import { can, currentRole } from './ims-permissions.js?v=20260920-85';

const IMS_BUILD='20260920-85';
const versioned=src=>`${src}${src.includes('?')?'&':'?'}v=${IMS_BUILD}`;

const MODULES=Object.freeze([
{id:'nav-active-fix',src:'./nav-active-fix.js',mode:'classic'},
{id:'date-standard',src:'./date-standard.js',mode:'classic'},
{id:'error-monitor',src:'./ims-error-monitor.js',owner:'IMSErrorMonitor'},
{id:'input-policy',src:'./ims-input-policy.js',owner:'IMSInputPolicy'},
{id:'masters',src:'./modules/masters/masters-module.js',permission:'masters.view',owner:'IMSMasters'},
{id:'masters-csv',src:'./modules/masters/master-import-export.js',roles:['manager','superadmin'],owner:'IMSMasterCSV'},
{id:'businesses',src:'./modules/businesses/business-module.js',permission:'business.view',owner:'IMSBusinesses'},
{id:'business-csv',src:'./modules/businesses/business-import-export.js',roles:['manager','superadmin'],owner:'IMSBusinessCSV'},
{id:'users',src:'./modules/users/users-module.js',permission:'users.view',owner:'IMSUsers'},
{id:'audit',src:'./modules/audit/audit-module.js',permission:'audit.view',owner:'IMSAudit'},
{id:'reversal',src:'./modules/reversal/reversal-module.js',roles:['superadmin'],owner:'IMSReversal'},
{id:'reversal-search',src:'./modules/reversal/reversal-search.js',roles:['superadmin'],owner:'IMSReversalSearch'},
{id:'reversal-lifecycle',src:'./modules/reversal/reversal-lifecycle.js',roles:['superadmin'],owner:'IMSReversalLifecycle'},
{id:'reversal-status',src:'./modules/reversal/reversal-status.js',roles:['superadmin'],owner:'IMSReversalStatus'},
{id:'reversal-wiring',src:'./modules/reversal/reversal-wiring.js',roles:['superadmin'],owner:'IMSReversalWiring'},
{id:'records',src:'./modules/records/records-module.js',permission:'records.view',owner:'IMSRecords'},
{id:'backup',src:'./modules/backup/recovery-module.js',permission:'backup.create',owner:'IMSBackup'},
{id:'backup-v8',src:'./modules/backup/backup-v8.js',roles:['superadmin'],owner:'IMSBackupV8'},
{id:'items',src:'./modules/items/item-module.js',permission:'inventory.view',owner:'IMSItems'},
{id:'inventory',src:'./modules/inventory/inventory-module.js',permission:'inventory.view',owner:'IMSInventory'},
{id:'inventory-filter-masters',src:'./modules/inventory/inventory-filter-masters.js',permission:'inventory.view',owner:'IMSInventoryFilterMasters'},
{id:'workspace',src:'./modules/workspace/workspace-module.js',permission:'app.view',owner:'IMSWorkspace'},
{id:'registration',src:'./modules/registration/registration-module.js',permission:'inventory.add',owner:'IMSRegistration'},
{id:'registration-import-export',src:'./modules/registration/registration-import-export.js',roles:['manager','superadmin'],owner:'IMSRegistrationCSV'},
{id:'movement',src:'./modules/movement/movement-module.js',permission:'movement.view',owner:'IMSMovement'},
{id:'movement-reservation-guard',src:'./modules/movement/movement-reservation-guard.js',permission:'movement.view',owner:'IMSMovementReservationGuard'},
{id:'service-cycle',src:'./modules/service-cycle/service-cycle-module.js',permission:'servicecycle.view',owner:'IMSServiceCycle'},
{id:'invoices',src:'./modules/invoices/invoice-module.js',permission:'documents.view',owner:'IMSInvoices'},
{id:'renttorent',src:'./modules/renttorent/renttorent-module.js',permission:'renttorent.view',owner:'IMSRentToRent'},
{id:'r2r-ui',src:'./modules/renttorent/renttorent-ui.js',permission:'renttorent.view',owner:'IMSR2RMovementCardDesign'},
{id:'reservation',src:'./modules/reservation/reservation-module.js',permission:'reservation.view',owner:'IMSReservation'},
{id:'disposition',src:'./modules/disposition/disposition-module.js',permission:'disposition.view',owner:'IMSDisposition'},
{id:'incident',src:'./modules/incident/incident-module.js',permission:'incident.view',owner:'IMSIncident'},
{id:'alpha-usability',src:'./ims-alpha-usability.js',owner:'IMSAlphaUsability'},
{id:'available-picker-pagination',src:'./modules/shared/paginated-available-pickers.js',owner:'IMSAvailablePickerPagination'},
{id:'commercial-context',src:'./ims-commercial-context.js',owner:'IMSCommercialContext'},
{id:'client-due-warning',src:'./ims-client-due-warning.js',owner:'IMSDueWarning'},
{id:'client-doc-enrichment',src:'./ims-client-doc-enrichment.js',owner:'IMSClientDocEnrichment'},
{id:'inventory-sort',src:'./modules/inventory/inventory-sort.js',permission:'inventory.view',owner:'IMSInventoryServerSort'},
{id:'service-transit-fix',src:'./modules/service-cycle/service-cycle-transit-fix.js',permission:'servicecycle.view',owner:'IMSServiceTransitFix'},
{id:'service-enhancements',src:'./modules/service-cycle/service-cycle-enhancements.js',permission:'servicecycle.view',owner:'IMSServiceEnhancements'},
{id:'item-master-editor',src:'./modules/items/item-master-editor.js',permission:'inventory.view',owner:'IMSItemMasterEditor'},
{id:'sortable-tables',src:'./sortable-tables.js',mode:'classic'},
{id:'print-clean',src:'./print-clean.js',mode:'classic',permission:'records.print.pdf'}
]);
function allowed(def){const role=currentRole();if(def.roles&&!def.roles.includes(role))return false;if(def.permission&&!can(def.permission,role))return false;return true;}
function waitForAuth(){if(window.IMSUser&&document.getElementById('navTabs'))return Promise.resolve();return new Promise(resolve=>window.addEventListener('ims:auth-ready',()=>resolve(),{once:true}));}
function loadClassic(def){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=versioned(def.src);s.async=false;s.dataset.imsModule=def.id;s.onload=()=>resolve(def.id);s.onerror=()=>reject(new Error(`Failed to load ${def.src}`));document.body.appendChild(s);});}
async function loadModule(def){await import(versioned(def.src));return def.id;}
async function loadOne(def){await(def.mode==='classic'?loadClassic(def):loadModule(def));if(def.owner&&!window[def.owner])throw new Error(`${def.id} imported but did not publish window.${def.owner}`);return def.id;}
function refreshImportExport(){if(window.IMSRegistrationCSV?.install){queueMicrotask(()=>window.IMSRegistrationCSV?.install?.());setTimeout(()=>window.IMSRegistrationCSV?.install?.(),100);}if(window.IMSBusinessCSV?.install){queueMicrotask(()=>window.IMSBusinessCSV?.install?.());setTimeout(()=>window.IMSBusinessCSV?.install?.(),150);}if(window.IMSMasterCSV?.install){queueMicrotask(()=>window.IMSMasterCSV?.install?.());setTimeout(()=>window.IMSMasterCSV?.install?.(),150);}}
function bindDirectNavigation(){const stock=document.querySelector('.navBtn[data-tab="stock"]');if(stock&&window.IMSInventory)stock.onclick=()=>window.IMSInventory.show('overview');const workspace=document.querySelector('.navBtn[data-tab="workspace"]');if(workspace&&window.IMSWorkspace)workspace.onclick=()=>window.IMSWorkspace.show();}
function publishStatus(loaded,failed,skipped){const owners=Object.fromEntries(MODULES.filter(x=>x.owner).map(x=>[x.id,{owner:x.owner,ready:Boolean(window[x.owner]),allowed:allowed(x)}]));window.IMSModules=Object.freeze({build:IMS_BUILD,loaded:[...loaded],failed:[...failed],skipped:[...skipped],owners,registry:MODULES});window.dispatchEvent(new CustomEvent('ims:modules-ready',{detail:window.IMSModules}));console.info('IMS consolidated module status',window.IMSModules);}
async function bootOptionalModules(){await waitForAuth();const loaded=[],failed=[],skipped=[];for(const def of MODULES){if(!allowed(def)){skipped.push(def.id);continue;}try{await loadOne(def);loaded.push(def.id);refreshImportExport();}catch(error){failed.push({id:def.id,error:String(error?.message||error)});console.error(`IMS module failed: ${def.id}`,error);window.IMSErrorMonitor?.record?.({message:error?.message||String(error),source:def.src,kind:'module-load'});}}bindDirectNavigation();refreshImportExport();publishStatus(loaded,failed,skipped);if(window.IMSWorkspace&&!document.querySelector('[data-ims-workspace-module="1"]'))window.IMSWorkspace.show();return window.IMSModules;}
window.addEventListener('ims:workspace-rendered',refreshImportExport);
window.addEventListener('ims:registration-ready',refreshImportExport);
window.addEventListener('ims:renttorent-ready',refreshImportExport);
window.addEventListener('ims:businesses-ready',refreshImportExport);
window.addEventListener('ims:masters-ready',refreshImportExport);
bootOptionalModules().catch(error=>{console.error('IMS module loader failed:',error);window.IMSErrorMonitor?.record?.({message:error?.message||String(error),source:'ims-module-loader.js',kind:'boot'});});export {MODULES,IMS_BUILD,bootOptionalModules};