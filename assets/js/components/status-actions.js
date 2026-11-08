/**
 * WISE System - Status Actions Component
 * Renders quick status-change buttons per status and handles the updates.
 * Delayed/Cancelled transitions open the auto-filled notification modal.
 */

// ---------- Status Actions ----------
function getStatusActions(schedule) {
  var status = schedule.status;
  var id = schedule.id;
  var buttons = '';
  if (status === 'Upcoming' || status === 'Arriving' || status === 'Arrived') {
    buttons = '<div class="status-actions-row">' +
      '<button class="btn btn-sm status-action-btn delayed" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Delayed' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Delayed</button>' +
      '<button class="btn btn-sm status-action-btn cancelled" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Cancelled' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancelled</button></div>';
  } else if (status === 'Delayed') {
    buttons = '<div class="status-actions-row">' +
      '<button class="btn btn-sm status-action-btn reschedule" onclick="openEditModal(' + id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Reschedule</button>' +
      '<button class="btn btn-sm status-action-btn cancelled" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Cancelled' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancelled</button></div>';
  }
  return buttons;
}

async function adminUpdateStopStatus(stopId, scheduleId, newStatus) {
  var reason = null;
  if (newStatus === 'Delayed' || newStatus === 'Cancelled') {
    reason = window.prompt('Enter reason for marking this stop as ' + newStatus + ':', newStatus === 'Delayed' ? 'Heavy Traffic' : 'Road Closure');
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('A reason is required for ' + newStatus + '.', 'error');
      return;
    }
    reason = reason.trim();
  }
  try {
    var res = await apiRequest('/api/collection-schedules/stops/' + stopId + '/status', {
      method: 'POST',
      body: JSON.stringify({ status: newStatus, reason: reason })
    });
    if (!res) return;
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      showToast(data.detail || 'Failed to update stop status.', 'error');
      return;
    }
    showToast('Stop marked as ' + newStatus + '!', 'success');
    await renderCalendar();
    var updated = getScheduleById(scheduleId);
    if (updated) showScheduleInSidebar(updated);
  } catch (e) {
    console.error('Stop status update error:', e);
    showToast('Error updating stop status.', 'error');
  }
}
