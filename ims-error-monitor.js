import {auth,db} from './firebase-config.js';
import {addDoc,collection} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const sent=new Map();
const WINDOW_MS=5*60*1000;
function text(v,max=900){return String(v??'').slice(0,max);}
function signature(message,source,line,column){return`${message}|${source}|${line}|${column}`.slice(0,600);}
function allowed(sig){const n=Date.now(),last=sent.get(sig)||0;if(n-last<WINDOW_MS)return false;sent.set(sig,n);if(sent.size>100){for(const[k,t]of sent)if(n-t>WINDOW_MS)sent.delete(k);}return true;}
async function record({message='',source='',line=0,column=0,stack='',kind='error'}={}){
  const user=auth.currentUser;if(!user||!navigator.onLine)return;
  const sig=signature(message,source,line,column);if(!allowed(sig))return;
  try{
    await addDoc(collection(db,'operational_logs'),{
      logVersion:3,date:new Date().toISOString(),module:'Client Monitor',activity:'CLIENT_ERROR',activityLabel:'Client Error',status:'Error',kind,
      message:text(message),source:text(source,500),line:Number(line||0),column:Number(column||0),stack:text(stack,1800),
      page:text(location.pathname+location.search,500),userAgent:text(navigator.userAgent,500),
      performedBy:window.IMSUser?.email||user.email||'',performedByRole:window.IMS_ROLE||''
    });
  }catch(e){console.warn('IMS error telemetry write failed:',e);}
}
window.addEventListener('error',e=>record({message:e.message||e.error?.message||'Window error',source:e.filename||'',line:e.lineno,column:e.colno,stack:e.error?.stack||'',kind:'error'}));
window.addEventListener('unhandledrejection',e=>{const r=e.reason;record({message:r?.message||r||'Unhandled rejection',stack:r?.stack||'',kind:'unhandledrejection'});});
window.IMSErrorMonitor=Object.freeze({record});
window.dispatchEvent(new CustomEvent('ims:error-monitor-ready'));
export{record};
