import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { NAVIGATION, can, currentRole } from './ims-permissions.js';

const STAR='<span class="ims-required-star text-red-400"> *</span>';
const REQUIRED_IDS=new Set([
  'r2rType','r2rQty','r2rUnit','r2rName','r2rAliases','r2rCategory','r2rSupplier','r2rPO','r2rWarehouse',
  'resLocation','resClient',
  'bmAction','bmSource','bmDestination',
  'scType','scSrcType','scSrc','scMode','scNo','scDate','scEndG','scEndDate','scRetG','scDstType','scDst',
  'incLookupValue','incType','incDate','dispLookupValue','dispType','dispDate',
  'docInvNo','docInvDate','docInvAmount'
]);
const REQUIRED_CLASSES=['resLookupValue','resQty','bmQty'];
const BUTTON_REQUIREMENTS={
  resSave:['#resLocation','#resClient','.resRow .resLookupValue','.resRow .resQty'],
  incSave:['#incLookupValue','#incDate'],
  dispSave:['#dispLookupValue','#dispDate'],
  scStart:['#scSrc','#scNo','#scDate'],
  scEnd:['#scEndG','#scEndDate'],
  scReturn:['#scRetG','#scDst'],
  attachInvoice:['#docInvNo','#docInvDate','#docInvAmount']
};
function labelFor(el){return el.closest('label')||document.querySelector(`label[for="${CSS.escape(el.id||'')}"]`);}
function markLabel(el){const label=labelFor(el);if(!label||label.querySelector('.ims-required-star'))return;const firstText=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(firstText){const span=document.createElement('span');span.className='ims-required-star text-red-400';span.textContent=' *';firstText.after(span);return;}label.insertAdjacentHTML('afterbegin',STAR);}
function clearRequired(el){if(!el)return;el.required=false;el.removeAttribute('aria-required');}
function requireEl(el){if(!el||el.disabled)return;el.required=true;el.setAttribute('aria-required','true');markLabel(el);}
function syncServiceProvider(){const mode=document.getElementById('scMode'),provider=document.getElementById('scProv');if(!provider)return;if(mode?.value==='Sent To')requireEl(provider);else clearRequired(provider);}
function syncMovementReference(){const mode=document.getElementById('bmGroupMode'),reference=document.getElementById('bmReference'),existing=document.getElementById('bmExistingGroup');if(!mode)return;if(mode.value==='existing'){clearRequired(reference);requireEl(existing);}else{clearRequired(existing);requireEl(reference);}}
function syncConditional(){syncServiceProvider();syncMovementReference();}
function applyRequiredFields(){for(const id of REQUIRED_IDS){const el=document.getElementById(id);if(el)requireEl(el);}for(const cls of REQUIRED_CLASSES)document.querySelectorAll(`.${cls}`).forEach(requireEl);syncConditional();}
function invalidElement(selectors){for(const selector of selectors){const els=[...document.querySelectorAll(selector)];if(!els.length)continue;for(const el of els){if(el.disabled)continue;if(el.matches('input,select,textarea')&&(!String(el.value||'').trim()||!el.checkValidity()))return el;}}return null;}
function validateButton(button){const selectors=BUTTON_REQUIREMENTS[button.id];if(!selectors)return true;const bad=invalidElement(selectors);if(!bad)return true;bad.reportValidity?.();bad.focus?.();return false;}
document.addEventListener('change',e=>{if(e.target?.id==='scMode'||e.target?.id==='bmGroupMode')syncConditional();},true);
document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(!button||!BUTTON_REQUIREMENTS[button.id])return;if(!validateButton(button)){e.preventDefault();e.stopImmediatePropagation();}},true);
let requiredTimer;
const requiredObserver=new MutationObserver(()=>{clearTimeout(requiredTimer);requiredTimer=setTimeout(applyRequiredFields,20);});
requiredObserver.observe(document.documentElement,{childList:true,subtree:true});
applyRequiredFields();
window.IMSRequiredFields=Object.freeze({apply:applyRequiredFields});

const ROLE=currentRole();
const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function allowedNavigation(){return NAVIGATION.filter(x=>!x.permission||can(x.permission));}
function rolePage(role){return role==='superadmin'?'superadmin.html':role==='manager'?'manager.html':role==='admin'?'admin.html':'index.html';}

function renderShell(profile,user){
  document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 lg:flex">
    <aside class="lg:w-64 lg:min-h-screen bg-slate-900 border-r border-slate-800 p-4 lg:sticky lg:top-0 lg:h-screen">
      <div class="relative mb-5">
        <div class="flex flex-col items-center text-center">
          <img src="./icon-192.png" width="192" height="192" alt="Wellora Energy" class="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-2" draggable="false">
          <div class="text-xl font-black tracking-tight text-white">IMS</div>
          <div class="text-[11px] font-bold uppercase tracking-[0.18em]" style="color:#d3af36">${esc(profile.role)}</div>
        </div>
        <button id="logoutBtn" class="absolute right-0 top-0 lg:hidden bg-slate-800 px-3 py-2 rounded-lg text-xs">Logout</button>
      </div>
      <nav id="navTabs" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">${allowedNavigation().map(x=>`<button data-tab="${esc(x.id)}" class="navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800">${esc(x.label)}</button>`).join('')}</nav>
      <div class="hidden lg:block mt-6 pt-4 border-t border-slate-800"><div id="currentUser" class="text-xs text-slate-400 break-all">${esc(profile.email||user.email||'')}</div><button id="logoutBtnDesktop" class="mt-3 w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg text-xs font-bold">Logout</button></div>
    </aside>
    <main class="flex-1 min-w-0 p-3 sm:p-5 lg:p-7 overflow-x-hidden"><div class="w-full max-w-none min-w-0"><div class="mb-5"><h1 id="pageTitle" class="text-xl sm:text-2xl font-bold">Main Workspace</h1><p id="pageSubtitle" class="text-xs text-slate-500 mt-1">Loading IMS modules…</p></div><div id="appContent" class="w-full min-w-0"><section class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">Loading authorized modules…</section></div></div></main>
  </div>`;
  const logout=()=>signOut(auth).then(()=>location.href='index.html');
  byId('logoutBtn').onclick=logout;byId('logoutBtnDesktop').onclick=logout;
  window.IMSUser=Object.freeze({uid:user.uid,email:profile.email||user.email||'',role:profile.role,status:profile.status||'active'});
  window.dispatchEvent(new CustomEvent('ims:auth-ready',{detail:window.IMSUser}));
}

async function routeTab(tab){
  if(tab==='workspace')return window.IMSWorkspace?.show?.();
  if(tab==='stock')return window.IMSInventory?.show?.('overview');
  if(tab==='invoices')return window.IMSInvoices?.show?.();
  if(tab==='renttorent')return window.IMSRentToRent?.show?.();
  if(tab==='reservation')return window.IMSReservation?.show?.();
  if(tab==='disposition')return window.IMSDisposition?.show?.();
  if(tab==='incident')return window.IMSIncident?.show?.();
  if(tab==='logs')return window.IMSRecords?.render?.('');
  if(tab==='businesses')return window.IMSBusinesses?.show?.();
  if(tab==='settings'){await window.IMSMasters?.reload?.();return window.IMSMasters?.render?.();}
  if(tab==='audit'){await window.IMSAudit?.reload?.();return window.IMSAudit?.render?.();}
  if(tab==='users'){await window.IMSUsers?.reload?.();return window.IMSUsers?.render?.();}
}

function bindNavigation(){
  const nav=byId('navTabs');if(!nav||nav.dataset.imsRouter==='1')return;
  nav.dataset.imsRouter='1';
  nav.addEventListener('click',event=>{
    const btn=event.target.closest?.('.navBtn[data-tab]');if(!btn)return;
    event.preventDefault();event.stopPropagation();
    routeTab(btn.dataset.tab).catch(err=>{console.error(`IMS navigation failed: ${btn.dataset.tab}`,err);alert(`Unable to open ${btn.textContent.trim()}: ${err?.message||err}`);});
  },true);
}

function activateWorkspace(){
  if(!byId('appContent'))return;
  if(window.IMSWorkspace?.show){window.IMSWorkspace.show();return;}
  const onReady=()=>{window.removeEventListener('ims:workspace-ready',onReady);window.IMSWorkspace?.show?.();};
  window.addEventListener('ims:workspace-ready',onReady,{once:true});
}

function showStartupError(err){document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"><div class="w-full max-w-xl bg-red-950/40 border border-red-900 rounded-2xl p-5"><div class="text-lg font-bold text-red-300">IMS failed to start</div><div class="text-sm text-slate-300 mt-3">${esc(err?.message||String(err))}</div><div class="text-xs text-slate-500 mt-3">Role page: ${esc(ROLE)}. Check the Firestore user profile and browser console.</div><button id="imsStartupBack" class="mt-4 bg-slate-700 px-4 py-2 rounded-lg text-sm">Back to Login</button></div></div>`;byId('imsStartupBack').onclick=()=>location.href='index.html';}

document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"><div class="text-center"><div class="text-xl font-bold text-red-400">IMS</div><div class="text-sm text-slate-400 mt-2">Authenticating ${esc(ROLE)}…</div></div></div>`;

onAuthStateChanged(auth,async user=>{
  try{
    if(!user){location.href='index.html';return;}
    const snap=await getDoc(doc(db,'users',user.uid));
    if(!snap.exists())throw new Error('User profile record is missing in Firestore.');
    const profile=snap.data();
    if(profile.status!=='active'){await signOut(auth);location.href='index.html';return;}
    if(profile.role!==ROLE){location.href=rolePage(profile.role);return;}
    renderShell(profile,user);
    bindNavigation();
    activateWorkspace();
  }catch(err){console.error('IMS startup failed:',err);showStartupError(err);}
});

window.IMSBootstrap=Object.freeze({allowedNavigation,activateWorkspace,routeTab,bindNavigation});
window.dispatchEvent(new CustomEvent('ims:bootstrap-ready'));
