import {db} from '../../firebase-config.js';
import {collection,getDocs,limit,query,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const $=id=>document.getElementById(id);
let installed=false;

function reservationState(item){
  const balances=Array.isArray(item?.stockBalances)?item.stockBalances:[];
  const reserved=balances.filter(b=>Number(b.qty||0)>0&&b.status==='Reserved');
  const activeId=String(item?.activeReservation?.reservationId||'');
  const balanceIds=[...new Set(reserved.map(b=>String(b.reservationId||'')).filter(Boolean))];
  return{reserved,activeId,balanceIds,isReserved:Boolean(item?.activeReservation)||reserved.length>0};
}

async function lookupItem(){
  const field=$('bmLookupField')?.value||'alias',value=$('bmLookupValue')?.value.trim()||'';
  if(!value)return null;
  const snap=await getDocs(query(collection(db,'inventory'),where(field,'==',value),limit(2)));
  if(snap.size!==1)return null;
  const d=snap.docs[0];
  return{id:d.id,...d.data()};
}

function reservationAllows(item){
  const selected=String($('bmReservation')?.value||''),state=reservationState(item);
  if(!state.isReserved)return{allowed:true};
  if(!selected)return{allowed:false,message:`${item.alias||item.itemCode||'This item'} is Reserved and is not Available for normal movement. Select its reservation to use it.`};
  const ids=new Set([state.activeId,...state.balanceIds].filter(Boolean));
  if(!ids.has(selected))return{allowed:false,message:`${item.alias||item.itemCode||'This item'} belongs to a different reservation and is unavailable.`};
  return{allowed:true};
}

async function validateAndForward(btn){
  try{
    const item=await lookupItem();
    if(item){const result=reservationAllows(item);if(!result.allowed){alert(result.message);return;}}
    btn.dataset.imsReservationGuardBypass='1';
    btn.click();
  }catch(e){console.error('IMS movement reservation guard:',e);alert('Unable to validate item reservation state: '+(e?.message||e));}
  finally{delete btn.dataset.imsReservationGuardBypass;}
}

function clickGuard(e){
  const btn=e.target.closest?.('#bmFindItem');
  if(!btn)return;
  if(btn.dataset.imsReservationGuardBypass==='1')return;
  e.preventDefault();e.stopImmediatePropagation();
  validateAndForward(btn);
}
function keyGuard(e){
  if(e.key!=='Enter'||e.target?.id!=='bmLookupValue')return;
  const btn=$('bmFindItem');if(!btn)return;
  e.preventDefault();e.stopImmediatePropagation();
  validateAndForward(btn);
}
function install(){if(installed)return;installed=true;document.addEventListener('click',clickGuard,true);document.addEventListener('keydown',keyGuard,true);}
install();
window.IMSMovementReservationGuard=Object.freeze({install,reservationAllows});
export{install,reservationAllows};
