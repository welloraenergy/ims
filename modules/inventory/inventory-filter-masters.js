import {db} from '../../firebase-config.js';
import {collection,getDocs} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

let categories=[],locations=[],loading=null;
const active=x=>x?.status!=='inactive';
const partyName=x=>x?.companyName||x?.clientName||x?.supplierName||'';
const uniq=values=>[...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));

async function loadMasters(){
  if(loading)return loading;
  loading=(async()=>{
    const [settingsSnap,clientsSnap,suppliersSnap]=await Promise.all([
      getDocs(collection(db,'settings')),
      getDocs(collection(db,'client_profiles')),
      getDocs(collection(db,'supplier_profiles'))
    ]);
    const settings=settingsSnap.docs.map(d=>({id:d.id,...d.data()})).filter(active);
    const clients=clientsSnap.docs.map(d=>({id:d.id,...d.data()})).filter(active);
    const suppliers=suppliersSnap.docs.map(d=>({id:d.id,...d.data()})).filter(active);
    categories=uniq(settings.filter(x=>x.type==='category').map(x=>x.value));
    locations=uniq([
      ...settings.filter(x=>x.type==='warehouse').map(x=>x.value),
      ...clients.map(partyName),
      ...suppliers.map(partyName)
    ]);
    return{categories,locations};
  })().catch(error=>{loading=null;throw error;});
  return loading;
}

function refill(select,values,label){
  if(!select)return;
  const current=select.value;
  select.innerHTML=`<option value="">All ${label}</option>${values.map(v=>`<option value="${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('')}`;
  if([...select.options].some(o=>o.value===current))select.value=current;
}

async function hydrate(){
  const category=document.getElementById('stockCategoryFilter'),location=document.getElementById('stockLocationFilter');
  if(!category&&!location)return;
  try{
    await loadMasters();
    if(category&&category.dataset.imsMasterHydrated!=='1'){
      refill(category,categories,'Categories');
      category.dataset.imsMasterHydrated='1';
    }
    if(location&&location.dataset.imsMasterHydrated!=='1'){
      refill(location,locations,'Locations');
      location.dataset.imsMasterHydrated='1';
    }
  }catch(error){console.error('IMS inventory filter master load failed:',error);}
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(hydrate,25);}).observe(document.body,{childList:true,subtree:true});
hydrate();
window.IMSInventoryFilterMasters=Object.freeze({hydrate,reload:()=>{loading=null;return loadMasters().then(hydrate);}});
window.dispatchEvent(new CustomEvent('ims:inventory-filter-masters-ready'));
export{hydrate};