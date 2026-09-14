import { db } from './firebase-config.js';
import { collection, documentId, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const MAX_IN=30;
const refCache=new Map();
const itemCache=new Map();
let timer=null,running=false,lastKey='';

const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const norm=s=>String(s??'').trim().toLowerCase();

async function loadRefs(keys){
  const missing=uniq(keys).filter(k=>!refCache.has(k));
  for(let i=0;i<missing.length;i+=MAX_IN){
    const chunk=missing.slice(i,i+MAX_IN);if(!chunk.length)continue;
    const snap=await getDocs(query(collection(db,'document_refs'),where('commercialKey','in',chunk)));
    for(const d of snap.docs)refCache.set(d.data().commercialKey,{id:d.id,...d.data()});
  }
}

async function loadItems(ids){
  const missing=uniq(ids).filter(id=>!itemCache.has(id));
  for(let i=0;i<missing.length;i+=MAX_IN){
    const chunk=missing.slice(i,i+MAX_IN);if(!chunk.length)continue;
    const snap=await getDocs(query(collection(db,'inventory'),where(documentId(),'in',chunk)));
    for(const id of chunk)itemCache.set(id,null);
    for(const d of snap.docs)itemCache.set(d.id,{id:d.id,...d.data()});
  }
}

function atClient(item,businessId){
  const balances=Array.isArray(item?.stockBalances)?item.stockBalances:[];
  return balances.some(b=>Number(b.qty||0)>0&&b.status==='At Client'&&String(b.locationId||'')===String(businessId||''));
}

function metrics(ref){
  const linkedIds=uniq(ref?.linkedItemIds);
  const next=ref?.supersededByPOKey?refCache.get(ref.supersededByPOKey):null;
  const nextIds=new Set(uniq(next?.linkedItemIds));
  const extendedIds=linkedIds.filter(id=>nextIds.has(id));
  const currentIds=ref?.commercialSide==='client'
    ? linkedIds.filter(id=>atClient(itemCache.get(id),ref.businessId))
    : linkedIds.filter(id=>itemCache.get(id));
  const extended=new Set(extendedIds).size;
  const current=new Set(currentIds).size;
  const linked=linkedIds.length;
  const returned=Math.max(0,linked-extended-current);
  return{linked,extended,returned,current};
}

async function enhanceTable(){
  const table=document.querySelector('#docTable table');if(!table)return;
  const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelector('.openPO[data-key]'));
  const keys=rows.map(r=>r.querySelector('.openPO')?.dataset.key).filter(Boolean);
  if(!keys.length)return;
  await loadRefs(keys);
  await loadRefs(keys.map(k=>refCache.get(k)?.supersededByPOKey).filter(Boolean));
  const ids=[];for(const k of keys)ids.push(...uniq(refCache.get(k)?.linkedItemIds));
  await loadItems(ids);

  const heads=table.querySelectorAll('thead th');
  if(heads.length>=9){
    heads[5].textContent='Linked';
    heads[6].textContent='Extended';
    heads[7].textContent='Returned';
    // Insert Current before PO Total once, reusing the old layout by adding one cell.
    if(!table.querySelector('thead th[data-po-current]')){
      const th=document.createElement('th');th.dataset.poCurrent='1';th.className='p-2 text-right';th.textContent='Current';
      heads[8].before(th);
    }
  }

  for(const row of rows){
    const key=row.querySelector('.openPO')?.dataset.key,ref=refCache.get(key);if(!ref)continue;
    const m=metrics(ref),cells=[...row.children];if(cells.length<12)continue;
    cells[5].textContent=String(m.linked);
    cells[6].textContent=String(m.extended);
    cells[7].textContent=String(m.returned);
    let currentCell=row.querySelector('td[data-po-current]');
    if(!currentCell){currentCell=document.createElement('td');currentCell.dataset.poCurrent='1';currentCell.className='p-2 text-right';cells[8].before(currentCell);}
    currentCell.textContent=String(m.current);
    currentCell.title='Items still active under this PO, including items awaiting return';
  }
}

function findDetailRef(){
  if(lastKey&&refCache.has(lastKey))return refCache.get(lastKey);
  const detail=document.getElementById('docDetail');if(!detail)return null;
  const title=detail.querySelector('h2')?.textContent||'',po=title.replace(/^.*?PO\s+/i,'').trim();
  const business=(detail.querySelector('h2')?.nextElementSibling?.textContent||'').split('·')[0].trim();
  return[...refCache.values()].find(r=>norm(r.poNumber||r.refNumber)===norm(po)&&(!business||norm(r.businessName)===norm(business)))||null;
}

async function enhanceDetail(){
  const detail=document.getElementById('docDetail');if(!detail?.querySelector('section'))return;
  const ref=findDetailRef();
  if(ref){
    await loadRefs(ref.supersededByPOKey?[ref.supersededByPOKey]:[]);
    await loadItems(uniq(ref.linkedItemIds));
  }
  const fallbackLinked=detail.querySelectorAll('.openDocItem[data-id]').length;
  const m=ref?metrics(ref):{linked:fallbackLinked,extended:0,returned:0,current:fallbackLinked};

  // Keep the legacy input in the DOM for the existing save handler, but remove it from the UI.
  const expected=document.getElementById('docExpected');
  if(expected){expected.value=String(m.linked);expected.closest('label')?.classList.add('hidden');}

  let box=detail.querySelector('#poLifecycleMetrics');
  if(!box){
    box=document.createElement('div');box.id='poLifecycleMetrics';
    const header=detail.querySelector('section > div.flex');
    if(header?.nextSibling)header.parentNode.insertBefore(box,header.nextSibling);else detail.querySelector('section')?.prepend(box);
  }
  box.className='grid grid-cols-2 sm:grid-cols-4 gap-2';
  box.innerHTML=`
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center"><div class="text-lg font-bold">${m.linked}</div><div class="text-[10px] text-slate-500">Linked</div></div>
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center"><div class="text-lg font-bold">${m.extended}</div><div class="text-[10px] text-slate-500">Extended</div></div>
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center"><div class="text-lg font-bold">${m.returned}</div><div class="text-[10px] text-slate-500">Returned</div></div>
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center"><div class="text-lg font-bold">${m.current}</div><div class="text-[10px] text-slate-500">Current</div><div class="text-[9px] text-slate-600 mt-1">Active / awaiting return</div></div>`;

  detail.querySelector('#poHistoryMetrics')?.remove();
}

async function enhance(){
  if(running)return;running=true;
  try{await enhanceTable();await enhanceDetail();}
  catch(err){console.warn('IMS PO lifecycle metrics failed:',err);}
  finally{running=false;}
}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,60);}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('.openPO[data-key],.openCyclePO[data-key]');if(b?.dataset.key){lastKey=b.dataset.key;schedule();}
},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('ims:auth-ready',schedule);
window.addEventListener('ims:invoices-ready',schedule);
schedule();
