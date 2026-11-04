import {makeScene,optimize,validateConfig} from './model.js';
self.onmessage=async event=>{
  const {cellId,config,mask}=event.data;
  try {
    const cfg=validateConfig(config),scene=makeScene(cellId,cfg);
    const result=await optimize(scene,cfg,mask,row=>self.postMessage({type:'progress',row}));
    self.postMessage({type:'done',mask:result.mask,history:result.history,changes:result.changes});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
