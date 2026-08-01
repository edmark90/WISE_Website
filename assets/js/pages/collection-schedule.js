/**
 * WISE System - Collection Schedule Page
 * Page state, DOM references, and initialization for collection schedule.html.
 * Rendering logic lives in the components under assets/js/components/.
 */

// ---------- State ----------
let state = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  today: new Date(),
  selectedDate: null,
  currentSchedule: null,
  schedules: [],
  editingId: null,
  routeEntries: [],
  deletingId: null,
  selectedDateSchedules: []
};

// ---------- DOM refs ----------
const calendarGrid = $id('calendar-grid');
const calendarTitle = $id('calendar-title');
const sidebarDetails = $id('sidebar-details');
const routePreviewInfo = $id('route-preview-info');

const modalOverlay = $id('schedule-modal-overlay');
const modalTitle = $id('modal-title-text');
const modalSaveBtn = $id('modal-save-btn');
const modalSaveText = $id('modal-save-text');
const modalCloseBtn = $id('modal-close-btn');
const modalCancelBtn = $id('modal-cancel-btn');
const scheduleForm = $id('schedule-form');
const fId = $id('f-id');
const fDate = $id('f-date');
const modalDateLabel = $id('modal-date-label');
const routeEntriesContainer = $id('route-entries');
const addRouteBtn = $id('add-route-btn');
const modalFooterSummary = $id('modal-footer-summary');

const deleteOverlay = $id('delete-modal-overlay');
const deleteConfirmBtn = $id('delete-confirm-btn');
const deleteCancelBtn = $id('delete-cancel-btn');
const deleteText = $id('delete-text');
const dayActions = $id('day-actions');

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', function() {
  if (!initBasePage()) return;
  $id('prev-month').addEventListener('click', function() { state.currentMonth--; if (state.currentMonth<0) { state.currentMonth=11; state.currentYear--; } renderCalendar(); });
  $id('next-month').addEventListener('click', function() { state.currentMonth++; if (state.currentMonth>11) { state.currentMonth=0; state.currentYear++; } renderCalendar(); });
  $id('today-btn').addEventListener('click', function() { state.currentMonth = new Date().getMonth(); state.currentYear = new Date().getFullYear(); state.selectedDate = new Date(); renderCalendar(); });
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeModal(); });
  deleteCancelBtn.addEventListener('click', closeDeleteModal);
  deleteConfirmBtn.addEventListener('click', async function() {
    if (state.deletingId && await deleteSchedule(state.deletingId)) { closeDeleteModal(); renderCalendar(); }
  });
  deleteOverlay.addEventListener('click', function(e) { if (e.target === deleteOverlay) closeDeleteModal(); });
  $id('delete-all-routes-btn').addEventListener('click', deleteAllDayRoutes);
  addRouteBtn.addEventListener('click', addRouteEntry);
  modalSaveBtn.addEventListener('click', handleSaveSchedule);
  renderCalendar();
});
