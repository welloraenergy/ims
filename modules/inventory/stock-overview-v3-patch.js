import {db} from '../../firebase-config.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
let busy=false;

function removeNonLiveExceptions(){
  const root=document.getElementById('appContent');if(!root)return;
  root.querySelectorAll('[title]').forEach(el=>{const t=String(el.getAttribute('title')||'');if(/^Missing:|^Stolen:/.test(t))el.remove();});
  root.querySelectorAll('section').forEach(section=>{
    const title=norm(section.querySelector('h3')?.textContent);
    if(title==='operational status')section.querySelectorAll('.grid > div').forEach(row=>{const t=norm(row.textContent);if(t.startsWith('missing')||t.startsWith('stolen'))row.remove();});
    if(title==='needs attention')section.querySelectorAll('.space-y-2 > div').forEach(row=>{if(norm(row.textContent).startsWith('missing / stolen'))row.remove();});
  });
}

function groupKey(type){const t=norm(type);if(t.includes('warehouse'))return'warehouses';if(t.includes('client'))return'clients';if(t.includes('supplier'))return'suppliers';return'r2rOwners';}
function detailHtml(category,fields){
  const entries=Object.entries(fields||{}).map(([label,values])=>({label,values:Object.entries(values||{}).map(([name,qty])=>({name,qty:Number(qty||0)})).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name))})).filter(x=>x.values.length).sort((a,b)=>(a.label==='Size'?-1:b.label==='Size'?1:a.label.localeCompare(b.label)));
  return`<div id="stockDimensionDetail" class="mt-4 border-t border-slate-800 pt-4"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><div class="text-[10px] uppercase text-cyan-400">${esc(category)}</div><div class="font-bold">Size & useful labels</div><div class="text-[10px] text-slate-500">Only labels recorded for this category are shown.</div></div><button id="stockDimensionClose" class="bg-slate-800 px-3 py-2 rounded-lg text-xs">Close detail</button></div>${entries.length?`<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${entries.map(f=>`<section class="border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">${esc(f.label)}</div><div class="space-y-1.5">${f.values.map(v=>`<div class="flex items-center justify-between gap-3 text-xs"><span class="truncate">${esc(v.name)}</span><b>${v.qty}</b></div>`).join('')}</div></section>`).join('')}</div>`:'<div class="text-xs text-slate-500">No Size / Grade / PPF / Connection / Range / Brand / Type values are recorded for this category yet.</div>'}<div class="mt-3"><button id="stockOpenDirectoryFromDetail" class="bg-cyan-800 hover:bg-cyan-700 px-3 py-2 rounded-lg text-xs font-bold">Open this category in Item Directory</button></div></div>`;
}

async function openDimensionDetail(button){
  if(busy)return;busy=true;
  try{
    const section=button.closest('section'),category=button.dataset.category||'',type=section?.querySelector('.text-cyan-400')?.textContent||'',name=section?.querySelector('h3')?.textContent||'';
    if(!category||!name)return;
    const snap=await getDoc(doc(db,'inventory_summary','distribution'));if(!snap.exists())return;
    const groups=snap.data()?.[groupKey(type)]||{},group=Object.values(groups).find(x=>norm(x?.name)===norm(name));
    const fields=group?.categoryDimensions?.[category]||{};
    section.querySelector('#stockDimensionDetail')?.remove();
    section.insertAdjacentHTML('beforeend',detailHtml(category,fields));
    const close=section.querySelector('#stockDimensionClose');if(close)close.onclick=()=>section.querySelector('#stockDimensionDetail')?.remove();
    const original=button.onclick,open=section.querySelector('#stockOpenDirectoryFromDetail');if(open)open.onclick=()=>{if(typeof original==='function')original.call(button,new MouseEvent('click',{bubbles:false}));};
  }finally{busy=false;}
}

function installCategoryIntercept(){
  if(window.__IMS_STOCK_V3_INTERCEPT)return;window.__IMS_STOCK_V3_INTERCEPT=true;
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('.stockCategoryOpen');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();openDimensionDetail(b);
  },true);
}

function patch(){removeNonLiveExceptions();}
installCategoryIntercept();
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patch,30);}).observe(document.body,{childList:true,subtree:true});
patch();
