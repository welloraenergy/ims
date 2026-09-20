import {db} from '../../firebase-config.js';
import {collection,doc,getDocs,runTransaction,setDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import './stock-overview-v3-patch.js';

export const SUMMARY_VERSION=3;
export const SUMMARY_GLOBAL=doc(db,'inventory_summary','global');
export const SUMMARY_DISTRIBUTION=doc(db,'inventory_summary','distribution');
export const SUMMARY_CATEGORIES=doc(db,'inventory_summary','categories');

const EXIT_STATUS=new Set(['Inactive','Missing','Stolen','Disposed - Sold','Disposed - Scrapped','Written Off','Returned to Supplier','Returned to Owner','Disposed - Other']);
const GLOBAL_FIELDS=['liveQty','availableQty','atClientQty','atSupplierQty','reservedQty','maintenanceQty','inspectionQty','notAvailableQty','inTransitQty','missingQty','stolenQty','ownedQty','r2rQty'];
const DIMENSION_FIELDS=[['Size','size'],['Grade','grade'],['PPF','ppf'],['Connection','connection'],['Range','range'],['Brand','brand'],['Type','type']];
const numeric=v=>Number(v||0);
const safe=s=>String(s??'').replace(/[./#$\[\]]/g,'_').trim()||'Unknown';
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const addValue=(target,key,qty)=>{target[key]=(target[key]||0)+numeric(qty);};
function dimensions(item={}){const out={};for(const[label,key]of DIMENSION_FIELDS){const v=String(item?.[key]??'').trim();if(v)out[label]=v;}return out;}
function addDimensions(target={},category,dim={},qty=0){const c=safe(category),bucket=target[c]||(target[c]={});for(const[label,value]of Object.entries(dim||{})){const field=bucket[label]||(bucket[label]={});addValue(field,safe(value),qty);}return target;}
function addGroup(target,key,{id='',name='Unknown',qty=0,availableQty,category='Uncategorized',dimensions:dim={}}={}){const k=safe(key||name),x=target[k]||(target[k]={id,name,qty:0,categories:{},categoryDimensions:{}});x.id=id||x.id||'';x.name=name||x.name||k;x.qty+=numeric(qty);if(availableQty!==undefined)x.availableQty=numeric(x.availableQty)+numeric(availableQty);addValue(x.categories,category,qty);addDimensions(x.categoryDimensions,category,dim,qty);return x;}

export function inventoryBalances(item){return(Array.isArray(item?.stockBalances)?item.stockBalances:[]).filter(b=>numeric(b.qty)>0).map(b=>({...b,qty:numeric(b.qty),locationType:b.locationType||'',locationId:b.locationId||'',locationName:b.locationName||b.location||'Unknown',status:b.status||'Not Available'}));}

export function summarizeItem(item={}){
  const global=Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses={},clients={},suppliers={},r2rOwners={},categories={},categoryDimensions={};
  const isR2R=item.ownershipType==='third_party',category=item.category||'Uncategorized',dim=dimensions(item);
  for(const b of inventoryBalances(item)){
    const q=b.qty,live=!EXIT_STATUS.has(b.status);
    if(live){
      global.liveQty+=q;isR2R?global.r2rQty+=q:global.ownedQty+=q;addValue(categories,category,q);addDimensions(categoryDimensions,category,dim,q);
      if(isR2R)addGroup(r2rOwners,item.ownerBusinessId||item.supplierId||item.ownerBusinessName||item.supplierName,{id:item.ownerBusinessId||item.supplierId||'',name:item.ownerBusinessName||item.supplierName||'Unknown Owner',qty:q,category,dimensions:dim});
    }
    if(b.status==='Available')global.availableQty+=q;
    if(b.status==='At Client')global.atClientQty+=q;
    if(b.status==='At Supplier')global.atSupplierQty+=q;
    if(b.status==='Reserved')global.reservedQty+=q;
    if(b.status==='Maintenance')global.maintenanceQty+=q;
    if(b.status==='Inspection')global.inspectionQty+=q;
    if(b.status==='Not Available')global.notAvailableQty+=q;
    if(b.status==='In Transit')global.inTransitQty+=q;
    if(b.status==='Missing')global.missingQty+=q;
    if(b.status==='Stolen')global.stolenQty+=q;
    if(live&&b.locationType==='warehouse')addGroup(warehouses,b.locationId||b.locationName,{id:b.locationId||'',name:b.locationName||'Unknown',qty:q,availableQty:b.status==='Available'?q:0,category,dimensions:dim});
    if(live&&b.status==='At Client')addGroup(clients,b.locationId||b.locationName,{id:b.locationId||'',name:b.locationName||'Unknown',qty:q,category,dimensions:dim});
    if(live&&b.status==='At Supplier'&&!isR2R)addGroup(suppliers,b.locationId||b.locationName,{id:b.locationId||'',name:b.locationName||item.supplierName||'Unknown Supplier',qty:q,category,dimensions:dim});
  }
  return{global,warehouses,clients,suppliers,r2rOwners,categories,categoryDimensions};
}

function mergeValueMap(target={},src={}){for(const[k,v]of Object.entries(src||{}))addValue(target,k,v);return target;}
function mergeDimensions(target={},src={}){for(const[cat,fields]of Object.entries(src||{})){const c=target[cat]||(target[cat]={});for(const[label,values]of Object.entries(fields||{}))mergeValueMap(c[label]||(c[label]={}),values);}return target;}
function mergeGroups(target,src,warehouse=false){for(const[k,v]of Object.entries(src||{})){const x=target[k]||(target[k]={id:v.id||'',name:v.name||k,qty:0,categories:{},categoryDimensions:{}});x.qty+=numeric(v.qty);if(warehouse)x.availableQty=numeric(x.availableQty)+numeric(v.availableQty);mergeValueMap(x.categories,v.categories);mergeDimensions(x.categoryDimensions,v.categoryDimensions);}}
export function summarizeInventory(items=[]){const out={global:Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses:{},clients:{},suppliers:{},r2rOwners:{},categories:{},categoryDimensions:{}};for(const item of items){const s=summarizeItem(item);for(const k of GLOBAL_FIELDS)out.global[k]+=numeric(s.global[k]);mergeGroups(out.warehouses,s.warehouses,true);mergeGroups(out.clients,s.clients);mergeGroups(out.suppliers,s.suppliers);mergeGroups(out.r2rOwners,s.r2rOwners);mergeValueMap(out.categories,s.categories);mergeDimensions(out.categoryDimensions,s.categoryDimensions);}return out;}

function valueDelta(before={},after={}){const out={},keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);for(const k of keys){const d=numeric(after?.[k])-numeric(before?.[k]);if(d)out[k]=d;}return out;}
function dimensionsDelta(before={},after={}){const out={},cats=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);for(const cat of cats){const c={},labels=new Set([...Object.keys(before?.[cat]||{}),...Object.keys(after?.[cat]||{})]);for(const label of labels){const d=valueDelta(before?.[cat]?.[label],after?.[cat]?.[label]);if(Object.keys(d).length)c[label]=d;}if(Object.keys(c).length)out[cat]=c;}return out;}
function groupDelta(before={},after={},warehouse=false){const out={},keys=new Set([...Object.keys(before),...Object.keys(after)]);for(const k of keys){const b=before[k]||{},a=after[k]||{},qty=numeric(a.qty)-numeric(b.qty),availableQty=numeric(a.availableQty)-numeric(b.availableQty),categories=valueDelta(b.categories,a.categories),categoryDimensions=dimensionsDelta(b.categoryDimensions,a.categoryDimensions);if(qty||(warehouse&&availableQty)||Object.keys(categories).length||Object.keys(categoryDimensions).length)out[k]={id:a.id||b.id||'',name:a.name||b.name||k,qty,categories,categoryDimensions,...(warehouse?{availableQty}:{})};}return out;}
export function inventorySummaryDelta(beforeItem={},afterItem={}){const before=summarizeItem(beforeItem),after=summarizeItem(afterItem),global={};for(const k of GLOBAL_FIELDS)global[k]=numeric(after.global[k])-numeric(before.global[k]);return{global,warehouses:groupDelta(before.warehouses,after.warehouses,true),clients:groupDelta(before.clients,after.clients),suppliers:groupDelta(before.suppliers,after.suppliers),r2rOwners:groupDelta(before.r2rOwners,after.r2rOwners),categories:valueDelta(before.categories,after.categories),categoryDimensions:dimensionsDelta(before.categoryDimensions,after.categoryDimensions)};}

function mergeDeltaGroups(target,src){for(const[k,d]of Object.entries(src||{})){const x=target[k]||(target[k]={id:d.id||'',name:d.name||k,qty:0,availableQty:0,categories:{},categoryDimensions:{}});x.qty+=numeric(d.qty);x.availableQty+=numeric(d.availableQty);mergeValueMap(x.categories,d.categories);mergeDimensions(x.categoryDimensions,d.categoryDimensions);}}
export function combineInventorySummaryDeltas(deltas=[]){const out={global:Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses:{},clients:{},suppliers:{},r2rOwners:{},categories:{},categoryDimensions:{}};for(const d of deltas){for(const k of GLOBAL_FIELDS)out.global[k]+=numeric(d?.global?.[k]);mergeDeltaGroups(out.warehouses,d?.warehouses);mergeDeltaGroups(out.clients,d?.clients);mergeDeltaGroups(out.suppliers,d?.suppliers);mergeDeltaGroups(out.r2rOwners,d?.r2rOwners);mergeValueMap(out.categories,d?.categories);mergeDimensions(out.categoryDimensions,d?.categoryDimensions);}return out;}

function applyValues(base={},delta={}){const out=clone(base);for(const[k,d]of Object.entries(delta||{})){const v=Math.max(0,numeric(out[k])+numeric(d));if(v)out[k]=v;else delete out[k];}return out;}
function applyDimensions(base={},delta={}){const out=clone(base);for(const[cat,fields]of Object.entries(delta||{})){const c=out[cat]||{};for(const[label,values]of Object.entries(fields||{})){c[label]=applyValues(c[label]||{},values);if(!Object.keys(c[label]).length)delete c[label];}if(Object.keys(c).length)out[cat]=c;else delete out[cat];}return out;}
function applyGroups(base={},delta={},warehouse=false){const out=clone(base);for(const[k,d]of Object.entries(delta||{})){const x=out[k]||{id:d.id||'',name:d.name||k,qty:0,categories:{},categoryDimensions:{}};x.id=d.id||x.id||'';x.name=d.name||x.name||k;x.qty=Math.max(0,numeric(x.qty)+numeric(d.qty));if(warehouse)x.availableQty=Math.max(0,numeric(x.availableQty)+numeric(d.availableQty));x.categories=applyValues(x.categories,d.categories);x.categoryDimensions=applyDimensions(x.categoryDimensions,d.categoryDimensions);if(!x.qty&&(!warehouse||!x.availableQty))delete out[k];else out[k]=x;}return out;}

export async function applyInventorySummaryDelta(tx,delta,{updatedAt=new Date().toISOString(),updatedBy=''}={}){
  const gSnap=await tx.get(SUMMARY_GLOBAL),dSnap=await tx.get(SUMMARY_DISTRIBUTION),cSnap=await tx.get(SUMMARY_CATEGORIES);
  if(!gSnap.exists()||!dSnap.exists()||!cSnap.exists())return false;
  if(gSnap.data().summaryVersion!==SUMMARY_VERSION||dSnap.data().summaryVersion!==SUMMARY_VERSION||cSnap.data().summaryVersion!==SUMMARY_VERSION)return false;
  const g={...gSnap.data(),summaryVersion:SUMMARY_VERSION};for(const k of GLOBAL_FIELDS)g[k]=Math.max(0,numeric(g[k])+numeric(delta.global[k]));g.updatedAt=updatedAt;g.updatedBy=updatedBy;
  const d={...dSnap.data(),summaryVersion:SUMMARY_VERSION};d.warehouses=applyGroups(d.warehouses,delta.warehouses,true);d.clients=applyGroups(d.clients,delta.clients);d.suppliers=applyGroups(d.suppliers,delta.suppliers);d.r2rOwners=applyGroups(d.r2rOwners,delta.r2rOwners);d.updatedAt=updatedAt;d.updatedBy=updatedBy;
  const c={...cSnap.data(),summaryVersion:SUMMARY_VERSION};c.categories=applyValues(c.categories,delta.categories);c.categoryDimensions=applyDimensions(c.categoryDimensions,delta.categoryDimensions);c.updatedAt=updatedAt;c.updatedBy=updatedBy;
  tx.set(SUMMARY_GLOBAL,g,{merge:true});tx.set(SUMMARY_DISTRIBUTION,d,{merge:true});tx.set(SUMMARY_CATEGORIES,c,{merge:true});return true;
}

export async function updateInventorySummary(beforeItem,afterItem,meta={}){const delta=inventorySummaryDelta(beforeItem,afterItem);await runTransaction(db,tx=>applyInventorySummaryDelta(tx,delta,meta));}
export async function rebuildInventorySummary(rebuiltBy=''){const snap=await getDocs(collection(db,'inventory')),items=snap.docs.map(d=>({id:d.id,...d.data()})),summary=summarizeInventory(items),at=new Date().toISOString(),meta={summaryVersion:SUMMARY_VERSION,updatedAt:at,updatedBy:rebuiltBy,rebuiltAt:at,rebuiltBy,sourceRecordCount:snap.size};await Promise.all([setDoc(SUMMARY_GLOBAL,{...meta,...summary.global}),setDoc(SUMMARY_DISTRIBUTION,{...meta,warehouses:summary.warehouses,clients:summary.clients,suppliers:summary.suppliers,r2rOwners:summary.r2rOwners}),setDoc(SUMMARY_CATEGORIES,{...meta,categories:summary.categories,categoryDimensions:summary.categoryDimensions})]);return{recordCount:snap.size,...summary};}
