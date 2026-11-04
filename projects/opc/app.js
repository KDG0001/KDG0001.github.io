import {VERSION,DEFAULTS,CELLS,MODEL_INFO,validateConfig,makeScene,initialMask,compare,morphMask} from './model.js';
import {APP_VERSION,NOTE_FIELDS,DEV_FIELDS,DEFAULT_DEVELOPMENT,cleanFields,physicsStamp,describeConditions,experimentData} from './evidence.js';
let development={...DEFAULT_DEVELOPMENT};
const $=id=>document.getElementById(id), $$=s=>Array.from(document.querySelectorAll(s));
const KEY='opc-lab-2026-v1';let config={...DEFAULTS},active='INV_X1',sessions={},brush='view',maskView='current',worker=null,busy=false,cancelled=false,paint=false,paintChanged=false,toastTimer,restored=false;
const fmt=(v,d=1)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d});
const percentage=v=>(100*v).toFixed(2)+'%';
function action(session,message){session.actions.push({time:new Date().toISOString(),message});session.actions=session.actions.slice(-120);}
function ensure(id){
  if(!sessions[id]){const scene=makeScene(id,config);sessions[id]={scene,mask:initialMask(scene,config),undo:[],history:[],actions:[],kind:'초기',notes:{},noteConditions:null};action(sessions[id],'목표 형상과 초기 마스크 생성');}
  if(!sessions[id].comparison)sessions[id].comparison=compare(sessions[id].scene,config,sessions[id].mask);
  return sessions[id];
}
function recalc(id){const s=ensure(id);s.comparison=compare(s.scene,config,s.mask);return s;}
function stash(s){s.undo.push(s.mask.slice());if(s.undo.length>25)s.undo.shift();}
function status(message,type=''){ $('status-text').textContent=message;$('status').className='status-bar '+type; }
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
function save(){
  try {localStorage.setItem(KEY,JSON.stringify({config,active,development,sessions:Object.fromEntries(Object.entries(sessions).map(([id,s])=>[id,{mask:Array.from(s.mask),history:s.history,actions:s.actions,kind:s.kind,notes:s.notes,noteConditions:s.noteConditions}]))}));$('save-state').textContent='브라우저에 자동 저장됨';}
  catch{$('save-state').textContent='JSON으로 결과를 저장하세요';}
}
function hydrate(data){
  if(!data||typeof data!=='object')throw Error('실험 파일 형식을 확인하세요.');
  const cfg=validateConfig(data.config),next={};
  for(const [id,entry] of Object.entries(data.sessions||{})){
    if(!Object.hasOwn(CELLS,id))continue;
    const scene=makeScene(id,cfg),mask=entry.mask;
    if(!Array.isArray(mask)||mask.length!==scene.target.length||mask.some(v=>v!==0&&v!==1))throw Error(id+' 마스크 데이터가 올바르지 않습니다.');
    const actions=Array.isArray(entry.actions)?entry.actions.filter(a=>a&&typeof a.time==='string'&&typeof a.message==='string').slice(-120):[];
    const history=Array.isArray(entry.history)?entry.history.filter(h=>h&&Number.isFinite(h.step)&&Number.isFinite(h.mismatchArea)).slice(0,60):[];
    next[id]={scene,mask:Uint8Array.from(mask),undo:[],actions,history,kind:['초기','수동','자동'].includes(entry.kind)?entry.kind:'수동',notes:cleanFields(entry.notes,NOTE_FIELDS),noteConditions:typeof entry.noteConditions==='string'?entry.noteConditions:null};
  }
  config=cfg;sessions=next;development=data.development?cleanFields(data.development,DEV_FIELDS):{...DEFAULT_DEVELOPMENT};active=Object.hasOwn(CELLS,data.active)?data.active:'INV_X1';ensure(active);
}
try{const stored=localStorage.getItem(KEY);if(stored){hydrate(JSON.parse(stored));restored=true;}}catch{config={...DEFAULTS};sessions={};}
function syncFields(){for(const k of ['grid','sigma','dose','tone','threshold','passes'])$(k).value=config[k];$('threshold-value').textContent=config.threshold.toFixed(2);$('tone-note').textContent=config.tone==='negative'?'노광량 ≥ threshold인 영역에 PR이 남습니다.':'노광량 < threshold인 영역에 PR이 남습니다.';}
const heatStops=[[239,245,251],[140,174,218],[77,104,189],[106,63,143],[235,155,77]];
function heat(v){const t=Math.max(0,Math.min(1,v/1.5))*(heatStops.length-1),i=Math.min(heatStops.length-2,Math.floor(t)),f=t-i;return heatStops[i].map((x,k)=>Math.round(x+(heatStops[i+1][k]-x)*f));}
function renderPlot(canvas,scene,values,kind,outline=true,dimensions={}){
  const width=Math.max(180,dimensions.width||canvas.clientWidth||400),height=dimensions.height||canvas.clientHeight||276,dpr=dimensions.dpr||Math.min(3,window.devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  const scale=Math.min((width-64)/scene.width,(height-45)/scene.height),pw=scene.width*scale,ph=scene.height*scale,ox=42+(width-64-pw)/2,oy=10+(height-45-ph)/2;
  canvas.plot={ox,oy,scale,scene};
  const off=document.createElement('canvas');off.width=scene.nx;off.height=scene.ny;const oc=off.getContext('2d'),img=oc.createImageData(scene.nx,scene.ny);
  const colors=kind==='target'?[[244,247,251],[49,107,226]]:kind==='mask'?[[248,250,253],[23,47,82]]:[[244,248,248],[21,146,134]];
  const errorColors=[[244,248,248],[21,146,134],[217,91,115],[224,157,54]];
  for(let i=0;i<values.length;i++){const c=kind==='dose'?heat(values[i]):kind==='error'?errorColors[values[i]]:colors[values[i]?1:0];img.data[4*i]=c[0];img.data[4*i+1]=c[1];img.data[4*i+2]=c[2];img.data[4*i+3]=255;}
  oc.putImageData(img,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(off,ox,oy,pw,ph);
  ctx.save();ctx.strokeStyle='rgba(123,147,178,0.13)';ctx.lineWidth=.65;
  const xtick=scene.cell.width<=63?31.5:63,ytick=63;
  for(let x=0;x<=scene.cell.width+.01;x+=xtick){const xx=ox+(x+scene.padding)*scale;ctx.beginPath();ctx.moveTo(xx,oy);ctx.lineTo(xx,oy+ph);ctx.stroke();}
  for(let y=0;y<=189.01;y+=ytick){const yy=oy+(y+scene.padding)*scale;ctx.beginPath();ctx.moveTo(ox,yy);ctx.lineTo(ox+pw,yy);ctx.stroke();}ctx.restore();
  if(outline){ctx.save();ctx.strokeStyle='#d45b73';ctx.lineWidth=.85;ctx.beginPath();const t=scene.target,nx=scene.nx,ny=scene.ny,gs=scene.grid*scale;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(t[y*nx+x]){
      const xx=ox+x*gs,yy=oy+y*gs;
      if(x===0||!t[y*nx+x-1]){ctx.moveTo(xx,yy);ctx.lineTo(xx,yy+gs);}
      if(x===nx-1||!t[y*nx+x+1]){ctx.moveTo(xx+gs,yy);ctx.lineTo(xx+gs,yy+gs);}
      if(y===0||!t[(y-1)*nx+x]){ctx.moveTo(xx,yy);ctx.lineTo(xx+gs,yy);}
      if(y===ny-1||!t[(y+1)*nx+x]){ctx.moveTo(xx,yy+gs);ctx.lineTo(xx+gs,yy+gs);}
    }ctx.stroke();ctx.restore();
  }
  ctx.strokeStyle='#dce5ef';ctx.lineWidth=.75;ctx.strokeRect(ox,oy,pw,ph);ctx.fillStyle='#7b8da5';ctx.font='9px system-ui';ctx.textAlign='center';
  for(let x=0;x<=scene.cell.width+.01;x+=xtick)ctx.fillText(fmt(x),ox+(x+scene.padding)*scale,oy+ph+14);
  ctx.textAlign='right';for(let y=0;y<=189.01;y+=ytick)ctx.fillText(fmt(y),ox-7,oy+(y+scene.padding)*scale+3);
  ctx.textAlign='center';ctx.fillText('x (nm)',ox+pw/2,oy+ph+28);ctx.save();ctx.translate(Math.max(12,ox-31),oy+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('y (nm)',0,0);ctx.restore();
}
function drawPlots(){
  const s=ensure(active),{scene,comparison:c}=s;
  renderPlot($('target-canvas'),scene,scene.target,'target',false);
  renderPlot($('mask-before-canvas'),scene,initialMask(scene,config),'mask');
  const errors=Uint8Array.from(scene.target,(t,i)=>t?(c.after.printed[i]?1:2):(c.after.printed[i]?3:0));
  renderPlot($('error-canvas'),scene,errors,'error');
  renderPlot($('mask-canvas'),scene,maskView==='before'?initialMask(scene,config):s.mask,'mask');
  renderPlot($('dose-before-canvas'),scene,c.before.dose,'dose');renderPlot($('dose-after-canvas'),scene,c.after.dose,'dose');
  renderPlot($('print-before-canvas'),scene,c.before.printed,'print');renderPlot($('print-after-canvas'),scene,c.after.printed,'print');
  $('mask-canvas').classList.toggle('editing',brush!=='view'&&maskView==='current'&&!busy);
}
function historyChart(){
  const s=ensure(active),rows=s.history;
  if(rows.length<2){$('history-chart').innerHTML='<p class="empty-note">자동 보정을 실행하면 오차 변화를 표시합니다.</p>';return;}
  const w=550,h=190,l=57,r=17,t=23,b=37,max=Math.max(...rows.map(x=>x.mismatchArea),1)*1.1,last=Math.max(...rows.map(x=>x.step),1);
  const points=rows.map(x=>(l+x.step/last*(w-l-r))+','+(t+(1-x.mismatchArea/max)*(h-t-b))).join(' ');
  const lines=[0,.5,1].map(k=>{const y=t+(1-k)*(h-t-b);return `<line x1="${l}" y1="${y}" x2="${w-r}" y2="${y}" stroke="#e8edf4"/><text x="${l-8}" y="${y+4}" text-anchor="end">${fmt(max*k,0)}</text>`;}).join('');
  $('history-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="자동 보정 반복별 불일치 면적"><title>불일치 면적 변화 (nm²)</title><text x="${l}" y="12">불일치 면적 (nm²)</text>${lines}<polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="2"/><text x="${l}" y="${h-17}">0</text><text x="${w-r}" y="${h-17}" text-anchor="end">${last}</text><text x="${w/2}" y="${h-3}" text-anchor="middle">반복 횟수</text></svg>`;
}
function render(){
  const s=ensure(active),c=s.comparison,before=c.before.metrics,after=c.after.metrics,delta=before.mismatchArea?(before.mismatchArea-after.mismatchArea)/before.mismatchArea:0;
  $('current-cell').textContent=active;$('scene-info').textContent=`Metal1 · ${config.grid} nm / 칸 · ${s.scene.nx} × ${s.scene.ny} 격자`;
  $('iou-after').textContent=percentage(after.iou);$('iou-before').textContent='보정 전 '+percentage(before.iou);
  $('area-after').textContent=fmt(after.mismatchArea,2);$('area-before').textContent='보정 전 '+fmt(before.mismatchArea,2)+' nm²';
  $('improvement').textContent=(delta>=0?'':'−')+fmt(Math.abs(delta)*100,1)+'%';$('improvement').className=delta>0?'positive-value':delta<0?'negative-value':'';
  const init=initialMask(s.scene,config);let diff=0;for(let i=0;i<init.length;i++)if(init[i]!==s.mask[i])diff++;$('changed-pixels').textContent=fmt(diff,0);
  $('missing-excess').textContent=`누락 ${fmt(after.missingArea)} · 과잉 ${fmt(after.excessArea)} nm²`;
  $('undo').disabled=busy||!s.undo.length;
  $$('[data-cell]').forEach(el=>{const selected=el.dataset.cell===active;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',selected);});
  $$('[data-mask-view]').forEach(el=>{const selected=el.dataset.maskView===maskView;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',selected);});
  $$('[data-brush]').forEach(el=>{const selected=el.dataset.brush===brush;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',selected);});
  drawPlots();historyChart();renderLog();renderTable();renderEvidence();
  $('print-after-canvas').setAttribute('aria-label',`현재 현상 후 PR 패턴. IoU ${percentage(after.iou)}, 불일치 면적 ${fmt(after.mismatchArea,2)} nm²`);
}
function renderTable(){
  const body=$('comparison-body');body.replaceChildren();
  for(const id of Object.keys(CELLS)){
    const s=ensure(id),a=s.comparison.before.metrics,b=s.comparison.after.metrics,d=a.mismatchArea?(a.mismatchArea-b.mismatchArea)/a.mismatchArea*100:0;
    const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.className='table-cell-link';button.textContent=id;button.onclick=()=>{if(!busy){active=id;render();save();$('current-cell').scrollIntoView({behavior:'smooth',block:'start'});}};td.appendChild(button);tr.appendChild(td);
    for(const text of [s.kind,percentage(a.iou)+' → '+percentage(b.iou),fmt(a.mismatchArea,2)+' → '+fmt(b.mismatchArea,2),fmt(d,1)+'%']){const cell=document.createElement('td');cell.textContent=text;tr.appendChild(cell);}body.appendChild(tr);
  }
}
function renderLog(){const list=$('action-log');list.replaceChildren();for(const row of ensure(active).actions.slice(-10).reverse()){const li=document.createElement('li'),time=document.createElement('time');time.textContent=new Date(row.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Seoul'});li.append(time,document.createTextNode(row.message));list.append(li);}}
function edited(message){const s=ensure(active);s.kind='수동';s.history=[];action(s,message);recalc(active);maskView='current';render();save();status(message);}
function applyConditions(){
  const next=validateConfig({grid:Number($('grid').value),sigma:Number($('sigma').value),dose:Number($('dose').value),threshold:Number($('threshold').value),tone:$('tone').value,passes:Number($('passes').value)});
  const gridChanged=next.grid!==config.grid,toneChanged=next.tone!==config.tone,physicsChanged=['grid','sigma','dose','threshold','tone'].some(k=>next[k]!==config[k]);config=next;
  if(gridChanged){for(const id of Object.keys(sessions)){const s=sessions[id],scene=makeScene(id,config);s.scene=scene;s.mask=initialMask(scene,config);s.undo=[];s.history=[];s.kind='초기';action(s,'격자 간격 변경: 초기 마스크로 다시 생성');s.comparison=null;}}
  else if(physicsChanged)for(const s of Object.values(sessions)){if(toneChanged){s.mask=Uint8Array.from(s.mask,x=>1-x);s.undo=s.undo.map(mask=>Uint8Array.from(mask,x=>1-x));}s.history=[];s.comparison=null;}
  const s=ensure(active);action(s,`조건 적용: Δ=${config.grid} nm, σ=${config.sigma} nm, dose=${config.dose}, threshold=${config.threshold}, ${config.tone} PR`);
  syncFields();render();save();status(gridChanged?'격자가 바뀌어 두 셀의 마스크를 초기화하고 다시 계산했습니다.':'같은 조건으로 보정 전후를 다시 계산했습니다.');
}
function setBusy(value){busy=value;for(const el of [...$$('#conditions input, #conditions select'),...$$('[data-cell], [data-brush], #passes, #auto-correct, #batch-run, #simulate, #grow, #shrink, #reset, #undo, #import-open, #export-png, #export-csv, #export-json, #export-report, #export-log')])el.disabled=value;$('cancel').hidden=!value;$('auto-correct').textContent=value?'보정 계산 중…':'자동 보정';$('mask-canvas').classList.toggle('editing',!value&&brush!=='view'&&maskView==='current');if(!value)$('undo').disabled=!ensure(active).undo.length;}
function workerOptimize(id,mask){return new Promise((resolve,reject)=>{
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>{const d=e.data;if(d.type==='progress'){status(`${id} · ${d.row.step}회 · 불일치 ${fmt(d.row.mismatchArea,2)} nm²`,'busy');}
    else if(d.type==='done'){worker.terminate();worker=null;resolve(d);}else if(d.type==='error'){worker.terminate();worker=null;reject(Error(d.message));}};
  worker.onerror=e=>{worker?.terminate();worker=null;reject(Error(e.message||'보정 계산을 시작하지 못했습니다. 페이지를 새로고침해 주세요.'));};
  worker.cancel=()=>{worker.terminate();worker=null;const err=Error('계산을 중지했습니다.');err.name='AbortError';reject(err);};worker.postMessage({cellId:id,config,mask});
});}
async function runCorrection(batch=false){
  if(busy)return;
  try{applyConditions();setBusy(true);cancelled=false;
    const ids=batch?Object.keys(CELLS):[active];
    for(const id of ids){if(cancelled)break;const s=ensure(id),start=batch?initialMask(s.scene,config):s.mask.slice(),result=await workerOptimize(id,start);stash(s);s.mask=Uint8Array.from(result.mask);s.history=result.history;s.kind='자동';s.comparison=null;action(s,`자동 보정: ${result.history.length-1}회, ${result.changes}회 격자 변경 채택${batch?' · 초기 마스크부터 비교':''}`);recalc(id);}
    render();save();status(batch?'두 셀의 자동 비교를 마쳤습니다. 표와 CSV에서 결과를 확인하세요.':'자동 보정을 마쳤습니다. 현상 후 패턴과 목표 경계를 비교해보세요.');
  }catch(error){status(error.message,error.name==='AbortError'?'':'error');}
  finally{setBusy(false);render();}
}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function pendingConditions(){return ['grid','sigma','dose','threshold','tone','passes'].some(k=>k==='tone'?$(k).value!==config[k]:Number($(k).value)!==config[k]);}
function showPendingConditions(){
  const pending=pendingConditions();$('pending-conditions').hidden=!pending;
  for(const id of ['export-png','export-csv','export-json','export-report','export-log'])$(id).disabled=busy||pending;
}
function initEvidence(){
  const makeFields=(container,fields,prefix)=>{for(const [key,label] of Object.entries(fields)){
    const l=document.createElement('label');l.className='field';l.textContent=label;
    const area=document.createElement('textarea');area.id=prefix+key;area.rows=3;area.maxLength=12000;
    area.placeholder=prefix==='note-'?'관찰 위치·보정 전 → 후·근거를 직접 기록하세요.':'본인의 대화와 검증 내용을 보완하세요.';
    l.append(area);$(container).append(l);
    area.addEventListener('input',()=>{
      if(prefix==='note-'){const s=ensure(active);s.notes[key]=area.value;if(!s.noteConditions)s.noteConditions=physicsStamp(config);}
      else development[key]=area.value;
      save();renderNoteStatus();
    });
  }};
  makeFields('observation-fields',NOTE_FIELDS,'note-');makeFields('development-fields',DEV_FIELDS,'dev-');
  $('notes-confirm').onclick=()=>{ensure(active).noteConditions=physicsStamp(config);save();renderNoteStatus();toast('관찰 기록의 조건을 현재 조건으로 확인했습니다.');};
  $('passes').addEventListener('change',showPendingConditions);
  $('export-report').onclick=exportAssignmentReport;
}
function renderNoteStatus(){
  const s=ensure(active),stale=s.noteConditions&&s.noteConditions!==physicsStamp(config);
  $('notes-status').textContent=stale?'조건이 변경되었습니다. 이전 기록을 검토하고 아래 확인 버튼으로 갱신하세요.':'현재 셀의 직접 관찰 기록입니다. 수동 수정·자동 보정 후 내용을 확인하세요.';
  $('notes-status').classList.toggle('stale-note',Boolean(stale));$('notes-confirm').hidden=!stale;
}
function renderEvidence(){
  const s=ensure(active),d=describeConditions(s.scene,config),g=d.gaussian,domain=d.domain;
  $('notes-cell-name').textContent=active;
  $('applied-model').textContent=`적용 조건: Δ ${config.grid} nm · σ ${config.sigma} nm · dose ${config.dose} · threshold ${config.threshold} · ${config.tone} PR`;
  $('domain-description').textContent=`${active}: 셀 ${s.scene.cell.width} × 189 nm, 계산 영역 ${domain.widthNm} × ${domain.heightNm} nm (${domain.nx} × ${domain.ny}칸). x = ${domain.xMinNm} … ${domain.xMaxNm} nm, y = ${domain.yMinNm} … ${domain.yMaxNm} nm. 사방 여백 42 nm.`;
  $('kernel-description').textContent=`K(i,j) = w(i)w(j), w(i) ∝ exp[−(iΔ)²/(2σ²)]. 각 축 ±${g.radiusPixels}칸 (±${g.halfWidthNm} nm), ${g.sidePixels} × ${g.sidePixels} 정사각 지지 영역. 이산 가중치 합 = ${g.sum2D.toFixed(10)}. 중심 가중치 ${g.centerWeight.toFixed(6)}. 이미지별 최대값 재정규화 없음.`;
  for(const key of Object.keys(NOTE_FIELDS))$('note-'+key).value=s.notes?.[key]||'';
  for(const key of Object.keys(DEV_FIELDS))$('dev-'+key).value=development[key]||'';
  renderNoteStatus();showPendingConditions();
}
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reportPanels(s){
  const r=s.comparison,errors=Uint8Array.from(s.scene.target,(t,i)=>t?(r.after.printed[i]?1:2):(r.after.printed[i]?3:0));
  return [['목표 Metal1',s.scene.target,'target',false],['보정 후 불일치 지도',errors,'error',true],['보정 전 마스크',initialMask(s.scene,config),'mask',true],['현재 마스크',s.mask,'mask',true],['보정 전 노광',r.before.dose,'dose',true],['현재 노광',r.after.dose,'dose',true],['보정 전 현상·목표 중첩',r.before.printed,'print',true],['현재 현상·목표 중첩',r.after.printed,'print',true]].map(([label,values,kind,outline])=>{
    const canvas=document.createElement('canvas');renderPlot(canvas,s.scene,values,kind,outline,{width:520,height:400,dpr:1.5});
    return `<figure><figcaption>${label}</figcaption><img alt="${label}" src="${canvas.toDataURL('image/png')}"></figure>`;
  }).join('');
}
function exportAssignmentReport(){
  if(busy||pendingConditions())return;
  let content=`<h1>OPC 과제 실행·분석 기록</h1><p>OPC Lab ${APP_VERSION} · ${escapeHTML(new Date().toISOString())}</p><p>이 파일은 실제 현재 계산값과 작성한 기록을 모은 보조 자료입니다. 빈 관찰란을 작성하고 게재논문양식에 맞춘 논문 PDF와 접속 가능한 앱 링크를 별도로 제출하세요.</p><h2>배경·대상</h2><p>빛의 공간적 퍼짐과 인접 패턴의 노광 중첩은 선폭 변화, 모서리 둥글어짐, 선 끝 단축, 패턴 간 연결을 유발할 수 있습니다. OPC는 목표 패턴에 가까운 현상 결과를 얻도록 마스크를 미리 수정합니다. 대상은 INV_X1 및 NAND2_X4의 Metal1만입니다.</p><h2>모델·조건·선정 근거</h2><p>격자 ${config.grid} nm, σ ${config.sigma} nm, 상대 dose ${config.dose}, threshold ${config.threshold}, ${config.tone} PR, 최대 ${config.passes}회 탐색. I = dose × (M ∗ K). Negative: I ≥ threshold 유지, I &lt; threshold 제거. Positive: I &lt; threshold 유지, I ≥ threshold 제거. Mask=1 투과, 0 차단. 남은 PR을 목표 Metal1 형상과 비교하며 식각·금속 전사는 계산하지 않습니다.</p><p>Gaussian은 중심에서 멀어질수록 감소하며 각 투과 격자의 기여를 합산합니다. 분리 가능한 2차원 Gaussian을 사용해 계산을 단순화했습니다. 이산 합을 1로 정규화하면 균일 투과 영역의 노광량이 상대 dose와 같아지고 전체 투과량 기준이 일정해집니다. 약 3σ 절단은 계산량을 제한합니다. 기본 σ=4.2 nm는 선폭의 0.4배로 왜곡 관찰을 위해 선택한 교육용 값이며 실제 장비 보정값이 아닙니다. 기본 Negative PR에서는 초기 마스크=목표, Positive에서는 초기 마스크=목표 반전인 별도 조건 실험입니다. λ=3.5 nm는 레이아웃 길이 단위입니다.</p><p>IoU=교집합/합집합. 불일치 면적=(누락 칸+과잉 칸)Δ². 감소율=(A전−A후)/A전×100%. A전=0이면 비율 대신 절대 오차를 해석합니다. 두 셀 및 전후에 동일한 기준을 적용합니다. 오차는 여백을 포함한 전체 계산 영역에서 계산합니다.</p><p>자동 보정은 마스크 경계의 이진 격자 반전으로 탐색하며, 실제 불일치 칸 수가 감소하거나 같은 수에서 threshold 여유 손실이 감소할 때 채택합니다. 반복당 후보 최대 256개, 채택 최대 32회; 개선 후보가 없거나 오차 0이면 종료합니다. 수동 브러시로 경계 이동·선 끝 확장·모서리 또는 보조 영역 추가·제거 후 재계산할 수 있습니다. 조건 변화 실험은 다른 파일로 저장해 OPC 효과와 구분합니다.</p>`;
  for(const id of Object.keys(CELLS)){
    const s=ensure(id),r=s.comparison,d=describeConditions(s.scene,config),b=r.before.metrics,a=r.after.metrics,rows=[['IoU',b.iou,a.iou],['불일치 면적 (nm²)',b.mismatchArea,a.mismatchArea],['누락 면적 (nm²)',b.missingArea,a.missingArea],['과잉 면적 (nm²)',b.excessArea,a.excessArea]];
    content+=`<section class="cell"><h2>${id}</h2><p>상태: ${escapeHTML(s.kind)}. 셀 ${s.scene.cell.width} × 189 nm, 공통 선폭 10.5 nm. 계산 영역 ${d.domain.widthNm} × ${d.domain.heightNm} nm (${d.domain.nx} × ${d.domain.ny}칸), x −42 … ${d.domain.xMaxNm}, y −42 … 231 nm. 좌상단 (0,0), x 오른쪽, y 아래. Gaussian 각 축 ±${d.gaussian.halfWidthNm} nm / ±${d.gaussian.radiusPixels}칸, ${d.gaussian.sidePixels} × ${d.gaussian.sidePixels} 가중치, 합 ${d.gaussian.sum2D.toFixed(10)}. 영역 밖 투과율 ${d.outsideTransmission}.</p><table><tr><th>지표</th><th>보정 전</th><th>현재</th></tr>${rows.map(row=>'<tr>'+row.map(v=>'<td>'+escapeHTML(v)+'</td>').join('')+'</tr>').join('')}</table><p>불일치 면적 감소율: ${b.mismatchArea?fmt((b.mismatchArea-a.mismatchArea)/b.mismatchArea*100,3)+'%':'정의하지 않음 (초기 오차 0)'}. 노광 색상 공통 0 … 1.5, 무차원 상대값. 분홍 실선=목표 경계. 오차 지도: 청록=일치, 분홍=누락, 주황=과잉.</p><div class="plots">${reportPanels(s)}</div><h3>직접 관찰·분석</h3><p>${s.noteConditions&&s.noteConditions!==physicsStamp(config)?'주의: 아래 기록은 이전 조건입니다. 현재 수치와 함께 해석하기 전에 검토하세요.':'현재 셀의 기록. 실제 전후 그림을 확인하고 내용을 검증하세요.'}</p><p>기록 조건 서명: ${escapeHTML(s.noteConditions||'미작성')}</p>${Object.entries(NOTE_FIELDS).map(([key,label])=>'<h4>'+label+'</h4><p class="note">'+escapeHTML(s.notes?.[key]||'[직접 관찰 후 작성]')+'</p>').join('')}<details><summary>채택된 보정 과정·실행 이력</summary><pre>${escapeHTML(JSON.stringify(s.history,null,2))}</pre><ul>${s.actions.map(x=>'<li>'+escapeHTML(x.time+' '+x.message)+'</li>').join('')}</ul></details></section>`;
  }
  content+='<h2>AI 개발·문제 해결·검증 기록</h2>'+Object.entries(DEV_FIELDS).map(([key,label])=>'<h3>'+label+'</h3><p class="note">'+escapeHTML(development[key]||'[직접 작성]')+'</p>').join('')+'<h2>모델·알고리즘 한계</h2><p>이 도구는 광량 합산의 교육용 근사이며 위상·간섭, 파장/NA/초점, 3차원 PR 화학반응, 식각, 마스크 제작 규칙을 직접 계산하지 않습니다. 격자 해상도·threshold·국소 경계 탐색에 따라 잔여 오차가 남으며 전역 최적해를 보장하지 않습니다. 최종 논문에서 실제 그림과 수치로 남은 오차의 위치와 원인을 설명하세요.</p><h2>제출 확인</h2><ul><li>두 셀의 모든 전후 그림·중첩·정량 지표·관찰 및 잔여 오차 분석</li><li>AI 주요 요구·문제·수정·본인의 직접 검증, 참고문헌 사실 확인</li><li>게재논문양식.hwp에 맞춘 학번_이름.pdf</li><li>평가자가 접속할 수 있는 앱 온라인 링크 (기기 안 HTML 파일만으로 대체되지 않음)</li></ul>';
  const html='<!doctype html><html lang="ko"><meta charset="utf-8"><title>OPC 과제 실행 기록</title><style>body{font:15px/1.7 sans-serif;max-width:1080px;margin:35px auto;padding:0 22px;color:#18222c}h1{font-size:26px}h2{margin-top:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}.plots{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}figcaption{font-weight:bold}img{width:100%}.note,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font-size:11px}@media print{body{font-size:10pt;margin:0}.cell{break-before:page}figure,table{break-inside:avoid}details{display:block}.plots{gap:5px}}@media(max-width:600px){.plots{grid-template-columns:1fr}}</style><body>'+content+'</body></html>';
  download(new Blob([html],{type:'text/html;charset=utf-8'}),'OPC_assignment_report.html');toast('두 셀의 그림·조건·수치·작성 기록을 저장했습니다.');
}
function exportJSON(){
  for(const id of Object.keys(CELLS))ensure(id);
  const data=experimentData(config,active,sessions,development);
  download(new Blob([JSON.stringify(data)],{type:'application/json'}),'OPC_experiment.json');toast('조건·마스크·계산 결과·기록을 저장했습니다.');
}
function exportCSV(){
  const header=['layout','state','grid_nm','sigma_nm','relative_dose','threshold','PR_tone','IoU','mismatch_nm2','missing_nm2','excess_nm2','target_nm2','printed_nm2','mismatch_pixels','area_reduction_percent'];const rows=[header];
  for(const id of Object.keys(CELLS)){const s=ensure(id),b=s.comparison.before.metrics;for(const stage of ['before','after']){const m=s.comparison[stage].metrics;rows.push([id,stage,config.grid,config.sigma,config.dose,config.threshold,config.tone,m.iou,m.mismatchArea,m.missingArea,m.excessArea,m.targetArea,m.printedArea,m.mismatchPixels,stage==='after'&&b.mismatchArea?(b.mismatchArea-m.mismatchArea)/b.mismatchArea*100:0]);}}
  download(new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'OPC_metrics.csv');toast('두 셀의 보정 전후 수치를 저장했습니다.');
}
function exportLog(){
  let text=`# OPC Lab 실행 기록\n\nVersion: ${APP_VERSION}\n\n## AI 개발 기록 (직접 실행 기록과 구분)\n\n${Object.entries(DEV_FIELDS).map(([k,label])=>'### '+label+'\n\n'+development[k]).join('\n\n')}\n\n## 계산 모델\n\n${Object.entries(MODEL_INFO).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\n## 현재 조건\n\n${JSON.stringify(config,null,2)}\n`;
  for(const id of Object.keys(CELLS)){const s=ensure(id);text+=`\n## ${id}\n\n${s.actions.map(x=>`- ${x.time}: ${x.message}`).join('\n')}\n\n분석 기록의 조건 일치: ${!s.noteConditions||s.noteConditions===physicsStamp(config)}\n\n${Object.entries(NOTE_FIELDS).map(([k,label])=>'### '+label+'\n\n'+(s.notes?.[k]||'[직접 관찰 후 작성]')).join('\n\n')}\n\n보정 전 IoU: ${s.comparison.before.metrics.iou}\n\n현재 IoU: ${s.comparison.after.metrics.iou}\n`;}
  download(new Blob([text],{type:'text/markdown;charset=utf-8'}),'OPC_run_log.md');toast('실제 실행 기록을 저장했습니다.');
}
function exportPanel(id){const c=$(id+'-canvas');c.toBlob(blob=>blob&&download(blob,`${active}_${id}.png`),'image/png');}
function exportFigure(){
  const s=ensure(active),{scene,comparison:result}=s,c=document.createElement('canvas');c.width=1800;c.height=2860;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='#17263c';x.font='600 44px sans-serif';x.fillText(active+' · OPC comparison',60,74);x.font='23px sans-serif';x.fillStyle='#607089';x.fillText(`Grid ${config.grid} nm | sigma ${config.sigma} nm | dose ${config.dose} | threshold ${config.threshold} | ${config.tone} PR`,60,120);x.fillText(`IoU: ${percentage(result.before.metrics.iou)} -> ${percentage(result.after.metrics.iou)} | Mismatch: ${fmt(result.before.metrics.mismatchArea,2)} -> ${fmt(result.after.metrics.mismatchArea,2)} nm^2`,60,162);
  const errors=Uint8Array.from(scene.target,(t,i)=>t?(result.after.printed[i]?1:2):(result.after.printed[i]?3:0));
  const panels=[['Target Metal1',scene.target,'target',false],['After: matched and mismatched areas',errors,'error',true],['Before: transmission mask',initialMask(scene,config),'mask',true],['After: transmission mask',s.mask,'mask',true],['Before: exposure',result.before.dose,'dose',true],['After: exposure',result.after.dose,'dose',true],['Before: retained PR',result.before.printed,'print',true],['After: retained PR',result.after.printed,'print',true]];
  panels.forEach(([title,values,kind,outline],i)=>{const xx=60+(i%2)*865,yy=220+Math.floor(i/2)*630,src=document.createElement('canvas');renderPlot(src,scene,values,kind,outline,{width:815,height:580,dpr:2});x.fillStyle='#17263c';x.font='600 25px sans-serif';x.fillText(title,xx,yy);x.drawImage(src,xx,yy+20,815,580);});
  x.fillStyle='#607089';x.font='19px sans-serif';x.fillText('Error map: teal = match, rose = missing PR, amber = excess PR. Thin rose contour = target.',60,2750);x.fillText('Exposure scale: 0 to 1.5 (common scale). Dose is relative. Axes in nm.',60,2785);x.fillText('Educational Gaussian intensity-sum model; no phase interference or calibrated process prediction.',60,2820);c.toBlob(blob=>blob&&download(blob,`${active}_OPC_comparison.png`),'image/png');toast('목표·전후 마스크·노광·현상·오차 지도를 저장했습니다.');
}
function paintAt(event){
  const c=$('mask-canvas'),rect=c.getBoundingClientRect(),p=c.plot,s=ensure(active),gx=((event.clientX-rect.left-p.ox)/p.scale)/config.grid,gy=((event.clientY-rect.top-p.oy)/p.scale)/config.grid,r=Number($('brush-size').value),v=brush==='add'?1:0;
  const cx=Math.floor(gx),cy=Math.floor(gy);if(cx<0||cy<0||cx>=s.scene.nx||cy>=s.scene.ny)return;
  for(let y=cy-r+1;y<=cy+r-1;y++)for(let xx=cx-r+1;xx<=cx+r-1;xx++)if(xx>=0&&y>=0&&xx<s.scene.nx&&y<s.scene.ny&&(xx-cx)**2+(y-cy)**2<r*r){const i=y*s.scene.nx+xx;if(s.mask[i]!==v){s.mask[i]=v;paintChanged=true;}}
  renderPlot(c,s.scene,s.mask,'mask');
}
$('conditions').addEventListener('input',showPendingConditions);
$('conditions').addEventListener('change',showPendingConditions);
$('conditions').addEventListener('submit',e=>{e.preventDefault();if(busy)return;try{applyConditions();}catch(err){status(err.message,'error');}});
$('threshold').addEventListener('input',()=>$('threshold-value').textContent=Number($('threshold').value).toFixed(2));
$('tone').addEventListener('change',()=>$('tone-note').textContent=$('tone').value==='negative'?'노광량 ≥ threshold인 영역에 PR이 남습니다.':'노광량 < threshold인 영역에 PR이 남습니다.');
$$('[data-cell]').forEach(el=>el.addEventListener('click',()=>{if(busy)return;active=el.dataset.cell;maskView='current';render();save();status(active+'의 현재 결과를 표시합니다.');}));
$$('[data-brush]').forEach(el=>el.addEventListener('click',()=>{brush=el.dataset.brush;maskView='current';render();}));
$$('[data-mask-view]').forEach(el=>el.addEventListener('click',()=>{maskView=el.dataset.maskView;render();}));
$('auto-correct').onclick=()=>runCorrection(false);$('batch-run').onclick=()=>runCorrection(true);$('cancel').onclick=()=>{cancelled=true;worker?.cancel();};
for(const [id,mode] of [['grow','dilate'],['shrink','erode']])$(id).onclick=()=>{if(busy)return;const s=ensure(active);stash(s);s.mask=morphMask(s.mask,s.scene.nx,s.scene.ny,mode,config.tone==='positive'?1:0);edited('투과 영역 '+(mode==='dilate'?'확장':'축소')+': '+config.grid+' nm (1칸)');};
$('undo').onclick=()=>{const s=ensure(active);if(busy||!s.undo.length)return;s.mask=s.undo.pop();edited('이전 마스크로 되돌리기');};
$('reset').onclick=()=>{if(busy)return;const s=ensure(active);stash(s);s.mask=initialMask(s.scene,config);s.kind='초기';s.history=[];action(s,'초기 마스크로 복원');recalc(active);render();save();status('초기 마스크로 돌아갔습니다.');};
const maskCanvas=$('mask-canvas');
maskCanvas.addEventListener('pointerdown',e=>{if(brush==='view'||maskView!=='current'||busy||e.button!==0)return;e.preventDefault();paint=true;paintChanged=false;stash(ensure(active));maskCanvas.setPointerCapture(e.pointerId);paintAt(e);});
maskCanvas.addEventListener('pointermove',e=>{if(paint)paintAt(e);});
function finishPaint(){if(!paint)return;paint=false;if(paintChanged)edited('브러시로 마스크 '+(brush==='add'?'투과':'차단')+' 영역 수정');else ensure(active).undo.pop();}
maskCanvas.addEventListener('pointerup',finishPaint);maskCanvas.addEventListener('pointercancel',finishPaint);
$$('[data-png]').forEach(el=>el.onclick=()=>exportPanel(el.dataset.png));$('export-png').onclick=exportFigure;$('export-csv').onclick=exportCSV;$('export-json').onclick=exportJSON;$('export-log').onclick=exportLog;
$('import-open').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8e6)throw Error('실험 파일이 너무 큽니다 (최대 8 MB).');const data=JSON.parse(await file.text());if(data.format!=='opc-lab-experiment'||data.version!==VERSION)throw Error('이 버전의 OPC 실험 JSON을 선택하세요.');hydrate(data);syncFields();render();save();status('저장한 조건과 마스크를 불러와 다시 계산했습니다.');toast('실험을 불러왔습니다.');}catch(err){status(err.message,'error');}finally{e.target.value='';}};
for(const id of ['help-open','geometry-open'])$(id).onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('geometry-details').innerHTML=Object.entries(CELLS).map(([id,c])=>`<details><summary>${id} · ${c.width} × ${c.height} nm</summary><table class="geometry-table"><thead><tr><th>직사각형</th><th>x0</th><th>y0</th><th>x1</th><th>y1</th></tr></thead><tbody>${c.rects.map((r,i)=>'<tr><td>'+(i+1)+'</td>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')}</tbody></table></details>`).join('');
initEvidence();
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawPlots,70);}).observe($('workspace-heading')||document.querySelector('.workspace'));
syncFields();render();save();if(restored)status('이 브라우저에 저장된 조건과 마스크를 불러와 다시 계산했습니다.');
