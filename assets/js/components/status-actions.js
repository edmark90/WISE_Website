/**
 * WISE System - Status Actions Component
 * Renders quick status-change buttons per status and handles the updates.
 */

// ---------- Status Actions ----------
function getStatusActions(schedule) {
  var status = schedule.status;
  var id = schedule.id;
  var buttons = '';
  if (status === 'Upcoming') {
    buttons = '';
  } else if (status === 'Arriving') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#F0FDF4;color:#166534;border:none" onclick="quickUpdateStatus(' + id + ',\'Arrived\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Mark Arrived</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF3C7;color:#92400E;border:none" onclick="quickUpdateStatus(' + id + ',\'Delayed\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Delayed</button></div>';
  } else if (status === 'Arrived') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;border:none;font-weight:700" onclick="quickUpdateStatus(' + id + ',\'Completed\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Mark Completed</button></div>';
  } else if (status === 'Delayed') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#F0FDF4;color:#166534;border:none" onclick="quickUpdateStatus(' + id + ',\'Arrived\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Arrived</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#EFF6FF;color:#1E40AF;border:none" onclick="openEditModal(' + id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Reschedule</button></div>';
  }
  return buttons;
}

function quickUpdateStatus(id, newStatus) {
  updateSchedule(id, { status: newStatus }).then(() => renderCalendar());
}
