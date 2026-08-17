/**
 * WISE System - Waste Record Table Component
 * Renders classification rows, confidence bars, badges, flags + pagination.
 * Follows the same pattern as components/user-table.js (globals for inline onclick).
 */

// Enable thumbnail display when waste photos are available
const WC_SHOW_IMAGES = true;

// 5 AI classes -> badge styling (matching system palette)
const WC_BADGE = {
  'Biodegradable': 'bio',
  'Recyclable': 'rec',
  'Electronic': 'ewaste',
  'Hazardous': 'haz',
  'Residual': 'res'
};

function wcBadgeClass(cls) { return WC_BADGE[cls] || 'res'; }

// Confidence level -> color family
function wcConfLevel(conf) {
  if (conf == null) return 'low';
  if (conf >= 85) return 'high';   // green
  if (conf >= 60) return 'medium'; // blue
  return 'low';                    // red/amber
}

function wcFormatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return pad(h) + ':' + pad(m) + ':' + pad(s) + ' ' + ampm;
}

function wcFormatDate(ts) {
  if (!ts) return '—';
  return formatDisplayDate(ts);
}

const WC_PLACEHOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';

function renderWasteRows(records) {
  if (!records || records.length === 0) return '';
  var html = '';
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var safeName = escapeHtml(r.fullname || 'Citizen Scanner');
    var sourceSub = (r.barangay ? escapeHtml(r.barangay) : '') + (r.zone ? ' · Zone ' + escapeHtml(r.zone) : '');
    var thumb;
    if (WC_SHOW_IMAGES && r.image_url) {
      thumb = '<span class="wc-thumb"><img src="' + escapeHtml(CONFIG.API_BASE_URL + '/' + r.image_url) + '" alt="Waste scan" onerror="this.parentElement.innerHTML=\'' + WC_PLACEHOLDER.replace(/"/g, '&quot;') + '\'"></span>';
    } else {
      thumb = '<span class="wc-thumb" aria-label="No image available">' + WC_PLACEHOLDER + '</span>';
    }
    var conf = r.confidence;
    var confLevel = wcConfLevel(conf);
    var confPct = conf != null ? conf.toFixed(1) + '%' : '—';
    var barW = conf != null ? Math.min(conf, 100) : 0;
    var flagCls = r.is_flagged ? ' flagged' : '';
    var flagTitle = r.is_flagged ? 'Unflag record' : 'Flag for review';
    html += '<tr class="' + (r.is_flagged ? 'is-flagged' : '') + '">';
    html += '<td>' + thumb + '</td>';
    html += '<td><p class="wc-source-primary">' + safeName + '</p><p class="wc-source-sub">' + (sourceSub || 'Mobile scan') + '</p></td>';
    html += '<td><span class="wc-badge ' + wcBadgeClass(r.classification || r.waste_type) + '">' + escapeHtml(r.classification || r.waste_type || '—') + '</span></td>';
    html += '<td><div class="wc-conf ' + confLevel + '"><span class="wc-conf-pct">' + confPct + '</span><span class="wc-conf-bar"><span class="wc-conf-fill" style="width:' + barW + '%"></span></span></div></td>';
    html += '<td><p class="wc-time-primary">' + wcFormatTime(r.created_at) + '</p><p class="wc-time-sub">' + wcFormatDate(r.created_at) + '</p></td>';
    html += '<td><div class="wc-actions">';
    html += '<button class="wc-icon-btn" type="button" onclick="viewWasteRecord(' + r.id + ')" title="View record details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
    html += '<button class="wc-icon-btn' + flagCls + '" type="button" onclick="toggleWasteFlag(' + r.id + ', ' + (r.is_flagged ? 'true' : 'false') + ')" title="' + flagTitle + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></button>';
    html += '<button class="wc-icon-btn danger" type="button" onclick="deleteWasteRecord(' + r.id + ')" title="Delete record"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>';
    html += '</div></td></tr>';
  }
  return html;
}

function renderWasteState(kind, msg) {
  var container = $id('wc-state-container');
  if (!container) return;
  if (kind === 'loading') {
    container.innerHTML = '<div class="wc-state"><div class="wc-spinner"></div><p>' + msg + '</p></div>';
    return;
  }
  var icon = kind === 'error'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  container.innerHTML = '<div class="wc-state">' + icon + '<h4>' + (kind === 'error' ? 'Something went wrong' : 'No records found') + '</h4><p>' + msg + '</p></div>';
}

function renderWastePagination() {
  var total = state.total, page = state.page, pageSize = state.pageSize;
  var start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  var end = Math.min(page * pageSize, total);
  $id('wc-count').innerHTML = 'Showing <strong>' + start + '-' + end + '</strong> of <strong>' + total.toLocaleString() + '</strong> records';
  var prev = $id('wc-prev'), next = $id('wc-next');
  prev.disabled = page <= 1;
  next.disabled = end >= total;
}