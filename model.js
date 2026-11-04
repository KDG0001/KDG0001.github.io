export const VERSION = '1.0.0';
export const DEFAULTS = Object.freeze({grid:1.75,sigma:4.2,dose:1,threshold:0.5,tone:'negative',padding:42,passes:14});
export const CELLS = Object.freeze({
  INV_X1:{name:'INV_X1',kind:'Inverter',width:63,height:189,linewidth:10.5,
    rects:[[0,0,63,10.5],[0,178.5,63,189],[10.5,10.5,21,73.5],[10.5,115.5,21,178.5],[42,63,52.5,126]]},
  NAND2_X4:{name:'NAND2_X4',kind:'2-input NAND',width:157.5,height:189,linewidth:10.5,
    rects:[[0,0,157.5,10.5],[0,178.5,157.5,189],[10.5,10.5,21,42],[73.5,10.5,84,42],[136.5,10.5,147,42],
      [42,21,52.5,84],[105,21,115.5,84],[42,73.5,115.5,84],[73.5,84,84,168],
      [10.5,105,21,178.5],[42,105,52.5,168],[105,105,115.5,168],[136.5,105,147,178.5]]}
});
export function validateConfig(input={}) {
  const c={...DEFAULTS,...input};
  for(const k of ['grid','sigma','dose','threshold','padding','passes']) if(!Number.isFinite(c[k]))throw Error('계산 조건에 유효하지 않은 값이 있습니다.');
  if(![3.5,1.75,0.875].includes(c.grid))throw Error('지원하지 않는 격자 간격입니다.');
  if(c.sigma<1.75||c.sigma>8.75)throw Error('Gaussian σ는 1.75–8.75 nm 범위입니다.');
  if(c.dose<0.5||c.dose>1.5||c.threshold<0.15||c.threshold>0.85)throw Error('노광량 또는 threshold가 허용 범위를 벗어났습니다.');
  if(!['negative','positive'].includes(c.tone))throw Error('PR 종류가 올바르지 않습니다.');
  c.padding=42;c.passes=Math.max(1,Math.min(30,Math.round(c.passes)));return c;
}
export function makeScene(cellId,cfg=DEFAULTS) {
  const c=validateConfig(cfg),cell=Object.hasOwn(CELLS,cellId)?CELLS[cellId]:null;if(!cell)throw Error('셀 이름을 확인하세요.');
  const nx=Math.round((cell.width+2*c.padding)/c.grid),ny=Math.round((cell.height+2*c.padding)/c.grid);
  const target=new Uint8Array(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const px=(x+.5)*c.grid-c.padding,py=(y+.5)*c.grid-c.padding;
    if(cell.rects.some(([x0,y0,x1,y1])=>px>=x0&&px<x1&&py>=y0&&py<y1))target[y*nx+x]=1;
  }
  return {cellId,cell,nx,ny,target,grid:c.grid,padding:c.padding,width:nx*c.grid,height:ny*c.grid};
}
export function initialMask(scene,cfg=DEFAULTS) {return Uint8Array.from(scene.target,x=>cfg.tone==='positive'?1-x:x);}
export function gaussian(cfg) {
  const radius=Math.ceil(3*cfg.sigma/cfg.grid),weights=new Float64Array(2*radius+1);let sum=0;
  for(let k=-radius;k<=radius;k++){const v=Math.exp(-.5*(k*cfg.grid/cfg.sigma)**2);weights[k+radius]=v;sum+=v;}
  for(let i=0;i<weights.length;i++)weights[i]/=sum;
  return {radius,weights};
}
export function convolve(values,nx,ny,kernel,pad=0) {
  const {radius:r,weights:w}=kernel,tmp=new Float64Array(nx*ny),out=new Float64Array(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    let v=0;for(let k=-r;k<=r;k++){const xx=x+k;v+=(xx<0||xx>=nx?pad:values[y*nx+xx])*w[k+r];}tmp[y*nx+x]=v;
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    let v=0;for(let k=-r;k<=r;k++){const yy=y+k;v+=(yy<0||yy>=ny?pad:tmp[yy*nx+x])*w[k+r];}out[y*nx+x]=v;
  }
  return out;
}
export function expose(scene,cfg,mask) {
  if(mask.length!==scene.target.length)throw Error('마스크 크기가 격자와 일치하지 않습니다.');
  const out=convolve(mask,scene.nx,scene.ny,gaussian(cfg),cfg.tone==='positive'?1:0);
  for(let i=0;i<out.length;i++)out[i]*=cfg.dose;return out;
}
export function develop(dose,cfg) {return Uint8Array.from(dose,v=>cfg.tone==='positive'?Number(v<cfg.threshold):Number(v>=cfg.threshold));}
export function metrics(target,printed,grid=1.75) {
  let tp=0,fp=0,fn=0,ta=0,pa=0;
  for(let i=0;i<target.length;i++){ta+=target[i];pa+=printed[i];if(target[i]&&printed[i])tp++;else if(printed[i])fp++;else if(target[i])fn++;}
  const union=tp+fp+fn;return {iou:union?tp/union:1,mismatchPixels:fp+fn,mismatchArea:(fp+fn)*grid*grid,
    missingArea:fn*grid*grid,excessArea:fp*grid*grid,targetArea:ta*grid*grid,printedArea:pa*grid*grid};
}
export function evaluate(scene,cfg,mask) {const dose=expose(scene,cfg,mask),printed=develop(dose,cfg);return {dose,printed,metrics:metrics(scene.target,printed,cfg.grid)};}
export function compare(scene,cfg,mask) {return {before:evaluate(scene,cfg,initialMask(scene,cfg)),after:evaluate(scene,cfg,mask)};}
export function morphMask(mask,nx,ny,mode,pad=0) {
  const out=mask.slice();for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    let v=mask[y*nx+x];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const xx=x+dx,yy=y+dy,a=xx<0||xx>=nx||yy<0||yy>=ny?pad:mask[yy*nx+xx];v=mode==='dilate'?Math.max(v,a):Math.min(v,a);
    }out[y*nx+x]=v;
  }return out;
}
function edge(mask,nx,ny,x,y) {
  const i=y*nx+x,v=mask[i];return x>0&&mask[i-1]!==v||x<nx-1&&mask[i+1]!==v||y>0&&mask[i-nx]!==v||y<ny-1&&mask[i+nx]!==v;
}
export async function optimize(scene,cfg,input,onProgress=()=>{}) {
  const mask=Uint8Array.from(input),{nx,ny,target}=scene,kernel=gaussian(cfg),{radius:r,weights:w}=kernel;
  const dose=expose(scene,cfg,mask),orient=cfg.tone==='positive'?-1:1,margin=.08*cfg.dose;
  const history=[];let changes=0;
  const kept=v=>cfg.tone==='positive'?v<cfg.threshold:v>=cfg.threshold;
  const loss=(v,t)=>{const h=Math.max(0,margin-(t?1:-1)*orient*(v-cfg.threshold));return h*h;};
  const snap=step=>{const printed=develop(dose,cfg),m=metrics(target,printed,cfg.grid);const row={step,changes,...m};history.push(row);return row;};
  onProgress(snap(0));
  for(let pass=1;pass<=cfg.passes;pass++) {
    const residual=new Float64Array(mask.length);
    for(let i=0;i<residual.length;i++){const sign=target[i]?1:-1,h=Math.max(0,margin-sign*orient*(dose[i]-cfg.threshold));residual[i]=-2*sign*orient*h;}
    const gradient=convolve(residual,nx,ny,kernel,0),candidates=[];
    for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++) {
      const i=y*nx+x;if(!edge(mask,nx,ny,x,y))continue;
      const predicted=(mask[i]?-1:1)*gradient[i];if(predicted<-1e-10)candidates.push({x,y,i,predicted});
    }
    candidates.sort((a,b)=>a.predicted-b.predicted||a.i-b.i);
    let accepted=0;
    for(const candidate of candidates.slice(0,Math.min(256,candidates.length))) {
      const {x,y,i}=candidate,delta=mask[i]?-1:1;let hardDelta=0,softDelta=0;
      for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=ny)continue;for(let dx=-r;dx<=r;dx++) {
        const xx=x+dx;if(xx<0||xx>=nx)continue;const j=yy*nx+xx,old=dose[j],v=old+delta*cfg.dose*w[dy+r]*w[dx+r];
        hardDelta+=Number(kept(v)!==Boolean(target[j]))-Number(kept(old)!==Boolean(target[j]));softDelta+=loss(v,target[j])-loss(old,target[j]);
      }}
      if(hardDelta<0||hardDelta===0&&softDelta<-1e-9) {
        mask[i]=1-mask[i];changes++;accepted++;
        for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=ny)continue;for(let dx=-r;dx<=r;dx++) {
          const xx=x+dx;if(xx>=0&&xx<nx)dose[yy*nx+xx]+=delta*cfg.dose*w[dy+r]*w[dx+r];
        }}
      }
      if(accepted>=32)break;
    }
    onProgress(snap(pass));if(!accepted||history.at(-1).mismatchPixels===0)break;
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {mask,history,changes,result:evaluate(scene,cfg,mask)};
}
export const MODEL_INFO={
  name:'Normalized Gaussian intensity-sum + threshold resist model',version:VERSION,layoutUnitNm:3.5,
  geometrySource:'2026 반도체제작기술 논문 설명서, 그림 3 (Metal1 teaching geometry)',
  convention:'Rectangles use [x0,y0,x1,y1), origin at cell top left; x right, y down; nm.',
  optics:'Separable 2D Gaussian; radius ceil(3 sigma / grid); discrete sum normalized to 1; no per-image peak normalization.',
  rationale:'A monotone isotropic Gaussian makes spatial spreading and overlap easy to inspect, and permits efficient separable convolution. Unit discrete sum preserves uniform-field exposure; approximately 3 sigma truncation bounds computation. Default sigma 4.2 nm is 0.4 times the 10.5 nm teaching linewidth, chosen to demonstrate distortion rather than calibrate a real optical system.',
  support:'K(i,j)=w(i)w(j), with |i|,|j|<=ceil(3 sigma/grid). Square support; outermost samples can exceed 3 sigma because of rounding. Layout lambda=3.5 nm is a geometry unit, not optical wavelength.',
  dose:'Dimensionless relative exposure. Mask=1 transmits, mask=0 blocks. Intensity multiplied by relative dose.',
  resist:'Negative: retained PR if I>=threshold. Positive: retained PR if I<threshold. Compare retained PR with target.',
  boundary:'42 nm padding. Beyond domain: transmission 0 for negative tone, 1 for positive tone.',
  optimizer:'Deterministic binary boundary-pixel flips. Candidate gradient from threshold-margin loss; accept only lower mismatch count or equal count with lower margin loss. No mask manufacturing constraints.',
  limitations:'Educational approximation; no phase interference, wavelength/NA calibration, focus, 3D resist chemistry, etch transfer, or mask-rule checking.'
};
