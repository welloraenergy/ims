// Current Rent-to-Rent presentation refinement. Kept separate from the workflow engine because it is UI-only.
const $=id=>document.getElementById(id);
const KINDS=['supplier','clientIncoming','client','clientReturning','incoming','warehouse','returning'];
const TITLES={
  supplier:{title:'R2R Ready at Supplier',subtitle:'Supplier-owned stock ready for dispatch to client or warehouse'},
  clientIncoming:{title:'R2R Supplier → Client · In Transit',subtitle:'Direct deliveries awaiting client arrival confirmation'},
  client:{title:'R2R At Client',subtitle:'Supplier-owned rentals physically with clients'},
  clientReturning:{title:'R2R Client Returns · In Transit',subtitle:'Client returns awaiting arrival at supplier or warehouse'},
  incoming:{title:'R2R Supplier → Warehouse · In Transit',subtitle:'Physical R2R movements waiting for warehouse arrival'},
  warehouse:{title:'R2R in Warehouse',subtitle:'R2R items currently available in warehouse'},
  returning:{title:'R2R Warehouse → Supplier · In Transit',subtitle:'Physical R2R returns waiting for supplier arrival'}
};
function queueSection(kind){return $(kind+'List')?.closest('section')||null;}
function normalizeHeader(kind,section){
  const heading=section.querySelector('h2');
  if(!heading)return;
  heading.className='font-bold';
  heading.textContent=TITLES[kind].title;
  const parent=heading.parentElement;
  if(!parent)return;
  let left=null;
  if(parent.dataset?.r2rMovementHead==='1'){
    left=parent;
  }else{
    const existing=parent.querySelector(':scope > [data-r2r-movement-head="1"]');
    if(existing){
      left=existing;
    }else{
      left=document.createElement('div');
      left.dataset.r2rMovementHead='1';
      heading.replaceWith(left);
      left.appendChild(heading);
    }
  }
  const head=left.parentElement;
  if(head)head.className='flex flex-wrap justify-between gap-2 items-start mb-3';
  let sub=left.querySelector(':scope > [data-r2r-movement-subtitle="1"]');
  if(!sub){
    sub=document.createElement('div');
    sub.dataset.r2rMovementSubtitle='1';
    sub.className='text-[10px] text-slate-500 mt-0.5';
    left.appendChild(sub);
  }
  if(sub.textContent!==TITLES[kind].subtitle)sub.textContent=TITLES[kind].subtitle;
  const count=$(kind+'Count');
  if(count){
    count.className='text-[10px] text-emerald-400 mt-1';
    const raw=(count.textContent||'').replace(/\s*·\s*Firestore server pagination\s*$/,'').trim();
    const next=raw?raw+' · Firestore server pagination':'';
    if(count.textContent!==next)count.textContent=next;
  }
}
function hideLegacyControls(kind){
  const input=$(kind+'PO');
  const filterRow=input?.closest('.grid');
  if(filterRow&&!filterRow.classList.contains('hidden'))filterRow.classList.add('hidden');
  const bulk=$(kind+'Action');if(bulk&&!bulk.classList.contains('hidden'))bulk.classList.add('hidden');
  const list=$(kind+'List');if(list){list.classList.remove('max-w-5xl');list.classList.add('w-full');}
  const prev=$(kind+'Prev'),pager=prev?.parentElement;if(pager){pager.classList.remove('max-w-5xl');pager.classList.add('w-full');}
}
function normalizeCards(kind){
  const list=$(kind+'List');if(!list)return;
  if(list.className!=='space-y-2 w-full')list.className='space-y-2 w-full';
  [...list.children].forEach(card=>{
    if(!card.querySelector('.r2rOpen'))return;
    card.className='bg-slate-950 border border-slate-800 rounded-xl p-3';
    const row=card.firstElementChild;if(row)row.className='flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    const pick=card.querySelector(`.${kind}Pick`);if(pick){pick.classList.add('hidden');pick.setAttribute('aria-hidden','true');}
    const left=pick?.parentElement;if(left)left.className='min-w-0 flex-1';
    const open=card.querySelector('.r2rOpen');if(open)open.className='r2rOpen w-full text-left min-w-0 flex-1 hover:border-cyan-800';
    const grid=open?.querySelector('.grid');if(grid)grid.className='grid sm:grid-cols-2 lg:grid-cols-6 gap-2 mt-2';
    const movementLine=open?.querySelector('.font-mono.text-\[9px\]');if(movementLine)movementLine.classList.add('hidden');
    const action=card.querySelector('.r2rSingle');if(action)action.className='r2rSingle shrink-0 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-xs font-bold';
  });
}
function normalize(kind){const section=queueSection(kind);if(!section)return;section.className='w-full bg-slate-900 border border-slate-800 rounded-2xl p-4';normalizeHeader(kind,section);hideLegacyControls(kind);normalizeCards(kind);}
function attachImportExport(){window.IMSRegistrationCSV?.install?.();}
function apply(){if(!document.getElementById('r2rForm'))return;KINDS.forEach(normalize);attachImportExport();}
let timer;
new MutationObserver(mutations=>{
  const relevant=mutations.some(m=>m.type==='childList'&&(m.addedNodes.length||m.removedNodes.length));
  if(!relevant)return;
  clearTimeout(timer);
  timer=setTimeout(apply,20);
}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:renttorent-ready',()=>setTimeout(apply,0));
window.addEventListener('ims:registration-csv-ready',()=>setTimeout(attachImportExport,0));
apply();
window.IMSR2RMovementCardDesign=Object.freeze({apply});
window.dispatchEvent(new CustomEvent('ims:r2r-movement-card-design-ready'));
export{apply};