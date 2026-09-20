(()=>{
  const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
  const MODEL_IDS=['regModel','r2rModel','ime-model'];

  function hideFieldById(id){
    const el=document.getElementById(id);if(!el)return;
    const label=el.closest('label');
    if(label){label.style.display='none';label.setAttribute('aria-hidden','true');return;}
    el.style.display='none';el.setAttribute('aria-hidden','true');
  }

  function hideItemDetailModel(){
    document.querySelectorAll('#itemDetailMount section').forEach(section=>{
      const title=norm(section.querySelector(':scope > h3')?.textContent);
      if(title!=='item specifications')return;
      section.querySelectorAll('.grid > div').forEach(card=>{
        const label=norm(card.querySelector('.text-[10px]')?.textContent);
        if(label==='model'){card.style.display='none';card.setAttribute('aria-hidden','true');}
      });
    });
  }

  function hideStockModelColumn(){
    document.querySelectorAll('#stockTable table').forEach(table=>{
      const heads=[...table.querySelectorAll('thead th')],idx=heads.findIndex(th=>norm(th.textContent)==='model');
      if(idx<0)return;
      table.querySelectorAll('tr').forEach(tr=>{const cell=tr.children[idx];if(cell)cell.style.display='none';});
    });
  }

  function patch(){
    MODEL_IDS.forEach(hideFieldById);
    hideItemDetailModel();
    hideStockModelColumn();
  }

  let timer;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patch,20);}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',patch,{once:true});
  patch();
  window.IMSHiddenModel=Object.freeze({patch});
})();
