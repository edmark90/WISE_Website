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
  if (lineSub) lineSub.textContent = 'Daily classification trends \u00b7 ' + label;

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
    renderNotifs(results[0]);
    renderMonthStrip(results[1]);
    cacheActivities(results[1], results[2]);
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
  $id('db-line').innerHTML = '<div class="db-chart-empty"><div class="db-spinner"></div><p>Aggregating daily trends…</p></div>';
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

  animateNumber('stat-records', data.total_waste_records || 0);
  var routesNote = data.total_routes
    ? '<strong>' + data.total_routes + '</strong> routes scheduled'
    : 'No routes scheduled';
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

/* ---------------- High-Precision Monotone Cubic Spline Engine ---------------- */

/**
 * Computes a Fritsch-Carlson Monotone Cubic Spline path.
 * Guarantees smooth natural curves without artificial overshoot dips or loops.
 */
function buildMonotoneCubicSpline(pts, clampBaseY) {
  var n = pts.length;
  if (n === 0) return '';
  if (n === 1) return 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  if (n === 2) {
    return 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1) +
           ' L ' + pts[1][0].toFixed(1) + ' ' + pts[1][1].toFixed(1);
  }

  // 1. Calculate secants (slopes)
  var deltas = [];
  for (var i = 0; i < n - 1; i++) {
    var dx = pts[i + 1][0] - pts[i][0];
    var dy = pts[i + 1][1] - pts[i][1];
    deltas.push(dx === 0 ? 0 : dy / dx);
  }

  // 2. Calculate tangents
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

  // 3. Fritsch-Carlson adjustment for strict monotonicity
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

  // 4. Generate Cubic Bézier commands
  var path = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (var i = 0; i < n - 1; i++) {
    var p0 = pts[i];
    var p1 = pts[i + 1];
    var dx = (p1[0] - p0[0]) / 3;

    var cp1x = p0[0] + dx;
    var cp1y = p0[1] + m[i] * dx;
    var cp2x = p1[0] - dx;
    var cp2y = p1[1] - m[i + 1] * dx;

    if (clampBaseY != null) {
      if (cp1y > clampBaseY) cp1y = clampBaseY;
      if (cp2y > clampBaseY) cp2y = clampBaseY;
    }

    path += ' C ' + cp1x.toFixed(1) + ' ' + cp1y.toFixed(1) +
            ', ' + cp2x.toFixed(1) + ' ' + cp2y.toFixed(1) +
            ', ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
  }

  return path;
}

/* ---------------- Line Chart Engine (Ultra-Clean Interactive Splines) ---------------- */

function renderLineChart(data) {
  var el = $id('db-line');
  if (!el) return;

  var byClass = data.records_by_class_by_day || {};
  var year = DB.year, month = DB.month;
  var daysInMonth = new Date(year, month, 0).getDate();

  // Active categories
  var classes = DB_CLASS_ORDER.filter(function (k) {
    return Object.keys(byClass[k] || {}).length > 0;
  });

  // Series per category
  var series = classes.map(function (k) {
    var vals = [];
    for (var d = 1; d <= daysInMonth; d++) {
      vals.push(byClass[k][d] || 0);
    }
    return { name: k, color: DB_CLASS_COLORS[k], values: vals };
  });

  var totalRecords = 0;
  series.forEach(function (s) {
    totalRecords += s.values.reduce(function (a, b) { return a + b; }, 0);
  });

  // Daily totals & peak day calculation
  var dailyTotals = [];
  var peakDay = 1;
  var peakVal = 0;
  for (var d = 1; d <= daysInMonth; d++) {
    var daySum = 0;
    classes.forEach(function (k) {
      daySum += (byClass[k][d] || 0);
    });
    dailyTotals.push(daySum);
    if (daySum > peakVal) {
      peakVal = daySum;
      peakDay = d;
    }
  }

  var badgeEl = $id('db-line-badge');
  if (badgeEl) {
    badgeEl.textContent = totalRecords.toLocaleString() + ' records' +
      (peakVal > 0 ? ' (Peak: Day ' + peakDay + ')' : '');
    badgeEl.className = 'db-chart-badge' + (totalRecords === 0 ? ' slate' : '');
  }

  if (totalRecords === 0) {
    el.innerHTML =
      '<div class="db-chart-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>' +
        '<p><strong>No classifications for this period.</strong><br>Records will appear as citizens sort waste using the AI scanner.</p>' +
      '</div>';
    var legendEmpty = $id('db-line-legend');
    if (legendEmpty) legendEmpty.innerHTML = '';
    return;
  }

  // Exact responsive width & layout geometry
  var rect = el.getBoundingClientRect();
  var W = Math.max(340, Math.floor(rect.width || 680));
  var H = 280;
  var padL = 44, padR = 20, padT = 22, padB = 36;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;
  var step = plotW / (daysInMonth - 1 || 1);

  // Maximum Y calculation with clean headroom
  var maxVal = 0;
  if (DB.lineChartMode === 'total') {
    dailyTotals.forEach(function (v) { if (v > maxVal) maxVal = v; });
  } else {
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
  }
  var maxY = Math.max(4, Math.ceil(maxVal * 1.18));
  var yFor = function (v) { return padT + plotH - (v / maxY) * plotH; };
  var baseY = padT + plotH;

  // Build series paths with Monotone Spline
  var renderedSeries = [];
  if (DB.lineChartMode === 'total') {
    var pts = [];
    for (var i = 0; i < daysInMonth; i++) {
      pts.push([padL + i * step, yFor(dailyTotals[i])]);
    }
    var splineD = buildMonotoneCubicSpline(pts, baseY);
    var areaD = splineD + ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + baseY +
                ' L ' + pts[0][0].toFixed(1) + ' ' + baseY + ' Z';
    renderedSeries.push({
      name: 'Total Volume',
      color: '#2563eb',
      values: dailyTotals,
      pts: pts,
      path: splineD,
      areaPath: areaD
    });
  } else {
    renderedSeries = series.map(function (s) {
      var pts = [];
      for (var i = 0; i < s.values.length; i++) {
        pts.push([padL + i * step, yFor(s.values[i])]);
      }
      var splineD = buildMonotoneCubicSpline(pts, baseY);
      var areaD = splineD + ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + baseY +
                  ' L ' + pts[0][0].toFixed(1) + ' ' + baseY + ' Z';
      return {
        name: s.name,
        color: s.color,
        values: s.values,
        pts: pts,
        path: splineD,
        areaPath: areaD
      };
    });
  }

  // Y-axis ticks (5 neat ticks for more granularity)
  var yTicks = [];
  var tickCount = 5;
  for (var t = 0; t <= tickCount; t++) {
    yTicks.push(Math.round((maxY / tickCount) * t));
  }

  // X labels — show every 4th or 5th day for readability
  var xLabelDays = [1];
  var dayStep = daysInMonth > 28 ? 5 : 4;
  for (var ld = 1 + dayStep; ld < daysInMonth; ld += dayStep) xLabelDays.push(ld);
  if (xLabelDays[xLabelDays.length - 1] !== daysInMonth) xLabelDays.push(daysInMonth);

  // SVG Linear Gradients
  var defs = '<defs>' +
    renderedSeries.map(function (s, idx) {
      var gradId = 'db-line-grad-' + idx;
      return '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="0.22"/>' +
        '<stop offset="60%" stop-color="' + s.color + '" stop-opacity="0.06"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0.0"/>' +
      '</linearGradient>';
    }).join('') +
  '</defs>';

  // Clean Horizontal Grid Lines & Y Tick Labels
  var gridSvg = yTicks.map(function (yv, idx) {
    var y = yFor(yv);
    var isBase = (idx === 0);
    return '<line class="db-line-grid' + (isBase ? ' base' : '') + '" x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '"/>' +
      '<text class="db-line-label y" x="' + (padL - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + yv + '</text>';
  }).join('');

  // X Date Labels — show short month+day
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthAbbr = monthNames[month - 1];
  var xLabelsSvg = xLabelDays.map(function (d) {
    var x = padL + (d - 1) * step;
    return '<text class="db-line-label x" x="' + x + '" y="' + (H - 6) + '" text-anchor="middle">' + monthAbbr + ' ' + d + '</text>';
  }).join('');

  // Smooth Area Fills & Spline Paths
  var pathsSvg = renderedSeries.map(function (s, idx) {
    var gradId = 'db-line-grad-' + idx;
    var isDim = DB.activeClassFilters[s.name] === false;
    return '<g class="db-line-series' + (isDim ? ' is-dim' : '') + '" data-series="' + escapeHtml(s.name) + '">' +
      '<path class="db-line-area" d="' + s.areaPath + '" fill="url(#' + gradId + ')"/>' +
      '<path class="db-line-path" d="' + s.path + '" stroke="' + s.color + '"/>' +
      s.pts.map(function (pt, dIdx) {
        var v = s.values[dIdx];
        if (v === 0) return '';
        return '<circle class="db-line-dot" cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="2.8" fill="' + s.color + '" stroke="#fff" stroke-width="1.5"/>';
      }).join('') +
    '</g>';
  }).join('');

  // Interactive Crosshair & Focus Elements
  var overlaySvg =
    '<line class="db-crosshair" id="db-crosshair" x1="0" y1="' + padT + '" x2="0" y2="' + baseY + '"/>' +
    renderedSeries.map(function (s, idx) {
      return '<circle class="db-focus-dot" id="db-focus-' + idx + '" r="5.5" fill="' + s.color + '"/>';
    }).join('') +
    '<rect class="db-hit" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '"/>';

  // Subtle vertical day markers at each labeled day
  var xMarkersSvg = xLabelDays.map(function (d) {
    var x = padL + (d - 1) * step;
    return '<line class="db-line-xmark" x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + baseY + '"/>';
  }).join('');

  el.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Classification trend chart">' +
      defs + gridSvg + xMarkersSvg + xLabelsSvg + pathsSvg + overlaySvg +
    '</svg>';

  // Wire interactive crosshair & tooltip
  wireLineChartInteraction(el, renderedSeries, padL, plotW, step, daysInMonth, year, month);

  // Render clickable legend pills
  renderLineLegend(classes, renderedSeries);
}

function wireLineChartInteraction(container, seriesList, padL, plotW, step, daysInMonth, year, month) {
  var hitRect = container.querySelector('.db-hit');
  var crosshair = container.querySelector('#db-crosshair');
  var tooltip = $id('db-chart-tip');
  if (!hitRect || !crosshair || !tooltip) return;

  var focusDots = seriesList.map(function (_, idx) {
    return container.querySelector('#db-focus-' + idx);
  });

  function handleMove(clientX, clientY) {
    var rect = container.getBoundingClientRect();
    var svgW = rect.width;
    var scale = svgW / (plotW + padL + 24);
    var mouseX = (clientX - rect.left);
    var relX = mouseX - padL * scale;

    var dayIndex = Math.round(relX / (step * scale));
    if (dayIndex < 0) dayIndex = 0;
    if (dayIndex >= daysInMonth) dayIndex = daysInMonth - 1;

    var actualDay = dayIndex + 1;
    var ptX = padL + dayIndex * step;

    // Move crosshair
    crosshair.setAttribute('x1', ptX);
    crosshair.setAttribute('x2', ptX);
    crosshair.classList.add('on');

    // Move focus dots
    seriesList.forEach(function (s, idx) {
      var dot = focusDots[idx];
      if (dot && s.pts[dayIndex]) {
        var ptY = s.pts[dayIndex][1];
        dot.setAttribute('cx', ptX);
        dot.setAttribute('cy', ptY);
        dot.classList.add('on');
      }
    });

    // Populate Tooltip
    var dateLabel = new Date(year, month - 1, actualDay)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    var totalDay = 0;
    var rowsHtml = '';

    if (DB.lineChartMode === 'total') {
      var val = seriesList[0].values[dayIndex] || 0;
      totalDay = val;
      rowsHtml = '<div class="db-tip-row">' +
        '<span class="db-tip-swatch" style="background:#2563eb"></span>' +
        '<span class="db-tip-name">Total Volume</span>' +
        '<span class="db-tip-val">' + val.toLocaleString() + '</span>' +
      '</div>';
    } else {
      seriesList.forEach(function (s) {
        var v = s.values[dayIndex] || 0;
        totalDay += v;
        rowsHtml += '<div class="db-tip-row">' +
          '<span class="db-tip-swatch" style="background:' + s.color + '"></span>' +
          '<span class="db-tip-name">' + escapeHtml(s.name) + '</span>' +
          '<span class="db-tip-val">' + v.toLocaleString() + '</span>' +
        '</div>';
      });
    }

    var tipHtml =
      '<div class="db-tip-head">' +
        '<span>📅 ' + dateLabel + '</span>' +
        '<span>Day ' + actualDay + '</span>' +
      '</div>' +
      '<div class="db-tip-rows">' + rowsHtml + '</div>' +
      '<div class="db-tip-total">' +
        '<span>Day Total</span>' +
        '<span>' + totalDay.toLocaleString() + '</span>' +
      '</div>';

    tooltip.innerHTML = tipHtml;

    // Position tooltip smoothly above the mouse position
    var tipX = mouseX;
    var tipY = (clientY - rect.top);
    tooltip.style.left = tipX + 'px';
    tooltip.style.top = tipY + 'px';
    tooltip.classList.add('on');
  }

  function handleLeave() {
    crosshair.classList.remove('on');
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

function renderLineLegend(classes, renderedSeries) {
  var legend = $id('db-line-legend');
  if (!legend) return;

  if (DB.lineChartMode === 'total') {
    legend.innerHTML =
      '<span class="db-legend-btn active">' +
        '<span class="db-legend-swatch" style="background:#2563eb"></span>' +
        'Total Classification Volume' +
      '</span>';
    return;
  }

  legend.innerHTML = classes.map(function (k) {
    var color = DB_CLASS_COLORS[k];
    var isOff = DB.activeClassFilters[k] === false;
    return '<button type="button" class="db-legend-btn' + (isOff ? ' is-off' : '') + '" data-class="' + escapeHtml(k) + '" title="Click to filter">' +
      '<span class="db-legend-swatch" style="background:' + color + '"></span>' +
      escapeHtml(k) +
    '</button>';
  }).join('');

  legend.querySelectorAll('.db-legend-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cls = btn.dataset.class;
      var allActive = Object.keys(DB.activeClassFilters).length === 0;
      if (allActive) {
        // Isolate this category
        classes.forEach(function (c) { DB.activeClassFilters[c] = (c === cls); });
      } else if (DB.activeClassFilters[cls] && Object.values(DB.activeClassFilters).filter(Boolean).length === 1) {
        // Reset to all
        DB.activeClassFilters = {};
      } else {
        DB.activeClassFilters[cls] = !DB.activeClassFilters[cls];
      }
      if (DB.monthlyData) renderLineChart(DB.monthlyData);
    });
  });
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
  list.forEach(function (s) { (byDate[s.collection_date] = byDate[s.collection_date] || []).push(s); });
  days.forEach(function (day) { day.routes = byDate[day.iso] || []; });

  if (!list.length) {
    body.innerHTML =
      '<div class="db-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
        '<p><strong>No collection routes scheduled in the last 7 days.</strong><br>Create scheduled pickups in the Collection Schedule management module.</p>' +
      '</div>';
    return;
  }

  var statusFor = function (day) {
    var rs = day.routes;
    if (!rs.length) return { status: 'none', label: 'No Run' };
    if (rs.some(function (r) { return r.status === 'Cancelled'; })) return { status: 'cancelled', label: 'Cancelled' };
    if (rs.some(function (r) { return r.status === 'Delayed'; })) return { status: 'delayed', label: 'Delayed' };
    if (rs.some(function (r) { return r.status === 'Arriving' || r.status === 'Arrived'; })) return { status: 'arriving', label: 'Live' };
    if (rs.every(function (r) { return r.status === 'Completed'; })) return { status: 'completed', label: 'Done' };
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
      '<div class="db-day' + (day.isToday ? ' today' : '') + ' ' + stInfo.status + '" data-iso="' + day.iso + '" title="' + escapeHtml(day.label + ', ' + day.iso + ' — ' + count + ' routes — Click to view schedule') + '">' +
        (day.isToday ? '<span class="db-day-today-tag">TODAY</span>' : '') +
        '<div class="db-day-top">' +
          '<span class="db-day-label">' + escapeHtml(day.label) + '</span>' +
          '<span class="db-day-date">' + escapeHtml(day.dayNum) + '</span>' +
        '</div>' +
        '<div class="db-day-status-chip ' + stInfo.status + '">' +
          '<span class="db-day-status-dot"></span>' +
          '<span class="db-day-status-txt">' + stInfo.label + '</span>' +
        '</div>' +
        '<div class="db-day-metric">' +
          '<span class="db-day-count-badge">' +
            (count ? '<strong>' + count + '</strong> ' + (count === 1 ? 'Route' : 'Routes') : 'No Run') +
          '</span>' +
          (count > 0
            ? '<div class="db-day-mini-bar"><div class="db-day-mini-fill ' + stInfo.status + '" style="width:' + (segPct || 25) + '%"></div></div>'
            : '<div class="db-day-mini-bar empty"></div>') +
        '</div>' +
        '<span class="db-day-go-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
        '</span>' +
      '</div>'
    );
  }).join('');

  var metaChips =
    '<div class="db-rail-summary-chips">' +
      '<span class="db-rail-chip total"><strong>' + totalRoutes + '</strong> Total Routes</span>' +
      '<span class="db-rail-chip good"><strong>' + doneRoutes + '</strong> Completed</span>' +
      (delayedRoutes ? '<span class="db-rail-chip warn"><strong>' + delayedRoutes + '</strong> Delayed</span>' : '') +
      (cancelledRoutes ? '<span class="db-rail-chip danger"><strong>' + cancelledRoutes + '</strong> Cancelled</span>' : '') +
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