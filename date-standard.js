(()=>{
  const pad=n=>String(n).padStart(2,'0');

  function formatIsoMatch(full,y,m,d,hh,mm,ss){
    const date=`${d}/${m}/${y}`;
    return hh?`${date} ${hh}:${mm}${ss?`:${ss}`:''}`:date;
  }

  function formatUsDateTimeMatch(full,m,d,y,h,mi,s,amp){
    let hour=Number(h);
    const ap=String(amp||'').toUpperCase();
    if(ap==='PM'&&hour<12)hour+=12;
    if(ap==='AM'&&hour===12)hour=0;
    return `${pad(d)}/${pad(m)}/${y} ${pad(hour)}:${mi}${s?`:${s}`:''}`;
  }

  function normalizeVisibleText(root){
    if(!root)return;
    const start=root.nodeType===Node.TEXT_NODE?root.parentElement:root;
    if(!start)return;
    const walker=document.createTreeWalker(start,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(p.tagName)||p.closest('input,textarea,select'))continue;
      const t=node.nodeValue;if(!t||!t.trim())continue;
      const n=t
        .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?)?\b/g,formatIsoMatch)
        .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/gi,formatUsDateTimeMatch);
      if(n!==t)node.nodeValue=n;
    }
  }

  function protectDateInput(el){
    if(!el||el.dataset.imsDateProtected==='1')return;
    el.dataset.imsDateProtected='1';
    el.lang='en-GB';el.autocomplete='off';el.title='Select date from calendar — DD/MM/YYYY';el.style.cursor='pointer';
    el.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape')return;e.preventDefault();if(typeof el.showPicker==='function'){try{el.showPicker();}catch{}}});
    el.addEventListener('paste',e=>e.preventDefault());
    el.addEventListener('drop',e=>e.preventDefault());
    el.addEventListener('click',()=>{if(typeof el.showPicker==='function'){try{el.showPicker();}catch{}}});
  }

  function enhanceNode(root){
    if(!root)return;
    const el=root.nodeType===Node.ELEMENT_NODE?root:root.parentElement;
    if(!el)return;
    if(el.matches?.('input[type="date"]'))protectDateInput(el);
    el.querySelectorAll?.('input[type="date"]').forEach(protectDateInput);
    normalizeVisibleText(el);
  }

  let pending=new Set(),queued=false;
  const flush=()=>{queued=false;const nodes=[...pending];pending.clear();nodes.forEach(enhanceNode);};
  const queue=node=>{if(node)pending.add(node);if(!queued){queued=true;requestAnimationFrame(flush);}};

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='characterData')queue(m.target.parentElement);
      else m.addedNodes.forEach(queue);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  const initial=()=>enhanceNode(document.body);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initial);else initial();
})();
