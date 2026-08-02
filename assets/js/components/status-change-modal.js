/**
 * WISE System - Status Change Modal Component
 * Auto-filled Delayed/Cancelled modals with reason dropdown and an
 * auto-generated citizen message. Saves through POST /api/collection-schedules/{id}/status.
 */

const STATUS_CHANGE = {
  newStatus: '',
  schedules: [],
  scope: 'one',            // 'one' (this route only) or 'all' (every route that day)
  daySchedules: [],        // all routes on the selected schedule's date (for the scope toggle)
  reasonOptions: [
    'Heavy Rain', 'Flood', 'Truck Breakdown', 'Mechanical Failure',
    'Heavy Traffic', 'Road Closure', 'Holiday', 'Emergency', 'Others'
  ]
};

function openStatusChangeModal(scheduleOrList, newStatus) {
  const list = Array.isArray(scheduleOrList) ? scheduleOrList : [scheduleOrList];
  if (!list || !list.length) { showToast('No routes selected.', 'info'); return; }
  STATUS_CHANGE.newStatus = newStatus;
  STATUS_CHANGE.schedules = list;
  STATUS_CHANGE.scope = list.length > 1 ? 'all' : 'one';
  STATUS_CHANGE.daySchedules = [];
  if (list.length === 1) {
    const dateStr = list[0].collection_date ? list[0].collection_date.substring(0, 10) : '';
    STATUS_CHANGE.daySchedules = dateStr
      ? (state.schedules || []).filter(function (s) {
          return s.collection_date && s.collection_date.substring(0, 10) === dateStr;
        })
      : [];
  }
  renderStatusChangeModal();
  const overlay = $id('status-change-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('active');
  }
}

function closeStatusChangeModal() {
  const overlay = $id('status-change-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('active');
  }
  STATUS_CHANGE.schedules = [];
  STATUS_CHANGE.daySchedules = [];
}

/** Routes that will actually be updated, honoring the chosen scope. */
function _scopedSchedules() {
  if (STATUS_CHANGE.scope === 'all' && STATUS_CHANGE.daySchedules.length > 0) {
    return STATUS_CHANGE.daySchedules;
  }
  return STATUS_CHANGE.schedules;
}

function _statusChangeContext() {
  const isDelay = STATUS_CHANGE.newStatus === 'Delayed';
  const list = _scopedSchedules();
  const first = list[0] || {};
  const routeName = first.route_name || first.starting_point || (first.barangay + ' Route');
  const barangays = list.map(function (s) { return s.barangay; }).join(', ');
  const dateLabel = first.collection_date ? formatDisplayDate(first.collection_date) : '-';
  const timeLabel = first.collection_time ? formatTime12(first.collection_time.substring(0, 5)) : '-';
  return { isDelay: isDelay, first: first, routeName: routeName, barangays: barangays, dateLabel: dateLabel, timeLabel: timeLabel, count: list.length };
}

function _buildStatusMessage() {
  const ctx = _statusChangeContext();
  const reasonSel = $id('sc-reason');
  const reason = reasonSel ? reasonSel.value : '';
  const otherEl = $id('sc-other');
  const reasonText = (reason === 'Others' && otherEl) ? otherEl.value.trim() : reason;
  const addMsgEl = $id('sc-additional');
  const addMsg = addMsgEl ? addMsgEl.value.trim() : '';
  let msg;
  if (ctx.isDelay) {
    msg = "Today's garbage collection for the following barangays has been delayed.\n" +
      'Affected Route: ' + ctx.routeName + '\n' +
      'Affected Barangays: ' + ctx.barangays;
  } else {
    msg = "Today's garbage collection has been cancelled.\n" +
      'Affected Route: ' + ctx.routeName + '\n' +
      'Affected Barangays: ' + ctx.barangays;
  }
  if (reasonText) msg += '\nReason: ' + reasonText;
  if (addMsg) msg += '\n\n' + addMsg;
  return msg;
}

function renderStatusChangeModal() {
  const ctx = _statusChangeContext();
  const isDelay = ctx.isDelay;
  const title = isDelay ? 'Collection Delayed' : 'Collection Cancelled';
  const typeLabel = isDelay ? 'Collection Delayed' : 'Collection Cancelled';
  const canScope = STATUS_CHANGE.schedules.length === 1 && STATUS_CHANGE.daySchedules.length > 1;

  const reasonOptions = STATUS_CHANGE.reasonOptions.map(function (r) {
    return '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>';
  }).join('');

  const scopeHtml = canScope
    ? '<div class="nt-field" style="margin-top:14px">' +
        '<label class="nt-label">Apply to</label>' +
        '<div class="sc-scope-row">' +
          '<label class="sc-scope-option"><input type="radio" name="sc-scope" value="one" ' + (STATUS_CHANGE.scope === 'one' ? 'checked' : '') + '>' +
            '<span>This route only (' + escapeHtml(STATUS_CHANGE.schedules[0].barangay) + ')</span></label>' +
          '<label class="sc-scope-option"><input type="radio" name="sc-scope" value="all" ' + (STATUS_CHANGE.scope === 'all' ? 'checked' : '') + '>' +
            '<span>All ' + STATUS_CHANGE.daySchedules.length + ' routes this day</span></label>' +
        '</div>' +
      '</div>'
    : '';

  $id('status-change-content').innerHTML =
    '<div class="modal-header">' +
      '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span id="sc-title">' + title + '</span></h3>' +
      '<button class="modal-close-btn" onclick="closeStatusChangeModal()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="modal-body" style="padding:20px 22px">' +
      '<div class="sc-summary">' +
        '<div class="sc-row"><span class="sc-label">Notification Type</span><span class="sc-value">' + escapeHtml(typeLabel) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">Route Name</span><span class="sc-value" id="sc-route-name"></span></div>' +
        '<div class="sc-row"><span class="sc-label">Affected Barangays</span><span class="sc-value" id="sc-barangays"></span></div>' +
        '<div class="sc-row"><span class="sc-label">Collection Date</span><span class="sc-value">' + escapeHtml(ctx.dateLabel) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">Collection Time</span><span class="sc-value">' + escapeHtml(ctx.timeLabel) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">Assigned Personnel</span><span class="sc-value">' + escapeHtml(ctx.first.assigned_personnel || '-') + '</span></div>' +
      '</div>' +
      scopeHtml +
      '<div class="nt-field" style="margin-top:16px">' +
        '<label class="nt-label" for="sc-reason">Reason <span style="color:#DC2626">*</span></label>' +
        '<select class="nt-select" id="sc-reason"><option value="">Select reason...</option>' + reasonOptions + '</select>' +
      '</div>' +
      '<div class="nt-field" id="sc-other-wrap" style="display:none">' +
        '<label class="nt-label" for="sc-other">Specify Reason</label>' +
        '<input class="nt-input" type="text" id="sc-other" placeholder="Type the reason..." autocomplete="off">' +
      '</div>' +
      '<div class="nt-field" style="margin-top:14px">' +
        '<label class="nt-label" for="sc-additional">Additional Message</label>' +
        '<textarea class="nt-input nt-textarea" id="sc-additional" rows="3" placeholder="e.g., The truck experienced engine failure. Collection will resume at 2:00 PM."></textarea>' +
      '</div>' +
      '<div class="sc-message-preview">' +
        '<div class="sc-message-label">Auto-generated citizen message</div>' +
        '<div class="sc-message" id="sc-message"></div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<div class="modal-footer-actions">' +
        '<button class="btn btn-secondary" onclick="closeStatusChangeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="sc-confirm-btn">Send Notification &amp; ' + title + '</button>' +
      '</div>' +
    '</div>';

  $id('sc-reason').addEventListener('change', function () {
    const wrap = $id('sc-other-wrap');
    wrap.style.display = this.value === 'Others' ? 'flex' : 'none';
    _updateStatusMessage();
  });
  const otherEl = $id('sc-other');
  if (otherEl) otherEl.addEventListener('input', _updateStatusMessage);
  const addMsgEl = $id('sc-additional');
  if (addMsgEl) addMsgEl.addEventListener('input', _updateStatusMessage);
  if (canScope) {
    $all('input[name="sc-scope"]').forEach(function (el) {
      el.addEventListener('change', function () {
        STATUS_CHANGE.scope = this.value;
        _refreshStatusSummary();
        _updateStatusMessage();
      });
    });
  }
  $id('sc-confirm-btn').addEventListener('click', confirmStatusChange);
  _refreshStatusSummary();
  _updateStatusMessage();
}

function _refreshStatusSummary() {
  const ctx = _statusChangeContext();
  const multi = ctx.count > 1;
  $id('sc-route-name').textContent = ctx.routeName;
  $id('sc-barangays').innerHTML = escapeHtml(ctx.barangays) +
    (multi ? ' <small>(' + ctx.count + ' routes)</small>' : '');
}

function _updateStatusMessage() {
  const el = $id('sc-message');
  if (el) el.textContent = _buildStatusMessage();
}

async function confirmStatusChange() {
  const reasonSel = $id('sc-reason');
  const reason = reasonSel ? reasonSel.value : '';
  const reasonOther = reason === 'Others' ? ($id('sc-other').value || '').trim() : '';
  const additional = ($id('sc-additional').value || '').trim();
  if (!reason) { showToast('Please select a reason.', 'error'); return; }
  if (reason === 'Others' && !reasonOther) { showToast('Please specify the reason.', 'error'); return; }

  const list = _scopedSchedules();
  const btn = $id('sc-confirm-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  var updated = 0;
  await Promise.all(list.map(function (s) {
    return updateScheduleStatus(s.id, STATUS_CHANGE.newStatus, reason, reasonOther, additional)
      .then(function (r) { if (r) updated++; });
  }));

  closeStatusChangeModal();
  if (updated > 0) {
    showToast(updated + ' route' + (updated > 1 ? 's' : '') + ' updated and notified!', 'success');
  }
  renderCalendar();
}
