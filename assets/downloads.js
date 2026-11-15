(() => {
  'use strict';
  const repository = 'KDG0001/KDG0001.github.io';
  const sharedPrefix = 'downloads/shared/';
  const folderUrl = `https://github.com/${repository}/tree/main/downloads/shared`;
  const list = document.getElementById('resource-list');
  const search = document.getElementById('file-search');
  const filters = [...document.querySelectorAll('[data-file-filter]')];
  const refresh = document.getElementById('refresh-files');
  const loadStatus = document.getElementById('load-status');
  const downloadStatus = document.getElementById('download-status');
  const fileCount = document.getElementById('file-count');
  const noFiles = document.getElementById('no-files');
  let activeFilter = 'all';
  let busy = false;

  const encodePath = path => path.split('/').map(encodeURIComponent).join('/');
  const normalize = value => value.normalize('NFC').toLocaleLowerCase('ko');
  const fileGroup = name => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['hwp', 'hwpx', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'document';
    if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'presentation';
    return 'other';
  };
  const formatSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  function applyFilters() {
    const rows = [...list.querySelectorAll('.resource-row')];
    const query = normalize(search.value.trim());
    let visible = 0;
    for (const row of rows) {
      row.hidden = !(activeFilter === 'all' || row.dataset.group === activeFilter)
        || !normalize(row.querySelector('.resource-copy').textContent).includes(query);
      if (!row.hidden) visible++;
    }
    fileCount.textContent = `전체 ${rows.length}개 · 표시 ${visible}개`;
    noFiles.hidden = visible !== 0;
  }

  function sourceLink(text, href) {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function createRow(file) {
    const name = file.path.split('/').pop();
    const relative = file.path.slice(sharedPrefix.length);
    const rawUrl = `https://raw.githubusercontent.com/${repository}/main/${encodePath(file.path)}`;
    const row = document.createElement('article');
    row.className = 'resource-row';
    row.dataset.shared = 'true';
    row.dataset.group = fileGroup(name);
    const badge = document.createElement('span');
    badge.className = 'file-badge';
    badge.textContent = name.includes('.') ? name.split('.').pop().slice(0, 10).toUpperCase() : 'FILE';
    const copy = document.createElement('div');
    copy.className = 'resource-copy';
    const heading = document.createElement('h3');
    heading.textContent = name;
    const detail = document.createElement('p');
    detail.textContent = relative.includes('/') ? relative : '새로 올린 공부 자료';
    const metadata = document.createElement('small');
    metadata.textContent = `추가 자료 · ${formatSize(file.size)}`;
    copy.append(heading, detail, metadata);
    const download = document.createElement('a');
    download.className = 'file-download';
    download.href = rawUrl;
    download.download = name;
    download.textContent = '다운로드 ↓';
    download.setAttribute('aria-label', `${name} 다운로드`);
    download.addEventListener('click', async event => {
      event.preventDefault();
      if (download.getAttribute('aria-disabled') === 'true') return;
      download.setAttribute('aria-disabled', 'true');
      download.textContent = '받는 중…';
      downloadStatus.textContent = `${name} 파일을 준비하고 있습니다.`;
      try {
        // The public raw URL is available as soon as the file is committed,
        // including while GitHub Pages is still rebuilding.
        const response = await fetch(rawUrl, {signal: AbortSignal.timeout(90000)});
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        downloadStatus.textContent = `${name} 다운로드를 시작했습니다.`;
      } catch {
        downloadStatus.replaceChildren(document.createTextNode('다운로드를 시작하지 못했습니다. '), sourceLink('파일을 직접 열어 저장하기 ↗', rawUrl));
      } finally {
        download.removeAttribute('aria-disabled');
        download.textContent = '다운로드 ↓';
      }
    });
    row.append(badge, copy, download);
    return row;
  }

  async function loadSharedFiles() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    loadStatus.textContent = '새로 올린 자료를 불러오는 중입니다.';
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/git/trees/main?recursive=1`, {
        headers: {Accept: 'application/vnd.github+json'},
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Listing failed: ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.tree) || payload.truncated) throw new Error('Incomplete listing');
      const files = payload.tree.filter(file => {
        if (file.type !== 'blob' || !['100644', '100755'].includes(file.mode)
          || typeof file.path !== 'string' || !file.path.startsWith(sharedPrefix)
          || !Number.isFinite(file.size) || file.size < 0) return false;
        const parts = file.path.slice(sharedPrefix.length).split('/');
        return parts.every(part => part && !part.startsWith('.'))
          && normalize(parts.at(-1)) !== 'readme.md';
      }).sort((a, b) => a.path.localeCompare(b.path, 'ko', {numeric: true}));
      const fragment = document.createDocumentFragment();
      for (const file of files) fragment.append(createRow(file));
      // Keep the previous list intact if a refresh fails.
      list.querySelectorAll('[data-shared]').forEach(row => row.remove());
      list.prepend(fragment);
      loadStatus.textContent = files.length ? `새로 올린 자료 ${files.length}개를 확인했습니다.` : '아직 새로 올린 자료가 없습니다. 기본 자료는 아래에서 내려받을 수 있습니다.';
      applyFilters();
    } catch {
      loadStatus.replaceChildren(document.createTextNode('추가 자료 목록을 불러오지 못했습니다. 잠시 후 새로고침하거나 '), sourceLink('공개 자료 폴더에서 확인해 주세요 ↗', folderUrl));
    } finally {
      refresh.disabled = false;
      busy = false;
    }
  }

  filters.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.fileFilter;
    filters.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    applyFilters();
  }));
  search.addEventListener('input', applyFilters);
  refresh.addEventListener('click', loadSharedFiles);
  document.querySelector('.upload-help-link').addEventListener('click', () => {
    document.getElementById('upload-help').open = true;
  });
  applyFilters();
  loadSharedFiles();
})();
