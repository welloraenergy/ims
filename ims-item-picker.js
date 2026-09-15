import {db} from './firebase-config.js';
import {collection,documentId,getDocs,limit,orderBy,query,startAfter} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const PAGE_SIZE=20;
const SCAN_SIZE=50;
const states=new Map();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const balances=i=>(Array.isArray(i?.stockBalances)?i.stockBalances:[]).filter(b=>Number(b.qty||0)>0).map(b=>({...b,qty:Number(b.qty||0)}));
const sameLoc=(b,id,name)=>b&&((id&&String(b.locationId||'')===String(id))||norm(b.locationName)===norm(name));
const selectedOption=e=>e?.selectedOptions?.[0]||null;

function movementAdapter(){
  if(!$('batchMoveForm')||!$('bmLookupField')||!$('bmFindItem'))return null;
  return{
    id:'movement',anchor:$('bmLines'),
    context(){const action=$('bmAction')?.value||'',src=$('bmSource'),o=selectedOption(src);return{action,sourceId:src?.value||'',sourceName:o?.dataset?.name||o?.textContent?.trim()||'',reservationId:$('bmReservation')?.value||''};},
    ready:c=>!!c.sourceId,
    eligible(i,c){
      if(c.action==='DELIVER_CLIENT'){
        if(i.activeReservation)return false;
        return balances(i).some(b=>sameLoc(b,c.sourceId,c.sourceName)&&b.locationType==='warehouse'&&b.status==='Available');
      }
      const map={RECEIVE_SUPPLIER:['supplier','At Supplier'],TRANSFER_WAREHOUSE:['warehouse','Available'],RETURN_CLIENT:['client','At Client']},rule=map[c.action];
      return!!rule&&balances(i).some(b=>sameLoc(b,c.sourceId,c.sourceName)&&b.locationType===rule[0]&&b.status===rule[1]);
    },
    selected:()=>new Set([...document.querySelectorAll('.bmLine')].map(r=>r.dataset.itemId).filter(Boolean)),
    async add(i){const field=$('bmLookupField'),input=$('bmLookupValue'),btn=$('bmFindItem');if(!field||!input||!btn)return false;const before=document.querySelectorAll('.bmLine').length;field.value=i.alias?'alias':'name';input.value=i.alias||i.name||'';btn.click();return waitFor(()=>document.querySelectorAll('.bmLine').length>before,1800);}
  };
}

function serviceAdapter(){
  if(!$('serviceCycleWorkflow')||!$('scLookupField')||!$('scFind'))return null;
  return{
    id:'service',anchor:$('scLines'),
    context(){const t=$('scSrcType')?.value||'warehouse',s=$('scSrc'),o=selectedOption(s);return{type:t,sourceId:s?.value||'',sourceName:o?.dataset?.name||o?.textContent?.trim()||''};},
    ready:c=>!!c.sourceId,
    eligible(i,c){return balances(i).some(b=>{if(!sameLoc(b,c.sourceId,c.sourceName))return false;if(c.type==='warehouse')return b.locationType==='warehouse'&&['Available','Not Available'].includes(b.status);if(c.type==='client')return b.locationType==='client'&&['At Client','Not Available'].includes(b.status);if(c.type==='supplier')return b.locationType==='supplier'&&['At Supplier','Not Available'].includes(b.status);return false;});},
    selected:()=>new Set([...document.querySelectorAll('.scLine')].map(r=>r.dataset.id).filter(Boolean)),
    async add(i){const field=$('scLookupField'),input=$('scLookupValue'),btn=$('scFind');if(!field||!input||!btn)return false;const before=document.querySelectorAll('.scLine').length;field.value=i.alias?'alias':'name';input.value=i.alias||i.name||'';btn.click();return waitFor(()=>document.querySelectorAll('.scLine').length>before,1800);}
  };
}

function reservationAdapter(){
  if(!$('resLocation')||!$('resRows')||!$('resAddRow'))return null;
  return{
    id:'reservation',anchor:$('resRows'),
    context(){const e=$('resLocation'),o=selectedOption(e);return{key:e?.value||'',type:o?.dataset?.type||'',id:o?.dataset?.id||'',name:o?.dataset?.name||o?.textContent?.trim()||''};},
    ready:c=>!!c.key,
    eligible:(i,c)=>!i.activeReservation&&balances(i).some(b=>b.status==='Available'&&`${b.locationType||''}|${b.locationId||''}|${b.locationName||''}`===c.key),
    selected:()=>new Set([...document.querySelectorAll('.resRow')].map(r=>r.dataset.itemId).filter(Boolean)),
    async add(i){let row=[...document.querySelectorAll('.resRow')].find(r=>!r.dataset.itemId);if(!row){$('resAddRow')?.click();row=[...document.querySelectorAll('.resRow')].at(-1);}if(!row)return false;const field=row.querySelector('.resLookupField'),input=row.querySelector('.resLookupValue'),btn=row.querySelector('.resFindItem');if(!field||!input||!btn)return false;field.value=i.alias?'alias':'name';input.value=i.alias||i.name||'';btn.click();return waitFor(()=>!!row.dataset.itemId,1800);}
  };
}

function dispositionAdapter(){
  if(!$('dispLookupField')||!$('dispFind')||!$('dispSelected'))return null;
  const exit=new Set(['Disposed - Sold','Disposed - Scrapped','Written Off','Returned to Supplier','Returned to Owner','Disposed - Other']);
  return{
    id:'disposition',anchor:$('dispSelected'),single:true,
    context:()=>({screen:'disposition'}),ready:()=>true,
    eligible(i){if(i.disposition||exit.has(i.status)||i.activeIncident)return false;const b=balances(i);return!!b.length&&!b.some(x=>['At Client','In Transit','Maintenance','Inspection','Reserved'].includes(x.status));},
    selected:()=>new Set(),
    async add(i){const field=$('dispLookupField'),input=$('dispLookupValue'),btn=$('dispFind');if(!field||!input||!btn)return false;field.value=i.alias?'alias':'name';input.value=i.alias||i.name||'';btn.click();return waitFor(()=>($('dispSelected')?.textContent||'').includes(i.alias||i.itemCode||i.name||'__'),1800);}
  };
}

function incidentAdapter(){
  if(!$('incLookupField')||!$('incFind')||!$('incSelected'))return null;
  const exit=new Set(['Disposed - Sold','Disposed - Scrapped','Written Off','Returned to Supplier','Returned to Owner','Disposed - Other']);
  return{
    id:'incident',anchor:$('incSelected'),single:true,
    context:()=>({screen:'incident'}),ready:()=>true,
    eligible:i=>!i.activeIncident&&!i.activeReservation&&!['Missing','Stolen'].includes(i.status)&&!exit.has(i.status)&&balances(i).length>0&&!balances(i).some(b=>b.status==='Reserved'),
    selected:()=>new Set(),
    async add(i){const field=$('incLookupField'),input=$('incLookupValue'),btn=$('incFind');if(!field||!input||!btn)return false;field.value=i.alias?'alias':'name';input.value=i.alias||i.name||'';btn.click();return waitFor(()=>($('incSelected')?.textContent||'').includes(i.alias||i.itemCode||i.name||'__'),1800);}
  };
}

function waitFor(test,ms){return new Promise(resolve=>{const started=Date.now(),tick=()=>{if(test())return resolve(true);if(Date.now()-started>=ms)return resolve(false);setTimeout(tick,60);};tick();});}
function keyOf(c){return JSON.stringify(c||{});}
function stateFor(a){let s=states.get(a.id);if(!s){s={contextKey:'',start:null,history:[],items:[],next:null,loading:false};states.set(a.id,s);}return s;}

async function fetchPage(a,reset=false){
  const s=stateFor(a),ctx=a.context(),k=keyOf(ctx);
  if(reset||s.contextKey!==k){s.contextKey=k;s.start=null;s.history=[];s.items=[];s.next=null;}
  if(!a.ready(ctx)){s.items=[];s.next=null;render(a,'Select the required source/location first.');return;}
  if(s.loading)return;s.loading=true;render(a,'Loading eligible items…');
  try{
    const out=[],selected=a.selected();let cursor=s.start,lastScanned=null,exhausted=false,guard=0;
    while(out.length<PAGE_SIZE&&!exhausted&&guard<20){
      guard++;
      const base=[collection(db,'inventory'),orderBy(documentId(),'asc')],q=cursor?query(...base,startAfter(cursor),limit(SCAN_SIZE)):query(...base,limit(SCAN_SIZE));
      const snap=await getDocs(q);if(!snap.size){exhausted=true;break;}
      for(const d of snap.docs){lastScanned=d;const item={id:d.id,...d.data()};if(a.eligible(item,ctx)&&!selected.has(item.id)){out.push(item);if(out.length===PAGE_SIZE)break;}}
      cursor=snap.docs.at(-1)||cursor;if(snap.size<SCAN_SIZE)exhausted=true;if(out.length===PAGE_SIZE)break;
    }
    s.items=out;s.next=!exhausted&&lastScanned?lastScanned:null;render(a,out.length?'':'No eligible items found on this page.');
  }catch(e){console.error('IMS item picker:',e);render(a,'Unable to load eligible items: '+(e?.message||e));}
  finally{s.loading=false;}
}

function panelId(a){return`imsPicker-${a.id}`;}
function ensurePanel(a){
  if(!a.anchor||document.getElementById(panelId(a)))return;
  const panel=document.createElement('div');panel.id=panelId(a);panel.className='border border-cyan-900/40 rounded-xl p-3 mt-3 space-y-3';
  panel.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2"><div><div class="font-semibold text-sm text-cyan-300">Browse Eligible Items</div><div class="text-[11px] text-slate-500">20 eligible items per page. Fast Pick by Wellora SN / R2R SN or Description remains available above.</div></div><button type="button" data-picker-refresh class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs">Refresh</button></div><div data-picker-body class="text-xs text-slate-500">Loading…</div>`;
  a.anchor.parentElement?.insertBefore(panel,a.anchor);
  panel.querySelector('[data-picker-refresh]').onclick=()=>fetchPage(a,true);
  const watchIds=a.id==='movement'?['bmAction','bmSource','bmReservation']:a.id==='service'?['scSrcType','scSrc']:a.id==='reservation'?['resLocation']:[];
  watchIds.forEach(id=>document.getElementById(id)?.addEventListener('change',()=>setTimeout(()=>fetchPage(a,true),120)));
  if(a.id==='movement'&&a.anchor){new MutationObserver(()=>{clearTimeout(a.__pickerRefreshTimer);a.__pickerRefreshTimer=setTimeout(()=>fetchPage(a,true),80);}).observe(a.anchor,{childList:true,subtree:false});}
  fetchPage(a,true);
}

function render(a,message=''){
  const panel=document.getElementById(panelId(a));if(!panel)return;const body=panel.querySelector('[data-picker-body]'),s=stateFor(a),selected=a.selected(),inputType=a.single?'radio':'checkbox',inputName=a.single?`imsPickerRadio-${a.id}`:'';
  const visible=s.items.filter(i=>!selected.has(i.id));
  if(message&&!visible.length){body.innerHTML=`<div class="py-2 text-slate-500">${esc(message)}</div>`;return;}
  const rows=visible.map(i=>`<label class="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_180px_minmax(0,1fr)_90px] gap-3 items-center border border-slate-800 rounded-lg px-3 py-2 cursor-pointer"><input type="${inputType}" ${inputName?`name="${inputName}"`:''} class="imsPickerCheck" value="${esc(i.id)}"><div class="sm:hidden min-w-0"><div class="font-semibold text-cyan-300">${esc(i.alias||'—')}</div><div class="text-xs text-slate-300 break-words">${esc(i.name||'')}</div><div class="text-[10px] text-slate-500">${esc(i.currentLocation||'')}</div></div><div class="hidden sm:block font-semibold text-cyan-300">${esc(i.alias||'—')}</div><div class="hidden sm:block text-xs text-slate-300 break-words">${esc(i.name||'')}</div><div class="hidden sm:block text-[10px] text-slate-500 text-right">${esc(i.unit||'')}</div></label>`).join('');
  body.innerHTML=`<div class="space-y-2">${rows||`<div class="py-2 text-slate-500">${esc(message||'No eligible items found.')}</div>`}</div><div class="flex flex-wrap items-center justify-between gap-2 pt-2"><div class="text-[11px] text-slate-500">Showing up to ${PAGE_SIZE} eligible item(s)</div><div class="flex flex-wrap gap-2"><button type="button" data-picker-prev ${s.history.length?'':'disabled'} class="px-3 py-2 rounded-lg text-xs ${s.history.length?'bg-slate-700':'bg-slate-900 text-slate-600'}">Previous</button><button type="button" data-picker-next ${s.next?'':'disabled'} class="px-3 py-2 rounded-lg text-xs ${s.next?'bg-slate-700':'bg-slate-900 text-slate-600'}">Next</button><button type="button" data-picker-add class="bg-cyan-700 hover:bg-cyan-600 px-3 py-2 rounded-lg text-xs font-bold">${a.single?'Select Item':'Add Selected'}</button></div></div>`;
  body.querySelector('[data-picker-prev]').onclick=()=>{if(!s.history.length)return;s.start=s.history.pop();fetchPage(a);};
  body.querySelector('[data-picker-next]').onclick=()=>{if(!s.next)return;s.history.push(s.start);s.start=s.next;fetchPage(a);};
  body.querySelector('[data-picker-add]').onclick=async e=>{const ids=[...body.querySelectorAll('.imsPickerCheck:checked')].map(x=>x.value);if(!ids.length)return;const chosen=a.single?ids.slice(0,1):ids,btn=e.currentTarget;btn.disabled=true;btn.textContent=a.single?'Selecting…':'Adding…';for(const id of chosen){const item=s.items.find(x=>x.id===id);if(item)await a.add(item);}btn.disabled=false;btn.textContent=a.single?'Select Item':'Add Selected';await fetchPage(a,true);};
}

function scan(){[movementAdapter(),serviceAdapter(),reservationAdapter(),dispositionAdapter(),incidentAdapter()].filter(Boolean).forEach(ensurePanel);}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,50);}).observe(document.documentElement,{childList:true,subtree:true});
scan();
window.IMSItemPicker=Object.freeze({refresh:()=>{states.clear();document.querySelectorAll('[id^="imsPicker-"]').forEach(x=>x.remove());scan();}});
