# 권덕규의 공부 노트

반도체·전자회로·신호 학습 노트와 교육용 OPC 시뮬레이터를 모은 정적 사이트입니다.

## 게시
KDG0001 계정에서 KDG0001.github.io 공개 저장소를 만든 뒤 이 폴더의 **내용물**을 저장소 루트에 넣습니다. Settings → Pages → Deploy from a branch → main → /(root)를 선택합니다. 실제 사이트 URL은 Pages 설정 화면에서 확인하세요. 검색 노출은 Google이 결정하며 즉시 보장되지 않습니다.

## 주요 파일
- index.html: 첫 화면
- assets/: 스타일, 검색 필터, 검증 그림
- notes/: 기초 학습 노트 4개
- projects/opc/: OPC 시뮬레이터
- downloads/: 사용 설명서, 논문 작성 가이드, 실행 HTML과 개발 검증 지표
- sitemap.xml, robots.txt, .nojekyll: 검색·게시 설정

## 로컬 실행
Python이 설치된 PC에서 이 폴더를 열고 `python -m http.server 8000`을 실행한 뒤 브라우저로 http://localhost:8000 을 엽니다. 개별 시뮬레이터는 downloads/OPC_Lab_Standalone.html 파일로도 사용할 수 있습니다.

## 수정
notes의 기존 HTML을 복사하여 내용을 작성하고 index.html의 목록과 sitemap.xml에 링크를 추가합니다. 사용자명이 바뀌면 canonical 주소, robots.txt와 sitemap.xml도 수정합니다.

## 검증과 한계
OPC의 수치는 교육용 Gaussian 광량 합산 모델의 실행값입니다. 실제 공정 예측 정확도나 사용자가 직접 수행한 실험을 뜻하지 않습니다. 계산 결과를 논문에 쓰기 전에 조건과 수치를 직접 확인하세요. APK는 이 패키지에 포함되어 있지 않습니다.

계정 비밀번호, 토큰, 학번과 성적표 등 공개할 필요가 없는 개인 자료를 저장소에 넣지 않습니다. 공개할 권한이 있는 노트와 코드만 관리하세요.
