function showConnectivity(){
  let bar=document.getElementById('imsOfflineBar');
  if(navigator.onLine){bar?.remove();return;}
  if(bar)return;
  bar=document.createElement('div');
  bar.id='imsOfflineBar';
  bar.style.cssText='position:fixed;inset:0 0 auto 0;z-index:99999;background:#991b1b;color:#fff;padding:10px 14px;text-align:center;font:600 12px system-ui,sans-serif;box-shadow:0 2px 8px #0008';
  bar.textContent='IMS requires an internet connection. Reconnect to continue.';
  document.body.appendChild(bar);
}

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('IMS service worker registration failed:',err));
    showConnectivity();
  });
}
window.addEventListener('online',showConnectivity);
window.addEventListener('offline',showConnectivity);
