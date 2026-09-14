const detailRoot=()=>document.getElementById('docDetail');

function labelText(input){
  const label=input?.closest('label');
  if(!label)return;
  const first=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  if(first&&!/Auto/i.test(first.textContent))first.textContent='Expected Qty (Auto)';
}

function linkedCount(){
  const root=detailRoot();
  if(!root)return 0;
  return root.querySelectorAll('.openDocItem[data-id]').length;
}

function isClientPO(){
  const title=detailRoot()?.querySelector('h2')?.textContent||'';
  return /^Client PO\b/i.test(title.trim());
}

function applyAutoExpected(){
  const input=document.getElementById('docExpected');
  if(!input)return;
  labelText(input);
  input.readOnly=true;
  input.setAttribute('aria-readonly','true');
  input.title='Calculated automatically by IMS';
  input.classList.add('opacity-80','cursor-not-allowed');
  if(isClientPO())input.value=String(linkedCount());
}

// Re-apply whenever the Documents module renders/open a PO.
let timer;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(applyAutoExpected,30);
}).observe(document.body,{childList:true,subtree:true});

// Ensure the automatic value is in place before the module's Save PO handler reads it.
document.addEventListener('click',event=>{
  if(event.target.closest?.('#savePO'))applyAutoExpected();
},true);

window.addEventListener('ims:modules-ready',applyAutoExpected);
window.addEventListener('ims:invoices-ready',applyAutoExpected);
applyAutoExpected();

window.IMSPOAutoExpected=Object.freeze({apply:applyAutoExpected});
