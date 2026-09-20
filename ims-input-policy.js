import {db} from './firebase-config.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const PREF_ID='system-input-uppercase';
let enabled=true;

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
  window.dispatchEvent(new CustomEvent('ims:input-policy-ready',{detail:{enabled}}));
  return enabled;
}

document.addEventListener('input',e=>uppercase(e.target),true);
document.addEventListener('change',e=>uppercase(e.target),true);
document.addEventListener('submit',e=>uppercaseForm(e.target),true);
window.addEventListener('ims:input-policy-changed',()=>reload().catch(console.error));
reload().catch(console.error);

window.IMSInputPolicy=Object.freeze({reload,isEnabled:()=>enabled,uppercaseForm,PREF_ID});
export{reload,uppercaseForm,PREF_ID};
