/**
 * WISE System - Waste Records Page (AI Classification Monitoring)
 * Page state, data fetching, and event wiring for waste records.html.
 * Rendering lives in components/waste-record-table.js.
 */

// ---------- State ----------
let state = {
  records: [], total: 0, page: 1, pageSize: 10,
  wasteType: '', isFlagged: '', startDate: '', endDate: '',
  search: '',
};

// ---------- DOM refs ----------
const tbody = $id('wc-tbody');
const stateContainer = $id('wc-state-container');
const countEl = $id('wc-count');
const prevBtn = $id('wc-prev');
const nextBtn = $id('wc-next');
const searchInput = $id('wc-search-input');
const typeFilter = $id('wc-type-filter');
const flagFilter = $id('wc-flag-filter');
const dateFilter = $id('wc-date-filter');
const resetBtn = $id('wc-reset-btn');
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
  if (cls) {
    tag.className = 'wc-pill ' + wcBadgeClass(cls);
    tag.textContent = cls;
  } else {
    tag.className = 'wc-pill slate';
    tag.textContent = 'No data';
  }

  // Flagged summary report panel
  if ($id('wc-rpt-total')) $id('wc-rpt-total').textContent = s.total_records != null ? s.total_records.toLocaleString() : '0';
  if ($id('wc-rpt-verified')) $id('wc-rpt-verified').textContent = s.verified_records != null ? s.verified_records.toLocaleString() : '0';
  if ($id('wc-rpt-flagged')) $id('wc-rpt-flagged').textContent = s.flagged_records != null ? s.flagged_records.toLocaleString() : '0';
  if ($id('wc-rpt-flagged-pct')) $id('wc-rpt-flagged-pct').textContent = s.flagged_rate_pct != null ? '(' + s.flagged_rate_pct.toFixed(1) + '%)' : '(0.0%)';
  if ($id('wc-rpt-breakdown')) {
    var thresh = s.low_confidence_threshold != null ? Number(s.low_confidence_threshold).toFixed(0) : '60';
    var lowCnt = s.low_confidence_flagged != null ? s.low_confidence_flagged.toLocaleString() : '0';
    var manCnt = s.manual_flagged != null ? s.manual_flagged.toLocaleString() : '0';
    $id('wc-rpt-breakdown').textContent = 'Auto (<' + thresh + '%): ' + lowCnt + ' · Manual: ' + manCnt;
  }
}

function trendHtml(pct) {
  var up = pct >= 0;
  var cls = up ? 'wc-trend-up' : 'wc-trend-down';
  var arrow = up
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>';
  return '<span class="' + cls + '">' + arrow + ' ' + Math.abs(pct).toFixed(1) + '%</span>';
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
  if (state.search) p.set('search', state.search);
  if (state.wasteType) p.set('disposal_category', state.wasteType);
  if (state.isFlagged !== '') p.set('is_flagged', state.isFlagged);
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
      var emptyMsg = state.search
        ? 'No classifications matching "' + escapeHtml(state.search) + '" found.'
        : (state.wasteType ? 'No records match the selected filter.' : 'No classifications yet. Captures from the mobile app will appear here.');
      renderWasteState('empty', emptyMsg);
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
  const confirmed = await wiseConfirmDialog({
    title: 'Delete Record?',
    message: 'Delete classification record #' + recordId + '? This cannot be undone.',
    confirmText: 'Delete',
    variant: 'danger'
  });
  if (!confirmed) return;
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
    ? '<div class="wc-detail-image-wrap"><img src="' + escapeHtml(resolveMediaUrl(r.image_url)) + '" alt="Classification Photo" class="wc-detail-img" onerror="this.parentElement.style.display=\'none\'"></div>'
    : '';

  var flagBadgeHtml = r.is_flagged
    ? '<span class="wc-flag-badge is-warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Flagged for Review</span>'
    : '<span class="wc-flag-badge is-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Verified</span>';

  var rows = [
    ['Record ID', '#' + r.id],
    ['Citizen', escapeHtml(r.fullname || 'Anonymous Citizen')],
    ['Barangay', escapeHtml((r.barangay || '—') + (r.zone ? ' · Zone ' + r.zone : ''))],
    ['Classification', '<span class="wc-badge ' + wcBadgeClass(r.classification || r.waste_type) + '">' + escapeHtml(r.classification || r.waste_type || '—') + '</span>'],
    ['AI Confidence', '<div class="wc-conf wc-conf-inline ' + confLevel + '"><span class="wc-conf-pct">' + conf + '</span><span class="wc-conf-bar"><span class="wc-conf-fill" style="width:' + barW + '%"></span></span></div>'],
    ['Review Status', flagBadgeHtml],
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
let searchTimer = null;
if (searchInput) {
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.search = searchInput.value.trim();
      state.page = 1;
      fetchRecords();
    }, 280);
  });
}

typeFilter.addEventListener('change', function () {
  state.wasteType = typeFilter.value;
  state.page = 1;
  fetchRecords();
});

if (flagFilter) {
  flagFilter.addEventListener('change', function () {
    state.isFlagged = flagFilter.value;
    state.page = 1;
    fetchRecords();
  });
}

if (dateFilter) {
  dateFilter.addEventListener('change', function () {
    var mode = dateFilter.value;
    var now = new Date();
    var todayStr = formatDate(now);
    if (mode === 'today') {
      state.startDate = todayStr;
      state.endDate = todayStr;
    } else if (mode === '7d') {
      var past = new Date(now);
      past.setDate(past.getDate() - 6);
      state.startDate = formatDate(past);
      state.endDate = todayStr;
    } else if (mode === 'month') {
      var first = new Date(now.getFullYear(), now.getMonth(), 1);
      state.startDate = formatDate(first);
      state.endDate = todayStr;
    } else {
      state.startDate = '';
      state.endDate = '';
    }
    state.page = 1;
    fetchRecords();
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', function () {
    if (searchInput) searchInput.value = '';
    if ($id('wc-search-clear-btn')) $id('wc-search-clear-btn').classList.remove('visible');
    state.search = '';
    typeFilter.value = '';
    state.wasteType = '';
    if (flagFilter) flagFilter.value = '';
    state.isFlagged = '';
    if (dateFilter) dateFilter.value = '';
    state.startDate = '';
    state.endDate = '';
    state.page = 1;
    fetchRecords();
  });
}

wireSearchClear(searchInput, $id('wc-search-clear-btn'), function () {
  state.search = '';
  state.page = 1;
  fetchRecords();
});

// Top-level view tabs (Classification Records | Barangay Leaderboard)
$all('.wc-tab-btn').forEach(function (tabBtn) {
  tabBtn.addEventListener('click', function () {
    var target = tabBtn.dataset.tab;
    $all('.wc-tab-btn').forEach(function (b) {
      var active = b === tabBtn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $all('.wc-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'wc-panel-' + target);
    });
  });
});

// Header refresh button
var headerRefreshBtn = $id('wc-header-refresh');
if (headerRefreshBtn) {
  headerRefreshBtn.addEventListener('click', function () {
    headerRefreshBtn.classList.add('spinning');
    Promise.all([fetchStats(), fetchRecords(), fetchBarangayLeaderboard()])
      .then(function () { showToast('Waste records refreshed.', 'success'); })
      .finally(function () {
        setTimeout(function () { headerRefreshBtn.classList.remove('spinning'); }, 450);
      });
  });
}

prevBtn.addEventListener('click', function () { goToPage(state.page - 1); });
nextBtn.addEventListener('click', function () { goToPage(state.page + 1); });
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
});

// ---------- Barangay Segregation & AI Ranking State & Methods ----------
const MUNTINLUPA_BARANGAYS = [
  'Alabang', 'Bayanan', 'Buli', 'Cupang', 'New Alabang Village',
  'Poblacion', 'Putatan', 'Sucat', 'Tunasan'
];

let brgyState = {
  mode: 'month', // 'month' | 'all'
  year: null,
  month: null,
};

function initBrgyControls() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  brgyState.year = now.getUTCFullYear();
  brgyState.month = now.getUTCMonth() + 1;

  const monthInput = $id('wc-brgy-month');
  if (monthInput) {
    monthInput.value = brgyState.year + '-' + String(brgyState.month).padStart(2, '0');
    monthInput.addEventListener('change', function () {
      if (!monthInput.value) return;
      brgyState.year = parseInt(monthInput.value.slice(0, 4), 10);
      brgyState.month = parseInt(monthInput.value.slice(5, 7), 10);
      fetchBarangayLeaderboard();
    });
  }

  // Segmented mode toggle (Monthly vs All Time)
  const modeBtns = $all('#wc-brgy-period-mode .wc-brgy-toggle-btn');
  modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      modeBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      brgyState.mode = btn.dataset.mode;
      const pickerWrap = $id('wc-brgy-picker-wrap');
      if (pickerWrap) {
        pickerWrap.style.display = brgyState.mode === 'month' ? 'inline-flex' : 'none';
      }
      fetchBarangayLeaderboard();
    });
  });

  const refreshBtn = $id('wc-brgy-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      fetchBarangayLeaderboard();
    });
  }
}

async function fetchBarangayLeaderboard() {
  let url = '/api/waste-records/barangay-leaderboard';
  if (brgyState.mode === 'month' && brgyState.year && brgyState.month) {
    url += '?year=' + brgyState.year + '&month=' + brgyState.month;
  }

  const refreshBtn = $id('wc-brgy-refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const res = await apiRequest(url);
    if (!res || !res.ok) {
      renderBarangayLeaderboard(null);
      return;
    }
    const data = await res.json();
    renderBarangayLeaderboard(data);
  } catch (err) {
    console.error('Failed to fetch barangay leaderboard:', err);
    renderBarangayLeaderboard(null);
  } finally {
    if (refreshBtn) {
      setTimeout(function () {
        refreshBtn.classList.remove('spinning');
      }, 400);
    }
  }
}

function renderBarangayLeaderboard(data) {
  const tbody = $id('wc-brgy-tbody');
  const podium = $id('wc-brgy-podium');
  const citywideRateEl = $id('wc-citywide-rate');

  if (citywideRateEl) {
    citywideRateEl.textContent = (data && data.citywide_sorting_rate != null) ? data.citywide_sorting_rate + '%' : '0.0%';
  }

  const list = (data && data.leaderboard && data.leaderboard.length)
    ? data.leaderboard
    : MUNTINLUPA_BARANGAYS.map((b, i) => ({
        rank: i + 1,
        barangay: b,
        proper_sorting_rate: 0.0,
        total_scans: 0,
        recyclable_count: 0,
        biodegradable_count: 0,
        residual_count: 0,
        hazardous_count: 0,
        electronic_count: 0,
        residual_special_count: 0,
        avg_confidence: 0.0,
        award_tier: 'Standard',
        badge_title: 'No Submissions',
      }));

  // Render Podium (Top 3 — only award places to barangays with actual scans)
  if (podium) {
    const activeRanked = list.filter(function (b) { return (b.total_scans || 0) > 0; });
    if (activeRanked.length === 0) {
      podium.innerHTML = '<div class="wc-podium-empty">No scans recorded for this period yet.</div>';
    } else {
      const top3 = activeRanked.slice(0, 3);
      const tiers = ['gold', 'silver', 'bronze'];
      const rankLabels = ['1st Place', '2nd Place', '3rd Place'];
      const medalSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
      let podiumHtml = '';

      top3.forEach((item, idx) => {
        const tier = tiers[idx] || 'bronze';
        const label = rankLabels[idx] || ('Rank ' + item.rank);
        const fillClass = item.proper_sorting_rate >= 80 ? 'high' : (item.proper_sorting_rate >= 50 ? 'med' : 'low');

        podiumHtml +=
          '<div class="wc-podium-card ' + tier + '">' +
            '<div class="wc-podium-badge-row">' +
              '<span class="wc-podium-rank-pill">' + medalSvg + label + '</span>' +
            '</div>' +
            '<h4 class="wc-podium-name">' + escapeHtml(item.barangay) + '</h4>' +
            '<div class="wc-podium-rate-row">' +
              '<span class="wc-podium-rate-num">' + item.proper_sorting_rate + '%</span>' +
              '<span class="wc-podium-rate-label">Proper Sorting</span>' +
            '</div>' +
            '<div class="wc-podium-progress">' +
              '<div class="wc-podium-progress-fill ' + fillClass + '" style="width:' + Math.min(item.proper_sorting_rate, 100) + '%;"></div>' +
            '</div>' +
            '<div class="wc-podium-stats-row">' +
              '<span>Scans: <strong>' + item.total_scans + '</strong></span>' +
              '<span>Confidence: <strong>' + (item.avg_confidence > 0 ? item.avg_confidence + '%' : '—') + '</strong></span>' +
            '</div>' +
          '</div>';
      });
      podium.innerHTML = podiumHtml;
    }
  }

  // Render Full Table (All 9 Barangays)
  if (tbody) {
    let tableHtml = '';
    list.forEach(b => {
      const rankClass = b.total_scans > 0 && b.rank <= 3 ? 'rank-' + b.rank : '';
      const barClass = b.proper_sorting_rate >= 80 ? 'high' : (b.proper_sorting_rate >= 50 ? 'med' : 'low');

      // Dynamic chips for 5 waste categories - only show active categories (> 0)
      const recyc = b.recyclable_count || 0;
      const bio = b.biodegradable_count || 0;
      const resid = (b.residual_count != null ? b.residual_count : b.residual_special_count) || 0;
      const haz = b.hazardous_count || 0;
      const elec = b.electronic_count || 0;

      const chips = [];
      if (recyc > 0) chips.push('<span class="wc-diverted-chip recyc" title="Recyclables">' + recyc + ' Recyc</span>');
      if (bio > 0) chips.push('<span class="wc-diverted-chip bio" title="Biodegradable">' + bio + ' Bio</span>');
      if (resid > 0) chips.push('<span class="wc-diverted-chip resid" title="Residual">' + resid + ' Resid</span>');
      if (haz > 0) chips.push('<span class="wc-diverted-chip haz" title="Hazardous">' + haz + ' Haz</span>');
      if (elec > 0) chips.push('<span class="wc-diverted-chip elec" title="Electronic / E-Waste">' + elec + ' E-Waste</span>');

      const chipsHtml = chips.length > 0
        ? '<div class="wc-diverted-chips">' + chips.join('') + '</div>'
        : '<span style="color:var(--wc-muted);font-size:13px;">—</span>';

      tableHtml +=
        '<tr>' +
          '<td><span class="wc-rank-chip ' + rankClass + '">' + b.rank + '</span></td>' +
          '<td>' +
            '<div class="wc-brgy-cell">' +
              '<div class="wc-brgy-cell-icon">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
                  '<circle cx="12" cy="10" r="3"></circle>' +
                '</svg>' +
              '</div>' +
              '<div>' +
                '<div class="wc-brgy-cell-name">' + escapeHtml(b.barangay) + '</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td>' +
            '<div class="wc-sort-rate-wrap">' +
              '<div class="wc-sort-rate-header">' +
                '<span>' + b.proper_sorting_rate + '%</span>' +
              '</div>' +
              '<div class="wc-sort-track">' +
                '<div class="wc-sort-fill ' + barClass + '" style="width:' + Math.min(b.proper_sorting_rate, 100) + '%;"></div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><strong>' + b.total_scans + '</strong> <span style="font-size:12px;color:var(--wc-muted);">scans</span></td>' +
          '<td>' + chipsHtml + '</td>' +
          '<td>' + (b.avg_confidence > 0 ? (b.avg_confidence + '%') : '—') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = tableHtml;
  }
}

// ---------- Init ----------
async function init() {
  if (!initBasePage()) return;
  initBrgyControls();
  await fetchStats();
  await fetchRecords();
  await fetchBarangayLeaderboard();
}
init();
