/* ── Helpers ────────────────────────────────── */
const $ = id => document.getElementById(id);
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function showMsg(id, msg, type) {
  const el = $(id);
  el.textContent = msg;
  el.className = `msg ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api/records' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Navigation ─────────────────────────────── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'records') loadRecords();
    if (btn.dataset.tab === 'summary') loadSummary();
  });
});

/* ── Search Tab ─────────────────────────────── */
async function doSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;
  const res = document.getElementById('searchResults');
  res.classList.remove('hidden');
  res.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', `/search?q=${encodeURIComponent(q)}`);
    res.innerHTML = buildTable(data.records);
    attachTableActions();
  } catch (e) {
    res.innerHTML = `<p class="no-records">${e.message}</p>`;
  }
}

$('searchBtn').addEventListener('click', doSearch);
$('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

/* ── Add Record Tab ─────────────────────────── */
function calcTotal(prefix) {
  const vals = ['mw1','mw2','h1','h2','wm'].map(k => parseInt($(prefix + k).value) || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  $(prefix + 'total').value = total;
}

function autoDay(dateId, dayId) {
  const v = $(dateId).value;
  $(dayId).value = v ? DAYS[new Date(v + 'T12:00:00').getDay()] : '';
}

$('f-date').addEventListener('input', () => autoDay('f-date', 'f-day'));
['f-mw1','f-mw2','f-h1','f-h2','f-wm'].forEach(id => $(id).addEventListener('input', () => calcTotal('f-')));

// Set today as default
const todayStr = new Date().toISOString().split('T')[0];
$('f-date').value = todayStr;
autoDay('f-date', 'f-day');

$('addRecordBtn').addEventListener('click', async () => {
  const body = {
    date: $('f-date').value,
    day: $('f-day').value,
    main_worker_shift1: parseInt($('f-mw1').value) || 0,
    main_worker_shift2: parseInt($('f-mw2').value) || 0,
    helpers_shift1: parseInt($('f-h1').value) || 0,
    helpers_shift2: parseInt($('f-h2').value) || 0,
    water_man: parseInt($('f-wm').value) || 0,
    notes: $('f-notes').value.trim()
  };
  if (!body.date) return showMsg('addMsg', 'Date is required.', 'error');
  try {
    await api('POST', '/', body);
    showMsg('addMsg', 'Record saved successfully!', 'success');
    showToast('Record added ✓');
    clearAddForm();
  } catch (e) {
    showMsg('addMsg', e.message, 'error');
  }
});

$('clearFormBtn').addEventListener('click', clearAddForm);

function clearAddForm() {
  ['f-mw1','f-mw2','f-h1','f-h2','f-wm'].forEach(id => $(id).value = 0);
  $('f-notes').value = '';
  $('f-date').value = todayStr;
  autoDay('f-date', 'f-day');
  calcTotal('f-');
}
calcTotal('f-');

/* ── All Records Tab ────────────────────────── */
let currentPage = 1;
let sortField = 'date';
let sortOrder = 'desc';

async function loadRecords() {
  $('recordsTable').innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', `?page=${currentPage}&sort=${sortField}&order=${sortOrder}&limit=20`);
    $('recordsTable').innerHTML = buildTable(data.records);
    attachTableActions();
    buildPagination(data.pages, data.page);
  } catch (e) {
    $('recordsTable').innerHTML = `<p class="no-records">${e.message}</p>`;
  }
}

function buildTable(records) {
  if (!records || records.length === 0) return '<p class="no-records">No records found.</p>';
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th><th>Day</th>
          <th>MW S1</th><th>MW S2</th>
          <th>H S1</th><th>H S2</th>
          <th>Water</th><th>Total</th>
          <th>Notes</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td>${r.date}</td>
            <td>${r.day}</td>
            <td>${r.main_worker_shift1}</td>
            <td>${r.main_worker_shift2}</td>
            <td>${r.helpers_shift1}</td>
            <td>${r.helpers_shift2}</td>
            <td>${r.water_man}</td>
            <td><span class="badge-total">${r.total}</span></td>
            <td>${r.notes || '—'}</td>
            <td class="actions-cell">
              <button class="btn-edit" data-id="${r.id}">Edit</button>
              <button class="btn-danger" data-id="${r.id}">Del</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function buildPagination(pages, page) {
  const el = $('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  const btns = [];
  for (let i = 1; i <= pages; i++) {
    btns.push(`<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`);
  }
  el.innerHTML = btns.join('');
  el.querySelectorAll('.page-btn').forEach(b => {
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); loadRecords(); });
  });
}

function attachTableActions() {
  document.querySelectorAll('.btn-edit[data-id]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-danger[data-id]').forEach(btn => {
    btn.addEventListener('click', () => deleteRecord(btn.dataset.id));
  });
}

async function deleteRecord(id) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  try {
    await api('DELETE', `/${id}`);
    showToast('Record deleted');
    loadRecords();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* CSV Export */
$('exportCsvBtn').addEventListener('click', async () => {
  try {
    const data = await api('GET', '?limit=9999&sort=' + sortField + '&order=' + sortOrder);
    const rows = [['ID','Date','Day','MW Shift1','MW Shift2','Helpers S1','Helpers S2','Water Man','Total','Notes']];
    data.records.forEach(r => rows.push([r.id,r.date,r.day,r.main_worker_shift1,r.main_worker_shift2,r.helpers_shift1,r.helpers_shift2,r.water_man,r.total,r.notes||'']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `employee_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('CSV exported ✓');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

/* ── Edit Modal ─────────────────────────────── */
async function openEditModal(id) {
  try {
    const r = await api('GET', `/${id}`);
    $('e-id').value = r.id;
    $('e-date').value = r.date;
    $('e-day').value = r.day;
    $('e-mw1').value = r.main_worker_shift1;
    $('e-mw2').value = r.main_worker_shift2;
    $('e-h1').value = r.helpers_shift1;
    $('e-h2').value = r.helpers_shift2;
    $('e-wm').value = r.water_man;
    $('e-notes').value = r.notes || '';
    calcTotal('e-');
    $('modal').classList.remove('hidden');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

$('e-date').addEventListener('input', () => autoDay('e-date', 'e-day'));
['e-mw1','e-mw2','e-h1','e-h2','e-wm'].forEach(id => $(id).addEventListener('input', () => calcTotal('e-')));

$('cancelEditBtn').addEventListener('click', () => $('modal').classList.add('hidden'));
$('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });

$('saveEditBtn').addEventListener('click', async () => {
  const id = $('e-id').value;
  const body = {
    date: $('e-date').value,
    day: $('e-day').value,
    main_worker_shift1: parseInt($('e-mw1').value) || 0,
    main_worker_shift2: parseInt($('e-mw2').value) || 0,
    helpers_shift1: parseInt($('e-h1').value) || 0,
    helpers_shift2: parseInt($('e-h2').value) || 0,
    water_man: parseInt($('e-wm').value) || 0,
    notes: $('e-notes').value.trim()
  };
  try {
    await api('PUT', `/${id}`, body);
    $('modal').classList.add('hidden');
    showToast('Record updated ✓');
    loadRecords();
  } catch (e) {
    showMsg('editMsg', e.message, 'error');
  }
});

/* ── Summary Tab ────────────────────────────── */
async function loadSummary() {
  $('summaryCards').innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const d = await api('GET', '/summary/totals');
    $('summaryCards').innerHTML = `
      <div class="summary-card">
        <div class="s-label">Today</div>
        <div class="s-value">${d.today_total}</div>
        <div class="s-sub">workers on site</div>
      </div>
      <div class="summary-card">
        <div class="s-label">Last 7 Days</div>
        <div class="s-value">${d.week_total}</div>
        <div class="s-sub">total headcount</div>
      </div>
      <div class="summary-card">
        <div class="s-label">Last 30 Days</div>
        <div class="s-value">${d.month_total}</div>
        <div class="s-sub">total headcount</div>
      </div>
      <div class="summary-card">
        <div class="s-label">Grand Total</div>
        <div class="s-value">${d.grand_total}</div>
        <div class="s-sub">across ${d.record_count} records</div>
      </div>`;
  } catch (e) {
    $('summaryCards').innerHTML = `<p style="color:red">${e.message}</p>`;
  }
}
