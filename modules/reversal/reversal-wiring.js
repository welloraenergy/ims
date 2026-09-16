const $=id=>document.getElementById(id);

function isSuperadmin(){return String(window.IMS_ROLE||'').toLowerCase()==='superadmin';}

function openReversal(){
  if(window.IMSReversal?.show)return window.IMSReversal.show();
  alert('Correction module is still loading. Please try again.');
}

function installEntry(){
  if(!isSuperadmin())return;
  const app=$('appContent');
  if(!app||app.querySelector('[data-ims-reversal-entry="1"]'))return;
  if(app.querySelector('#revMoveSearch,#deleteLookupValue'))return;
  const workspace=app.querySelector('[data-ims-workspace-module]');
  if(!workspace)return;
  const wrap=document.createElement('div');
  wrap.dataset.imsReversalEntry='1';
  wrap.className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/60 bg-amber-950/20 px-3 py-2.5';
  wrap.innerHTML='<div><div class="text-xs font-bold text-amber-300">Superadmin Correction</div><div class="text-[10px] text-slate-500">Central place for reversal, correction checks and untouched new-item deletion.</div></div><button type="button" class="bg-amber-700 hover:bg-amber-600 px-3 py-2 rounded-lg text-xs font-bold">Correction / Reversal</button>';
  wrap.querySelector('button').onclick=openReversal;
  workspace.prepend(wrap);
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(installEntry,40);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:reversal-ready',installEntry);
window.addEventListener('ims:workspace-rendered',installEntry);
installEntry();

window.IMSReversalWiring=Object.freeze({install:installEntry,open:openReversal});
window.dispatchEvent(new CustomEvent('ims:reversal-wiring-ready'));
export{installEntry,openReversal};