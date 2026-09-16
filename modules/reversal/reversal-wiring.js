const $=id=>document.getElementById(id);

function isSuperadmin(){return String(window.IMS_ROLE||'').toLowerCase()==='superadmin';}

const CONTEXTS=[
  {selector:'#bmAction',label:'Movement'},
  {selector:'#scAction',label:'Service Cycle'},
  {selector:'#incSave',label:'Incident'},
  {selector:'#dispSave',label:'Disposition'},
  {selector:'#registerForm',label:'Registration'},
  {selector:'#r2rForm',label:'Rent-to-Rent'},
  {selector:'#stockOverview,#stockDirectory,#stockInactive',label:'Stock Inventory'}
];

function currentContext(){return CONTEXTS.find(x=>document.querySelector(x.selector))||null;}

function openReversal(){
  if(window.IMSReversal?.show)return window.IMSReversal.show();
  const nav=document.querySelector('.navBtn[data-tab="reversal"]');
  nav?.click();
}

function installEntry(){
  if(!isSuperadmin())return;
  const app=$('appContent');
  if(!app||app.querySelector('[data-ims-reversal-entry="1"]'))return;
  if(app.querySelector('#revMoveSearch,#deleteLookupValue'))return;
  const ctx=currentContext();
  if(!ctx)return;
  const wrap=document.createElement('div');
  wrap.dataset.imsReversalEntry='1';
  wrap.className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2.5';
  wrap.innerHTML=`<div><div class="text-xs font-bold text-amber-300">Superadmin Correction</div><div class="text-[10px] text-slate-500">${ctx.label}: use the central Reversal module for reversal, new-item deletion and correction checks.</div></div><button type="button" class="bg-amber-700 hover:bg-amber-600 px-3 py-2 rounded-lg text-xs font-bold">Correction / Reversal</button>`;
  wrap.querySelector('button').onclick=openReversal;
  app.prepend(wrap);
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(installEntry,40);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:reversal-ready',installEntry);
window.addEventListener('ims:workspace-rendered',installEntry);
installEntry();

window.IMSReversalWiring=Object.freeze({install:installEntry,open:openReversal});
window.dispatchEvent(new CustomEvent('ims:reversal-wiring-ready'));
export{installEntry,openReversal};