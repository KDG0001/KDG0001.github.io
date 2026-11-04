# 권덕규의 공부 사이트 게시하기

이 파일 묶음은 GitHub Pages 등 일반 정적 웹 호스팅에서 실행하는 사이트입니다. 사이트 방문자는 ChatGPT·GitHub 계정 로그인 없이 공부 노트와 OPC 시뮬레이터를 이용할 수 있습니다. 사이트를 관리하는 본인은 GitHub에 로그인해야 합니다.

이 묶음은 게시할 파일입니다. 실제 공개 사이트 주소의 발급·접속 검증은 아직 완료되지 않았습니다.

## 1. 저장소 만들기

1. GitHub에서 KDG0001 계정에 로그인합니다.
2. 오른쪽 위 + 메뉴 → New repository를 선택합니다.
3. Repository name은 KDG0001.github.io로 지정합니다.
4. Visibility는 Public을 선택하고 Add README를 켠 뒤 Create repository를 누릅니다.
5. ChatGPT의 GitHub 연결이 특정 저장소만 허용하는 설정이면 새 저장소를 연결 대상에 포함합니다. 이미 연결되어 있어도 새 저장소의 접근 권한은 별도로 필요할 수 있습니다.

저장소가 준비되고 연결에서 접근할 수 있으면 이 채팅에서 저장소 주소를 알려주세요. 파일 업로드를 이어서 진행할 수 있습니다.

## 2. 파일 올리기

1. ZIP을 PC에서 압축 해제합니다.
2. 저장소에서 Add file → Upload files를 선택합니다.
3. 압축 해제한 폴더의 **내용물**을 올립니다. 저장소 첫 화면에 index.html이 보여야 합니다. ZIP 하나만 올리거나 최상위 폴더를 한 겹 더 넣으면 첫 화면이 나오지 않을 수 있습니다.
4. 업로드가 끝나면 Commit changes로 저장합니다. 기존 README를 유지해도 실행에는 영향이 없습니다.

주요 경로:

- index.html: 공부 사이트 첫 화면
- assets/: 스타일·노트 검색·그림
- notes/: 공부 노트 4개
- projects/opc/: OPC Lab v1.1.0 시뮬레이터
- downloads/: 설명서·점검표·논문 가이드·단일 HTML·개발 검증값

## 3. Pages 활성화

저장소의 Settings → Pages → Build and deployment에서 Source를 Deploy from a branch로 선택합니다. Branch는 main, 폴더는 /(root)를 고르고 Save를 누릅니다.

배포가 완료되면 Pages 화면에 실제 공개 주소가 표시됩니다. 그 주소를 시크릿 창이나 다른 기기에서 열어 로그인 없이 접속되는지 확인합니다. 게시에는 시간이 걸릴 수 있습니다. 최종 제출 링크는 실제 열린 주소로 확인합니다.

기본 주소 형식은 https://kdg0001.github.io/이고, OPC 경로는 /projects/opc/입니다. 이 문서의 주소는 목표 게시 주소이며 배포 완료를 뜻하지 않습니다.

## 4. 게시 후 확인

1. 첫 화면의 공부 노트와 검색·분야 필터가 열리는지 확인합니다.
2. OPC 시뮬레이터 열기 → 두 셀 자동 비교를 실행합니다.
3. 기본 조건(격자 1.75 nm, sigma 4.2 nm, dose 1, threshold 0.5, Negative, 14회)에서 개발 확인값과 비교합니다. 불일치 면적: INV 275.625 → 12.25 nm², NAND 637 → 70.4375 nm². 논문에는 본인이 실행·저장한 값을 씁니다.
4. PNG·CSV·JSON·과제 보고서 저장과 JSON 복원을 확인합니다.
5. PDF 설명서와 코드 다운로드가 열리는지 확인합니다.

실험은 방문자의 브라우저에서 계산하고 저장합니다. 다른 기기나 다른 사이트 주소로 자동 동기화되지 않으므로 JSON으로 옮깁니다. 홈 화면에 추가한 앱의 오프라인 실행은 보장하지 않습니다.

## 5. 내 도메인과 검색

GitHub 기본 주소로 먼저 게시할 수 있습니다. 보유한 도메인이 있으면 Pages의 Custom domain과 도메인 업체 DNS를 설정해 연결할 수 있습니다. 도메인 등록 비용은 별도입니다. 이 묶음의 canonical·robots.txt·sitemap.xml은 위 기본 주소를 기준으로 작성했습니다. 다른 주소로 게시하면 함께 수정합니다.

검색 허용 메타 태그·사이트맵을 포함했지만 Google 검색 노출 시점이나 순위는 보장하지 않습니다.

## 동봉 PDF의 공개 상태 설명

OPC 사용 설명서와 요구사항 점검표에 적힌 소유자 접근용 온라인 도구는 앞서 만든 기존 사이트의 상태를 설명합니다. 이 묶음은 일반 웹 호스팅용으로 별도 준비했으며 ChatGPT 로그인 요구 안내를 제거했습니다. 게시 완료 후 최종 논문에는 새 사이트에서 검증한 실제 링크를 적습니다.

## 공식 문서

- GitHub Pages 개요: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- 사이트 만들기: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- 게시 소스 설정: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- 도메인 연결: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
