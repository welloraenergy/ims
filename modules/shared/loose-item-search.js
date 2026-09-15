import {db} from '../../firebase-config.js';
import {collection,documentId,getDocs,limit,orderBy,query,startAfter} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const PAGE_SIZE=20,SCAN_SIZE=50,MAX_SCANS=40;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const balances=i=>(Array.isArray(i?.stockBalances)?i.stockBalances:[]).filter(b=>Number(b.qty||0)>0).map(b=>({...b,qty:Number(b.qty||0)}));
const selectedOption=e=>e?.selectedOptions?.[0]||null;
const sameLoc=(b,id,name)=>b&&((id&&String(b.locationId||'')===String(id))||norm(b.locationName)===norm(name));
let categoryCache=null;
const states=new Map();

async function categories(){
  if(categoryCache)return categoryCache;
  try{
    const snap=await getDocs(collection(db,'settings'));
    categoryCache=[...new Set(snap.docs.map(d=>d.data()).filter(x=>x.type==='category'&&x.status!=='inactive').map(x=>String(x.value||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }catch{categoryCache=[];}
  return categoryCache;
}

function movementAdapter(){
  if(!$('batchMoveForm')||!$('bmLookupField')||!$('bmLookupValue')||!$('bmFindItem')||!$('bmLines'))return null;
  return{
    id:'movement',anchor:$('bmLines'),exactField:$('bmLookupField'),exactInput:$('bmLookupValue'),exactButton:$('bmFindItem'),
    context(){const action=$('bmAction')?.value||'',src=$('bmSource'),o=selectedOption(src);return{action,sourceId:src?.value||'',sourceName:o?.dataset?.name||o?.textContent?.trim()||'',reservationId:$('bmReservation')?.value||''};},
    ready:c=>!!c.sourceId,
    selected:()=>new Set([...document.querySelectorAll('.bmLine')].map(r=>r.dataset.itemId).filter(Boolean)),
    eligible(i,c){
      if(c.action==='DELIVER_CLIENT'){
        if(i.activeReservation)return false;
        return balances(i).some(b=>sameLoc(b,c.sourceId,c.sourceName)&&b.locationType==='warehouse'&&b.status==='Available');
      }
      const map={RECEIVE_SUPPLIER:['supplier','At Supplier'],TRANSFER_WAREHOUSE:['warehouse','Available'],RETURN_CLIENT:['client','At Client']},rule=map[c.action];
      return!!rule&&balances(i).some(b=>sameLoc(b,c.sourceId,c.sourceName)&&b.locationType===rule[0]&&b.status===rule[1]);
    },
    add(i){const before=document.querySelectorAll('.bmLine').length;this.exactField.value=i.alias?'alias':'name';this.exactInput.value=i.alias||i.name||'';this.exactButton.click();return waitFor(()=>document.querySelectorAll('.bmLine').length>before,1800);}
  };
}

function serviceAdapter(){
  if(!$('serviceCycleWorkflow')||!$('scLookupField')||!$('scLookupValue')||!$('scFind')||!$('scLines'))return null;
  return{
    id:'service',anchor:$('scLines'),exactField:$('scLookupField'),exactInput:$('scLookupValue'),exactButton:$('scFind'),
    context(){const type=$('scSrcType')?.value||'warehouse',src=$('scSrc'),o=selectedOption(src);return{type,sourceId:src?.value||'',sourceName:o?.dataset?.name||o?.textContent?.trim()||''};},
    ready:c=>!!c.sourceId,
    selected:()=>new Set([...document.querySelectorAll('.scLine')].map(r=>r.dataset.id).filter(Boolean)),
    eligible(i,c){
      if(i.activeServiceCycleId)return false;
      return balances(i).some(b=>{
        if(!sameLoc(b,c.sourceId,c.sourceName))return false;
        if(c.type==='warehouse')return b.locationType==='warehouse'&&['Available','Not Available'].includes(b.status);
        if(c.type==='client')return b.locationType==='client'&&['At Client','Not Available'].includes(b.status);
        if(c.type==='supplier')return b.locationType==='supplier'&&['At Supplier','Not Available'].includes(b.status);
        return false;
      });
    },
    add(i){const before=document.querySelectorAll('.scLine').length;this.exactField.value=i.alias?'alias':'name';this.exactInput.value=i.alias||i.name||'';this.exactButton.click();return waitFor(()=>document.querySelectorAll('.scLine').length>before,1800);}
  };
}

function waitFor(test,ms){return new Promise(resolve=>{const started=Date.now(),tick=()=>{if(test())return resolve(true);if(Date.now()-started>=ms)return resolve(false);setTimeout(tick,60);};tick();});}
function stateFor(a){let s=states.get(a.id);if(!s){s={search:'',category:'',items:[],loading:false};states.set(a.id,s);}return s;}
function matches(i,s){if(s.category&&norm(i.category)!==norm(s.category))return false;const q=norm(s.search);if(!q)return true;return norm(i.alias).startsWith(q)||norm(i.itemCode).startsWith(q)||norm(i.r2rSerial||i.r2rSN||i.r2rSn).startsWith(q)||norm(i.name).includes(q);}
function panelId(a){return`imsLooseSearch-${a.id}`;}

async function ensurePanel(a){
  if(document.getElementById(panelId(a)))return;
  const exactGrid=a.exactButton.parentElement;if(!exactGrid)return;
  const panel=document.createElement('div');panel.id=panelId(a);panel.className='border border-cyan-900/40 rounded-xl p-3 space-y-3';
  panel.innerHTML=`<div><div class="font-semibold text-sm text-cyan-300">Loose Search</div><div class="text-[11px] text-slate-500">Optional. Prefix-search serial numbers (example: ABD-123-) or type part of a description. Exact Find & Add above remains unchanged.</div></div><div class="grid sm:grid-cols-[minmax(0,1fr)_220px_auto] gap-2 items-end"><label class="block text-xs text-slate-400">Search<input data-loose-input class="w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm mt-1" placeholder="SN prefix or description"></label><label class="block text-xs text-slate-400">Category<select data-loose-category class="w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm mt-1"><option value="">All Categories</option></select></label><button type="button" data-loose-search class="bg-cyan-700 hover:bg-cyan-600 px-4 py-2.5 rounded-lg text-xs font-bold">Loose Search</button></div><div data-loose-results class="text-xs text-slate-500">Enter a search or choose a category.</div>`;
  exactGrid.insertAdjacentElement('afterend',panel);
  const cat=panel.querySelector('[data-loose-category]');cat.innerHTML='<option value="">All Categories</option>'+((await categories()).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''));
  panel.querySelector('[data-loose-search]').onclick=()=>search(a);
  panel.querySelector('[data-loose-input]').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search(a);}};
  cat.onchange=()=>search(a);
}

async function search(a){
  const panel=$(panelId(a));if(!panel)return;const s=stateFor(a),body=panel.querySelector('[data-loose-results]'),ctx=a.context();
  s.search=panel.querySelector('[data-loose-input]').value||'';s.category=panel.querySelector('[data-loose-category]').value||'';
  if(!a.ready(ctx)){body.textContent='Select the required source/location first.';return;}
  if(s.loading)return;s.loading=true;body.textContent='Searching eligible items…';
  try{
    const out=[],selected=a.selected();let cursor=null,done=false,guard=0;
    while(out.length<PAGE_SIZE&&!done&&guard<MAX_SCANS){guard++;const q=cursor?query(collection(db,'inventory'),orderBy(documentId(),'asc'),startAfter(cursor),limit(SCAN_SIZE)):query(collection(db,'inventory'),orderBy(documentId(),'asc'),limit(SCAN_SIZE));const snap=await getDocs(q);if(!snap.size){done=true;break;}for(const d of snap.docs){const i={id:d.id,...d.data()};if(!selected.has(i.id)&&a.eligible(i,ctx)&&matches(i,s)){out.push(i);if(out.length===PAGE_SIZE)break;}}cursor=snap.docs.at(-1);if(snap.size<SCAN_SIZE)done=true;}
    s.items=out;render(a);
  }catch(e){body.textContent='Unable to search items: '+(e?.message||e);}
  finally{s.loading=false;}
}

function render(a){
  const panel=$(panelId(a)),body=panel?.querySelector('[data-loose-results]'),s=stateFor(a);if(!body)return;
  if(!s.items.length){body.innerHTML='<div class="py-2 text-slate-500">No eligible items match.</div>';return;}
  body.innerHTML=`<div class="hidden lg:grid grid-cols-[160px_minmax(0,1fr)_150px_180px_80px_auto] gap-3 px-3 text-[10px] uppercase tracking-wide text-slate-600"><span>Wellora / R2R SN</span><span>Description</span><span>Category</span><span>Location</span><span>Unit</span><span></span></div><div class="space-y-2 mt-2">${s.items.map(i=>`<div class="grid lg:grid-cols-[160px_minmax(0,1fr)_150px_180px_80px_auto] gap-3 items-center border border-slate-800 rounded-lg px-3 py-2"><div class="font-semibold text-cyan-300">${esc(i.alias||'—')}</div><div class="text-xs text-slate-300">${esc(i.name||'')}</div><div class="text-[11px] text-slate-400">${esc(i.category||'—')}</div><div class="text-[11px] text-slate-400">${esc(i.currentLocation||'—')}</div><div class="text-[10px] text-slate-500">${esc(i.unit||'')}</div><button type="button" data-loose-add="${esc(i.id)}" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs">Add</button></div>`).join('')}</div><div class="text-[11px] text-slate-500 pt-2">Showing up to ${PAGE_SIZE} eligible matches.</div>`;
  body.querySelectorAll('[data-loose-add]').forEach(btn=>btn.onclick=async()=>{const item=s.items.find(i=>i.id===btn.dataset.looseAdd);if(!item)return;btn.disabled=true;btn.textContent='Adding…';await a.add(item);await search(a);});
}

function scan(){[movementAdapter(),serviceAdapter()].filter(Boolean).forEach(a=>ensurePanel(a));}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,60);}).observe(document.documentElement,{childList:true,subtree:true});
scan();
window.IMSLooseItemSearch=Object.freeze({refresh:()=>{states.clear();categoryCache=null;document.querySelectorAll('[id^="imsLooseSearch-"]').forEach(x=>x.remove());scan();}});
