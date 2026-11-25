import {auth,db} from '../../firebase-config.js';
import {addDoc,collection,doc,getDocs,limit,query,runTransaction,updateDoc,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import {applyInventorySummaryDelta,inventorySummaryDelta} from '../inventory/inventory-summary.js?v=20261125-129';

{
const $=id=>document.getElementById(id),norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase(),now=()=>new Date().toISOString(),today=()=>now().slice(0,10);
const COMBINED='Inspection / Maintenance';
let busy=false;
function cleanBalance(b){const x={...b};for(const k of ['serviceCycleId','serviceGroupId','serviceNo','providerId','providerName','serviceMode'])delete x[k];return x;}
function sourceFromUi(){const e=$('scSrc'),o=e?.selectedOptions?.[0];return e?.value?{id:e.value,name:o?.dataset?.name||o?.textContent?.trim()||'',type:$('scSrcType')?.value||'warehouse'}:null;}
function sourceAllowed(b,t){return t==='warehouse'?b.locationType==='warehouse'&&['Available','Not Available'].includes(b.status):t==='client'?b.locationType==='client'&&['At Client','Not Available'].includes(b.status):t==='supplier'?b.locationType==='supplier'&&['At Supplier','Not Available'].includes(b.status):false;}
function sameSource(b,s){return b&&s&&((b.locationId&&String(b.locationId)===String(s.id))||norm(b.locationName)===norm(s.name));}
function itemStatusFromBalances(b){const p=b.filter(x=>Number(x.qty||0)>0),order=['In Transit','Maintenance','Inspection','At Client','Reserved','Not Available','At Supplier','Available'];return!p.length?{status:'Not Available',location:'No Stock'}:{status:order.find(s=>p.some(x=>x.status===s))||'Not Available',location:p.length===1?p[0].locationName:`${p.length} Locations`};}
function labelLeaf(root,from,to){for(const el of root.querySelectorAll('*'))if(!el.children.length&&el.textContent.trim()===from)el.textContent=to;}
function normalizeDisplayedType(root){for(const el of root.querySelectorAll('*')){if(el.children.length)continue;const t=el.textContent;if(!t)continue;if(/^Inspection\s*·/.test(t)||/^Maintenance\s*·/.test(t))el.textContent=t.replace(/^(Inspection|Maintenance)/,COMBINED);if(/^(Inspection|Maintenance) —/.test(t))el.textContent=t.replace(/^(Inspection|Maintenance)/,COMBINED);}}
function refineTypeSelect(){const e=$('scType');if(!e)return;if([...e.options].map(o=>o.value).join('|')===[COMBINED,'Machine Shop'].join('|'))return;const current=e.value;e.innerHTML='';for(const value of [COMBINED,'Machine Shop']){const o=document.createElement('option');o.value=value;o.textContent=value;e.appendChild(o);}e.value=current==='Machine Shop'?'Machine Shop':COMBINED;}
function syncAddress(){const mode=$('scMode'),addr=$('scAddr');if(!mode||!addr)return;const onsite=mode.value==='On Site';addr.disabled=onsite;addr.readOnly=onsite;addr.classList.toggle('opacity-40',onsite);addr.classList.toggle('cursor-not-allowed',onsite);addr.placeholder=onsite?'Not required for On Site service':'Provider address';if(onsite)addr.value='';}

function refineServiceUi(){const root=$('serviceCycleWorkflow');if(!root)return;refineTypeSelect();labelLeaf(root,'Service No.','PO');labelLeaf(root,'Active Service No.','Active PO');labelLeaf(root,'Failed Service No.','Failed PO');labelLeaf(root,'Completed / Failed Service No.','Completed / Failed PO');labelLeaf(root,'Select a Service No.','Select a PO.');normalizeDisplayedType(root);syncAddress();const mode=$('scMode');if(mode&&!mode.dataset.imsOnsiteAddress){mode.dataset.imsOnsiteAddress='1';mode.addEventListener('change',syncAddress);}const type=$('scType');if(type&&!type.dataset.imsCombinedBound){type.dataset.imsCombinedBound='1';type.addEventListener('change',()=>setTimeout(refineTypeSelect,0));}}
function refineItemDetail(){const root=$('itemDetailMount');if(!root)return;for(const el of root.querySelectorAll('*'))if(!el.children.length){if(el.textContent.trim()==='Service No.')el.textContent='PO';if(/^(Inspection|Maintenance)\s*·/.test(el.textContent))el.textContent=el.textContent.replace(/^(Inspection|Maintenance)/,COMBINED);if(/^(Inspection|Maintenance) —/.test(el.textContent))el.textContent=el.textContent.replace(/^(Inspection|Maintenance)/,COMBINED);}}
async function opLog(data){await addDoc(collection(db,'operational_logs'),{logVersion:3,date:now(),performedBy:auth.currentUser?.email||'',performedByRole:window.IMS_ROLE||'',module:'Service Cycle',...data});}



let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{refineServiceUi();refineItemDetail();},40);}).observe(document.body,{childList:true,subtree:true});
refineServiceUi();refineItemDetail();
window.IMSServiceRefinement=Object.freeze({refineServiceUi});
window.dispatchEvent(new CustomEvent('ims:service-refinement-ready'));
}

{
const $=id=>document.getElementById(id);
let pending=null,timer;
function leaf(root,from,to){if(!root)return;for(const el of root.querySelectorAll('*')){if(!el.children.length&&el.textContent.trim()===from)el.textContent=to;}}
function refineWorkflow(){const root=$('serviceCycleWorkflow');if(!root)return;leaf(root,'Service No.','Service No. / PO *');leaf(root,'PO','Service No. / PO *');leaf(root,'Service No. / PO','Service No. / PO *');leaf(root,'Active Service No.','Active Service No. / PO');leaf(root,'Active PO','Active Service No. / PO');leaf(root,'Failed Service No.','Failed Service No. / PO');leaf(root,'Failed PO','Failed Service No. / PO');leaf(root,'Completed / Failed Service No.','Completed / Failed Service No. / PO');leaf(root,'Completed / Failed PO','Completed / Failed Service No. / PO');leaf(root,'Select a Service No.','Select a Service No. / PO.');leaf(root,'Select a PO.','Select a Service No. / PO.');leaf(root,'Select a PO','Select a Service No. / PO');}
function refineItemDetail(){const root=$('itemDetailMount');if(!root)return;const headings=[...root.querySelectorAll('h3')];const serviceHeading=headings.find(x=>x.textContent.trim()==='Service Cycle History');if(serviceHeading){const section=serviceHeading.closest('section');if(section){leaf(section,'Service No.','Service No. / PO');leaf(section,'PO','Service No. / PO');}}const docsHeading=headings.find(x=>x.textContent.trim()==='Documents & References');if(docsHeading){const section=docsHeading.closest('section');if(section){for(const td of section.querySelectorAll('td')){const t=td.textContent.trim();if((t==='PO'||t==='Service No.')&&td.previousElementSibling?.textContent.trim()==='Service Cycle')td.textContent='Service No. / PO';}}}}
async function canonicalize(reference){reference=String(reference||'').trim();if(!reference)return;const snap=await getDocs(query(collection(db,'service_cycles'),where('serviceNo','==',reference),limit(100)));for(const d of snap.docs){const c=d.data();if(c.serviceReference===reference&&Array.isArray(c.stages)&&c.stages.every(s=>s.serviceReference||!s.serviceRef))continue;const stages=Array.isArray(c.stages)?c.stages.map(s=>({...s,serviceReference:s.serviceReference||s.serviceRef||reference})):[];await updateDoc(doc(db,'service_cycles',d.id),{serviceReference:reference,stages});}}
function scheduleCanonicalize(){const p=pending;pending=null;if(!p?.reference)return;for(const ms of [900,1800,3200])setTimeout(()=>canonicalize(p.reference).catch(e=>console.warn('IMS service reference canonicalization pending Rules update:',e?.message||e)),ms);}

new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{refineWorkflow();refineItemDetail();},35);}).observe(document.body,{childList:true,subtree:true});
refineWorkflow();refineItemDetail();
window.IMSServiceReference=Object.freeze({canonicalize,refineWorkflow});
window.dispatchEvent(new CustomEvent('ims:service-reference-ready'));
}

window.IMSServiceEnhancements=Object.freeze({ready:true});
window.dispatchEvent(new CustomEvent('ims:service-enhancements-ready'));
