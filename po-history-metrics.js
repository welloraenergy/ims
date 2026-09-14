import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const MAX_IN = 30;
let timer = null;
let running = false;
const cache = new Map();

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 80);
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function loadRefs(keys) {
  const missing = [...new Set(keys.filter(Boolean))].filter(k => !cache.has(k));
  for (let i = 0; i < missing.length; i += MAX_IN) {
    const chunk = missing.slice(i, i + MAX_IN);
    if (!chunk.length) continue;
    const snap = await getDocs(query(collection(db, 'document_refs'), where('commercialKey', 'in', chunk)));
    for (const d of snap.docs) {
      const r = d.data();
      const linked = Array.isArray(r.linkedItemIds) ? r.linkedItemIds.length : 0;
      cache.set(r.commercialKey, {
        linked,
        expected: r.expectedQty == null ? null : Number(r.expectedQty)
      });
    }
  }
}

async function enhanceTable() {
  const table = document.querySelector('#docTable table');
  if (!table) return;
  const rows = [...table.querySelectorAll('tbody tr')].filter(r => r.querySelector('.openPO[data-key]'));
  const keys = rows.map(r => r.querySelector('.openPO')?.dataset.key).filter(Boolean);
  if (!keys.length) return;
  await loadRefs(keys);

  for (const row of rows) {
    const key = row.querySelector('.openPO')?.dataset.key;
    const rec = cache.get(key);
    const cells = row.querySelectorAll('td');
    if (!rec || cells.length < 8) continue;

    const currentCell = cells[6];
    if (!currentCell.dataset.imsCurrent) {
      const original = toNumber(currentCell.textContent);
      currentCell.dataset.imsCurrent = String(original == null ? rec.linked : original);
    }
    const current = Number(currentCell.dataset.imsCurrent || 0);
    currentCell.textContent = `${rec.linked} / ${current}`;
    currentCell.title = 'Historically linked to this PO / currently at the related client or active context';

    const expected = rec.expected;
    cells[5].textContent = expected == null ? '—' : String(expected);
    cells[7].textContent = expected == null ? '—' : String(Math.max(0, expected - rec.linked));
    cells[7].title = 'Expected minus historically linked items';
  }
}

function enhanceDetail() {
  const detail = document.getElementById('docDetail');
  if (!detail || !detail.querySelector('section')) return;

  const linked = detail.querySelectorAll('.openDocItem[data-id]').length;
  const expectedInput = detail.querySelector('#docExpected');
  const expected = expectedInput?.value === '' || !expectedInput ? null : Number(expectedInput.value);
  const headerText = detail.textContent || '';
  const currentMatch = headerText.match(/(\d+)\s+current\/linked\s+unit/i);
  const current = currentMatch ? Number(currentMatch[1]) : linked;
  const outstanding = expected == null ? null : Math.max(0, expected - linked);

  let box = detail.querySelector('#poHistoryMetrics');
  if (!box) {
    box = document.createElement('div');
    box.id = 'poHistoryMetrics';
    box.className = 'grid grid-cols-3 gap-2';
    const header = detail.querySelector('section > div.flex');
    if (header?.nextSibling) header.parentNode.insertBefore(box, header.nextSibling);
    else detail.querySelector('section')?.prepend(box);
  }
  box.innerHTML = `
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
      <div class="text-lg font-bold">${expected == null ? '—' : expected}</div>
      <div class="text-[10px] text-slate-500">Expected</div>
    </div>
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
      <div class="text-lg font-bold">${linked} / ${current}</div>
      <div class="text-[10px] text-slate-500">Linked / Current</div>
    </div>
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
      <div class="text-lg font-bold">${outstanding == null ? '—' : outstanding}</div>
      <div class="text-[10px] text-slate-500">Outstanding</div>
    </div>`;
}

async function enhance() {
  if (running) return;
  running = true;
  try {
    await enhanceTable();
    enhanceDetail();
  } catch (err) {
    console.warn('IMS PO history metrics enhancement failed:', err);
  } finally {
    running = false;
  }
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('change', e => {
  if (e.target?.id === 'docExpected') schedule();
}, true);
window.addEventListener('ims:auth-ready', schedule);
schedule();
