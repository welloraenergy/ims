import {auth,db} from './firebase-config.js';
import {addDoc,collection,doc,getDoc,setDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import {can} from './ims-permissions.js';

const PREF_ID='system-input-uppercase';
let enabled=true;
const now=()=>new Date().toISOString();

function eligible(el){
  if(el instanceof HTMLTextAreaElement)return true;
  if(!(el instanceof HTMLInputElement))return false;
  const type=String(el.type||'text').toLowerCase();
  return type==='text'||type==='search'||type==='tel';
}
function uppercase(el){
  if(!enabled||!eligible(el)||el.disabled||el.readOnly)return;
  const before=el.value||'',after=before.toUpperCase();
  if(after===before)return;
  const start=el.selectionStart,end=el.selectionEnd;
  el.value=after;
  if(document.activeElement===el&&start!==null&&end!==null){try{el.setSelectionRange(start,end);}catch{}}
}
function uppercaseForm(form){for(const el of form?.querySelectorAll?.('input,textarea')||[])uppercase(el);}
async function reload(){
  try{
    const snap=await getDoc(doc(db,'settings',PREF_ID));
    enabled=!snap.exists()||snap.data()?.enabled!==false;
  }catch(error){
    console.warn('IMS input policy preference unavailable; defaulting to uppercase enabled.',error);
    enabled=true;
  }
  renderSetting();
  window.dispatchEvent(new CustomEvent('ims:input-policy-ready',{detail:{enabled}}));
  return enabled;
}
async function audit(before,after){
  try{
    await addDoc(collection(db,'audit_traces'),{
      traceVersion:3,actionType:'CHANGE_SYSTEM_SETTING',module:'Global Settings',targetType:'system_preference',targetName:'Force text input to UPPERCASE',targetId:PREF_ID,summary:`Force text input to UPPERCASE: ${after?'ON':'OFF'}`,beforeValue:{enabled:before},afterValue:{enabled:after},changedFields:['enabled'],remark:'Email inputs are excluded.',performedBy:window.IMSUser?.email||auth.currentUser?.email||'',performedByRole:window.IMS_ROLE||'',performedAt:now()
    });
  }catch(error){console.warn('IMS input policy audit failed:',error);}
}
async function setEnabled(next){
  if(!can('masters.status'))return;
  const before=enabled;
  await setDoc(doc(db,'settings',PREF_ID),{type:'system_preference',value:'input_uppercase',enabled:Boolean(next),status:'active',updatedAt:now(),updatedBy:window.IMSUser?.email||auth.currentUser?.email||''},{merge:true});
  enabled=Boolean(next);
  await audit(before,enabled);
  renderSetting();
  window.dispatchEvent(new CustomEvent('ims:input-policy-ready',{detail:{enabled}}));
}
function renderSetting(){
  if((document.getElementById('pageTitle')?.textContent||'').trim()!=='Global Settings')return;
  const root=document.getElementById('imsMastersModule');if(!root)return;
  let card=document.getElementById('imsInputPolicySetting');
  if(!card){
    card=document.createElement('section');
    card.id='imsInputPolicySetting';
    card.className='w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl';
    root.firstElementChild?.after(card);
  }
  const editable=can('masters.status'),state=`${enabled?'1':'0'}|${editable?'1':'0'}`;
  if(card.dataset.state===state)return;
  card.dataset.state=state;
  card.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-bold text-sm sm:text-base">Input Format</h2><p class="text-xs text-slate-400 mt-1">Force normal text inputs and textareas to UPPERCASE across IMS. Email fields are not changed.</p></div><button id="imsUppercaseToggle" type="button" class="${enabled?'bg-emerald-700':'bg-slate-700'} px-4 py-2 rounded-lg text-xs font-bold" ${editable?'':'disabled'}>${enabled?'ON':'OFF'}</button></div>`;
  const btn=document.getElementById('imsUppercaseToggle');if(btn&&editable)btn.onclick=()=>setEnabled(!enabled).catch(e=>alert('Unable to change input format setting: '+(e?.message||e)));
}

document.addEventListener('input',e=>uppercase(e.target),true);
document.addEventListener('change',e=>uppercase(e.target),true);
document.addEventListener('submit',e=>uppercaseForm(e.target),true);
window.addEventListener('ims:input-policy-changed',()=>reload().catch(console.error));
window.addEventListener('ims:masters-ready',()=>setTimeout(renderSetting,0));
window.addEventListener('ims:modules-ready',()=>setTimeout(renderSetting,0));
new MutationObserver(()=>setTimeout(renderSetting,0)).observe(document.body,{childList:true,subtree:true});
reload().catch(console.error);

window.IMSInputPolicy=Object.freeze({reload,isEnabled:()=>enabled,uppercaseForm,setEnabled,PREF_ID});
export{reload,uppercaseForm,setEnabled,PREF_ID};
