/**
 * WISE System - Reports Page Logic
 * Administrative reports generator & exporter:
 *  - Monthly & Yearly period selectors with quick presets
 *  - Live period summary KPI analytics
 *  - Multi-section report selection with select-all toggle
 *  - End-to-end binary downloads for Excel (.xlsx) and PDF (.pdf)
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;
  initReports();
});

var ALL_REPORT_TYPES = [
  'barangay_performance',
  'waste_trends',
  'collection_calendar',
  'notification_analytics',
  'schedule'
];

var RP = {
  mode: 'month',          // 'month' | 'year'
  year: null,
  month: null,            // 1-12 when mode is month
  selectedTypes: ALL_REPORT_TYPES.slice(),
  downloading: false,
  loadingSummary: false
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
  updateSelectedTypes();
  updateSelectAll();
  updatePeriodBadge();
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
      updatePeriodBadge();
      loadSummary();
    });
  });

  var monthInput = $id('rp-month');
  var yearInput = $id('rp-year');

  if (monthInput) {
    monthInput.addEventListener('change', function () {
      var val = monthInput.value;
      if (!val) return;
      RP.year = parseInt(val.slice(0, 4), 10);
      RP.month = parseInt(val.slice(5, 7), 10);
      updatePeriodBadge();
      loadSummary();
    });
  }

  if (yearInput) {
    yearInput.addEventListener('change', function () {
      var val = parseInt(yearInput.value, 10);
      if (isNaN(val) || val < 2000 || val > 2100) return;
      RP.year = val;
      updatePeriodBadge();
      loadSummary();
    });
  }

  // Quick period preset buttons
  $all('.rp-quick-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var now = rpPhNow();
      var y = now.getUTCFullYear();
      var m = now.getUTCMonth() + 1;
      var q = btn.dataset.quick;

      if (q === 'this-month') {
        RP.mode = 'month';
        RP.year = y;
        RP.month = m;
      } else if (q === 'last-month') {
        RP.mode = 'month';
        RP.year = m === 1 ? y - 1 : y;
        RP.month = m === 1 ? 12 : m - 1;
      } else if (q === 'this-year') {
        RP.mode = 'year';
        RP.year = y;
        RP.month = null;
      }

      syncPeriodInputs();
      setModeUI();
      updatePeriodBadge();
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

  var selectAllEl = $id('rp-select-all');
  if (selectAllEl) {
    selectAllEl.addEventListener('change', function () {
      var checked = selectAllEl.checked;
      $all('.rp-type-check').forEach(function (cb) { cb.checked = checked; });
      updateSelectedTypes();
    });
  }

  // Summary refresh button
  var refreshBtn = $id('rp-summary-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      loadSummary();
    });
  }

  // Export buttons
  var excelBtn = $id('rp-dl-excel');
  if (excelBtn) {
    excelBtn.addEventListener('click', function () { downloadReport('excel'); });
  }

  var pdfBtn = $id('rp-dl-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () { downloadReport('pdf'); });
  }
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
    var monthEl = $id('rp-month');
    if (monthEl) monthEl.value = RP.year + '-' + pad(RP.month);
  } else {
    var yearEl = $id('rp-year');
    if (yearEl) yearEl.value = RP.year;
  }
}

function updatePeriodBadge() {
  var badge = $id('rp-active-period-label');
  if (!badge) return;
  if (RP.mode === 'month' && RP.month) {
    var dateObj = new Date(RP.year, RP.month - 1, 1);
    var monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    badge.textContent = monthName + ' ' + RP.year;
  } else {
    badge.textContent = 'Year ' + RP.year;
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
  var checkedCount = 0;
  boxes.forEach(function (cb) {
    if (cb.checked) checkedCount++;
  });
  var selectAllEl = $id('rp-select-all');
  if (selectAllEl) {
    selectAllEl.checked = checkedCount === boxes.length && boxes.length > 0;
    selectAllEl.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  }
}

function buildParams(extra) {
  var p = new URLSearchParams({ year: RP.year });
  if (RP.mode === 'month' && RP.month) p.set('month', RP.month);
  if (extra) {
    Object.keys(extra).forEach(function (k) { p.set(k, extra[k]); });
  }
  return p.toString();
}

function setSummaryLoading(loading) {
  RP.loadingSummary = loading;
  var summaryCard = $id('rp-summary-card');
  if (summaryCard) {
    summaryCard.classList.toggle('loading', loading);
  }
}

function loadSummary() {
  if (!RP.year) return;
  setSummaryLoading(true);

  apiRequest('/api/reports/summary?' + buildParams())
    .then(function (res) {
      if (!res) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!data) return;

      // Overall Collection Performance
      setElementText('rp-total-collections', data.total_collections);
      setElementText('rp-completed-collections', data.completed_collections);
      setElementText('rp-delayed-collections', data.delayed_collections);
      setElementText('rp-completion-rate', (data.completion_rate !== null && data.completion_rate !== undefined)
        ? data.completion_rate + '%' : '0%');

      // Waste Classification
      setElementText('rp-waste-classifications', data.waste_classifications);
      setElementText('rp-recycling-rate', (data.recycling_rate !== null && data.recycling_rate !== undefined)
        ? data.recycling_rate + '%' : '0%');
      setElementText('rp-avg-confidence', (data.avg_confidence !== null && data.avg_confidence !== undefined)
        ? data.avg_confidence + '%' : '—');

      // Barangay Performance
      setElementText('rp-total-barangays', data.total_barangays);
      setElementText('rp-top-barangay', data.top_barangay || '—');
    })
    .catch(function (err) {
      console.warn('Summary load error:', err);
      // Display neutral dash states on error
      setElementText('rp-total-collections', '—');
      setElementText('rp-completed-collections', '—');
      setElementText('rp-delayed-collections', '—');
      setElementText('rp-completion-rate', '—');
      setElementText('rp-waste-classifications', '—');
      setElementText('rp-recycling-rate', '—');
      setElementText('rp-avg-confidence', '—');
      setElementText('rp-total-barangays', '—');
      setElementText('rp-top-barangay', '—');
    })
    .finally(function () {
      setSummaryLoading(false);
    });
}

function setElementText(id, value) {
  var el = $id(id);
  if (el) {
    el.textContent = (value !== null && value !== undefined && value !== '') ? value : '0';
  }
}

/**
 * Download handler for Excel (.xlsx) and PDF (.pdf) reports.
 * Uses auth headers, binary blob streams, and accurate Content-Disposition filenames.
 */
function downloadReport(format) {
  if (RP.downloading) return;

  if (!RP.selectedTypes || !RP.selectedTypes.length) {
    showToast('Please select at least one report section to include.', 'error');
    return;
  }
  if (!RP.year) {
    showToast('Please select a valid period first.', 'error');
    return;
  }

  RP.downloading = true;
  setDownloading(true, format);

  var token = localStorage.getItem('access_token');
  var headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  var url = CONFIG.API_BASE_URL + '/api/reports/export?' + buildParams({
    format: format,
    types: RP.selectedTypes.join(',')
  });

  fetch(url, { headers: headers })
    .then(async function (res) {
      if (!res) return null;
      if (res.status === 401) {
        logout();
        return null;
      }
      if (!res.ok) {
        var errorMsg = 'Failed to generate ' + format.toUpperCase() + ' report (HTTP ' + res.status + ')';
        try {
          var errJson = await res.json();
          if (errJson && errJson.detail) errorMsg = errJson.detail;
        } catch (e) {
          try {
            var errText = await res.text();
            if (errText && errText.length < 160) errorMsg = errText;
          } catch (e2) {}
        }
        throw new Error(errorMsg);
      }

      // Extract filename from Content-Disposition header if present
      var filename = suggestedFilename(format);
      var disposition = res.headers.get('Content-Disposition') || '';
      var filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }

      var blob = await res.blob();
      return { blob: blob, filename: filename };
    })
    .then(function (result) {
      if (!result) return;
      var a = document.createElement('a');
      var objUrl = URL.createObjectURL(result.blob);
      a.href = objUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 3000);

      var successMsg = format === 'excel'
        ? 'Excel report (' + result.filename + ') downloaded successfully.'
        : 'PDF report (' + result.filename + ') downloaded successfully.';
      showToast(successMsg, 'success');
    })
    .catch(function (err) {
      console.error('Report export error:', err);
      showToast(err.message || 'Unable to download report. Please try again.', 'error');
    })
    .finally(function () {
      RP.downloading = false;
      setDownloading(false);
    });
}

function setDownloading(on, format) {
  var excelBtn = $id('rp-dl-excel');
  var pdfBtn = $id('rp-dl-pdf');
  if (!excelBtn || !pdfBtn) return;

  excelBtn.disabled = on;
  pdfBtn.disabled = on;

  if (on) {
    if (format === 'excel') {
      excelBtn.classList.add('loading');
      excelBtn.querySelector('.rp-dl-main').textContent = 'Preparing Excel...';
    } else {
      pdfBtn.classList.add('loading');
      pdfBtn.querySelector('.rp-dl-main').textContent = 'Preparing PDF...';
    }
  } else {
    excelBtn.classList.remove('loading');
    pdfBtn.classList.remove('loading');
    excelBtn.querySelector('.rp-dl-main').textContent = 'Download Excel (.xlsx)';
    pdfBtn.querySelector('.rp-dl-main').textContent = 'Download PDF (.pdf)';
  }
}

function suggestedFilename(format) {
  var period = RP.mode === 'month'
    ? RP.year + '-' + pad(RP.month)
    : '' + RP.year;
  var ext = format === 'excel' ? 'xlsx' : 'pdf';
  return 'WISE_Report_' + period + '.' + ext;
}