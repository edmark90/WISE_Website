/**
 * WISE System - Executive Dashboard Logic
 * High-performance, interactive SVG Line & Donut/Pie Chart Engines,
 * live 7-day operations telemetry rail, and month-scoped analytics.
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;
  initDashboard();
});

var DB = {
  nowMarkerPlaced: false,
  refreshTimer: null,
  monthInput: null,
  year: 2026,
  month: 8,
  monthlyData: null,
  lineGranularity: 'daily',  // 'daily' | 'hourly'
  lineChartMode: 'category', // 'category' | 'total'
  activeClassFilters: {},    // { 'Biodegradable': true, ... }
  activityFilter: 'all',     // 'all' | 'complete' | 'classify'
  rawActivities: []
};

/* Modern, vibrant category colors */
var DB_CLASS_COLORS = {
  Biodegradable: '#10b981', // Emerald
  Recyclable: '#3b82f6',    // Electric Blue
  Electronic: '#8b5cf6',    // Violet
  Hazardous: '#ef4444',     // Crimson
  Residual: '#64748b'       // Slate
};

var DB_CLASS_ORDER = ['Biodegradable', 'Recyclable', 'Electronic', 'Hazardous', 'Residual'];

function initDashboard() {
  setPHDateLabels();

  // Default period = current PH month
  var now = phNow();
  DB.year = now.getFullYear();
  DB.month = now.getMonth() + 1;
  renderPeriodLabel();

  wireControls();
  loadDashboard();
  loadWeather();
  loadMonthly();

  // Auto-refresh live data every 60s
  DB.refreshTimer = setInterval(function () {
    loadDashboard();
    touchUpdated();
  }, 60000);

  window.addEventListener('beforeunload', function () {
    if (DB.refreshTimer) clearInterval(DB.refreshTimer);
  });

  // Re-render chart on window resize with debounce for crisp scaling
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (DB.monthlyData) {
        renderLineChart(DB.monthlyData);
      }
    }, 120);
  });
}

/** Current instant shifted to the Philippines (UTC+8). */
function phNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

/** "YYYY-MM-DD" for the Philippines, matching backend ph_today(). */
function phToday() {
  return phNow().toISOString().slice(0, 10);
}

/** Fill the eyebrow/rail date + updated stamp from the PH clock. */
function setPHDateLabels() {
  var iso = phToday().split('-');
  var d = new Date(iso[0], iso[1] - 1, iso[2]);
  var dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  var eyebrow = $id('db-eyebrow');
  if (eyebrow) eyebrow.innerHTML = 'Operations &middot; ' + escapeHtml(dateLabel);
  var railDate = $id('db-rail-date');
  if (railDate) railDate.textContent = dateLabel;
  touchUpdated();
}

function touchUpdated() {
  var iso = phNow().toISOString().slice(0, 16);
  var el = $id('db-updated');
  if (el) el.textContent = 'Updated ' + formatTime12(iso.slice(11));
}

/* ---------------- Period Controls ---------------- */

function renderPeriodLabel() {
  var label = new Date(DB.year, DB.month - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var monthLabel = $id('db-month-label');
  if (monthLabel) monthLabel.textContent = label;

  var lineSub = $id('db-line-sub');
  if (lineSub) {
    lineSub.textContent = (DB.lineGranularity === 'hourly'
      ? 'Hourly classification activity (PH Time) \u00b7 '
      : 'Daily classification trends \u00b7 ') + label;
  }

  var donutSub = $id('db-donut-sub');
  if (donutSub) donutSub.textContent = 'Share of classified records \u00b7 ' + label;

  var periodHint = $id('db-period-hint');
  if (periodHint) periodHint.textContent = 'Aggregated records for ' + label;

  var now = phNow();
  var isCurrentMonth = (DB.year === now.getFullYear() && DB.month === (now.getMonth() + 1));
  var jumpBtn = $id('db-jump-current-btn');
  if (jumpBtn) {
    jumpBtn.style.display = isCurrentMonth ? 'none' : 'inline-block';
  }

  var prevBtn = $id('db-month-prev');
  var nextBtn = $id('db-month-next');
  if (prevBtn) prevBtn.disabled = (DB.year <= 2024);
  if (nextBtn) nextBtn.disabled = (DB.year === now.getFullYear() + 1 && DB.month === 12);
}

function shiftMonth(delta) {
  DB.month += delta;
  if (DB.month < 1) { DB.month = 12; DB.year -= 1; }
  if (DB.month > 12) { DB.month = 1; DB.year += 1; }
  renderPeriodLabel();
  loadMonthly();
}

function jumpToCurrentMonth() {
  var now = phNow();
  DB.year = now.getFullYear();
  DB.month = now.getMonth() + 1;
  renderPeriodLabel();
  loadMonthly();
}

function wireControls() {
  var prevBtn = $id('db-month-prev');
  if (prevBtn) prevBtn.addEventListener('click', function () { shiftMonth(-1); });

  var nextBtn = $id('db-month-next');
  if (nextBtn) nextBtn.addEventListener('click', function () { shiftMonth(1); });

  var currentBtn = $id('db-month-current');
  if (currentBtn) currentBtn.addEventListener('click', openMonthDialog);

  var jumpBtn = $id('db-jump-current-btn');
  if (jumpBtn) jumpBtn.addEventListener('click', jumpToCurrentMonth);

  var refreshBtn = $id('db-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      refreshBtn.classList.add('is-syncing');
      Promise.all([loadDashboard(), loadMonthly()]).finally(function () {
        setTimeout(function () { refreshBtn.classList.remove('is-syncing'); }, 600);
      });
    });
  }

  // Line chart time granularity switchers (Daily vs By Hour)
  var granularityContainer = $id('db-line-granularity');
  if (granularityContainer) {
    granularityContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.db-view-btn');
      if (!btn) return;
      granularityContainer.querySelectorAll('.db-view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      DB.lineGranularity = btn.dataset.granularity === 'hourly' ? 'hourly' : 'daily';
      renderPeriodLabel();
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  }

  // Line chart view mode switchers (By Category vs Total Volume)
  var viewModeContainer = $id('db-line-view-mode');
  if (viewModeContainer) {
    viewModeContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.db-view-btn');
      if (!btn) return;
      viewModeContainer.querySelectorAll('.db-view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      DB.lineChartMode = btn.dataset.mode || 'category';
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  }

  // Activity filter tabs
  var activityFilter = $id('db-activity-filter');
  if (activityFilter) {
    activityFilter.addEventListener('click', function (e) {
      var btn = e.target.closest('.db-filter-pill');
      if (!btn) return;
      activityFilter.querySelectorAll('.db-filter-pill').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      DB.activityFilter = btn.dataset.filter || 'all';
      renderFilteredActivities();
    });
  }
}

/** Native month picker dialog so the user can jump anywhere. */
function openMonthDialog() {
  if (document.getElementById('db-month-overlay')) return;

  var overlay = document.createElement('div');
  overlay.className = 'db-month-dialog';
  overlay.id = 'db-month-overlay';

  var current = DB.year + '-' + (DB.month < 10 ? '0' + DB.month : DB.month);
  var now = phNow();
  var max = (now.getFullYear() + 1) + '-12';

  overlay.innerHTML =
    '<div class="db-month-dialog-box" role="dialog" aria-modal="true" aria-label="Choose month">' +
      '<h4>Select Analytics Period</h4>' +
      '<p style="font-size:12.5px;color:var(--db-muted);margin:0 0 12px;">Choose any month to load complete classification and collection metrics.</p>' +
      '<input type="month" id="db-month-input" value="' + current + '" min="2024-01" max="' + max + '">' +
      '<div class="db-month-dialog-actions">' +
        '<button type="button" class="db-month-dialog-btn" id="db-month-cancel">Cancel</button>' +
        '<button type="button" class="db-month-dialog-btn primary" id="db-month-apply">Apply Period</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  DB.monthInput = $id('db-month-input');

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    DB.monthInput = null;
  }

  $id('db-month-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
  $id('db-month-apply').addEventListener('click', function () {
    var val = DB.monthInput.value;
    if (val && val.length === 7) {
      var parts = val.split('-');
      DB.year = parseInt(parts[0], 10);
      DB.month = parseInt(parts[1], 10);
      renderPeriodLabel();
      loadMonthly();
    }
    close();
  });
  DB.monthInput.focus();
}

/* ---------------- Data Loading ---------------- */

function loadDashboard() {
  var today = phToday();
  var start = dateOffset(today, -6);
  var notifP = apiRequest('/api/notifications/summary').then(okJson);
  var routesP = apiRequest('/api/collection-schedules/by-date-range/?start_date=' + start + '&end_date=' + today).then(okJson);
  var recentP = apiRequest('/api/waste-records/?page=1&page_size=10').then(okJson);

  return Promise.all([notifP, routesP, recentP]).then(function (results) {
    var notifData = results[0] || {};
    var routesData = results[1] || [];

    // Verify today's delayed and cancelled counts with live schedule state
    var todayIso = phToday();
    var todayRoutes = (routesData || []).filter(function(s) {
      return s.collection_date && s.collection_date.substring(0, 10) === todayIso;
    });
    var delayedToday = todayRoutes.filter(function(s) { return s.status === 'Delayed'; }).length;
    var cancelledToday = todayRoutes.filter(function(s) { return s.status === 'Cancelled'; }).length;

    if (delayedToday > 0 && (!notifData.delayed_routes || notifData.delayed_routes < delayedToday)) {
      notifData.delayed_routes = delayedToday;
    }
    if (cancelledToday > 0 && (!notifData.cancelled_routes || notifData.cancelled_routes < cancelledToday)) {
      notifData.cancelled_routes = cancelledToday;
    }

    renderNotifs(notifData);
    renderMonthStrip(routesData);
    cacheActivities(routesData, results[2]);
    renderFilteredActivities();
    touchUpdated();
  }).catch(function (err) {
    var why = (err && err.message) ? err.message : 'Could not reach the server.';
    showRailError(why);
    showSectionError('db-notif-body', 'Could not load notifications.');
    showSectionError('db-activity-body', 'Could not load recent activity.');
  });
}

function dateOffset(baseIso, days) {
  var p = baseIso.split('-');
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function loadMonthly() {
  var url = '/api/dashboard/monthly?year=' + DB.year + '&month=' + DB.month;
  $id('db-line').innerHTML = '<div class="db-chart-empty"><div class="db-spinner"></div><p>Aggregating classification trends…</p></div>';
  $id('db-donut').innerHTML = '<div class="db-chart-empty"><div class="db-spinner"></div><p>Calculating waste mix…</p></div>';

  return apiRequest(url).then(okJson).then(function (data) {
    DB.monthlyData = data;
    renderMonthlyStats(data);
    renderLineChart(data);
    renderDonut(data);
  }).catch(function (err) {
    var why = (err && err.message) ? err.message : 'Could not load this month.';
    showChartError('db-line', why);
    showChartError('db-donut', why);
    showMonthlyStatDefaults();
  });
}

function okJson(res) {
  if (!res || !res.ok) throw new Error('Server returned ' + (res ? res.status : 'no response') + '.');
  return res.json();
}

/* ---------------- Month Telemetry Cards ---------------- */

function renderMonthlyStats(data) {
  var label = new Date(DB.year, DB.month - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  animateNumber('stat-users', data.total_users || 0);
  $id('stat-users-foot').innerHTML = 'All registered citizens';

  animateNumber('stat-records', data.total_routes || 0);
  var routesNote = data.total_routes
    ? '<strong>' + data.total_routes + '</strong> routes in ' + escapeHtml(label)
    : 'No routes scheduled in ' + escapeHtml(label);
  $id('stat-records-foot').innerHTML = routesNote;

  animateNumber('stat-today-class', data.total_ai_classifications || 0);
  $id('stat-today-class-foot').innerHTML =
    data.avg_confidence == null ? 'Avg AI confidence n/a' : 'Avg AI confidence <strong>' + data.avg_confidence + '%</strong>';

  animateNumber('stat-notif', data.total_notifications || 0);
  $id('stat-notif-foot').innerHTML = 'Messages sent in ' + escapeHtml(label);
}

function animateNumber(id, targetVal) {
  var el = $id(id);
  if (!el) return;
  var target = parseInt(targetVal, 10) || 0;
  if (target === 0) {
    el.textContent = '0';
    return;
  }
  var duration = 700;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var easeOut = 1 - Math.pow(1 - progress, 3);
    var value = Math.round(easeOut * target);
    el.textContent = value.toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = target.toLocaleString();
    }
  }
  window.requestAnimationFrame(step);
}

function showMonthlyStatDefaults() {
  var foots = ['stat-users-foot', 'stat-records-foot', 'stat-today-class-foot', 'stat-notif-foot'];
  for (var i = 0; i < foots.length; i++) {
    var el = $id(foots[i]);
    if (el) { el.textContent = 'Unavailable right now'; el.className = 'db-stat-foot warn'; }
  }
}

/* ---------------- High-Precision Monotone Cubic Spline & Collision Engine ---------------- */

/**
 * Computes Fritsch-Carlson Monotone Cubic Spline segments, splitting flat
 * zero-baseline runs from active positive curves while keeping C1 continuity.
 */
function buildMonotoneCubicSplineParts(pts, values, clampBaseY, clampTopY) {
  var n = pts.length;
  if (n === 0) return { fullPath: '', activePath: '', baselinePath: '' };
  if (n === 1) {
    var single = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    return {
      fullPath: single,
      activePath: (values && values[0] > 0) ? single : '',
      baselinePath: (values && values[0] > 0) ? '' : single
    };
  }

  // 1. Secants (slopes)
  var deltas = [];
  for (var i = 0; i < n - 1; i++) {
    var dx = pts[i + 1][0] - pts[i][0];
    var dy = pts[i + 1][1] - pts[i][1];
    deltas.push(dx === 0 ? 0 : dy / dx);
  }

  // 2. Initial tangents
  var m = [deltas[0]];
  for (var i = 1; i < n - 1; i++) {
    var dPrev = deltas[i - 1];
    var dNext = deltas[i];
    if (dPrev * dNext <= 0) {
      m.push(0);
    } else {
      m.push((dPrev + dNext) / 2);
    }
  }
  m.push(deltas[n - 2]);

  // 3. Fritsch-Carlson strict monotonicity clamping
  for (var i = 0; i < n - 1; i++) {
    var d = deltas[i];
    if (d === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      var a = m[i] / d;
      var b = m[i + 1] / d;
      var h = Math.hypot(a, b);
      if (h > 3) {
        var t = 3 / h;
        m[i] = t * a * d;
        m[i + 1] = t * b * d;
      }
    }
  }

  // 4. Generate continuous full path + separate active & baseline paths
  var fullPath = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  var activePath = '';
  var baselinePath = '';
  var activeOpen = false;
  var baseOpen = false;

  for (var i = 0; i < n - 1; i++) {
    var p0 = pts[i];
    var p1 = pts[i + 1];
    var segDx = (p1[0] - p0[0]) / 3;

    var cp1x = p0[0] + segDx;
    var cp1y = p0[1] + m[i] * segDx;
    var cp2x = p1[0] - segDx;
    var cp2y = p1[1] - m[i + 1] * segDx;

    if (clampBaseY != null) {
      if (cp1y > clampBaseY) cp1y = clampBaseY;
      if (cp2y > clampBaseY) cp2y = clampBaseY;
    }
    if (clampTopY != null) {
      if (cp1y < clampTopY) cp1y = clampTopY;
      if (cp2y < clampTopY) cp2y = clampTopY;
    }

    var segCmd = ' C ' + cp1x.toFixed(1) + ' ' + cp1y.toFixed(1) +
                 ', ' + cp2x.toFixed(1) + ' ' + cp2y.toFixed(1) +
                 ', ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
    fullPath += segCmd;

    var isZeroSeg = values && (values[i] === 0 && values[i + 1] === 0);
    if (isZeroSeg) {
      if (!baseOpen) {
        baselinePath += (baselinePath ? ' ' : '') + 'M ' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1);
        baseOpen = true;
      }
      baselinePath += ' L ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
      activeOpen = false;
    } else {
      if (!activeOpen) {
        activePath += (activePath ? ' ' : '') + 'M ' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1);
        activeOpen = true;
      }
      activePath += segCmd;
      baseOpen = false;
    }
  }

  return {
    fullPath: fullPath,
    activePath: activePath,
    baselinePath: baselinePath
  };
}

/**
 * Computes clean, non-duplicate integer Y-axis ticks & ceiling with breathing room.
 */
function computeNiceYAxis(maxVal) {
  if (!maxVal || maxVal <= 0) {
    return { maxY: 4, ticks: [0, 1, 2, 3, 4] };
  }
  if (maxVal <= 5) {
    var topSmall = Math.max(4, maxVal + 1);
    var smallTicks = [];
    for (var s = 0; s <= topSmall; s++) smallTicks.push(s);
    return { maxY: topSmall, ticks: smallTicks };
  }
  if (maxVal <= 10) {
    var topTen = Math.ceil((maxVal + 1) / 2) * 2;
    var tenTicks = [];
    for (var k = 0; k <= topTen; k += 2) tenTicks.push(k);
    return { maxY: topTen, ticks: tenTicks };
  }

  var niceSteps = [3, 4, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  var targetMax = Math.ceil(maxVal * 1.15);
  var chosenStep = Math.ceil(targetMax / 5);
  for (var idx = 0; idx < niceSteps.length; idx++) {
    var candidate = niceSteps[idx];
    if (Math.ceil(targetMax / candidate) <= 6) {
      chosenStep = candidate;
      break;
    }
  }
  var maxY = Math.ceil(targetMax / chosenStep) * chosenStep;
  var ticks = [];
  for (var yv = 0; yv <= maxY; yv += chosenStep) {
    ticks.push(yv);
  }
  return { maxY: maxY, ticks: ticks };
}

function getCategoryColor(name, idx) {
  if (DB_CLASS_COLORS[name]) return DB_CLASS_COLORS[name];
  var fallback = ['#0ea5e9', '#f59e0b', '#ec4899', '#14b8a6'];
  return fallback[idx % fallback.length];
}

function getLineCategoryColor(name, idx) {
  return getCategoryColor(name, idx);
}

function formatHourShort(hour) {
  var h = Number(hour) || 0;
  if (h === 0) return '12 AM';
  if (h < 12) return h + ' AM';
  if (h === 12) return '12 PM';
  return (h - 12) + ' PM';
}

function formatHourWindow(hour) {
  var h = Number(hour) || 0;
  var suffix = h < 12 ? 'AM' : 'PM';
  var h12 = h % 12 === 0 ? 12 : (h % 12);
  return h12 + ':00 ' + suffix + ' \u2013 ' + h12 + ':59 ' + suffix;
}

/* ---------------- Line Chart Engine (Dark Wave Aesthetic + Daily/Hourly + Tie-Safe) ---------------- */

function renderLineChart(data) {
  var el = $id('db-line');
  if (!el) return;

  var isHourly = DB.lineGranularity === 'hourly';
  var byClass = isHourly ? (data.records_by_class_by_hour || {}) : (data.records_by_class_by_day || {});
  var fallbackTotalsByBin = isHourly ? (data.records_by_hour || {}) : (data.records_by_day || {});
  var year = DB.year, month = DB.month;
  var daysInMonth = new Date(year, month, 0).getDate();
  var binCount = isHourly ? 24 : daysInMonth;
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthAbbr = monthNames[month - 1];

  var binKeys = [];
  for (var bk = 0; bk < binCount; bk++) {
    binKeys.push(isHourly ? bk : (bk + 1));
  }

  // Active categories present this month (ordered cleanly)
  var classes = DB_CLASS_ORDER.filter(function (k) {
    return Object.keys(byClass[k] || {}).length > 0;
  });
  Object.keys(byClass).forEach(function (k) {
    if (DB_CLASS_ORDER.indexOf(k) === -1 && Object.keys(byClass[k] || {}).length > 0) {
      classes.push(k);
    }
  });

  // Build full series list with totals across selected bins (Days or Hours)
  var allSeries = classes.map(function (k, idx) {
    var vals = [];
    var sum = 0;
    for (var i = 0; i < binCount; i++) {
      var binKey = binKeys[i];
      var v = (byClass[k] && byClass[k][binKey] !== undefined) ? Number(byClass[k][binKey]) : 0;
      vals.push(v);
      sum += v;
    }
    return { name: k, color: getLineCategoryColor(k, idx), values: vals, total: sum };
  });

  // Defensive fallback if class-by-bin map is absent while aggregate totals exist
  if (allSeries.length === 0 && Object.keys(fallbackTotalsByBin).length > 0) {
    var fbVals = [];
    var fbSum = 0;
    for (var fbi = 0; fbi < binCount; fbi++) {
      var fbk = binKeys[fbi];
      var fbv = fallbackTotalsByBin[fbk] !== undefined ? Number(fallbackTotalsByBin[fbk]) : 0;
      fbVals.push(fbv);
      fbSum += fbv;
    }
    if (fbSum > 0) {
      allSeries.push({ name: 'Classified Waste', color: '#2563eb', values: fbVals, total: fbSum });
      classes = ['Classified Waste'];
    }
  }

  var totalRecordsAll = allSeries.reduce(function (acc, s) { return acc + s.total; }, 0);

  // Respect interactive legend filters in By Category mode
  var activeClasses = classes.filter(function (k) {
    return DB.activeClassFilters[k] !== false;
  });
  if (classes.length > 0 && activeClasses.length === 0) {
    DB.activeClassFilters = {};
    activeClasses = classes.slice();
  }
  var isFiltered = DB.lineChartMode === 'category' && activeClasses.length < classes.length;
  var visibleBaseSeries = DB.lineChartMode === 'total'
    ? allSeries
    : allSeries.filter(function (s) { return DB.activeClassFilters[s.name] !== false; });

  // Visible bin totals & peak bin calculation
  var visibleTotals = [];
  var visibleTotalRecords = 0;
  var peakBinIdx = 0;
  var peakVal = 0;

  for (var bIdx = 0; bIdx < binCount; bIdx++) {
    var binSum = 0;
    visibleBaseSeries.forEach(function (s) {
      binSum += (s.values[bIdx] || 0);
    });
    visibleTotals.push(binSum);
    visibleTotalRecords += binSum;
    if (binSum > peakVal) {
      peakVal = binSum;
      peakBinIdx = bIdx;
    }
  }

  var badgeEl = $id('db-line-badge');
  if (badgeEl) {
    var shownCount = DB.lineChartMode === 'total' ? totalRecordsAll : visibleTotalRecords;
    var peakBadgeTxt = isHourly
      ? formatHourShort(peakBinIdx)
      : (monthAbbr + ' ' + (peakBinIdx + 1));
    badgeEl.textContent = shownCount.toLocaleString() + ' records' +
      (peakVal > 0 ? ' \u00b7 Peak: ' + peakBadgeTxt : '');
    badgeEl.className = 'db-chart-badge' + (totalRecordsAll === 0 ? ' slate' : '');
  }

  if (totalRecordsAll === 0) {
    el.innerHTML =
      '<div class="db-chart-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>' +
        '<p><strong>No classifications for this period.</strong><br>Records will appear as citizens sort waste using the AI scanner.</p>' +
      '</div>';
    var legendEmpty = $id('db-line-legend');
    if (legendEmpty) legendEmpty.innerHTML = '';
    return;
  }

  // Exact responsive container geometry (1:1 SVG scaling avoids oval dot distortion)
  var rect = el.getBoundingClientRect();
  var W = Math.max(280, Math.floor(rect.width || 680));
  var H = Math.max(220, Math.floor(rect.height || (W < 480 ? 245 : 300)));
  var padL = W < 360 ? 34 : 46;
  var padR = W < 360 ? 20 : 28;
  var padT = 26;
  var padB = 38;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;
  var step = plotW / (binCount - 1 || 1);

  // Max value & crisp integer Y ticks
  var maxVal = 0;
  if (DB.lineChartMode === 'total') {
    visibleTotals.forEach(function (v) { if (v > maxVal) maxVal = v; });
  } else {
    visibleBaseSeries.forEach(function (s) {
      s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
  }
  var yAxis = computeNiceYAxis(maxVal);
  var maxY = yAxis.maxY;
  var yTicks = yAxis.ticks;
  var yFor = function (v) { return padT + plotH - (v / maxY) * plotH; };
  var baseY = padT + plotH;
  var pxPerUnit = plotH / (maxY || 1);

  // Compute collision-free coordinates for every visible series
  var renderedSeries = [];
  if (DB.lineChartMode === 'total') {
    var totalPts = [];
    for (var ti = 0; ti < binCount; ti++) {
      totalPts.push([padL + ti * step, yFor(visibleTotals[ti])]);
    }
    var totalParts = buildMonotoneCubicSplineParts(totalPts, visibleTotals, baseY, padT + 2);
    var totalAreaD = totalParts.fullPath +
      ' L ' + totalPts[totalPts.length - 1][0].toFixed(1) + ' ' + baseY.toFixed(1) +
      ' L ' + totalPts[0][0].toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
    renderedSeries.push({
      name: 'Total Volume',
      color: '#2563eb',
      values: visibleTotals,
      total: visibleTotalRecords,
      pts: totalPts,
      path: totalParts.fullPath,
      activePath: totalParts.activePath,
      baselinePath: totalParts.baselinePath,
      areaPath: totalAreaD,
      needsDash: false,
      ties: []
    });
  } else {
    var ptsMatrix = visibleBaseSeries.map(function (s) {
      var arr = [];
      for (var i = 0; i < binCount; i++) {
        arr.push([padL + i * step, yFor(s.values[i])]);
      }
      return arr;
    });
    var tiesMatrix = visibleBaseSeries.map(function () { return new Array(binCount).fill(false); });
    var dashOverlapSeries = visibleBaseSeries.map(function () { return false; });

    // Apply deterministic tie-aware micro-lane separation (dx, dy) whenever >=2 series share the same value > 0
    if (visibleBaseSeries.length > 1) {
      for (var bi = 0; bi < binCount; bi++) {
        var groupsByVal = {};
        for (var sIdx = 0; sIdx < visibleBaseSeries.length; sIdx++) {
          var val = visibleBaseSeries[sIdx].values[bi];
          if (val > 0) {
            if (!groupsByVal[val]) groupsByVal[val] = [];
            groupsByVal[val].push(sIdx);
          }
        }

        Object.keys(groupsByVal).forEach(function (valKey) {
          var grp = groupsByVal[valKey];
          if (grp.length < 2) return;

          var k = grp.length;
          var baseBinX = padL + bi * step;
          var rawY = yFor(Number(valKey));

          // Horizontal bead fan stays cleanly inside bin slot & plot bounds
          var maxHalfX = Math.min(7.2, step * 0.25);
          var dxStep = Math.min(5.2, (maxHalfX * 2) / (k - 1));

          // Vertical lane spread stays within <=28% of 1 unit so numerical level remains clear
          var maxHalfY = Math.min(8.0, Math.max(0.8, pxPerUnit * 0.28));
          var dyStep = Math.min(4.1, (maxHalfY * 2) / (k - 1));
          var crampedVertically = dyStep < 2.5;

          grp.forEach(function (sIndex, pos) {
            var centerOff = pos - (k - 1) / 2;
            var dx = centerOff * dxStep;
            var dy = centerOff * dyStep;

            if (bi === 0) {
              var edgeStep = Math.min(dxStep, (step * 0.45) / Math.max(1, k - 1));
              dx = pos * edgeStep;
            } else if (bi === binCount - 1) {
              var edgeStepLast = Math.min(dxStep, (step * 0.45) / Math.max(1, k - 1));
              dx = -((k - 1 - pos) * edgeStepLast);
            }

            var finalX = Math.max(padL, Math.min(padL + plotW, baseBinX + dx));
            var finalY = Math.max(padT + 4, Math.min(baseY - 4, rawY + dy));

            ptsMatrix[sIndex][bi] = [finalX, finalY];
            tiesMatrix[sIndex][bi] = true;
            if (crampedVertically && pos > 0) {
              dashOverlapSeries[sIndex] = true;
            }
          });
        });
      }
    }

    renderedSeries = visibleBaseSeries.map(function (s, idx) {
      var pts = ptsMatrix[idx];
      var parts = buildMonotoneCubicSplineParts(pts, s.values, baseY, padT + 2);
      var areaD = parts.fullPath +
        ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + baseY.toFixed(1) +
        ' L ' + pts[0][0].toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
      return {
        name: s.name,
        color: s.color,
        values: s.values,
        total: s.total,
        pts: pts,
        path: parts.fullPath,
        activePath: parts.activePath,
        baselinePath: parts.baselinePath,
        areaPath: areaD,
        needsDash: dashOverlapSeries[idx],
        dashOffset: idx * 5,
        ties: tiesMatrix[idx]
      };
    });
  }

  // X column ticks & labels (7 clean evenly spaced columns matching reference aesthetic)
  var xLabelBins = [];
  if (isHourly) {
    xLabelBins = W < 380 ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23];
  } else {
    var xDayNums = [1];
    var dayStep = daysInMonth > 28 ? 5 : 4;
    for (var ld = 1 + dayStep; ld < daysInMonth; ld += dayStep) xDayNums.push(ld);
    if (xDayNums[xDayNums.length - 1] !== daysInMonth) xDayNums.push(daysInMonth);
    xLabelBins = xDayNums.map(function (d) { return d - 1; });
  }

  // Current PH time marker (Today day in Daily mode; Current PH hour in Hourly mode)
  var nowPh = phNow();
  var todayIso = phToday();
  var todayParts = todayIso.split('-');
  var isCurrentMonth = Number(todayParts[0]) === year && Number(todayParts[1]) === month;
  var todayDayNum = Number(todayParts[2]);
  var currentHourNum = nowPh.getHours();
  var currentMarkerBin = -1;
  var currentMarkerLabel = '';

  if (isCurrentMonth) {
    if (isHourly) {
      currentMarkerBin = currentHourNum;
      currentMarkerLabel = 'NOW';
    } else if (todayDayNum >= 1 && todayDayNum <= daysInMonth) {
      currentMarkerBin = todayDayNum - 1;
      currentMarkerLabel = 'TODAY';
    }
  }

  var todayMarkerSvg = '';
  if (currentMarkerBin >= 0 && currentMarkerBin < binCount) {
    var tx = padL + currentMarkerBin * step;
    var pillWNow = currentMarkerLabel === 'TODAY' ? 38 : 32;
    todayMarkerSvg =
      '<line class="db-line-today-line" x1="' + tx.toFixed(1) + '" y1="' + (padT - 4) + '" x2="' + tx.toFixed(1) + '" y2="' + baseY + '"/>' +
      '<rect class="db-line-today-pill" x="' + (tx - pillWNow / 2).toFixed(1) + '" y="4" width="' + pillWNow + '" height="14" rx="7"/>' +
      '<text class="db-line-today-txt" x="' + tx.toFixed(1) + '" y="13.5" text-anchor="middle">' + currentMarkerLabel + '</text>';
  }

  // SVG Linear Gradients (Soft luminous aura under waves + subtle blue hover band)
  var defs = '<defs>' +
    '<linearGradient id="db-band-grad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2563eb" stop-opacity="0.08"/>' +
      '<stop offset="100%" stop-color="#2563eb" stop-opacity="0.01"/>' +
    '</linearGradient>' +
    renderedSeries.map(function (s, idx) {
      var gradId = 'db-line-grad-' + idx;
      var topOp = DB.lineChartMode === 'total' ? '0.24' : '0.15';
      var midOp = DB.lineChartMode === 'total' ? '0.07' : '0.04';
      return '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="' + topOp + '"/>' +
        '<stop offset="65%" stop-color="' + s.color + '" stop-opacity="' + midOp + '"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0.0"/>' +
      '</linearGradient>';
    }).join('') +
  '</defs>';

  // Left Vertical Y-Axis Spine + Short Horizontal Cross-Ticks (no cluttered horizontal lines)
  var yAxisSvg =
    '<line class="db-line-yaxis" x1="' + padL + '" y1="' + (padT - 6) + '" x2="' + padL + '" y2="' + baseY + '"/>' +
    yTicks.map(function (yv) {
      var y = yFor(yv);
      return '<line class="db-line-ytick" x1="' + (padL - 5) + '" y1="' + y.toFixed(1) + '" x2="' + (padL + 5) + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="db-line-label y" x="' + (padL - 10) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + yv.toLocaleString() + '</text>';
    }).join('');

  // Crisp Vertical Column Dividers + Uppercase X Labels (Image 1 column aesthetic)
  var xMarkersSvg = xLabelBins.map(function (b) {
    if (b === 0) return '';
    var x = padL + b * step;
    return '<line class="db-line-xmark" x1="' + x.toFixed(1) + '" y1="' + (padT - 6) + '" x2="' + x.toFixed(1) + '" y2="' + baseY + '"/>';
  }).join('');

  var xLabelsSvg = xLabelBins.map(function (b) {
    var x = padL + b * step;
    var labelTxt = isHourly
      ? formatHourShort(b)
      : (monthAbbr + ' ' + (b + 1)).toUpperCase();
    return '<text class="db-line-label x" x="' + x.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + labelTxt + '</text>';
  }).join('');

  // Series Curves, Luminous Area Fills & Glowing Data Nodes
  var pathsSvg = renderedSeries.map(function (s, idx) {
    var gradId = 'db-line-grad-' + idx;
    var dashAttr = s.needsDash ? ' stroke-dasharray="7 4" stroke-dashoffset="' + s.dashOffset + '"' : '';

    var firstPos = -1;
    var lastPos = -1;
    for (var pi = 0; pi < s.values.length; pi++) {
      if (s.values[pi] > 0) {
        if (firstPos === -1) firstPos = pi;
        lastPos = pi;
      }
    }

    var dotsHtml = s.pts.map(function (pt, bIdx) {
      var v = s.values[bIdx];
      if (!v || v <= 0) return '';
      var isTied = s.ties && s.ties[bIdx];
      var isEndpoint = (bIdx === firstPos || bIdx === lastPos);
      var rSize = isEndpoint ? '4.2' : (isTied ? '3.3' : '3.6');
      return '<circle class="db-line-dot' + (isTied ? ' is-tied' : '') + (isEndpoint ? ' is-end' : '') + '" ' +
        'cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="' + rSize + '" ' +
        'fill="' + s.color + '" stroke="#ffffff" stroke-width="1.6"/>';
    }).join('');

    return '<g class="db-line-series show-area" data-series="' + escapeHtml(s.name) + '">' +
      '<path class="db-line-area" d="' + s.areaPath + '" fill="url(#' + gradId + ')"/>' +
      (s.baselinePath
        ? '<path class="db-line-baseline" d="' + s.baselinePath + '" stroke="' + s.color + '"/>'
        : '') +
      (s.activePath
        ? '<path class="db-line-casing" d="' + s.activePath + '"/>' +
          '<path class="db-line-path" d="' + s.activePath + '" stroke="' + s.color + '"' + dashAttr + '/>'
        : '') +
      dotsHtml +
    '</g>';
  }).join('');

  // Peak Pill Annotation (shown in Total Volume or isolated single category)
  var peakTagSvg = '';
  if ((DB.lineChartMode === 'total' || renderedSeries.length === 1) && peakVal > 0) {
    var soloSeries = renderedSeries[0];
    var soloPeakIdx = 0;
    var soloPeakMax = 0;
    soloSeries.values.forEach(function (v, idx) {
      if (v > soloPeakMax) { soloPeakMax = v; soloPeakIdx = idx; }
    });
    if (soloPeakMax > 0 && soloSeries.pts[soloPeakIdx]) {
      var pkPt = soloSeries.pts[soloPeakIdx];
      var pillW = 64;
      var pillX = Math.max(padL + 6, Math.min(W - padR - pillW, pkPt[0] - pillW / 2));
      var pillY = Math.max(2, pkPt[1] - 24);
      peakTagSvg =
        '<g class="db-line-peak-tag">' +
          '<rect x="' + pillX.toFixed(1) + '" y="' + pillY.toFixed(1) + '" width="' + pillW + '" height="17" rx="8.5" fill="#ffffff" stroke="' + soloSeries.color + '" stroke-width="1.2"/>' +
          '<text x="' + (pillX + pillW / 2).toFixed(1) + '" y="' + (pillY + 11.5).toFixed(1) + '" text-anchor="middle" fill="' + soloSeries.color + '">Peak: ' + soloPeakMax + '</text>' +
        '</g>';
    }
  }

  // Interactive Bin Band, Crosshair & De-collided Focus Rings
  var bandW = Math.max(14, Math.min(34, step * 0.85));
  var overlaySvg =
    '<rect class="db-focus-band" id="db-focus-band" x="0" y="' + padT + '" width="' + bandW.toFixed(1) + '" height="' + plotH + '" rx="4" fill="url(#db-band-grad)"/>' +
    '<line class="db-crosshair" id="db-crosshair" x1="0" y1="' + padT + '" x2="0" y2="' + baseY + '"/>' +
    renderedSeries.map(function (s, idx) {
      return '<circle class="db-focus-dot" id="db-focus-' + idx + '" r="5.5" fill="' + s.color + '"/>';
    }).join('') +
    '<rect class="db-hit" x="' + Math.max(0, padL - 10) + '" y="' + Math.max(0, padT - 10) + '" width="' + (plotW + 20) + '" height="' + (plotH + 20) + '"/>';

  el.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Classification trend chart">' +
      defs + xMarkersSvg + yAxisSvg + todayMarkerSvg + xLabelsSvg + pathsSvg + peakTagSvg + overlaySvg +
    '</svg>';

  wireLineChartInteraction(el, renderedSeries, allSeries, {
    W: W,
    H: H,
    padL: padL,
    padT: padT,
    step: step,
    bandW: bandW,
    binCount: binCount,
    isHourly: isHourly,
    year: year,
    month: month,
    isCurrentMonth: isCurrentMonth,
    currentMarkerBin: currentMarkerBin
  });

  renderLineLegend(classes, allSeries, el, isFiltered);
}

function wireLineChartInteraction(container, seriesList, allSeries, geo) {
  var svgEl = container.querySelector('svg');
  var hitRect = container.querySelector('.db-hit');
  var crosshair = container.querySelector('#db-crosshair');
  var focusBand = container.querySelector('#db-focus-band');
  var tooltip = $id('db-chart-tip');
  var chartShell = container.closest('.db-chart-container') || container;
  if (!svgEl || !hitRect || !crosshair || !tooltip) return;

  var focusDots = seriesList.map(function (_, idx) {
    return container.querySelector('#db-focus-' + idx);
  });

  function handleMove(clientX, clientY) {
    var svgRect = svgEl.getBoundingClientRect();
    var contRect = chartShell.getBoundingClientRect();
    if (!svgRect.width) return;

    var xInSvg = ((clientX - svgRect.left) / svgRect.width) * geo.W;
    var binIndex = Math.round((xInSvg - geo.padL) / geo.step);
    if (binIndex < 0) binIndex = 0;
    if (binIndex >= geo.binCount) binIndex = geo.binCount - 1;

    var binX = geo.padL + binIndex * geo.step;

    // Move crosshair + column highlight band
    crosshair.setAttribute('x1', binX.toFixed(1));
    crosshair.setAttribute('x2', binX.toFixed(1));
    crosshair.classList.add('on');

    if (focusBand) {
      focusBand.setAttribute('x', (binX - geo.bandW / 2).toFixed(1));
      focusBand.classList.add('on');
    }

    // Move each focus dot to its collision-separated coordinate
    seriesList.forEach(function (s, idx) {
      var dot = focusDots[idx];
      if (!dot || !s.pts[binIndex]) return;
      var pt = s.pts[binIndex];
      var val = s.values[binIndex] || 0;
      dot.setAttribute('cx', pt[0].toFixed(1));
      dot.setAttribute('cy', pt[1].toFixed(1));
      dot.setAttribute('r', val > 0 ? '6' : '3');
      dot.classList.toggle('is-zero', val <= 0);
      dot.classList.add('on');
    });

    // Tooltip header labels for Daily vs By Hour mode
    var headLeft = '';
    var headRight = '';
    var isCurrentBin = geo.isCurrentMonth && binIndex === geo.currentMarkerBin;

    if (geo.isHourly) {
      headLeft = formatHourWindow(binIndex);
      headRight = String(binIndex).padStart(2, '0') + ':00 PH';
    } else {
      var actualDay = binIndex + 1;
      headLeft = new Date(geo.year, geo.month - 1, actualDay)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      headRight = 'Day ' + actualDay;
    }

    var totalBinVisible = 0;
    var totalBinAll = 0;
    var rowsHtml = '';

    allSeries.forEach(function (s) {
      totalBinAll += (s.values[binIndex] || 0);
    });

    if (DB.lineChartMode === 'total') {
      var val = seriesList[0].values[binIndex] || 0;
      totalBinVisible = val;
      rowsHtml = '<div class="db-tip-row">' +
        '<span class="db-tip-swatch" style="background:#2563eb"></span>' +
        '<span class="db-tip-name">Total Scans</span>' +
        '<span class="db-tip-val">' + val.toLocaleString() + '</span>' +
      '</div>';
    } else {
      var valFreq = {};
      seriesList.forEach(function (s) {
        var v = s.values[binIndex] || 0;
        totalBinVisible += v;
        if (v > 0) valFreq[v] = (valFreq[v] || 0) + 1;
      });

      var ordered = seriesList.map(function (s, idx) {
        return { series: s, val: s.values[binIndex] || 0, idx: idx };
      }).sort(function (a, b) {
        if ((a.val > 0) !== (b.val > 0)) return a.val > 0 ? -1 : 1;
        if (b.val !== a.val) return b.val - a.val;
        return a.idx - b.idx;
      });

      if (totalBinVisible === 0) {
        rowsHtml = '<div class="db-tip-empty">No scans recorded ' +
          (geo.isHourly ? 'in this hour' : 'on this day') + '</div>';
      } else {
        rowsHtml = ordered.map(function (item) {
          var v = item.val;
          var isTied = v > 0 && (valFreq[v] || 0) > 1;
          var pct = totalBinVisible > 0 && v > 0 ? Math.round((v / totalBinVisible) * 100) : 0;
          return '<div class="db-tip-row' + (v === 0 ? ' is-zero' : '') + '">' +
            '<span class="db-tip-swatch" style="background:' + item.series.color + '"></span>' +
            '<span class="db-tip-name">' + escapeHtml(item.series.name) + '</span>' +
            (isTied ? '<span class="db-tip-tie" title="Same count across categories">Tie</span>' : '') +
            (v > 0 ? '<span class="db-tip-pct">' + pct + '%</span>' : '') +
            '<span class="db-tip-val">' + v.toLocaleString() + '</span>' +
          '</div>';
        }).join('');
      }
    }

    var totalLabel = (DB.lineChartMode === 'category' && totalBinVisible !== totalBinAll)
      ? '<span>Shown Total <small style="opacity:0.7;font-weight:600">(All: ' + totalBinAll + ')</small></span>'
      : '<span>' + (geo.isHourly ? 'Hour Total' : 'Day Total') + '</span>';

    tooltip.innerHTML =
      '<div class="db-tip-head">' +
        '<span>' + escapeHtml(headLeft) + (isCurrentBin ? ' <span class="db-tip-today">' + (geo.isHourly ? 'Now' : 'Today') + '</span>' : '') + '</span>' +
        '<span>' + escapeHtml(headRight) + '</span>' +
      '</div>' +
      '<div class="db-tip-rows">' + rowsHtml + '</div>' +
      '<div class="db-tip-total">' +
        totalLabel +
        '<span>' + totalBinVisible.toLocaleString() + '</span>' +
      '</div>';

    // Measure & clamp tooltip cleanly inside chart container
    tooltip.classList.add('on');
    var tipW = tooltip.offsetWidth || 195;
    var tipH = tooltip.offsetHeight || 110;
    var binCenterPx = svgRect.left - contRect.left + (binX / geo.W) * svgRect.width;
    var pointerY = clientY - contRect.top;

    var minLeft = tipW / 2 + 8;
    var maxLeft = Math.max(minLeft, contRect.width - tipW / 2 - 8);
    var clampedLeft = Math.max(minLeft, Math.min(maxLeft, binCenterPx));

    var flipBelow = pointerY < (tipH + 22);
    tooltip.classList.toggle('is-below', flipBelow);
    tooltip.style.left = clampedLeft.toFixed(1) + 'px';
    tooltip.style.top = (flipBelow ? Math.min(contRect.height - tipH - 8, pointerY + 18) : pointerY).toFixed(1) + 'px';
  }

  function handleLeave() {
    crosshair.classList.remove('on');
    if (focusBand) focusBand.classList.remove('on');
    focusDots.forEach(function (dot) { if (dot) dot.classList.remove('on'); });
    tooltip.classList.remove('on');
  }

  hitRect.addEventListener('mousemove', function (e) { handleMove(e.clientX, e.clientY); });
  hitRect.addEventListener('mouseleave', handleLeave);
  hitRect.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  hitRect.addEventListener('touchend', handleLeave);
}

function renderLineLegend(classes, allSeries, chartContainer, isFiltered) {
  var legend = $id('db-line-legend');
  if (!legend) return;

  var totalByClass = {};
  allSeries.forEach(function (s) { totalByClass[s.name] = s.total || 0; });

  if (DB.lineChartMode === 'total') {
    var grandTotal = allSeries.reduce(function (acc, s) { return acc + (s.total || 0); }, 0);
    legend.innerHTML =
      '<span class="db-legend-btn active">' +
        '<span class="db-legend-swatch" style="background:#2563eb"></span>' +
        '<span>Total Classification Volume</span>' +
        '<span class="db-legend-count">' + grandTotal.toLocaleString() + '</span>' +
      '</span>';
    return;
  }

  var pillsHtml = classes.map(function (k, idx) {
    var color = getLineCategoryColor(k, idx);
    var isOff = DB.activeClassFilters[k] === false;
    var count = totalByClass[k] || 0;
    return '<button type="button" class="db-legend-btn' + (isOff ? ' is-off' : '') + '" data-class="' + escapeHtml(k) + '" title="Hover to spotlight \u00b7 Click to filter">' +
      '<span class="db-legend-swatch" style="background:' + color + '"></span>' +
      '<span>' + escapeHtml(k) + '</span>' +
      '<span class="db-legend-count">' + count.toLocaleString() + '</span>' +
    '</button>';
  }).join('');

  if (isFiltered) {
    pillsHtml += '<button type="button" class="db-legend-reset" id="db-legend-reset" title="Show all categories">Show All</button>';
  }

  legend.innerHTML = pillsHtml;

  var svgEl = chartContainer ? chartContainer.querySelector('svg') : null;
  function setSpotlight(targetClass) {
    if (!svgEl) return;
    var groups = svgEl.querySelectorAll('.db-line-series');
    groups.forEach(function (g) {
      var name = g.getAttribute('data-series');
      if (!targetClass) {
        g.classList.remove('is-dim', 'is-spotlight');
      } else {
        g.classList.toggle('is-spotlight', name === targetClass);
        g.classList.toggle('is-dim', name !== targetClass);
      }
    });
  }

  legend.querySelectorAll('.db-legend-btn[data-class]').forEach(function (btn) {
    var cls = btn.dataset.class;
    btn.addEventListener('mouseenter', function () {
      if (DB.activeClassFilters[cls] !== false) setSpotlight(cls);
    });
    btn.addEventListener('mouseleave', function () {
      setSpotlight(null);
    });
    btn.addEventListener('click', function () {
      var allActive = Object.keys(DB.activeClassFilters).length === 0;
      if (allActive) {
        classes.forEach(function (c) { DB.activeClassFilters[c] = (c === cls); });
      } else {
        var currentOn = classes.filter(function (c) { return DB.activeClassFilters[c] !== false; });
        if (currentOn.length === 1 && currentOn[0] === cls) {
          DB.activeClassFilters = {};
        } else {
          DB.activeClassFilters[cls] = (DB.activeClassFilters[cls] === false);
        }
      }
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  });

  var resetBtn = $id('db-legend-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      DB.activeClassFilters = {};
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  }
}

/* ---------------- Donut / Pie Chart Engine (Interactive Slices) ---------------- */

function renderDonut(data) {
  var el = $id('db-donut');
  if (!el) return;

  var per = data.per_class || {};
  var items = DB_CLASS_ORDER.filter(function (k) { return (per[k] || 0) > 0; })
    .map(function (k) { return { name: k, value: per[k] || 0, color: DB_CLASS_COLORS[k] }; });

  var total = items.reduce(function (a, b) { return a + b.value; }, 0);

  var badgeEl = $id('db-donut-badge');
  if (badgeEl) {
    badgeEl.textContent = items.length + ' Active Class' + (items.length === 1 ? '' : 'es');
  }

  if (!total) {
    el.innerHTML =
      '<div class="db-chart-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>' +
        '<p><strong>No waste mix data.</strong><br>Classifications will populate this donut breakdown once recorded.</p>' +
      '</div>';
    return;
  }

  var size = 200, r = 82, cx = size / 2, cy = size / 2;
  var circ = 2 * Math.PI * r;
  var offset = 0;
  var segs = '';

  items.forEach(function (item, idx) {
    var frac = item.value / total;
    var dash = frac * circ;
    // Tiny gap between slices
    var strokeDash = (dash > 2 ? (dash - 1.5).toFixed(2) : dash.toFixed(2)) + ' ' + circ.toFixed(2);

    segs +=
      '<circle class="db-donut-seg" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
      'stroke="' + item.color + '" stroke-width="22" stroke-dasharray="' + strokeDash + '" ' +
      'stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" ' +
      'data-idx="' + idx + '">' +
      '<title>' + escapeHtml(item.name) + ': ' + item.value.toLocaleString() + ' records (' + Math.round(frac * 100) + '%)</title>' +
      '</circle>';
    offset += dash;
  });

  // Legend rows with percentage bars
  var legendRows = items.map(function (item, idx) {
    var pct = Math.round((item.value / total) * 1000) / 10;
    return (
      '<div class="db-donut-legend-row" data-idx="' + idx + '">' +
        '<div class="db-donut-legend-top">' +
          '<div class="db-donut-legend-left">' +
            '<span class="db-donut-legend-swatch" style="background:' + item.color + '"></span>' +
            '<span class="db-donut-legend-name">' + escapeHtml(item.name) + '</span>' +
          '</div>' +
          '<div class="db-donut-legend-right">' +
            '<span class="db-donut-legend-count">' + item.value.toLocaleString() + ' recs</span>' +
            '<span class="db-donut-legend-pct">' + pct + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="db-donut-pct-bar">' +
          '<div class="db-donut-pct-fill" style="width:' + pct + '%; background:' + item.color + '"></div>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  el.innerHTML =
    '<div class="db-donut" id="db-donut-svg-wrap">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Waste mix donut chart">' + segs + '</svg>' +
      '<div class="db-donut-center" id="db-donut-center">' +
        '<strong id="db-donut-center-val">' + total.toLocaleString() + '</strong>' +
        '<span id="db-donut-center-lbl">Total Records</span>' +
      '</div>' +
    '</div>' +
    '<div class="db-donut-legend" id="db-donut-legend">' + legendRows + '</div>';

  wireDonutHover(el, items, total);
}

function wireDonutHover(container, items, total) {
  var donutWrap = container.querySelector('#db-donut-svg-wrap');
  var centerVal = container.querySelector('#db-donut-center-val');
  var centerLbl = container.querySelector('#db-donut-center-lbl');
  var segs = container.querySelectorAll('.db-donut-seg');
  var rows = container.querySelectorAll('.db-donut-legend-row');

  function setActive(idx) {
    if (idx == null || idx < 0 || idx >= items.length) {
      donutWrap.classList.remove('has-active');
      segs.forEach(function (s) { s.classList.remove('is-active'); });
      rows.forEach(function (r) { r.classList.remove('is-active'); });
      centerVal.textContent = total.toLocaleString();
      centerVal.style.color = 'var(--db-ink)';
      centerLbl.textContent = 'Total Records';
      return;
    }

    var item = items[idx];
    var pct = Math.round((item.value / total) * 1000) / 10;
    donutWrap.classList.add('has-active');

    segs.forEach(function (s, sIdx) {
      s.classList.toggle('is-active', sIdx === idx);
    });
    rows.forEach(function (r, rIdx) {
      r.classList.toggle('is-active', rIdx === idx);
    });

    centerVal.textContent = item.value.toLocaleString();
    centerVal.style.color = item.color;
    centerLbl.textContent = item.name + ' (' + pct + '%)';
  }

  segs.forEach(function (seg) {
    var idx = parseInt(seg.dataset.idx, 10);
    seg.addEventListener('mouseenter', function () { setActive(idx); });
    seg.addEventListener('mouseleave', function () { setActive(null); });
  });

  rows.forEach(function (row) {
    var idx = parseInt(row.dataset.idx, 10);
    row.addEventListener('mouseenter', function () { setActive(idx); });
    row.addEventListener('mouseleave', function () { setActive(null); });
  });
}

/* ---------------- 7-Day Collection Strip ---------------- */

function renderMonthStrip(schedules) {
  var body = $id('db-rail-body');
  if (!body) return;

  var list = (schedules || []).slice();
  var today = phToday();
  var days = [];

  for (var off = 6; off >= 0; off--) {
    var iso = dateOffset(today, -off);
    var p = iso.split('-');
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    days.push({
      iso: iso,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: String(parseInt(p[2], 10)),
      routes: [],
      isToday: off === 0
    });
  }

  var byDate = {};
  list.forEach(function (s) {
    var dKey = (s.collection_date || '').substring(0, 10);
    (byDate[dKey] = byDate[dKey] || []).push(s);
  });
  days.forEach(function (day) { day.routes = byDate[day.iso] || []; });

  var statusFor = function (day) {
    var rs = day.routes;
    if (!rs.length) return { status: 'none', label: 'No Run' };
    if (rs.some(function (r) { return r.status === 'Cancelled'; })) return { status: 'cancelled', label: 'Cancelled' };
    if (rs.some(function (r) { return r.status === 'Delayed'; })) return { status: 'delayed', label: 'Delayed' };
    if (rs.some(function (r) { return r.status === 'Arriving' || r.status === 'Arrived'; })) return { status: 'arriving', label: 'Live' };
    if (rs.every(function (r) { return r.status === 'Completed'; })) return { status: 'completed', label: 'Completed' };
    return { status: 'upcoming', label: 'Scheduled' };
  };

  var totalRoutes = list.length;
  var doneRoutes = list.filter(function (r) { return r.status === 'Completed'; }).length;
  var cancelledRoutes = list.filter(function (r) { return r.status === 'Cancelled'; }).length;
  var delayedRoutes = list.filter(function (r) { return r.status === 'Delayed'; }).length;
  var completionPct = totalRoutes ? Math.round((doneRoutes / totalRoutes) * 100) : 0;

  var cols = days.map(function (day) {
    var stInfo = statusFor(day);
    var count = day.routes.length;
    var doneCount = day.routes.filter(function (r) { return r.status === 'Completed'; }).length;
    var segPct = count ? Math.round((doneCount / count) * 100) : 0;

    return (
      '<div class="db-day' + (day.isToday ? ' today' : '') + ' ' + stInfo.status + '" data-iso="' + day.iso + '" title="' + escapeHtml(day.label + ', ' + day.iso + ' — ' + count + (count === 1 ? ' route' : ' routes') + ' — Click to view schedule') + '">' +
        '<div class="db-day-top">' +
          '<div class="db-day-weekday">' +
            '<span class="db-day-label">' + escapeHtml(day.label) + '</span>' +
            (day.isToday ? '<span class="db-day-today-tag">Today</span>' : '') +
          '</div>' +
          '<span class="db-day-date">' + escapeHtml(day.dayNum) + '</span>' +
        '</div>' +
        '<div class="db-day-mid">' +
          '<div class="db-day-status-chip ' + stInfo.status + '">' +
            '<span class="db-day-status-dot"></span>' +
            '<span class="db-day-status-txt">' + stInfo.label + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="db-day-metric">' +
          '<div class="db-day-metric-row">' +
            '<span class="db-day-count-badge">' +
              (count ? '<strong>' + count + '</strong> ' + (count === 1 ? 'Route' : 'Routes') : 'No Run') +
            '</span>' +
            '<span class="db-day-go-icon" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
            '</span>' +
          '</div>' +
          (count > 0
            ? '<div class="db-day-mini-bar"><div class="db-day-mini-fill ' + stInfo.status + '" style="width:' + (segPct || 25) + '%"></div></div>'
            : '<div class="db-day-mini-bar empty"></div>') +
        '</div>' +
      '</div>'
    );
  }).join('');

  var metaChips =
    '<div class="db-rail-summary-chips">' +
      '<span class="db-rail-chip total"><strong>' + totalRoutes + '</strong> Total Routes</span>' +
      '<span class="db-rail-chip good"><span class="db-chip-dot good"></span><strong>' + doneRoutes + '</strong> Completed</span>' +
      (delayedRoutes ? '<span class="db-rail-chip warn"><span class="db-chip-dot warn"></span><strong>' + delayedRoutes + '</strong> Delayed</span>' : '') +
      (cancelledRoutes ? '<span class="db-rail-chip danger"><span class="db-chip-dot danger"></span><strong>' + cancelledRoutes + '</strong> Cancelled</span>' : '') +
    '</div>';

  body.innerHTML =
    '<div class="db-rail-meta-row">' +
      metaChips +
      '<div class="db-rail-progress-wrap">' +
        '<span class="db-rail-progress-label">Dispatch Rate</span>' +
        '<div class="db-rail-progress-bar"><div class="db-rail-progress-fill" style="width:' + completionPct + '%"></div></div>' +
        '<span class="db-rail-progress-pct">' + completionPct + '%</span>' +
      '</div>' +
    '</div>' +
    '<div class="db-week">' + cols + '</div>' +
    '<div class="db-rail-legend">' +
      '<span class="db-legend-item"><span class="db-legend-swatch arriving"></span>Live Run</span>' +
      '<span class="db-legend-item"><span class="db-legend-swatch completed"></span>Completed</span>' +
      '<span class="db-legend-item"><span class="db-legend-swatch upcoming"></span>Scheduled</span>' +
      '<span class="db-legend-item"><span class="db-legend-swatch delayed"></span>Delayed</span>' +
      '<span class="db-legend-item"><span class="db-legend-swatch cancelled"></span>Cancelled</span>' +
    '</div>';

  // Wire clickable day tiles → navigate to collection schedule page for that date
  body.querySelectorAll('.db-day[data-iso]').forEach(function (tile) {
    tile.style.cursor = 'pointer';
    tile.addEventListener('click', function () {
      var iso = tile.dataset.iso;
      if (iso) {
        window.location.href = 'collection schedule.html?date=' + encodeURIComponent(iso);
      }
    });
  });
}

/* ---------------- Recent Activity Feed ---------------- */

function cacheActivities(schedules, recentRecords) {
  var events = [];

  // Completed collection runs
  (schedules || []).filter(function (s) { return s.status === 'Completed'; }).forEach(function (s) {
    events.push({
      kind: 'complete',
      title: escapeHtml(s.barangay) + (s.zone ? ' &middot; ' + escapeHtml(s.zone) : ''),
      sub: 'Collection route completed',
      time: formatShortDateTime(s.collection_date, s.collection_time),
      timeSort: Date.parse(s.collection_date.substring(0, 10) + 'T' + (s.collection_time || '00:00:00'))
    });
  });

  // AI Classification scans
  (recentRecords && recentRecords.records || []).forEach(function (r) {
    events.push({
      kind: 'classify',
      title: escapeHtml(r.fullname || 'Citizen Scanner'),
      sub: 'Classified waste as <strong style="color:' + (DB_CLASS_COLORS[r.waste_type] || 'inherit') + '">' + escapeHtml(r.waste_type) + '</strong>',
      time: formatAgo(r.created_at),
      timeSort: new Date(r.created_at).getTime()
    });
  });

  events.sort(function (a, b) { return (b.timeSort || 0) - (a.timeSort || 0); });
  DB.rawActivities = events;
}

function renderFilteredActivities() {
  var body = $id('db-activity-body');
  if (!body) return;

  var filter = DB.activityFilter;
  var list = DB.rawActivities.filter(function (ev) {
    if (filter === 'all') return true;
    return ev.kind === filter;
  });

  if (!list.length) {
    body.innerHTML =
      '<div class="db-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>' +
        '<p><strong>No recent activity recorded.</strong><br>Completed routes and AI classifications will appear live here.</p>' +
      '</div>';
    return;
  }

  var rows = list.slice(0, 8).map(function (ev) {
    var icon = ev.kind === 'complete'
      ? '<span class="db-activity-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>'
      : '<span class="db-activity-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"></path><polyline points="21 3 21 9 15 9"></polyline></svg></span>';

    return (
      '<div class="db-activity-row">' +
        icon +
        '<div class="db-activity-body">' +
          '<p class="db-activity-title">' + ev.title + '</p>' +
          '<p class="db-activity-sub">' + ev.sub + '</p>' +
        '</div>' +
        '<span class="db-activity-time">' + ev.time + '</span>' +
      '</div>'
    );
  }).join('');

  body.innerHTML = '<div class="db-activity">' + rows + '</div>';
}

function formatShortDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  var base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  var t = formatTime12(timeStr);
  return t ? base + ', ' + t : base;
}

function formatAgo(iso) {
  if (!iso) return '';
  var then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  var mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.round(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ---------------- Notifications Summary ---------------- */

function renderNotifs(notif) {
  var body = $id('db-notif-body');
  if (!body) return;

  var html = '<div class="db-notif-rows">';

  if (notif.delayed_routes > 0) {
    html +=
      '<div class="db-notif-row">' +
        '<span class="db-notif-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>' +
        '<div class="db-notif-body">' +
          '<p class="db-notif-label">Delayed Route Alerts</p>' +
          '<p class="db-notif-sub">Citizens notified of schedule shift</p>' +
        '</div>' +
        '<span class="db-notif-count" style="color:var(--db-amber)">' + notif.delayed_routes + '</span>' +
      '</div>';
  }

  if (notif.cancelled_routes > 0) {
    html +=
      '<div class="db-notif-row">' +
        '<span class="db-notif-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></span>' +
        '<div class="db-notif-body">' +
          '<p class="db-notif-label">Cancellation Broadcasts</p>' +
          '<p class="db-notif-sub">Citizens notified of cancelled pickups</p>' +
        '</div>' +
        '<span class="db-notif-count" style="color:var(--db-red)">' + notif.cancelled_routes + '</span>' +
      '</div>';
  }

  if (notif.manual_announcements > 0) {
    html +=
      '<div class="db-notif-row">' +
        '<span class="db-notif-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span>' +
        '<div class="db-notif-body">' +
          '<p class="db-notif-label">City Announcements</p>' +
          '<p class="db-notif-sub">Dispatched by administration</p>' +
        '</div>' +
        '<span class="db-notif-count" style="color:var(--db-purple)">' + notif.manual_announcements + '</span>' +
      '</div>';
  }

  var todayTotal = notif.today || 0;
  html +=
    '<div class="db-notif-row">' +
      '<span class="db-notif-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7z"></path></svg></span>' +
      '<div class="db-notif-body">' +
        '<p class="db-notif-label">Total Dispatches Today</p>' +
        '<p class="db-notif-sub">Total push messages delivered</p>' +
      '</div>' +
      '<span class="db-notif-count" style="color:var(--db-green)">' + todayTotal + '</span>' +
    '</div>';

  html += '</div>';

  if (notif.delayed_routes === 0 && notif.cancelled_routes === 0 && notif.manual_announcements === 0 && todayTotal === 0) {
    html =
      '<div class="db-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
        '<p><strong>All clear.</strong><br>No urgent dispatch alerts or cancellations recorded today.</p>' +
      '</div>';
  }

  body.innerHTML = html;
}

/* ---------------- Error & Fallback Helpers ---------------- */

function showRailError(msg) {
  var body = $id('db-rail-body');
  if (!body) return;
  body.innerHTML =
    '<div class="db-error">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
      '<p>' + escapeHtml(msg) + ' Please check network status and retry.</p>' +
      '<button class="db-retry" type="button" onclick="loadDashboard()">Retry Sync</button>' +
    '</div>';
}

function showSectionError(id, msg) {
  var el = $id(id);
  if (!el) return;
  el.innerHTML =
    '<div class="db-error">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
      '<p>' + escapeHtml(msg) + '</p>' +
    '</div>';
}

function showChartError(id, msg) {
  var el = $id(id);
  if (!el) return;
  el.innerHTML =
    '<div class="db-chart-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
      '<p><strong>Could not load data for this period.</strong><br>' + escapeHtml(msg) + '</p>' +
    '</div>';
}


var DB_WEATHER_CODES = {
  0: ['Clear Sky', '☀️'], 1: ['Mainly Clear', '🌤️'], 2: ['Partly Cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Foggy', '🌫️'], 48: ['Rime Fog', '🌫️'],
  51: ['Light Drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy Drizzle', '🌧️'],
  61: ['Light Rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy Rain', '🌧️'],
  71: ['Light Snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy Snow', '❄️'],
  80: ['Light Rain Showers', '🌦️'], 81: ['Rain Showers', '🌧️'], 82: ['Violent Showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm Hail', '⛈️'], 99: ['Thunderstorm Hail', '⛈️']
};

function getWeatherSvg(code) {
  if (code === 0 || code === 1) {
    return '<svg viewBox="0 0 64 64" width="46" height="46" class="db-weather-art">' +
      '<defs>' +
        '<linearGradient id="dbSunGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fde047"/><stop offset="50%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>' +
        '<linearGradient id="dbCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e0f2fe"/></linearGradient>' +
        '<filter id="dbSunGlow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#f59e0b" flood-opacity="0.35"/></filter>' +
        '<filter id="dbCloudShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0284c7" flood-opacity="0.18"/></filter>' +
      '</defs>' +
      '<g filter="url(#dbSunGlow)"><circle cx="28" cy="28" r="14" fill="url(#dbSunGrad)"/>' +
      '<g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">' +
        '<line x1="28" y1="7" x2="28" y2="3"/><line x1="28" y1="53" x2="28" y2="49"/>' +
        '<line x1="7" y1="28" x2="3" y2="28"/><line x1="53" y1="28" x2="49" y2="28"/>' +
        '<line x1="13.15" y1="13.15" x2="10.32" y2="10.32"/><line x1="45.68" y1="45.68" x2="42.85" y2="42.85"/>' +
        '<line x1="13.15" y1="42.85" x2="10.32" y2="45.68"/><line x1="45.68" y1="10.32" x2="42.85" y2="13.15"/>' +
      '</g></g>' +
      '<path d="M34 47h18a7 7 0 0 0 0-14 6.5 6.5 0 0 0-4.8 2.1 9.5 9.5 0 0 0-17.7 5.9 6.5 6.5 0 0 0 4.5 6z" fill="url(#dbCloudGrad)" filter="url(#dbCloudShadow)"/>' +
    '</svg>';
  } else if ((code >= 51 && code <= 82) || code >= 95) {
    return '<svg viewBox="0 0 64 64" width="46" height="46" class="db-weather-art">' +
      '<defs>' +
        '<linearGradient id="dbRainCloud" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/></linearGradient>' +
        '<filter id="dbRainShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.2"/></filter>' +
      '</defs>' +
      '<path d="M22 36h24a8 8 0 0 0 0-16 7.5 7.5 0 0 0-5.8 2.8 11 11 0 0 0-20.4 6.9 7.5 7.5 0 0 0 2.2 6.3z" fill="url(#dbRainCloud)" filter="url(#dbRainShadow)"/>' +
      '<g stroke="#0284c7" stroke-width="2.5" stroke-linecap="round">' +
        '<line x1="24" y1="41" x2="21" y2="49"/><line x1="32" y1="41" x2="29" y2="49"/><line x1="40" y1="41" x2="37" y2="49"/>' +
      '</g>' +
    '</svg>';
  } else {
    return '<svg viewBox="0 0 64 64" width="46" height="46" class="db-weather-art">' +
      '<defs>' +
        '<linearGradient id="dbCloudOnly" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#bae6fd"/></linearGradient>' +
        '<filter id="dbCloudOnlyShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0284c7" flood-opacity="0.2"/></filter>' +
      '</defs>' +
      '<path d="M20 40h26a8 8 0 0 0 0-16 7.5 7.5 0 0 0-5.8 2.8 11 11 0 0 0-20.4 6.9 7.5 7.5 0 0 0 0.2 6.3z" fill="url(#dbCloudOnly)" filter="url(#dbCloudOnlyShadow)"/>' +
    '</svg>';
  }
}

function loadWeather() {
  var url = 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=14.4239&longitude=121.0414' +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
    '&timezone=Asia%2FManila&forecast_days=1';

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var code = data.current.weather_code;
      var info = DB_WEATHER_CODES[code] || ['Unknown', '🌡️'];
      var iconEl = $id('db-weather-icon');
      if (iconEl) iconEl.innerHTML = getWeatherSvg(code);
      $id('db-weather-condition').textContent = info[0];
      $id('db-weather-temp').textContent = Math.round(data.current.temperature_2m) + '°';
      $id('db-weather-humidity').textContent = data.current.relative_humidity_2m + '%';
      $id('db-weather-wind').textContent = Math.round(data.current.wind_speed_10m) + ' km/h';
      $id('db-weather-max').textContent = 'H ' + Math.round(data.daily.temperature_2m_max[0]) + '° / L ' + Math.round(data.daily.temperature_2m_min[0]) + '°';
      var upd = data.current.time ? new Date(data.current.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
      $id('db-weather-updated').textContent = 'As of ' + upd;

      var iconBox = $id('db-weather-icon-box');
      var weatherCard = document.querySelector('.db-weather');
      if (weatherCard) {
        weatherCard.classList.remove('is-sunny', 'is-cloudy', 'is-rainy', 'is-stormy');
      }

      if (code === 0 || code === 1) {
        if (iconBox) { iconBox.className = 'db-weather-icon-box is-sunny'; }
        if (weatherCard) { weatherCard.classList.add('is-sunny'); }
      } else if (code >= 2 && code <= 3) {
        if (iconBox) { iconBox.className = 'db-weather-icon-box is-cloudy'; }
        if (weatherCard) { weatherCard.classList.add('is-cloudy'); }
      } else if ((code >= 51 && code <= 82)) {
        if (iconBox) { iconBox.className = 'db-weather-icon-box is-rainy'; }
        if (weatherCard) { weatherCard.classList.add('is-rainy'); }
      } else if (code >= 95) {
        if (iconBox) { iconBox.className = 'db-weather-icon-box is-rainy'; }
        if (weatherCard) { weatherCard.classList.add('is-stormy'); }
      } else {
        if (iconBox) { iconBox.className = 'db-weather-icon-box is-sunny'; }
        if (weatherCard) { weatherCard.classList.add('is-sunny'); }
      }
    })
    .catch(function () {
      $id('db-weather-updated').textContent = 'Forecast offline';
      $id('db-weather-condition').textContent = '—';
      var iconEl = $id('db-weather-icon');
      if (iconEl) iconEl.innerHTML = getWeatherSvg(0);
    });
}