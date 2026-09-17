import {auth,db} from './firebase-config.js';
import {addDoc,collection,doc,getDoc,getDocs,limit,query,where,writeBatch} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const now=()=>new Date().toISOString();
let groupCache=null,loading=false,lastLoad=0;

async function actor(){
  const u=auth.currentUser;if(!u)throw new Error('Sign in required.');
  const s=await getDoc(doc(db,'users',u.uid));
  return{email:s.exists()?(s.data().email||u.email||''):(u.email||''),role:s.exists()?(s.data().role||window.IMS_ROLE||''):(window.IMS_ROLE||'')};
}

async function clientGroups(force=false){
  if(loading)return groupCache||[];
  if(!force&&groupCache&&Date.now()-lastLoad<30000)return groupCache;
  loading=true;
  try{
    const snap=await getDocs(query(collection(db,'movement_groups'),where('referenceType','==','client_po'),limit(100)));
    groupCache=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.referenceNumber);
    lastLoad=Date.now();
    return groupCache;
  }finally{loading=false;}
}

async function movementSummary(group){
  const snap=await getDocs(query(collection(db,'movements'),where('movementGroupId','==',group.id),limit(200)));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.referenceType==='client_po'||m.action==='DELIVER_CLIENT');
  if(!rows.length)return null;
  rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const itemIds=[...new Set(rows.map(x=>x.itemId).filter(Boolean))],first=rows.find(x=>x.periodFrom||x.periodTo||x.clientPOAmount)||rows[0];
  let current=0;
  for(const id of itemIds){
    const s=await getDoc(doc(db,'inventory',id));if(!s.exists())continue;
    const i=s.data(),balances=Array.isArray(i.stockBalances)?i.stockBalances:[];
    if(balances.some(b=>b.status==='At Client'&&((group.partyId&&String(b.locationId||'')===String(group.partyId))||norm(b.locationName)===norm(group.partyName||group.toName||''))))current++;
  }
  const poAmount=Math.max(0,...rows.map(x=>Number(x.clientPOAmount||0))),currency=first.currency||'MYR',expected=itemIds.length,outstanding=Math.max(0,expected-current);
  return{periodFrom:first.periodFrom||'',periodTo:first.periodTo||'',poAmount,currency,expected,current,outstanding};
}

function cellText(td){return String(td?.textContent||'').trim();}
function incomplete(cells){return cellText(cells[3])==='—'||cellText(cells[4])==='—'||cellText(cells[5])==='—'||cellText(cells[6])==='0'||/0\.00$/.test(cellText(cells[8]));}
function inventorySummary(list){const p=list.filter(x=>Number(x.qty||0)>0),priority=['In Transit','Maintenance','Inspection','At Client','Reserved','Missing','Stolen','Not Available','At Supplier','Available'];return!p.length?{status:'Not Available',location:'No Stock'}:{status:priority.find(s=>p.some(x=>x.status===s))||'Not Available',location:p.length===1?p[0].locationName:`${p.length} Locations`};}

async function enrichTable(force=false){
  const table=document.querySelector('#docTable table');if(!table)return;
  const groups=await clientGroups(force),rows=[...table.querySelectorAll('tbody tr')];
  for(const tr of rows){
    const cells=[...tr.children];if(cells.length<11||!incomplete(cells))continue;
    const po=cellText(cells[0]),business=cellText(cells[1]);
    const g=groups.find(x=>norm(x.referenceNumber)===norm(po)&&(!business||norm(x.partyName||x.toName)===norm(business)));
    if(!g)continue;
    const s=await movementSummary(g);if(!s)continue;
    if(cellText(cells[3])==='—'&&s.periodFrom)cells[3].textContent=s.periodFrom;
    if(cellText(cells[4])==='—'&&s.periodTo)cells[4].textContent=s.periodTo;
    if(cellText(cells[5])==='—')cells[5].textContent=String(s.expected);
    if(cellText(cells[6])==='0'||cellText(cells[6])==='—')cells[6].textContent=String(s.current);
    if(cellText(cells[7])==='—')cells[7].textContent=String(s.outstanding);
    if(/0\.00$/.test(cellText(cells[8]))&&s.poAmount>0)cells[8].textContent=`${s.currency} ${money(s.poAmount)}`;
    if(/0\.00$/.test(cellText(cells[10]))&&s.poAmount>0)cells[10].textContent=`${s.currency} ${money(s.poAmount)}`;
    tr.dataset.imsMovementEnriched='1';
  }
  installReturnRelease();
  window.IMSDueWarning?.refresh?.(false);
}

function openPOIdentity(){
  const section=document.querySelector('#docDetail section');if(!section)return null;
  const h2=section.querySelector('h2');
  const text=String(h2?.textContent||'').trim();
  const m=text.match(/^Client PO\s+(.+)$/i);if(!m)return null;
  const po=m[1].trim();
  const info=h2?.parentElement?.querySelector('.text-xs.text-slate-500');
  const business=String(info?.textContent||'').split('·')[0].trim();
  return{po,business};
}

async function findOpenClientPO(){
  const id=openPOIdentity();if(!id)throw new Error('Unable to identify the open Client PO.');
  const snap=await getDocs(query(collection(db,'document_refs'),where('poNumber','==',id.po),limit(10)));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.commercialSide==='client'&&(!id.business||norm(x.businessName)===norm(id.business)));
  if(rows.length!==1)throw new Error(rows.length?'More than one matching Client PO was found.':'Client PO record was not found.');
  return rows[0];
}

async function releaseExtendedItemsForReturn(){
  const btn=document.getElementById('dueReturn');if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Releasing…';}
  try{
    const po=await findOpenClientPO(),ids=[...new Set((Array.isArray(po.linkedItemIds)?po.linkedItemIds:[]).filter(Boolean))];
    if(!ids.length)throw new Error('This Client PO has no linked items.');
    const a=await actor(),stamp=now(),batch=writeBatch(db);let releasedItems=0,releasedQty=0;
    for(const id of ids){
      const ref=doc(db,'inventory',id),snap=await getDoc(ref);if(!snap.exists())continue;
      const item=snap.data(),bs=(Array.isArray(item.stockBalances)?item.stockBalances:[]).map(b=>({...b}));let changed=false,itemQty=0;
      for(let n=0;n<bs.length;n++){
        const b=bs[n],match=b.status==='Not Available'&&b.locationType==='client'&&String(b.locationId||'')===String(po.businessId||'')&&String(b.extensionCommercialKey||'')===String(po.commercialKey||'')&&Number(b.qty||0)>0;
        if(!match)continue;
        itemQty+=Number(b.qty||0);
        const next={...b,status:'At Client'};
        delete next.extensionCommercialKey;delete next.extensionPONumber;delete next.extensionStartedAt;delete next.extensionStartedBy;
        bs[n]=next;changed=true;
      }
      if(!changed)continue;
      const sum=inventorySummary(bs);releasedItems++;releasedQty+=itemQty;
      batch.update(ref,{stockBalances:bs,status:sum.status,currentLocation:sum.location,lastEditedAt:stamp,lastEditedBy:a.email});
    }
    if(!releasedItems){alert('No extended items on this PO need releasing. Items already At Client are already returnable through Movement.');return;}
    batch.update(doc(db,'document_refs',po.id),{returnReleasedAt:stamp,returnReleasedBy:a.email,lastEditedAt:stamp,lastEditedBy:a.email});
    await batch.commit();
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'RELEASE_CLIENT_PO_FOR_RETURN',module:'Documents',targetType:'commercial_po',targetName:po.poNumber||po.refNumber||'',targetId:po.id,summary:`Release Client PO ${po.poNumber||po.refNumber||''} items for Return from Client`,beforeValue:{inventoryStatus:'Not Available',commercialKey:po.commercialKey||''},afterValue:{inventoryStatus:'At Client',releasedItems,releasedQty},changedFields:['inventory.stockBalances.status','inventory.extensionCommercialKey'],remark:'Document action only releases extended items back to At Client. Physical return must be performed once through Movement > Return from Client.',performedBy:a.email,performedByRole:a.role,performedAt:stamp});
    alert(`${releasedItems} item(s) are now At Client and available for the normal Movement > Return from Client flow. No movement or transit was created.`);
    await window.IMSDocuments?.show?.(true);
  }catch(e){console.error('IMS release Client PO for return failed:',e);alert('Unable to release items for return: '+(e?.message||e));}
  finally{const b=document.getElementById('dueReturn');if(b){b.disabled=false;b.textContent='Return from Client';}}
}

function installReturnRelease(){
  const btn=document.getElementById('dueReturn');if(!btn||btn.dataset.imsReturnRelease==='1')return;
  btn.dataset.imsReturnRelease='1';
  btn.title='Makes extended items At Client and returnable. The actual physical return is done once in Movement.';
  btn.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();releaseExtendedItemsForReturn();};
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{enrichTable(false).catch(e=>console.error('IMS client document enrichment failed:',e));installReturnRelease();},90);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:invoices-ready',()=>enrichTable(true).catch(console.error));
window.addEventListener('ims:modules-ready',()=>enrichTable(true).catch(console.error));
enrichTable(true).catch(e=>console.error('IMS client document enrichment failed:',e));
window.IMSClientDocEnrichment=Object.freeze({enrichTable,releaseExtendedItemsForReturn,installReturnRelease});
export{enrichTable,releaseExtendedItemsForReturn,installReturnRelease};