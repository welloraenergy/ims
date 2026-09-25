import {db} from './firebase-config.js';
import {collection,doc,getDoc,getDocs,limit,query,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const DAY=86400000;
const CLOSED=new Set(['Extended / Superseded','Cancelled','Closed']);
let refs=[],loading=false,lastLoad=0;

function localDate(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function dayNumber(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const[y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)/DAY;}
function dueState(due,status='Open'){
  if(!due||CLOSED.has(status))return null;
  const today=dayNumber(localDate()),target=dayNumber(due);
  if(today===null||target===null)return null;
  const days=target-today;
  if(days>7)return null;
  if(days<0)return{level:'overdue',days,label:`OVERDUE ${Math.abs(days)} DAY${Math.abs(days)===1?'':'S'}`,row:'border-red-500/90 bg-gradient-to-r from-red-950/80 via-red-950/50 to-slate-950 shadow-[inset_0_0_24px_rgba(239,68,68,.14)]',badge:'bg-red-600 text-white border-red-400',tone:'red'};
  if(days===0)return{level:'today',days,label:'DUE TODAY',row:'border-red-500/90 bg-gradient-to-r from-red-950/70 via-red-950/40 to-slate-950 shadow-[inset_0_0_22px_rgba(239,68,68,.12)]',badge:'bg-red-600 text-white border-red-400',tone:'red'};
  if(days<=3)return{level:'urgent',days,label:days===1?'DUE TOMORROW':`DUE IN ${days} DAYS`,row:'border-rose-500/80 bg-gradient-to-r from-rose-950/55 via-rose-950/25 to-slate-950',badge:'bg-rose-200 text-rose-950 border-rose-300',tone:'light-red'};
  return{level:'warning',days,label:`DUE IN ${days} DAYS`,row:'border-yellow-500/80 bg-gradient-to-r from-yellow-950/55 via-yellow-950/20 to-slate-950',badge:'bg-yellow-300 text-yellow-950 border-yellow-200',tone:'yellow'};
}
function badgeHtml(state,due,po=''){return`<span data-ims-due-badge class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${state.badge}">${state.label}${due?` · ${due}`:''}${po?` · PO ${po}`:''}</span>`;}
function cleanClasses(el){for(const c of [...el.classList])if(c.startsWith('border-red-')||c.startsWith('border-rose-')||c.startsWith('border-yellow-')||c.startsWith('bg-gradient-')||c.startsWith('from-red-')||c.startsWith('from-rose-')||c.startsWith('from-yellow-')||c.startsWith('via-red-')||c.startsWith('via-rose-')||c.startsWith('via-yellow-')||c.startsWith('to-slate-')||c.startsWith('shadow-['))el.classList.remove(c);}
function dueTextClass(state){return state.tone==='yellow'?'text-yellow-200':state.tone==='light-red'?'text-rose-200':'text-red-200';}
function dueBorderClass(state){return state.tone==='yellow'?'border-yellow-900/60':state.tone==='light-red'?'border-rose-900/60':'border-red-900/60';}
function dueCaptionClass(state){return state.tone==='yellow'?'text-yellow-200/80':state.tone==='light-red'?'text-rose-200/80':'text-red-200/80';}
function positiveBalances(i){return(Array.isArray(i?.stockBalances)?i.stockBalances:[]).filter(b=>Number(b.qty||0)>0);}
async function currentClientHolds(itemId){const s=await getDoc(doc(db,'inventory',itemId));if(!s.exists())return[];return positiveBalances(s.data()).filter(b=>b.locationType==='client'&&['At Client','Not Available'].includes(b.status));}

async function loadRefs(force=false){
  if(loading)return refs;
  if(!force&&Date.now()-lastLoad<30000)return refs;
  loading=true;
  try{
    const snap=await getDocs(query(collection(db,'document_refs'),where('commercialSide','==','client'),limit(200)));
    refs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.docType==='Commercial PO'&&r.periodTo&&!CLOSED.has(r.poStatus||'Open'));
    lastLoad=Date.now();
    return refs;
  }finally{loading=false;}
}
function mostUrgentFromRefs(itemId,holds){
  const matches=refs.filter(r=>Array.isArray(r.linkedItemIds)&&r.linkedItemIds.includes(itemId)&&holds.some(b=>String(b.locationId||'')===String(r.businessId||''))).map(r=>({po:r.poNumber||r.refNumber||'',due:r.periodTo,status:r.poStatus||'Open',businessId:r.businessId||'',state:dueState(r.periodTo,r.poStatus||'Open')})).filter(x=>x.state);
  matches.sort((a,b)=>a.state.days-b.state.days);
  return matches[0]||null;
}
async function movementDueForItem(itemId,holds){
  if(!holds.length)return null;
  const snap=await getDocs(query(collection(db,'movements'),where('itemId','==',itemId),where('action','==','DELIVER_CLIENT'),limit(25)));
  const rows=snap.docs.map(d=>d.data()).filter(m=>m.periodTo&&m.status==='arrived'&&holds.some(b=>String(b.locationId||'')===String(m.toId||m.destinationId||m.partyId||''))).map(m=>({po:m.referenceNumber||'',due:m.periodTo,status:'Open',createdAt:m.createdAt||'',state:dueState(m.periodTo,'Open')})).filter(x=>x.state).sort((a,b)=>a.state.days-b.state.days||String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows[0]||null;
}
function decorateDocuments(){
  const table=document.querySelector('#docTable table');if(!table)return;
  const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase()),dueIndex=headers.findIndex(x=>x==='due date'),statusIndex=headers.findIndex(x=>x==='status');
  if(dueIndex<0)return;
  for(const tr of table.querySelectorAll('tbody tr')){
    const cells=[...tr.children];if(cells.length<=dueIndex)continue;
    tr.querySelectorAll('[data-ims-due-badge]').forEach(x=>x.remove());cleanClasses(tr);cells[dueIndex]?.classList.remove('text-red-200','text-rose-200','text-yellow-200','font-bold');
    const due=cells[dueIndex]?.textContent.trim()||'',status=statusIndex>=0?cells[statusIndex]?.textContent.replace(/^DUE\s*·\s*/i,'').trim():'Open',state=dueState(due,status);if(!state)continue;
    tr.classList.add(...state.row.split(' '));cells[dueIndex].classList.add(dueTextClass(state),'font-bold');cells[dueIndex].insertAdjacentHTML('beforeend',`<div class="mt-1">${badgeHtml(state,'','')}</div>`);
    const action=tr.querySelector('.openPO');if(action){action.classList.remove('bg-slate-700','bg-red-600','bg-red-800','bg-rose-700','bg-yellow-700');action.classList.add(state.tone==='yellow'?'bg-yellow-700':state.tone==='light-red'?'bg-rose-700':'bg-red-600');action.textContent=state.tone==='yellow'?'Review':'Act Now';}
  }
}
async function decorateAtClient(){
  const root=document.querySelector('[data-workspace-queue="client"]');if(!root)return;
  for(const card of root.querySelectorAll('.workspaceOpenItem[data-id]')){
    card.querySelectorAll('[data-ims-due-strip]').forEach(x=>x.remove());cleanClasses(card);
    const holds=await currentClientHolds(card.dataset.id);if(!holds.length)continue;
    let hit=mostUrgentFromRefs(card.dataset.id,holds);if(!hit)hit=await movementDueForItem(card.dataset.id,holds);if(!hit)continue;
    const{state,due,po}=hit;card.classList.add(...state.row.split(' '));card.insertAdjacentHTML('beforeend',`<div data-ims-due-strip class="mt-3 pt-2 border-t ${dueBorderClass(state)} flex flex-wrap items-center justify-between gap-2"><div>${badgeHtml(state,due,po)}</div><div class="text-[10px] ${dueCaptionClass(state)}">Client PO due warning</div></div>`);
  }
}
async function refresh(force=false){try{await loadRefs(force);decorateDocuments();await decorateAtClient();}catch(e){console.error('IMS client due warning failed:',e);}}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>refresh(false),80);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:workspace-rendered',()=>refresh(true));window.addEventListener('ims:modules-ready',()=>refresh(true));refresh(true);
window.IMSDueWarning=Object.freeze({refresh,dueState});
export{refresh,dueState};