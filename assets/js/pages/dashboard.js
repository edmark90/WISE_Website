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
  lineChartMode: 'category', // 'category' | 'total'
  lineSmooth: true,          // Soften jagged dense swings while preserving exact hover counts
  activeClassFilters: {},    // { 'Biodegradable': true, ... }
  activityFilter: 'all',     // 'all' | 'complete' | 'classify'
  rawActivities: []
};

/* Modern, vibrant category colors */
var DB_CLASS_COLORS = {
  Biodegradable: '#10b981', // Emerald
  Recyclable: '#2563eb',    // Royal Blue
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
    lineSub.textContent = 'Daily classification trends \u00b7 ' + label;
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
      Promise.all([loadDashboard(), loadMonthly()])
        .then(function () {
          if (typeof showToast === 'function') showToast('Dashboard refreshed.', 'success');
        })
        .finally(function () {
          setTimeout(function () { refreshBtn.classList.remove('is-syncing'); }, 600);
        });
    });
  }

  // Line chart view mode switchers (By Category vs Total)
  var viewModeContainer = $id('db-line-view-mode');
  if (viewModeContainer) {
    viewModeContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.db-view-btn');
      if (!btn) return;
      viewModeContainer.querySelectorAll('.db-view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      DB.lineChartMode = btn.dataset.mode === 'total' ? 'total' : 'category';
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  }

  // Smooth curve toggle (softens jagged dense swings while keeping exact tooltip values)
  var smoothBtn = $id('db-line-smooth');
  if (smoothBtn) {
    smoothBtn.addEventListener('click', function () {
      DB.lineSmooth = !DB.lineSmooth;
      smoothBtn.classList.toggle('active', DB.lineSmooth);
      smoothBtn.setAttribute('aria-pressed', DB.lineSmooth ? 'true' : 'false');
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
      '<h4>Select Month</h4>' +
      '<input type="month" id="db-month-input" value="' + current + '" min="2024-01" max="' + max + '">' +
      '<div class="db-month-dialog-actions">' +
        '<button type="button" class="db-month-dialog-btn" id="db-month-cancel">Cancel</button>' +
        '<button type="button" class="db-month-dialog-btn primary" id="db-month-apply">Apply</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  DB.monthInput = $id('db-month-input');

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    DB.monthInput = null;
  }

  $id('db-month-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
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
  $id('stat-users-foot').innerHTML = 'All registered accounts';

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
function buildMonotoneCubicSplineParts(pts, values, clampBaseY, clampTopY, tension) {
  var n = pts.length;
  var damp = (typeof tension === 'number' && tension > 0 && tension <= 1) ? tension : 0.9;
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

  // 3. Fritsch-Carlson strict monotonicity clamping + tension damping
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
  for (var mi = 0; mi < n; mi++) {
    m[mi] *= damp;
  }

  // 4. Generate smooth continuous full path + separate active and baseline paths
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

function formatCompactAxisNum(n) {
  var num = Number(n) || 0;
  if (num >= 10000) return Math.round(num / 1000) + 'k';
  if (num >= 1000) {
    var k = num / 1000;
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return num.toLocaleString();
}

/**
 * Zero-preserving gentle curve smoothing for dense multi-point swings.
 * Keeps zeros and isolated single-bin spikes exact while calming chaotic sawtooth runs;
 * raw counts are always preserved separately for tooltips and totals.
 */
function smoothSeriesForDisplay(vals, enabled) {
  if (!enabled || !vals || vals.length < 3) return vals.slice();
  var out = vals.slice();
  var n = vals.length;
  for (var i = 0; i < n; i++) {
    var curr = vals[i] || 0;
    if (curr <= 0) continue;
    var prev = i > 0 ? (vals[i - 1] || 0) : 0;
    var next = i < n - 1 ? (vals[i + 1] || 0) : 0;
    // Preserve isolated single-day spikes and 2-point bursts at exact height
    if (prev <= 0 && next <= 0) continue;
    if (prev > 0 && next > 0) {
      out[i] = 0.20 * prev + 0.60 * curr + 0.20 * next;
    } else if (prev > 0) {
      out[i] = 0.22 * prev + 0.78 * curr;
    } else if (next > 0) {
      out[i] = 0.78 * curr + 0.22 * next;
    }
  }
  return out;
}

/* ---------------- Line Chart Engine (Clean White Translucent Waves + Dotted Grid + Peak Nodes) ---------------- */

function renderLineChart(data) {
  var el = $id('db-line');
  if (!el) return;

  var byClass = data.records_by_class_by_day || {};
  var fallbackTotalsByDay = data.records_by_day || {};
  var year = DB.year, month = DB.month;
  var daysInMonth = new Date(year, month, 0).getDate();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthAbbr = monthNames[month - 1];

  // Active categories present this month (ordered cleanly)
  var classes = DB_CLASS_ORDER.filter(function (k) {
    return Object.keys(byClass[k] || {}).length > 0;
  });
  Object.keys(byClass).forEach(function (k) {
    if (DB_CLASS_ORDER.indexOf(k) === -1 && Object.keys(byClass[k] || {}).length > 0) {
      classes.push(k);
    }
  });

  // Build full daily series list
  var allSeries = classes.map(function (k, idx) {
    var vals = [];
    var sum = 0;
    for (var d = 1; d <= daysInMonth; d++) {
      var v = (byClass[k] && byClass[k][d] !== undefined) ? Number(byClass[k][d]) : 0;
      vals.push(v);
      sum += v;
    }
    return { name: k, color: getLineCategoryColor(k, idx), values: vals, total: sum };
  });

  // Defensive fallback if class-by-day map is absent while aggregate daily totals exist
  if (allSeries.length === 0 && Object.keys(fallbackTotalsByDay).length > 0) {
    var fbVals = [];
    var fbSum = 0;
    for (var fbd = 1; fbd <= daysInMonth; fbd++) {
      var fbv = fallbackTotalsByDay[fbd] !== undefined ? Number(fallbackTotalsByDay[fbd]) : 0;
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
  var mode = DB.lineChartMode === 'total' ? 'total' : 'category';
  var activeClasses = classes.filter(function (k) {
    return DB.activeClassFilters[k] !== false;
  });
  if (classes.length > 0 && activeClasses.length === 0) {
    DB.activeClassFilters = {};
    activeClasses = classes.slice();
  }
  var isFiltered = mode === 'category' && activeClasses.length < classes.length;
  var visibleBaseSeries = mode === 'total'
    ? allSeries
    : allSeries.filter(function (s) { return DB.activeClassFilters[s.name] !== false; });

  // Visible daily totals & peak day calculation
  var visibleTotals = [];
  var visibleTotalRecords = 0;
  var peakDayIdx = 0;
  var peakVal = 0;

  for (var bIdx = 0; bIdx < daysInMonth; bIdx++) {
    var daySum = 0;
    visibleBaseSeries.forEach(function (s) {
      daySum += (s.values[bIdx] || 0);
    });
    visibleTotals.push(daySum);
    visibleTotalRecords += daySum;
    if (daySum > peakVal) {
      peakVal = daySum;
      peakDayIdx = bIdx;
    }
  }

  var badgeEl = $id('db-line-badge');
  if (badgeEl) {
    var shownCount = mode === 'total' ? totalRecordsAll : visibleTotalRecords;
    badgeEl.textContent = shownCount.toLocaleString() + ' records' +
      (peakVal > 0 ? ' \u00b7 Peak: ' + monthAbbr + ' ' + (peakDayIdx + 1) : '');
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

  // Exact responsive container geometry
  var rect = el.getBoundingClientRect();
  var W = Math.max(280, Math.floor(rect.width || 680));
  var H = Math.max(240, Math.floor(rect.height || (W < 480 ? 255 : 320)));
  var padL = W < 360 ? 34 : 44;
  var padR = W < 360 ? 18 : 24;
  var padT = 34;
  var padB = 34;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;
  var step = plotW / (daysInMonth - 1 || 1);

  var useSmooth = !!DB.lineSmooth;
  var splineTension = 0.90;

  // Prepare display-smoothed arrays while keeping exact raw daily counts for tooltips & totals
  var displayTotals = smoothSeriesForDisplay(visibleTotals, useSmooth);
  var displaySeriesList = visibleBaseSeries.map(function (s) {
    return smoothSeriesForDisplay(s.values, useSmooth);
  });

  // Compute crisp Y-axis ceiling (giving airy headroom matching the reference aesthetic)
  var maxVal = 0;
  if (mode === 'total') {
    for (var mv = 0; mv < daysInMonth; mv++) {
      if (visibleTotals[mv] > maxVal) maxVal = visibleTotals[mv];
      if (displayTotals[mv] > maxVal) maxVal = displayTotals[mv];
    }
  } else {
    visibleBaseSeries.forEach(function (s, idx) {
      s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
      displaySeriesList[idx].forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
  }
  var yAxis = computeNiceYAxis(maxVal);
  var maxY = yAxis.maxY;
  var yTicks = yAxis.ticks;
  var yFor = function (v) { return padT + plotH - (v / maxY) * plotH; };
  var baseY = padT + plotH;
  var pxPerUnit = plotH / (maxY || 1);

  // Build clean, silky-smooth series paths & peak metadata
  var renderedSeries = [];
  if (mode === 'total') {
    var totalPts = [];
    var totalPeakIdx = 0;
    var totalPeakVal = 0;
    for (var ti = 0; ti < daysInMonth; ti++) {
      totalPts.push([padL + ti * step, yFor(displayTotals[ti])]);
      if (visibleTotals[ti] > totalPeakVal) {
        totalPeakVal = visibleTotals[ti];
        totalPeakIdx = ti;
      }
    }
    var totalParts = buildMonotoneCubicSplineParts(totalPts, visibleTotals, baseY, padT + 2, splineTension);
    var totalAreaD = totalParts.fullPath +
      ' L ' + totalPts[totalPts.length - 1][0].toFixed(1) + ' ' + baseY.toFixed(1) +
      ' L ' + totalPts[0][0].toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
    renderedSeries.push({
      name: 'Total Volume',
      color: '#2563eb',
      values: visibleTotals,
      total: visibleTotalRecords,
      peakVal: totalPeakVal,
      peakIdx: totalPeakIdx,
      pts: totalPts,
      path: totalParts.fullPath,
      activePath: totalParts.activePath,
      areaPath: totalAreaD
    });
  } else {
    // Keep X strictly aligned to day columns so splines never warp horizontally
    var ptsMatrix = visibleBaseSeries.map(function (s, idx) {
      var dispVals = displaySeriesList[idx];
      var arr = [];
      for (var i = 0; i < daysInMonth; i++) {
        arr.push([padL + i * step, yFor(dispVals[i])]);
      }
      return arr;
    });

    // Subtle vertical-only micro-lane separation when >=2 series collide at the same positive height
    if (visibleBaseSeries.length > 1) {
      for (var bi = 0; bi < daysInMonth; bi++) {
        var groupsByVal = {};
        for (var sIdx = 0; sIdx < visibleBaseSeries.length; sIdx++) {
          if (visibleBaseSeries[sIdx].values[bi] > 0) {
            var dispKey = Math.round(displaySeriesList[sIdx][bi] * 10) / 10;
            if (!groupsByVal[dispKey]) groupsByVal[dispKey] = [];
            groupsByVal[dispKey].push(sIdx);
          }
        }
        Object.keys(groupsByVal).forEach(function (valKey) {
          var grp = groupsByVal[valKey];
          if (grp.length < 2) return;
          var k = grp.length;
          var baseBinX = padL + bi * step;
          var rawY = yFor(Number(valKey));
          var maxHalfY = Math.min(5.5, Math.max(0.9, pxPerUnit * 0.22));
          var dyStep = Math.min(2.8, (maxHalfY * 2) / (k - 1));
          grp.forEach(function (sIndex, pos) {
            var centerOff = pos - (k - 1) / 2;
            var finalY = Math.max(padT + 4, Math.min(baseY - 4, rawY + centerOff * dyStep));
            ptsMatrix[sIndex][bi] = [baseBinX, finalY];
          });
        });
      }
    }

    renderedSeries = visibleBaseSeries.map(function (s, idx) {
      var pts = ptsMatrix[idx];
      var sPeakIdx = -1;
      var sPeakVal = 0;
      for (var pi = 0; pi < daysInMonth; pi++) {
        if (s.values[pi] > sPeakVal) {
          sPeakVal = s.values[pi];
          sPeakIdx = pi;
        }
      }
      var parts = buildMonotoneCubicSplineParts(pts, s.values, baseY, padT + 2, splineTension);
      var areaD = parts.fullPath +
        ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + baseY.toFixed(1) +
        ' L ' + pts[0][0].toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
      return {
        name: s.name,
        color: s.color,
        values: s.values,
        total: s.total,
        peakVal: sPeakVal,
        peakIdx: sPeakIdx,
        pts: pts,
        path: parts.fullPath,
        activePath: parts.activePath,
        areaPath: areaD
      };
    });

    // Paint tallest waves in the back and shorter waves in front so smaller waves stay vivid & readable
    renderedSeries.sort(function (a, b) {
      if (b.peakVal !== a.peakVal) return b.peakVal - a.peakVal;
      return b.total - a.total;
    });
  }

  // Evenly spaced X-axis day ticks & vertical dotted guides
  var xDayNums = [1];
  var dayStep = daysInMonth > 28 ? 5 : 4;
  for (var ld = 1 + dayStep; ld < daysInMonth; ld += dayStep) xDayNums.push(ld);
  if (xDayNums[xDayNums.length - 1] !== daysInMonth) xDayNums.push(daysInMonth);
  var xLabelBins = xDayNums.map(function (d) { return d - 1; });

  // Current PH TODAY marker (purple-indigo pill + vertical dashed line matching reference image)
  var todayIso = phToday();
  var todayParts = todayIso.split('-');
  var isCurrentMonth = Number(todayParts[0]) === year && Number(todayParts[1]) === month;
  var todayDayNum = Number(todayParts[2]);
  var currentMarkerBin = (isCurrentMonth && todayDayNum >= 1 && todayDayNum <= daysInMonth)
    ? (todayDayNum - 1)
    : -1;

  var todayMarkerSvg = '';
  if (currentMarkerBin >= 0 && currentMarkerBin < daysInMonth) {
    var tx = padL + currentMarkerBin * step;
    var pillWNow = 50;
    var pillXNow = Math.max(padL + 2, Math.min(W - padR - pillWNow, tx - pillWNow / 2));
    todayMarkerSvg =
      '<g class="db-today-marker">' +
        '<line class="db-line-today-line" x1="' + tx.toFixed(1) + '" y1="22" x2="' + tx.toFixed(1) + '" y2="' + baseY + '"/>' +
        '<rect class="db-line-today-pill" x="' + pillXNow.toFixed(1) + '" y="4" width="' + pillWNow + '" height="18" rx="9" fill="url(#db-today-pill-grad)"/>' +
        '<text class="db-line-today-txt" x="' + (pillXNow + pillWNow / 2).toFixed(1) + '" y="16" text-anchor="middle">TODAY</text>' +
      '</g>';
  }

  // SVG Gradients: Soft luminous watercolor/glass translucent fills + purple TODAY pill
  var defs = '<defs>' +
    '<linearGradient id="db-today-pill-grad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#6366f1"/>' +
      '<stop offset="100%" stop-color="#7c3aed"/>' +
    '</linearGradient>' +
    '<linearGradient id="db-band-grad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#6366f1" stop-opacity="0.07"/>' +
      '<stop offset="100%" stop-color="#6366f1" stop-opacity="0.01"/>' +
    '</linearGradient>' +
    renderedSeries.map(function (s, idx) {
      var gradId = 'db-line-grad-' + idx;
      var topOp = mode === 'total' ? '0.26' : '0.24';
      var midOp = mode === 'total' ? '0.10' : '0.11';
      return '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="' + topOp + '"/>' +
        '<stop offset="58%" stop-color="' + s.color + '" stop-opacity="' + midOp + '"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0.02"/>' +
      '</linearGradient>';
    }).join('') +
  '</defs>';

  // Delicate dotted horizontal & vertical grid + crisp solid Y/X axis spines & ticks
  var hGridSvg = yTicks.map(function (yv) {
    if (yv === 0) return '';
    var y = yFor(yv);
    return '<line class="db-line-hgrid" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (padL + plotW) + '" y2="' + y.toFixed(1) + '"/>';
  }).join('');

  var vGridSvg = xLabelBins.map(function (b) {
    if (b === 0) return '';
    var x = padL + b * step;
    return '<line class="db-line-vgrid" x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + baseY + '"/>';
  }).join('');

  var axesSvg =
    '<line class="db-line-yaxis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + baseY + '"/>' +
    '<line class="db-line-xbase" x1="' + padL + '" y1="' + baseY + '" x2="' + (padL + plotW) + '" y2="' + baseY + '"/>' +
    yTicks.map(function (yv) {
      var y = yFor(yv);
      return '<line class="db-line-ytick" x1="' + (padL - 4) + '" y1="' + y.toFixed(1) + '" x2="' + padL + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="db-line-label y" x="' + (padL - 10) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + formatCompactAxisNum(yv) + '</text>';
    }).join('') +
    xLabelBins.map(function (b) {
      var x = padL + b * step;
      var labelTxt = (monthAbbr + ' ' + (b + 1)).toUpperCase();
      return '<line class="db-line-xtick" x1="' + x.toFixed(1) + '" y1="' + baseY + '" x2="' + x.toFixed(1) + '" y2="' + (baseY + 5) + '"/>' +
        '<text class="db-line-label x" x="' + x.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + labelTxt + '</text>';
    }).join('');

  // Translucent Smooth Wave Areas + Crisp Colored Strokes + Single Peak Marker Dot per Series
  var pathsSvg = renderedSeries.map(function (s, idx) {
    var gradId = 'db-line-grad-' + idx;
    var peakDotHtml = '';
    if (s.peakVal > 0 && s.peakIdx >= 0 && s.pts[s.peakIdx]) {
      var pkPt = s.pts[s.peakIdx];
      peakDotHtml =
        '<circle class="db-line-peak-dot" cx="' + pkPt[0].toFixed(1) + '" cy="' + pkPt[1].toFixed(1) + '" r="4.3" ' +
        'fill="' + s.color + '" stroke="#ffffff" stroke-width="2"/>';
    }

    return '<g class="db-line-series show-area" data-series="' + escapeHtml(s.name) + '">' +
      '<path class="db-line-area" d="' + s.areaPath + '" fill="url(#' + gradId + ')"/>' +
      '<path class="db-line-path" d="' + s.path + '" stroke="' + s.color + '"/>' +
      peakDotHtml +
    '</g>';
  }).join('');

  // Interactive Hover Column Band, Crosshair & Focus Rings
  var bandW = Math.max(16, Math.min(34, step * 0.85));
  var overlaySvg =
    '<rect class="db-focus-band" id="db-focus-band" x="0" y="' + padT + '" width="' + bandW.toFixed(1) + '" height="' + plotH + '" rx="4" fill="url(#db-band-grad)"/>' +
    '<line class="db-crosshair" id="db-crosshair" x1="0" y1="' + padT + '" x2="0" y2="' + baseY + '"/>' +
    renderedSeries.map(function (s, idx) {
      return '<circle class="db-focus-halo" id="db-focus-halo-' + idx + '" r="9.5" fill="' + s.color + '"/>' +
        '<circle class="db-focus-dot" id="db-focus-' + idx + '" r="4.8" fill="' + s.color + '"/>';
    }).join('') +
    '<rect class="db-hit" x="' + Math.max(0, padL - 10) + '" y="' + Math.max(0, padT - 10) + '" width="' + (plotW + 20) + '" height="' + (plotH + 20) + '"/>';

  el.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Daily waste classification trend chart">' +
      defs + hGridSvg + vGridSvg + axesSvg + pathsSvg + todayMarkerSvg + overlaySvg +
    '</svg>';

  wireLineChartInteraction(el, renderedSeries, allSeries, {
    W: W,
    H: H,
    padL: padL,
    padT: padT,
    step: step,
    bandW: bandW,
    binCount: daysInMonth,
    mode: mode,
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

  var seriesGroups = Array.prototype.slice.call(svgEl.querySelectorAll('.db-line-series'));
  var focusDots = seriesList.map(function (_, idx) {
    return container.querySelector('#db-focus-' + idx);
  });
  var focusHalos = seriesList.map(function (_, idx) {
    return container.querySelector('#db-focus-halo-' + idx);
  });

  function applyHoverSpotlight(spotlightSet) {
    seriesGroups.forEach(function (g) {
      var name = g.getAttribute('data-series');
      if (!spotlightSet || spotlightSet.size === 0) {
        g.classList.remove('is-dim', 'is-spotlight');
      } else {
        g.classList.toggle('is-spotlight', spotlightSet.has(name));
        g.classList.toggle('is-dim', !spotlightSet.has(name));
      }
    });
  }

  function handleMove(clientX, clientY) {
    var svgRect = svgEl.getBoundingClientRect();
    var contRect = chartShell.getBoundingClientRect();
    if (!svgRect.width) return;

    var xInSvg = ((clientX - svgRect.left) / svgRect.width) * geo.W;
    var yInSvg = ((clientY - svgRect.top) / svgRect.height) * geo.H;
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

    // Detect closest hovered wave directly on canvas for smooth spotlighting
    var spotlightNames = new Set();
    if (geo.mode === 'category' && seriesList.length > 1) {
      var bestDist = 24;
      var candidates = [];
      seriesList.forEach(function (s) {
        var val = s.values[binIndex] || 0;
        if (val <= 0 || !s.pts[binIndex]) return;
        var d = Math.abs(yInSvg - s.pts[binIndex][1]);
        if (d <= bestDist) {
          candidates.push({ name: s.name, dist: d });
        }
      });
      if (candidates.length > 0) {
        candidates.sort(function (a, b) { return a.dist - b.dist; });
        var minD = candidates[0].dist;
        candidates.forEach(function (c) {
          if (c.dist - minD <= 5) spotlightNames.add(c.name);
        });
      }
      applyHoverSpotlight(spotlightNames);
    }

    // Move each focus dot + glowing halo to its coordinate
    seriesList.forEach(function (s, idx) {
      var dot = focusDots[idx];
      var halo = focusHalos[idx];
      if (!dot || !s.pts[binIndex]) return;
      var pt = s.pts[binIndex];
      var val = s.values[binIndex] || 0;
      var isActiveDot = spotlightNames.size === 0 || spotlightNames.has(s.name);
      dot.setAttribute('cx', pt[0].toFixed(1));
      dot.setAttribute('cy', pt[1].toFixed(1));
      dot.setAttribute('r', val > 0 ? (isActiveDot ? '5' : '3') : '0');
      dot.classList.toggle('is-zero', val <= 0 || !isActiveDot);
      dot.classList.toggle('on', val > 0);
      if (halo) {
        halo.setAttribute('cx', pt[0].toFixed(1));
        halo.setAttribute('cy', pt[1].toFixed(1));
        halo.classList.toggle('on', val > 0 && isActiveDot);
      }
    });

    // Tooltip header labels for the hovered day
    var actualDay = binIndex + 1;
    var isCurrentBin = geo.isCurrentMonth && binIndex === geo.currentMarkerBin;
    var headLeft = new Date(geo.year, geo.month - 1, actualDay)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var headRight = 'Day ' + actualDay;

    var totalBinVisible = 0;
    var totalBinAll = 0;
    var rowsHtml = '';

    allSeries.forEach(function (s) {
      totalBinAll += (s.values[binIndex] || 0);
    });

    if (geo.mode === 'total') {
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
        rowsHtml = '<div class="db-tip-empty">No scans recorded on this day</div>';
      } else {
        rowsHtml = ordered.map(function (item) {
          var v = item.val;
          var isTied = v > 0 && (valFreq[v] || 0) > 1;
          var isFocused = spotlightNames.has(item.series.name);
          var pct = totalBinVisible > 0 && v > 0 ? Math.round((v / totalBinVisible) * 100) : 0;
          var barHtml = v > 0
            ? '<div class="db-tip-bar"><span style="width:' + Math.max(4, pct) + '%;background:' + item.series.color + '"></span></div>'
            : '';
          return '<div class="db-tip-item' + (v === 0 ? ' is-zero' : '') + (isFocused ? ' is-active' : '') + '">' +
            '<div class="db-tip-row' + (v === 0 ? ' is-zero' : '') + (isFocused ? ' is-active' : '') + '">' +
              '<span class="db-tip-swatch" style="background:' + item.series.color + '"></span>' +
              '<span class="db-tip-name">' + escapeHtml(item.series.name) + '</span>' +
              (isTied ? '<span class="db-tip-tie" title="Same count across categories">Tie</span>' : '') +
              (v > 0 ? '<span class="db-tip-pct">' + pct + '%</span>' : '') +
              '<span class="db-tip-val">' + v.toLocaleString() + '</span>' +
            '</div>' +
            barHtml +
          '</div>';
        }).join('');
      }
    }

    var totalLabel = (geo.mode === 'category' && totalBinVisible !== totalBinAll)
      ? '<span>Shown Total <small style="opacity:0.7;font-weight:600">(All: ' + totalBinAll + ')</small></span>'
      : '<span>Day Total</span>';

    tooltip.innerHTML =
      '<div class="db-tip-head">' +
        '<span>' + escapeHtml(headLeft) + (isCurrentBin ? ' <span class="db-tip-today">Today</span>' : '') + '</span>' +
        '<span>' + escapeHtml(headRight) + '</span>' +
      '</div>' +
      '<div class="db-tip-rows">' + rowsHtml + '</div>' +
      '<div class="db-tip-total">' +
        totalLabel +
        '<span>' + totalBinVisible.toLocaleString() + '</span>' +
      '</div>';

    // Measure & clamp tooltip cleanly inside chart container
    tooltip.classList.add('on');
    var tipW = tooltip.offsetWidth || 215;
    var tipH = tooltip.offsetHeight || 120;
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
    focusHalos.forEach(function (halo) { if (halo) halo.classList.remove('on'); });
    applyHoverSpotlight(null);
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

  var totalAll = allSeries.reduce(function (acc, s) { return acc + (s.total || 0); }, 0);
  var pillsHtml = classes.map(function (k, idx) {
    var color = getLineCategoryColor(k, idx);
    var isOff = DB.activeClassFilters[k] === false;
    var count = totalByClass[k] || 0;
    var pct = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
    return '<button type="button" class="db-legend-btn' + (isOff ? ' is-off' : '') + '" data-class="' + escapeHtml(k) + '" style="--lg-color:' + color + '" title="Hover to spotlight \u00b7 Click to filter">' +
      '<span class="db-legend-swatch" style="background:' + color + '"></span>' +
      '<span>' + escapeHtml(k) + '</span>' +
      '<span class="db-legend-count">' + count.toLocaleString() + (pct > 0 ? ' \u00b7 ' + pct + '%' : '') + '</span>' +
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
      '<div class="db-donut-legend-row" data-idx="' + idx + '" role="button" tabindex="0" aria-label="' + escapeHtml(item.name + ': ' + item.value + ' records, ' + pct + '%') + '">' +
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
    row.addEventListener('focus', function () { setActive(idx); });
    row.addEventListener('blur', function () { setActive(null); });
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
      '<div class="db-day' + (day.isToday ? ' today' : '') + ' ' + stInfo.status + '" data-iso="' + day.iso + '" role="button" tabindex="0" aria-label="' + escapeHtml(day.label + ' ' + day.dayNum + ', ' + stInfo.label + ', ' + count + (count === 1 ? ' route' : ' routes')) + '" title="' + escapeHtml(day.label + ', ' + day.iso + ' — ' + count + (count === 1 ? ' route' : ' routes') + ' — Click to view schedule') + '">' +
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

  // Wire clickable & keyboard-accessible day tiles → navigate to collection schedule page for that date
  body.querySelectorAll('.db-day[data-iso]').forEach(function (tile) {
    tile.style.cursor = 'pointer';
    function openDay() {
      var iso = tile.dataset.iso;
      if (iso) {
        window.location.href = 'collection schedule.html?date=' + encodeURIComponent(iso);
      }
    }
    tile.addEventListener('click', openDay);
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDay();
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
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d97706" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="db-weather-art">' +
      '<circle cx="12" cy="12" r="4"></circle>' +
      '<line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line>' +
      '<line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line>' +
      '<line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line>' +
      '<line x1="6.34" y1="17.66" x2="4.93" y2="19.07"></line><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"></line>' +
    '</svg>';
  } else if ((code >= 51 && code <= 82) || code >= 95) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1d4ed8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="db-weather-art">' +
      '<path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path>' +
      '<line x1="8" y1="19" x2="8" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line x1="16" y1="19" x2="16" y2="21"></line>' +
    '</svg>';
  } else {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#64748b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="db-weather-art">' +
      '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>' +
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