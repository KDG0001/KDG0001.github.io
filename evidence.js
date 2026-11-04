import {CELLS,VERSION,MODEL_INFO,gaussian,initialMask} from './model.js';
export const APP_VERSION='1.1.0';
export const NOTE_FIELDS={linewidth:'선폭 변화',corners:'모서리 왜곡',lineEnds:'선 끝의 짧아짐',bridging:'패턴 사이 연결 여부',method:'선택한 보정 방법·판단 기준',effective:'효과적이었던 수정·발생한 문제',limitations:'남은 오차·모델과 알고리즘의 한계'};
export const DEV_FIELDS={tool:'사용한 AI 도구·활용 범위',requirements:'AI에 입력한 주요 요구사항',problem:'발생한 문제·원인',fix:'수정 과정',verification:'직접 실행·검증 방법과 결과'};
export const DEFAULT_DEVELOPMENT={
  tool:'ChatGPT (Codex): 요구사항 정리, HTML/JavaScript 생성·수정, 계산 검증 및 사용 안내 작성. 작성자는 코드·설명·인용문헌과 제출 수치를 확인한다.',
  requirements:'목표·보정 전후 마스크, 2차원 노광량, 임계값 현상, 마스크 수정·재계산, 목표와의 비교, 조건·결과 내보내기를 요청함. 추가로 2026 반도체제작기술 설명서의 배경·과제 수행 조건을 전부 대조하고 빠진 항목 수정 및 사용법 정리를 요청함. (요청 요약)',
  problem:'2026-11-04 점검: 기존 계산과 저장 기능은 있었으나 네 종류 왜곡의 관찰 기록, AI 개발 기록, 모델 선정 근거 및 계산 영역을 한 결과물에 모으기 어려웠음. 조건 입력 후 실행 전에는 화면 결과와 입력값을 혼동할 수 있었음. 새 모델 요약 기능의 브라우저 검사에서 중심 가중치 변수 이름 오류로 초기 표시가 중단됨을 발견함.',
  fix:'v1.1.0: 보정 전 마스크·오차 지도를 상시 표시. 계산 영역·Gaussian 적용 범위·선정 근거 표시, 셀별 분석 기록, AI 개발 기록, 전체 과제 보고서 내보내기 추가. 미적용 조건 안내 및 조건이 바뀐 관찰 기록의 구분 추가. 중심 가중치 변수를 수정하고 모델 설명·결과 직렬화 검사를 추가함.',
  verification:'2026-11-04 개발 검증: 수치 모델·기록 내보내기 관련 Node 검사 8개 통과. Chrome에서 두 셀 자동 보정, 수동 확장·되돌리기, 조건 미적용 표시, 이전 조건의 기록 구분, JSON 저장·불러오기, HTML 보고서·CSV·PNG 다운로드를 직접 확인함. 기본 불일치 면적 INV 275.625→12.25 nm², NAND 637→70.4375 nm². 자세한 개발 검증 기록은 함께 제공한 요구사항 점검표를 참고한다. 아래에 본인이 직접 실행한 날짜, 기기·브라우저, 조건, 두 셀의 수치, 오류 및 재검증 결과를 추가한다. 개발자가 얻은 예시 수치를 본인의 실행 결과로 기재하지 않는다.'
};
export const cleanText=v=>typeof v==='string'?v.slice(0,12000):'';
export function cleanFields(value,fields){return Object.fromEntries(Object.keys(fields).map(k=>[k,cleanText(value?.[k])]));}
export const physicsStamp=c=>JSON.stringify(['grid','sigma','dose','threshold','tone','padding'].map(k=>c[k]));
export function describeConditions(scene,cfg){
  const {radius,weights}=gaussian(cfg);
  return {gridNm:cfg.grid,cellWidthNm:scene.cell.width,cellHeightNm:scene.cell.height,
    domain:{xMinNm:-scene.padding,xMaxNm:scene.cell.width+scene.padding,yMinNm:-scene.padding,yMaxNm:scene.cell.height+scene.padding,widthNm:scene.width,heightNm:scene.height,nx:scene.nx,ny:scene.ny},
    gaussian:{sigmaNm:cfg.sigma,radiusPixels:radius,halfWidthNm:radius*cfg.grid,sidePixels:2*radius+1,support:'square, inclusive integer offsets -r..r on each axis',sum2D:weights.reduce((a,b)=>a+b,0)**2,centerWeight:weights[radius]**2,normalized:true,peakRenormalized:false},
    exposureUnit:'dimensionless relative exposure',relativeDose:cfg.dose,threshold:cfg.threshold,tone:cfg.tone,
    retainedPR:cfg.tone==='negative'?'I >= threshold':'I < threshold',outsideTransmission:cfg.tone==='positive'?1:0,
    baseline:cfg.tone==='negative'?'mask = target':'mask = 1 - target (positive-tone supplementary experiment)'};
}
export function experimentData(config,active,sessions,development){
  const data={format:'opc-lab-experiment',version:VERSION,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),config:{...config},active,model:MODEL_INFO,development:{...development},sessions:{}};
  for(const id of Object.keys(CELLS)){
    const s=sessions[id];if(!s)throw Error('두 셀 계산 결과를 먼저 준비하세요.');
    data.sessions[id]={mask:Array.from(s.mask),baselineMask:Array.from(initialMask(s.scene,config)),kind:s.kind,history:s.history,actions:s.actions,
      notes:cleanFields(s.notes,NOTE_FIELDS),noteConditions:s.noteConditions||null,notesMatchCurrentConditions:!s.noteConditions||s.noteConditions===physicsStamp(config),
      geometry:CELLS[id],conditions:describeConditions(s.scene,config),nx:s.scene.nx,ny:s.scene.ny,target:Array.from(s.scene.target)};
    for(const stage of ['before','after']){const result=s.comparison[stage];data.sessions[id][stage]={metrics:result.metrics,dose:Array.from(result.dose),printed:Array.from(result.printed)};}
  }
  return data;
}
