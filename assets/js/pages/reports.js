/**
 * WISE System - Reports Page Logic
 * Period picker (monthly/yearly), live summary chips, report-type
 * selection, and one-file downloads (Excel .xlsx / PDF).
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;
  initReports();
});

var RP = {
  mode: 'month',          // 'month' | 'year'
  year: null,
  month: null,            // 1-12 when mode is month
  selectedTypes: ['waste', 'schedule', 'users'],
  downloading: false
};

function rpPhNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function initReports() {
  var now = rpPhNow();
  RP.year = now.getUTCFullYear();
  RP.month = now.getUTCMonth() + 1;

  var monthInput = $id('rp-month');
  var yearInput = $id('rp-year');
  if (monthInput) monthInput.value = RP.year + '-' + pad(RP.month);
  if (yearInput) yearInput.value = RP.year;

  wireReportsControls();
  loadSummary();
}

function wireReportsControls() {
  // Period mode segmented toggle
  $all('#rp-period-mode .rp-seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $all('#rp-period-mode .rp-seg-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      RP.mode = btn.dataset.mode;
      $id('rp-month-wrap').style.display = RP.mode === 'month' ? 'flex' : 'none';
      $id('rp-year-wrap').style.display = RP.mode === 'month' ? 'none' : 'flex';
      loadSummary();
    });
  });

  var monthInput = $id('rp-month');
  var yearInput = $id('rp-year');

  monthInput.addEventListener('change', function () {
    var val = monthInput.value;
    if (!val) return;
    RP.year = parseInt(val.slice(0, 4), 10);
    RP.month = parseInt(val.slice(5, 7), 10);
    loadSummary();
  });

  yearInput.addEventListener('change', function () {
    var val = parseInt(yearInput.value, 10);
    if (isNaN(val) || val < 2000 || val > 2100) return;
    RP.year = val;
    loadSummary();
  });

  // Quick period buttons
  $all('.rp-quick-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var now = rpPhNow();
      var y = now.getUTCFullYear();
      var m = now.getUTCMonth() + 1;
      var q = btn.dataset.quick;

      if (q === 'this-month') {
        RP.mode = 'month';
        RP.year = y; RP.month = m;
      } else if (q === 'last-month') {
        RP.mode = 'month';
        RP.year = m === 1 ? y - 1 : y;
        RP.month = m === 1 ? 12 : m - 1;
      } else {
        RP.mode = 'year';
        RP.year = y; RP.month = null;
      }

      syncPeriodInputs();
      setModeUI();
      loadSummary();
    });
  });

  // Report type checkboxes
  $all('.rp-type-check').forEach(function (cb) {
    cb.addEventListener('change', function () {
      updateSelectedTypes();
      updateSelectAll();
    });
  });

  $id('rp-select-all').addEventListener('change', function () {
    var checked = $id('rp-select-all').checked;
    $all('.rp-type-check').forEach(function (cb) { cb.checked = checked; });
    updateSelectedTypes();
  });

  // Download buttons
  $id('rp-dl-excel').addEventListener('click', function () { downloadReport('excel'); });
  $id('rp-dl-pdf').addEventListener('click', function () { downloadReport('pdf'); });
}

function setModeUI() {
  $all('#rp-period-mode .rp-seg-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === RP.mode);
  });
  $id('rp-month-wrap').style.display = RP.mode === 'month' ? 'flex' : 'none';
  $id('rp-year-wrap').style.display = RP.mode === 'month' ? 'none' : 'flex';
}

function syncPeriodInputs() {
  if (RP.mode === 'month') {
    $id('rp-month').value = RP.year + '-' + pad(RP.month);
  } else {
    $id('rp-year').value = RP.year;
  }
}

function updateSelectedTypes() {
  RP.selectedTypes = [];
  $all('.rp-type-check').forEach(function (cb) {
    if (cb.checked) RP.selectedTypes.push(cb.dataset.type);
  });
}

function updateSelectAll() {
  var boxes = $all('.rp-type-check');
  var checked = Array.prototype.filter.call(boxes, function (cb) { return cb.checked; }).length;
  $id('rp-select-all').checked = checked === boxes.length && boxes.length > 0;
}

function buildParams(extra) {
  var p = new URLSearchParams({ year: RP.year });
  if (RP.mode === 'month' && RP.month) p.set('month', RP.month);
  if (extra) {
    Object.keys(extra).forEach(function (k) { p.set(k, extra[k]); });
  }
  return p.toString();
}

function loadSummary() {
  if (!RP.year) return;
  apiRequest('/api/reports/summary?' + buildParams())
    .then(function (res) {
      if (!res) return;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      $id('rp-waste').textContent = data.waste_records;
      $id('rp-schedules').textContent = data.collection_schedules;
      $id('rp-users').textContent = data.users;

      $id('rp-avg-conf').textContent = data.waste_avg_confidence !== null && data.waste_avg_confidence !== undefined
        ? data.waste_avg_confidence + '%' : '—';
      $id('rp-low-conf').textContent = data.waste_low_confidence;
      $id('rp-common-type').textContent = data.waste_most_common_type || '—';

      $id('rp-completed').textContent = data.routes_completed;
      $id('rp-cancelled').textContent = data.routes_cancelled;
      $id('rp-delayed').textContent = data.routes_delayed;
      $id('rp-rate').textContent = (data.completion_rate !== null && data.completion_rate !== undefined)
        ? data.completion_rate + '%' : '—';
    })
    .catch(function (err) {
      $id('rp-waste').textContent = '—';
      $id('rp-schedules').textContent = '—';
      $id('rp-users').textContent = '—';
      $id('rp-avg-conf').textContent = '—';
      $id('rp-low-conf').textContent = '—';
      $id('rp-common-type').textContent = '—';
      $id('rp-completed').textContent = '—';
      $id('rp-cancelled').textContent = '—';
      $id('rp-delayed').textContent = '—';
      $id('rp-rate').textContent = '—';
    });
}

function downloadReport(format) {
  if (RP.downloading) return;
  if (!RP.selectedTypes.length) {
    showToast('Select at least one report type.', 'error');
    return;
  }
  if (!RP.year) {
    showToast('Select a valid period first.', 'error');
    return;
  }

  RP.downloading = true;
  setDownloading(true);

  var url = CONFIG.API_BASE_URL + '/api/reports/export?' + buildParams({ format: format, types: RP.selectedTypes.join(',') });

  fetch(url, { headers: getHeaders() })
    .then(function (res) {
      if (!res) return;
      if (res.status === 401) { logout(); return; }
      if (!res.ok) return res.json().then(function (d) { throw new Error((d && d.detail) || 'HTTP ' + res.status); });
      return res.blob();
    })
    .then(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      var objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = suggestedFilename(format);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 2000);
      showToast(format === 'excel' ? 'Excel report downloaded.' : 'PDF report downloaded.', 'success');
    })
    .catch(function (err) {
      showToast('Download failed: ' + err.message, 'error');
    })
    .finally(function () {
      RP.downloading = false;
      setDownloading(false);
    });
}

function setDownloading(on) {
  $id('rp-dl-excel').disabled = on;
  $id('rp-dl-pdf').disabled = on;
  var x = $id('rp-dl-excel');
  var p = $id('rp-dl-pdf');
  if (on) {
    x.querySelector('.rp-dl-main').textContent = 'Preparing…';
    p.querySelector('.rp-dl-main').textContent = 'Preparing…';
  } else {
    x.querySelector('.rp-dl-main').textContent = 'Download Excel';
    p.querySelector('.rp-dl-main').textContent = 'Download PDF';
  }
}

function suggestedFilename(format) {
  var period = RP.mode === 'month'
    ? RP.year + '-' + pad(RP.month)
    : '' + RP.year;
  return 'WISE_Report_' + period + '.' + (format === 'excel' ? 'xlsx' : 'pdf');
}