import {db} from '../../firebase-config.js';
import {collection,getCountFromServer,getDocs,limit,query,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let loading=false;

function inactiveView(){const b=$('stockInactive');return Boolean(b&&String(b.className||'').includes('bg-red-600'));}

async function install(){
  const app=$('appContent');
  if(!app||!inactiveView()||app.querySelector('[data-ims-deactivated-list="1"]')||loading)return;
  loading=true;
  const section=document.createElement('section');
  section.dataset.imsDeactivatedList='1';
  section.className='mt-5 bg-slate-900 border border-slate-800 rounded-2xl p-4';
  section.innerHTML='<div class="text-sm text-slate-500">Loading deactivated items…</div>';
  app.appendChild(section);
  try{
    const base=query(collection(db,'inventory'),where('status','==','Inactive'));
    const [snap,countSnap]=await Promise.all([getDocs(query(base,limit(100))),getCountFromServer(base)]);
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    section.innerHTML=`<div class="flex flex-wrap justify-between gap-2 mb-3"><div><h3 class="font-bold">Deactivated Items</h3><div class="text-[10px] text-slate-500">Preserved after reversal/correction · excluded from live stock</div></div><div class="text-xs text-slate-500">${countSnap.data().count||0} item(s)</div></div><div class="space-y-2">${rows.map(i=>`<div class="border border-slate-800 rounded-xl p-3"><div class="flex flex-wrap justify-between gap-2"><div><b class="text-cyan-300">${esc(i.alias||i.itemCode||i.id)}</b> · ${esc(i.name||'')}<div class="text-[10px] font-mono text-slate-600">${esc(i.itemCode||i.id)}</div></div><span class="text-xs text-slate-500">Inactive</span></div><div class="text-xs text-slate-500 mt-1">Last location: ${esc(i.currentLocation||'—')} · ${esc(i.deactivationReason||'No deactivation remark')}</div></div>`).join('')||'<div class="text-sm text-slate-500">No deactivated items.</div>'}</div>${rows.length===100?'<div class="text-[10px] text-slate-600 mt-3">Showing first 100 deactivated items.</div>':''}`;
  }catch(e){section.innerHTML=`<div class="text-sm text-amber-300">Unable to load deactivated items: ${esc(e?.message||e)}</div>`;}
  finally{loading=false;}
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>install().catch(()=>{}),60);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:modules-ready',()=>install().catch(()=>{}));
install().catch(()=>{});
window.IMSInventoryDeactivated=Object.freeze({install});
export{install};