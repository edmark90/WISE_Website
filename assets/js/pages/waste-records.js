/**
 * WISE System - Waste Records Page (AI Classification Monitoring)
 * Page state, data fetching, and event wiring for waste records.html.
 * Rendering lives in components/waste-record-table.js.
 */

// ---------- State ----------
let state = {
  records: [], total: 0, page: 1, pageSize: 10,
  wasteType: '', startDate: '', endDate: '',
};

// ---------- DOM refs ----------
const tbody = $id('wc-tbody');
const stateContainer = $id('wc-state-container');
const countEl = $id('wc-count');
const prevBtn = $id('wc-prev');
const nextBtn = $id('wc-next');
const typeFilter = $id('wc-type-filter');
const dateBtn = $id('wc-date-btn');
const dateLabel = $id('wc-date-label');
const modal = $id('wc-modal');
const modalClose = $id('wc-modal-close');
const detailBody = $id('wc-detail-body');

// ---------- Stats rendering ----------
function renderStats(s) {
  // Total Records Processed
  $id('stat-total').textContent = s.total_records != null ? s.total_records.toLocaleString() : '—';
  $id('stat-total-trend').innerHTML = s.trend_24h_pct == null ? '—' : trendHtml(s.trend_24h_pct);

  // Average AI Confidence
  var conf = s.avg_confidence != null ? s.avg_confidence.toFixed(1) : null;
  $id('stat-confidence').textContent = conf != null ? conf + '%' : '—';
  var fill = $id('stat-progress-fill');
  fill.style.width = (conf != null ? Math.min(conf, 100) : 0) + '%';
  $id('stat-conf-trend').innerHTML = s.avg_confidence_trend_pct == null ? '—' : trendHtml(s.avg_confidence_trend_pct);

  // Most Common Type
  $id('stat-type').textContent = s.most_common_type || '—';
  $id('stat-type-share').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>' +
    (s.most_common_share_pct != null ? s.most_common_share_pct.toFixed(1) : '0') + '% of volume';

  var tag = $id('stat-type-tag');
  var cls = s.most_common_type || '';
  if (cls === 'Recyclable') {
    tag.className = 'wc-pill rec';
    tag.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Recyclable';
  } else if (cls === 'Biodegradable') {
    tag.className = 'wc-pill bio';
    tag.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Biodegradable';
  } else if (cls) {
    tag.className = 'wc-pill res';
    tag.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Non-Recyclable';
  } else {
    tag.className = 'wc-pill res';
    tag.textContent = 'No data';
  }
}

function trendHtml(pct) {
  var up = pct >= 0;
  var color = up ? 'var(--wc-green)' : 'var(--wc-red)';
  var arrow = up
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>';
  return '<span style="color:' + color + '">' + arrow + ' ' + Math.abs(pct).toFixed(1) + '%</span>';
}

// ---------- Data fetching ----------
async function fetchStats() {
  try {
    const res = await apiRequest('/api/waste-records/stats');
    if (!res || !res.ok) return;
    renderStats(await res.json());
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

async function fetchRecords() {
  if (!checkAuth()) return;
  const p = new URLSearchParams({ page: state.page, page_size: state.pageSize });
  if (state.wasteType) p.set('disposal_category', state.wasteType);
  if (state.startDate) p.set('start_date', state.startDate);
  if (state.endDate) p.set('end_date', state.endDate);

  tbody.innerHTML = '';
  renderWasteState('loading', 'Loading classifications...');
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  countEl.innerHTML = 'Loading...';

  try {
    const res = await apiRequest('/api/waste-records/?' + p.toString());
    if (!res) return;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.records = data.records || [];
    state.total = data.total || 0;

    if (state.records.length === 0) {
      tbody.innerHTML = '';
      renderWasteState('empty', state.wasteType ? 'No records match the selected filter.' : 'No classifications yet. Captures from the mobile app will appear here.');
    } else {
      stateContainer.innerHTML = '';
      tbody.innerHTML = renderWasteRows(state.records);
    }
    renderWastePagination();
  } catch (err) {
    console.error('Failed to fetch waste records:', err);
    tbody.innerHTML = '';
    renderWasteState('error', 'Failed to load classifications. Make sure the server is running.');
  }
}

function goToPage(p) {
  if (p < 1) return;
  state.page = p;
  fetchRecords();
}

// ---------- Actions ----------
async function toggleWasteFlag(recordId, current) {
  try {
    const res = await apiRequest('/api/waste-records/' + recordId, {
      method: 'PUT',
      body: JSON.stringify({ is_flagged: !current })
    });
    if (!res) return;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(current ? 'Record unflagged' : 'Record flagged for review', 'success');
    fetchRecords();
    fetchStats();
  } catch (e) {
    console.error('Failed to update flag:', e);
    showToast('Could not update flag.', 'error');
  }
}

async function deleteWasteRecord(recordId) {
  if (!confirm('Delete this classification record? This cannot be undone.')) return;
  try {
    const res = await apiRequest('/api/waste-records/' + recordId, {
      method: 'DELETE'
    });
    if (!res) return;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('Record deleted', 'success');
    fetchRecords();
    fetchStats();
  } catch (e) {
    console.error('Failed to delete record:', e);
    showToast('Could not delete record.', 'error');
  }
}

function viewWasteRecord(recordId) {
  var r = null;
  for (var i = 0; i < state.records.length; i++) {
    if (state.records[i].id === recordId) { r = state.records[i]; break; }
  }
  if (!r) return;

  var conf = r.confidence != null ? r.confidence.toFixed(1) + '%' : '—';
  var confLevel = wcConfLevel(r.confidence);
  var barW = r.confidence != null ? Math.min(r.confidence, 100) : 0;
  var imageBlock = (r.image_url)
    ? '<div class="wc-detail-image-wrap"><img src="' + escapeHtml(CONFIG.API_BASE_URL + '/' + r.image_url) + '" alt="Classification Photo" class="wc-detail-img" onerror="this.parentElement.style.display=\'none\'"></div>'
    : '';

  var rows = [
    ['Record ID', '#' + r.id],
    ['Citizen Scanner', escapeHtml(r.fullname || 'Anonymous Citizen')],
    ['Location / Barangay', escapeHtml((r.barangay || '—') + (r.zone ? ' · Zone ' + r.zone : ''))],
    ['Waste Classification', '<span class="wc-badge ' + wcBadgeClass(r.classification || r.waste_type) + '">' + escapeHtml(r.classification || r.waste_type || '—') + '</span>'],
    ['AI Confidence', '<div class="wc-conf ' + confLevel + '" style="display:inline-flex; align-items:center; gap:8px;"><span class="wc-conf-pct">' + conf + '</span><span class="wc-conf-bar" style="width:70px;"><span class="wc-conf-fill" style="width:' + barW + '%"></span></span></div>'],
    ['Flagged Status', r.is_flagged ? '<span style="color:#b45309;font-weight:700;">⚠️ Flagged for Review</span>' : '<span style="color:#047857;font-weight:600;">✓ Normal</span>'],
    ['Timestamp', wcFormatTime(r.created_at) + ' · ' + wcFormatDate(r.created_at)],
  ];

  detailBody.innerHTML =
    imageBlock +
    '<div class="wc-detail-list">' +
      rows.map(function (row) {
        return '<div class="wc-detail-row"><span class="wc-detail-label">' + row[0] + '</span><span class="wc-detail-value">' + row[1] + '</span></div>';
      }).join('') +
    '</div>';

  modal.classList.add('active');
}

function closeModal() {
  modal.classList.remove('active');
}

// ---------- Event wiring ----------
typeFilter.addEventListener('change', function () {
  state.wasteType = typeFilter.value;
  state.page = 1;
  fetchRecords();
});

dateBtn.addEventListener('click', function () {
  if (state.startDate) {
    state.startDate = ''; state.endDate = '';
    dateLabel.textContent = 'All time';
  } else {
    var today = formatDate(new Date());
    state.startDate = today;
    state.endDate = today;
    dateLabel.textContent = 'Today';
  }
  state.page = 1;
  fetchRecords();
});

prevBtn.addEventListener('click', function () { goToPage(state.page - 1); });
nextBtn.addEventListener('click', function () { goToPage(state.page + 1); });
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
});

// ---------- Init ----------
async function init() {
  if (!initBasePage()) return;
  await loadSidebarUserFromApi();
  await fetchStats();
  await fetchRecords();
}
init();