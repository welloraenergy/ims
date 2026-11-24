(()=>{
  const pad=n=>String(n).padStart(2,'0');

  function formatIsoMatch(full,y,m,d,hh,mm,ss){
    const date=`${d}/${m}/${y.slice(-2)}`;
    if(!hh)return date;
    const value=new Date((full.replace(' ','T').endsWith('Z')?full.replace(' ','T'):full.replace(' ','T')+'Z'));
    if(Number.isNaN(value.getTime()))return `${date} ${hh}:${mm}${ss?`:${ss}`:''}`;
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',...(ss?{second:'2-digit'}:{}),hourCycle:'h23'}).format(value).replace(',','');
  }

  function formatUsDateTimeMatch(full,m,d,y,h,mi,s,amp){
    let hour=Number(h);
    const ap=String(amp||'').toUpperCase();
    if(ap==='PM'&&hour<12)hour+=12;
    if(ap==='AM'&&hour===12)hour=0;
    return `${pad(d)}/${pad(m)}/${y.slice(-2)} ${pad(hour)}:${mi}${s?`:${s}`:''}`;
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
        .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?)?\b/g,formatIsoMatch)
        .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/gi,formatUsDateTimeMatch);
      if(n!==t)node.nodeValue=n;
    }
  }

  const dateFields=new Map();
  function protectDateInput(el){
    if(!el||dateFields.has(el)||!el.parentNode)return;
    el.lang='en-GB';el.autocomplete='off';el.title='Select date from calendar — DD/MM/YY';
    const wrap=document.createElement('span'),display=document.createElement('span'),value=document.createElement('span'),icon=document.createElement('span');
    wrap.style.cssText='display:grid;min-width:0;position:relative;';wrap.dataset.imsDateField='1';
    display.className=el.className;display.style.cssText='grid-area:1/1;display:flex;align-items:center;justify-content:space-between;gap:8px;pointer-events:none;min-width:0;';display.setAttribute('aria-hidden','true');
    icon.textContent='▦';icon.style.cssText='font-size:1em;opacity:.8;';display.append(value,icon);
    el.parentNode.insertBefore(wrap,el);wrap.append(display,el);
    el.style.gridArea='1/1';el.style.opacity='0';el.style.cursor='pointer';el.style.zIndex='1';
    const sync=()=>{
      const iso=el.value,formatted=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(2,4):'dd/mm/yy';
      if(value.textContent!==formatted)value.textContent=formatted;
      display.style.opacity=el.disabled?'.5':'1';
      value.style.opacity=iso?'1':'.55';
      if(el.className!==display.className)display.className=el.className;
      wrap.style.display=el.hidden||getComputedStyle(el).display==='none'?'none':'grid';
      display.style.outline=document.activeElement===el?'2px solid #22d3ee':'';
      display.style.outlineOffset='2px';
    };
    dateFields.set(el,sync);sync();
    ['input','change','focus','blur'].forEach(event=>el.addEventListener(event,sync));
    el.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape')return;if(e.key==='Enter'||e.key===' '){e.preventDefault();if(typeof el.showPicker==='function'){try{el.showPicker();}catch{}}}});
    el.addEventListener('click',()=>{if(typeof el.showPicker==='function'){try{el.showPicker();}catch{}}});
  }
  // Date inputs keep their native ISO value, calendar, validation and events.
  // Refresh presentation when existing modules assign .value programmatically.
  setInterval(()=>{for(const [el,sync] of dateFields){if(!el.isConnected){dateFields.delete(el);continue;}sync();}},250);

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
