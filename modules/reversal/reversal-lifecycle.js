import {auth,db} from '../../firebase-config.js';
import {collection,doc,getDoc,getDocs,query,runTransaction,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import {applyInventorySummaryDelta,inventorySummaryDelta} from '../inventory/inventory-summary.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date().toISOString();
const cls='w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
let candidate=null,check=null,busy=false;

function isSuperadmin(){return String(window.IMS_ROLE||'').toLowerCase()==='superadmin';}
function balances(i){return(Array.isArray(i?.stockBalances)?i.stockBalances:[]).filter(b=>Number(b.qty||0)>0).map(b=>({...b,qty:Number(b.qty||0)}));}
function email(){return auth.currentUser?.email||window.IMSUser?.email||'';}

async function eligibility(item){
  const [m,s]=await Promise.all([
    getDocs(query(collection(db,'movements'),where('itemId','==',item.id))),
    getDocs(query(collection(db,'service_cycles'),where('itemId','==',item.id)))
  ]);
  const movements=m.docs.map(d=>({id:d.id,...d.data()})),services=s.docs.map(d=>({id:d.id,...d.data()})),reasons=[];
  const openMoves=movements.filter(x=>String(x.status||'').toLowerCase()!=='reversed');
  const openServices=services.filter(x=>String(x.status||'').toLowerCase()!=='reversed');
  if(item.status==='Inactive'||item.deactivatedAt)reasons.push('Item is already inactive.');
  if(item.activeReservation)reasons.push('Active Reservation exists.');
  if(item.activeIncident)reasons.push('Active Incident exists. Reverse/recover it first.');
  if(item.disposition)reasons.push('Disposition exists. Reverse it first before deactivation.');
  if(openMoves.length)reasons.push(`${openMoves.length} Movement record(s) are not reversed.`);
  if(openServices.length)reasons.push(`${openServices.length} Service Cycle record(s) are not reversed.`);
  if(!movements.length&&!services.length&&item.sourceModule==='Registration')reasons.push('Untouched Registration item: use Delete New Item instead of Deactivate.');
  return{eligible:reasons.length===0,reasons,movements,services};
}

function resultHtml(){
  if(!candidate)return'<div class="text-xs text-slate-500">Find an exact item after its required Movement / Service history has been reversed.</div>';
  const ok=check?.eligible,reasons=check?.reasons||[];
  return`<div class="border ${ok?'border-emerald-900/60':'border-amber-900/60'} rounded-xl p-3"><div class="flex flex-wrap justify-between gap-3"><div><b class="text-cyan-300">${esc(candidate.alias||candidate.itemCode||candidate.id)}</b> · ${esc(candidate.name||'')}<div class="text-[10px] font-mono text-slate-500">${esc(candidate.itemCode||candidate.id)}</div><div class="text-xs text-slate-400 mt-1">${esc(candidate.status||'')} · ${esc(candidate.currentLocation||'')}</div></div><b class="text-xs ${ok?'text-emerald-300':'text-amber-300'}">${ok?'DEACTIVATE ELIGIBLE':'DEACTIVATE BLOCKED'}</b></div>${reasons.length?`<div class="mt-3 text-xs text-amber-200">${reasons.map(r=>`<div>• ${esc(r)}</div>`).join('')}</div>`:'<div class="mt-3 text-xs text-slate-400">All operational Movement / Service history is reversed and there is no active dependency.</div>'}${ok?'<button id="revDeactivateBtn" class="mt-3 bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg text-xs font-bold">Deactivate Item</button>':''}</div>`;
}

async function findItem(){
  const field=$('revDeactivateField')?.value||'alias',value=$('revDeactivateValue')?.value.trim()||'';
  if(!value)return alert('Enter an exact item value.');
  const snap=await getDocs(query(collection(db,'inventory'),where(field,'==',value)));
  if(!snap.size){candidate=null;check=null;renderResult();return alert('No item found.');}
  if(snap.size>1)return alert('More than one item matched. Use IMS Item ID.');
  const d=snap.docs[0];candidate={id:d.id,...d.data()};check=await eligibility(candidate);renderResult();
}

function renderResult(){const box=$('revDeactivateResult');if(!box)return;box.innerHTML=resultHtml();const b=$('revDeactivateBtn');if(b)b.onclick=requestDeactivate;}

async function requestDeactivate(){
  if(!candidate||!check?.eligible||busy)return;
  const remark=prompt('Deactivation remark (required)');
  if(!remark?.trim())return;
  if(!confirm(`Deactivate ${candidate.alias||candidate.itemCode}?\n\nThe item will remain in Inventory → Inactive with its history preserved.`))return;
  busy=true;
  try{await deactivateItem(candidate.id,remark.trim());candidate=null;check=null;renderResult();alert('Item deactivated. It remains under Inventory → Inactive.');}
  catch(e){alert('Deactivation failed: '+(e?.message||e));}
  finally{busy=false;}
}

async function deactivateItem(id,remark){
  const at=now(),by=email(),itemRef=doc(db,'inventory',id),auditRef=doc(collection(db,'audit_traces')),logRef=doc(collection(db,'operational_logs'));
  const snap=await getDoc(itemRef);
  if(!snap.exists())throw new Error('Item no longer exists.');
  const item={id:snap.id,...snap.data()},state=await eligibility(item);
  if(!state.eligible)throw new Error(state.reasons.join(' '));
  await runTransaction(db,async tx=>{
    const currentSnap=await tx.get(itemRef);if(!currentSnap.exists())throw new Error('Item no longer exists.');
    const before=currentSnap.data(),stock=balances(before).map(b=>({...b,status:'Inactive'}));
    const after={...before,stockBalances:stock,status:'Inactive',deactivatedAt:at,deactivatedBy:by,deactivationReason:remark,lastEditedAt:at,lastEditedBy:by};
    await applyInventorySummaryDelta(tx,inventorySummaryDelta(before,after),{updatedAt:at,updatedBy:by});
    tx.update(itemRef,{stockBalances:stock,status:'Inactive',deactivatedAt:at,deactivatedBy:by,deactivationReason:remark,lastEditedAt:at,lastEditedBy:by});
    tx.set(auditRef,{traceVersion:3,actionType:'DEACTIVATE_ITEM',module:'Reversal',targetType:'inventory',targetName:before.alias||before.itemCode||id,targetId:id,summary:`Deactivate Item ${before.alias||before.itemCode||id}`,beforeValue:{status:before.status,currentLocation:before.currentLocation},afterValue:{status:'Inactive',currentLocation:before.currentLocation,deactivatedAt:at},changedFields:['status','stockBalances','deactivatedAt'],remark,performedBy:by,performedByRole:'superadmin',performedAt:at});
    tx.set(logRef,{logVersion:3,date:at,module:'Reversal',activity:'DEACTIVATE_ITEM',activityLabel:'Deactivate Item',status:'Inactive',itemId:id,itemAlias:before.alias||'',itemCode:before.itemCode||'',itemName:before.name||'',fromName:before.currentLocation||'',toName:'Inactive',qty:Number(before.quantity||1),unit:before.unit||'',remark,performedBy:by,performedByRole:'superadmin'});
  });
}

function installPanel(){
  if(!isSuperadmin()||!$('deleteLookupValue')||document.querySelector('[data-ims-deactivate-panel="1"]'))return;
  const host=$('appContent')?.querySelector('.space-y-5');if(!host)return;
  const section=document.createElement('section');
  section.dataset.imsDeactivatePanel='1';
  section.className='bg-slate-900 border border-amber-950 rounded-2xl p-4 space-y-3';
  section.innerHTML=`<div><div class="font-bold text-amber-300">Deactivate Item After Reversal</div><div class="text-[11px] text-slate-500">For items with operational history: reverse required Movement / Service records first, then deactivate. The item stays in Inventory → Inactive.</div></div><div class="grid sm:grid-cols-[170px_minmax(0,1fr)_auto] gap-2 items-end"><label class="text-xs text-slate-400">Find By<select id="revDeactivateField" class="${cls} mt-1"><option value="alias">Wellora / R2R SN</option><option value="itemCode">IMS Item ID</option></select></label><label class="text-xs text-slate-400">Exact Value<input id="revDeactivateValue" class="${cls} mt-1" placeholder="Enter exact value"></label><button id="revDeactivateFind" class="bg-cyan-700 px-4 py-2.5 rounded-lg text-xs font-bold">Check Item</button></div><div id="revDeactivateResult">${resultHtml()}</div>`;
  host.appendChild(section);
  $('revDeactivateFind').onclick=()=>findItem().catch(e=>alert('Item check failed: '+(e?.message||e)));
  $('revDeactivateValue').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findItem().catch(err=>alert('Item check failed: '+(err?.message||err)));}};
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(installPanel,40);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:reversal-ready',installPanel);installPanel();
window.IMSReversalLifecycle=Object.freeze({install:installPanel,eligibility,deactivateItem});
window.dispatchEvent(new CustomEvent('ims:reversal-lifecycle-ready'));
export{installPanel,eligibility,deactivateItem};