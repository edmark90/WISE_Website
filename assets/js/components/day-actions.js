/**
 * WISE System - Day Actions Component
 * Bulk operations for a day's routes: delete all, move all, bulk status update.
 */

// ---------- Day Actions ----------
function deleteDayRoute(id) {
  const schedule = state.schedules.find(s => s.id === id);
  if (!schedule) return;
  openDeleteModal(id, schedule.barangay);
}

function deleteAllDayRoutes() {
  const scheds = state.selectedDateSchedules;
  if (!scheds || scheds.length === 0) { showToast('No routes to delete.', 'info'); return; }
  const dateStr = new Date(scheds[0].collection_date + 'T00:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
  if (!confirm('Delete all ' + scheds.length + ' route' + (scheds.length > 1 ? 's' : '') + ' for ' + dateStr + '?')) return;
  var deleted = 0;
  Promise.all(scheds.map(s => deleteSchedule(s.id).then(r => { if (r) deleted++; })))
    .then(() => { if (deleted > 0) showToast(deleted + ' route' + (deleted > 1 ? 's' : '') + ' deleted!', 'success'); renderCalendar(); });
}

function rescheduleAllRoutes() {
  const scheds = state.selectedDateSchedules;
  if (!scheds || scheds.length === 0) { showToast('No routes to move.', 'info'); return; }
  const dateInput = $id('reschedule-date-input');
  const newDate = dateInput ? dateInput.value : '';
  if (!newDate) { showToast('Please select a target date.', 'info'); return; }
  if (isDatePast(newDate)) { showToast('Cannot move to past dates.', 'info'); return; }
  if (!confirm('Move all ' + scheds.length + ' route' + (scheds.length > 1 ? 's' : '') + '?')) return;
  const btn = document.querySelector('.move-btn');
  btn.disabled = true; btn.textContent = 'Moving...';
  var moved = 0;
  Promise.all(scheds.map(s => updateSchedule(s.id, { collection_date: newDate }, true).then(r => { if (r) moved++; })))
    .then(() => { btn.disabled = false; btn.textContent = 'Move All'; if (moved > 0) showToast(moved + ' route' + (moved > 1 ? 's' : '') + ' moved!', 'success'); renderCalendar(); })
    .catch(() => { btn.disabled = false; btn.textContent = 'Move All'; });
}

function bulkUpdateDayStatus() {
  const sel = $id('bulk-status-select');
  const newStatus = sel.value;
  if (!newStatus) { showToast('Select a status first.', 'info'); return; }
  if (newStatus !== 'Delayed' && newStatus !== 'Cancelled') {
    showToast('Automatic statuses are managed by the system.', 'info');
    return;
  }
  const scheds = state.selectedDateSchedules;
  if (!scheds || scheds.length === 0) { showToast('No routes to update.', 'info'); return; }
  openStatusChangeModal(scheds, newStatus);
}
