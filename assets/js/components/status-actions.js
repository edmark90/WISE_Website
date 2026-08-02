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
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF3C7;color:#92400E;border:none" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Delayed' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Delayed</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#F3F4F6;color:#4B5563;border:none" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Cancelled' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancelled</button></div>';
  } else if (status === 'Delayed') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#EFF6FF;color:#1E40AF;border:none" onclick="openEditModal(' + id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Reschedule</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#F3F4F6;color:#4B5563;border:none" onclick="openStatusChangeModal(getScheduleById(' + id + '),\'' + 'Cancelled' + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancelled</button></div>';
  }
  return buttons;
}
