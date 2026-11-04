// Keep installation independent from the numerical model and experiment format.
const installOpen=document.getElementById('install-open');
const installDialog=document.getElementById('install-dialog');
const installNative=document.getElementById('install-native');
const installMessage=document.getElementById('install-message');
const standalone=window.matchMedia('(display-mode: standalone)');
let deferredPrompt=null,installed=false;

function updateInstallation(){
  const runningAsApp=standalone.matches||window.navigator.standalone===true;
  installOpen.hidden=runningAsApp;
  document.getElementById('installed-badge').hidden=!runningAsApp;
  installNative.hidden=!deferredPrompt||installed||runningAsApp;
  installOpen.textContent=installed?'설치 안내':'앱 설치';
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredPrompt=event;
  updateInstallation();
});
window.addEventListener('appinstalled',()=>{
  installed=true;
  deferredPrompt=null;
  updateInstallation();
  installMessage.textContent='설치가 완료되었습니다. 홈 화면이나 앱 목록에서 OPC Lab을 열어보세요.';
});
standalone.addEventListener('change',updateInstallation);
installOpen.addEventListener('click',()=>installDialog.showModal());
document.getElementById('install-close').addEventListener('click',()=>installDialog.close());
installDialog.addEventListener('click',event=>{
  if(event.target!==installDialog)return;
  const rect=installDialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)installDialog.close();
});
installNative.addEventListener('click',async()=>{
  const prompt=deferredPrompt;
  if(!prompt)return;
  deferredPrompt=null;
  updateInstallation();
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    installMessage.textContent=choice.outcome==='accepted'
      ?'설치를 진행합니다. 완료되면 홈 화면이나 앱 목록에서 OPC Lab을 실행하세요.'
      :'설치를 취소했습니다. 원할 때 브라우저 메뉴에서 다시 설치할 수 있습니다.';
  }catch{
    installMessage.textContent='이 브라우저에서는 아래 안내에 따라 메뉴에서 설치하세요.';
  }
});
updateInstallation();
