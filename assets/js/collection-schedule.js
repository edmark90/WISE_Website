/**
 * WISE System - Schedule Management Module
 * Multi-route entry system: each "route" is a separate schedule record.
 * No route map in modal — only on the right sidebar after saving.
 */

const API_BASE = 'http://127.0.0.1:8000';
const $id = (id) => document.getElementById(id);
const $all = (sel) => document.querySelectorAll(sel);

// Barangays of Muntinlupa City
const BARANGAYS = [
  'Alabang', 'Ayala Alabang', 'Bayanan', 'Buli',
  'Cupang', 'New Alabang Village', 'Poblacion',
  'Putatan', 'Sucat', 'Tunasan'
];

// Allowed statuses
const STATUSES = ['Upcoming', 'Arriving', 'Arrived', 'Delayed', 'Completed', 'Cancelled'];

// Zone colors for calendar events
const ZONE_COLORS = {
  'Zone 1': { bg: '#16A34A', gradient: 'linear-gradient(135deg, #16A34A, #15803D)' },
  'Zone 2': { bg: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  'Zone 3': { bg: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  'Zone 4': { bg: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  'Zone 5': { bg: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)' },
  default: { bg: '#6B7280', gradient: 'linear-gradient(135deg, #6B7280, #4B5563)' }
};

// ---------- State ----------
let state = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  today: new Date(),
  selectedDate: null,
  currentSchedule: null,
  schedules: [],
  editingId: null,
  routeEntries: [],     // [{time, barangay, zone, personnel, status}]
  deletingId: null,
  selectedDateSchedules: []  // schedules for the selected date (for sidebar route map)
};

// ---------- DOM refs ----------
const calendarGrid = $id('calendar-grid');
const calendarTitle = $id('calendar-title');
const sidebarDetails = $id('sidebar-details');
const routePreviewMap = $id('route-preview-map');
const routePreviewInfo = $id('route-preview-info');
const toastContainer = $id('toast-container');

// Modal
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

// Delete modal & Day actions
const deleteOverlay = $id('delete-modal-overlay');
const deleteConfirmBtn = $id('delete-confirm-btn');
const deleteCancelBtn = $id('delete-cancel-btn');
const deleteText = $id('delete-text');
const dayActions = $id('day-actions');
const deleteAllRoutesBtn = $id('delete-all-routes-btn');

// ---------- Auth ----------
function getHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function checkAuth() {
  if (!localStorage.getItem('access_token')) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_type');
  localStorage.removeItem('user_role');
  window.location.href = 'index.html';
}

// ---------- Toast ----------
function showToast(msg, type) {
  type = type || 'info';
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
  toastContainer.appendChild(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ---------- Format helpers ----------
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function formatDate(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

function formatTime12(t) {
  if (!t) return '';
  const parts = t.split(':');
  const h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + ampm;
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------- Date Restrictions ----------
function isDatePast(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  return checkDate < today;
}

// ---------- Auto Status Logic ----------
function getAutoStatus(dateStr, currentStatus) {
  // Manual overrides - keep these as-is
  if (currentStatus === 'Cancelled' || currentStatus === 'Delayed') {
    return currentStatus;
  }
  
  // If current status is 'Arrived' or 'Completed', keep it unless date is in the future
  if (currentStatus === 'Completed' || currentStatus === 'Arrived') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
    // Only keep 'Arrived' if it's today still
    if (currentStatus === 'Arrived' && schedDate.toDateString() === today.toDateString()) {
      return 'Arrived';
    }
    // Keep Completed if date is in the past
    if (currentStatus === 'Completed' && schedDate < today) {
      return 'Completed';
    }
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  
  if (schedDate < today) {
    return 'Completed';
  } else if (schedDate.toDateString() === today.toDateString()) {
    return 'Arriving';
  } else {
    return 'Upcoming';
  }
}

// ---------- API calls ----------
async function fetchSchedulesByMonth(year, month) {
  const startDate = year + '-' + pad(month + 1) + '-01';
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = year + '-' + pad(month + 1) + '-' + lastDay;

  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/by-date-range/?start_date=' + startDate + '&end_date=' + endDate, {
      headers: getHeaders()
    });
    if (res.status === 401) { logout(); return []; }
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Fetch schedules error:', err);
    return [];
  }
}

async function createSchedule(data) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to create schedule', 'error'); return null; }
    return await res.json();
  } catch (err) {
    showToast('Connection error. Please try again.', 'error');
    return null;
  }
}

async function updateSchedule(id, data, silent) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/' + id, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to update schedule', 'error'); return null; }
    if (!silent) showToast('Schedule updated successfully!', 'success');
    return await res.json();
  } catch (err) {
    showToast('Connection error. Please try again.', 'error');
    return null;
  }
}

async function deleteSchedule(id) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/' + id, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (res.status === 401) { logout(); return false; }
    if (!res.ok) { showToast('Failed to delete schedule.', 'error'); return false; }
    showToast('Schedule deleted.', 'success');
    return true;
  } catch (err) {
    showToast('Connection error.', 'error');
    return false;
  }
}

// ---------- Calendar rendering ----------
async function renderCalendar() {
  const year = state.currentYear;
  const month = state.currentMonth;
  const today = state.today;

  calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  var fetched = await fetchSchedulesByMonth(year, month);
  // Auto-update statuses based on date
  state.schedules = fetched.map(function(s) {
    var autoStatus = getAutoStatus(s.collection_date, s.status);
    if (autoStatus !== s.status) {
      // Silently update backend for auto-changed status
      updateSchedule(s.id, { status: autoStatus }, true);
    }
    s.status = autoStatus;
    return s;
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const scheduleMap = {};
  state.schedules.forEach(s => {
    const d = s.collection_date;
    const dateKey = d.substring(0, 10);
    if (!scheduleMap[dateKey]) scheduleMap[dateKey] = [];
    scheduleMap[dateKey].push(s);
  });

  let html = '';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    html += '<div class="calendar-day-header">' + d + '</div>';
  });

  for (let i = firstDay - 1; i >= 0; i--) {
    html += '<div class="calendar-day other-month"><span class="day-number">' + (daysInPrevMonth - i) + '</span></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = year + '-' + pad(month + 1) + '-' + pad(d);
    const isToday = dateObj.toDateString() === today.toDateString();
    const isSelected = state.selectedDate && state.selectedDate.toDateString() === dateObj.toDateString();
    const daySchedules = scheduleMap[dateStr] || [];

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (dateObj < today) classes += ' past';

    html += '<div class="' + classes + '" data-date="' + dateStr + '">';
    html += '<span class="day-number">' + d + '</span>';

    if (daySchedules.length > 0) {
      html += '<div class="calendar-events">';
      const shown = daySchedules.slice(0, 3);
      const remaining = daySchedules.length - 3;

      shown.forEach(s => {
        const zoneColor = ZONE_COLORS[s.zone] || ZONE_COLORS.default;
        const timeStr = s.collection_time ? formatTime12(s.collection_time.substring(0, 5)) : '';
        const title = s.barangay || 'Collection';
        html += '<div class="calendar-event" data-id="' + s.id + '" style="background:' + zoneColor.gradient + '">';
        if (timeStr) html += '<span class="event-time">' + timeStr + '</span>';
        html += '<span class="event-dot"></span>';
        html += '<span>' + escapeHtml(title) + '</span>';
        html += '</div>';
      });

      if (remaining > 0) {
        html += '<div class="calendar-event more">+' + remaining + ' more</div>';
      }
      html += '</div>';
    }

    html += '</div>';
  }

  const totalCells = firstDay + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    html += '<div class="calendar-day other-month"><span class="day-number">' + i + '</span></div>';
  }

  calendarGrid.innerHTML = html;
  attachCalendarListeners();

  const defaultDate = state.selectedDate || today;
  updateSidebarForDate(defaultDate);
}

function attachCalendarListeners() {
  $all('.calendar-day:not(.other-month)').forEach(el => {
    el.addEventListener('click', function (e) {
      if (e.target.closest('.calendar-event')) return;
      const dateStr = this.dataset.date;
      if (!dateStr) return;
      state.selectedDate = new Date(dateStr + 'T00:00:00');
      renderCalendar();
      // Only open modal if no schedules exist for this date
      const hasSchedules = state.schedules.some(s => s.collection_date.substring(0, 10) === dateStr);
      if (!hasSchedules) {
        // Block creating schedules for past dates
        if (isDatePast(dateStr)) {
          showToast('Cannot create schedules for past dates. Select today or a future date.', 'info');
          return;
        }
        openScheduleModalForDate(state.selectedDate);
      }
    });
  });

  $all('.calendar-event:not(.more)').forEach(el => {
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      const id = parseInt(this.dataset.id);
      if (!id) return;
      const schedule = state.schedules.find(s => s.id === id);
      if (schedule) {
        showScheduleInSidebar(schedule);
      }
    });
  });
}

// ---------- Sidebar: Route Map for the Whole Day ----------
function updateSidebarForDate(date) {
  const dateStr = formatDate(date);
  const daySchedules = state.schedules.filter(s => s.collection_date.substring(0, 10) === dateStr);
  state.selectedDateSchedules = daySchedules;
  renderSidebar(date, daySchedules);
}

function renderSidebar(date, schedules) {
  const dateFormatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (schedules.length > 0) {
    // Sort by time
    const sorted = [...schedules].sort((a, b) => {
      return (a.collection_time || '00:00').localeCompare(b.collection_time || '00:00');
    });
    showDayRouteMap(sorted, dateFormatted);
  } else {
    state.currentSchedule = null;
    dayActions.style.display = 'none';
    sidebarDetails.innerHTML = '<div class="sidebar-card"><div class="sidebar-card-header"><h3>Schedule Details</h3></div><div class="sidebar-card-body"><div class="empty-state" style="text-align:center;padding:20px 0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:#D1D5DB;margin-bottom:12px"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><p style="margin:0;color:var(--sc-text-secondary);font-size:14px">No schedules for <br><strong>' + dateFormatted + '</strong></p><p style="margin:8px 0 0;color:var(--sc-text-secondary);font-size:13px">Click on the date to add new routes.</p></div></div></div>';
    routePreviewMap.innerHTML = '<div style="height:160px;display:flex;align-items:center;justify-content:center;background:#F9FAFB;border-radius:var(--sc-radius-sm)"><p style="color:var(--sc-text-secondary);font-size:13px">No routes yet</p></div>';
    routePreviewInfo.innerHTML = '';
  }
}

function showDayRouteMap(schedules, dateFormatted) {
  state.currentSchedule = schedules[0];
  dayActions.style.display = 'flex';

  // Build schedule summary cards + route map
  let detailsHtml = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header"><h3>' + dateFormatted + '</h3></div>' +
    '<div class="sidebar-card-body" style="padding-top:12px">';

  // Bulk Status Update Bar
  detailsHtml += '<div class="bulk-status-bar">' +
    '<label class="bulk-status-label">Set all routes:</label>' +
    '<select class="bulk-status-select" id="bulk-status-select">' +
      '<option value="">Select status...</option>' +
      '<option value="Arriving">Arriving</option>' +
      '<option value="Arrived">Arrived</option>' +
      '<option value="Delayed">Delayed</option>' +
      '<option value="Completed">Completed</option>' +
      '<option value="Cancelled">Cancelled</option>' +
    '</select>' +
    '<button class="bulk-status-btn" onclick="bulkUpdateDayStatus()">Update All</button>' +
  '</div>';

  schedules.forEach(function(s, idx) {
    const zoneColor = ZONE_COLORS[s.zone] || ZONE_COLORS.default;
    const time12 = s.collection_time ? formatTime12(s.collection_time.substring(0, 5)) : '';
    const statusColors = {
      'Upcoming': { bg: '#EFF6FF', color: '#1E40AF' },
      'Arriving': { bg: '#FEF3C7', color: '#92400E' },
      'Arrived': { bg: '#F0FDF4', color: '#166534' },
      'Delayed': { bg: '#FEF2F2', color: '#991B1B' },
      'Completed': { bg: '#F0FDF4', color: '#15803D' },
      'Cancelled': { bg: '#F3F4F6', color: '#4B5563' }
    };
    const sc = statusColors[s.status] || statusColors.Upcoming;

    detailsHtml += '<div class="day-route-item" onclick="showScheduleInSidebar(state.selectedDateSchedules[' + idx + '])">' +
      '<div class="day-route-index" style="background:' + zoneColor.gradient + '">#' + (idx + 1) + '</div>' +
      '<div class="day-route-info">' +
        '<div class="day-route-barangay">' + escapeHtml(s.barangay) + '</div>' +
        '<div class="day-route-meta">' + time12 + ' \u00B7 ' + escapeHtml(s.zone || 'No zone') + ' \u00B7 ' + escapeHtml(s.assigned_personnel || '-') + '</div>' +
      '</div>' +
      '<span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';font-size:10px;padding:2px 8px">' + s.status + '</span>' +
      '<button class="day-route-delete-btn" onclick="event.stopPropagation();deleteDayRoute(' + s.id + ')" title="Delete this route">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button>' +
    '</div>';
  });

  // Reschedule All Section
  detailsHtml += '<div class="day-action-section reschedule-section">' +
    '<div class="day-action-header">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '<span>Move All Routes</span>' +
    '</div>' +
    '<div class="day-action-row">' +
      '<input type="date" class="day-action-input" id="reschedule-date-input" value="" min="' + formatDate(new Date()) + '">' +
      '<button class="day-action-btn move-btn" onclick="rescheduleAllRoutes()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg> Move All' +
      '</button>' +
    '</div>' +
  '</div>';

  detailsHtml += '</div></div>';
  sidebarDetails.innerHTML = detailsHtml;

  // Set default date for reschedule input to tomorrow
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var dateInput = $id('reschedule-date-input');
  if (dateInput) dateInput.value = formatDate(tomorrow);

  // Route map: show all stops for the day ordered by time
  const stops = schedules.map(function(s) { return s.barangay; });
  renderRouteMapSvg(stops, dateFormatted);
}

function deleteDayRoute(id) {
  const schedule = state.schedules.find(s => s.id === id);
  if (!schedule) return;
  
  const name = schedule.barangay;
  openDeleteModal(id, name);
}

function deleteAllDayRoutes() {
  const schedules = state.selectedDateSchedules;
  if (!schedules || schedules.length === 0) {
    showToast('No routes to delete.', 'info');
    return;
  }

  const dateFormatted = new Date(schedules[0].collection_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  if (!confirm('Delete all ' + schedules.length + ' route' + (schedules.length > 1 ? 's' : '') + ' for ' + dateFormatted + '?')) return;

  var deleted = 0;
  var promises = schedules.map(function(s) {
    return deleteSchedule(s.id).then(function(result) {
      if (result) deleted++;
    });
  });

  Promise.all(promises).then(function() {
    if (deleted > 0) {
      showToast(deleted + ' route' + (deleted > 1 ? 's' : '') + ' deleted from ' + dateFormatted + '!', 'success');
    }
    renderCalendar();
  });
}

function rescheduleAllRoutes() {
  const schedules = state.selectedDateSchedules;
  if (!schedules || schedules.length === 0) {
    showToast('No routes to move.', 'info');
    return;
  }

  const dateInput = $id('reschedule-date-input');
  const newDate = dateInput ? dateInput.value : '';

  if (!newDate) {
    showToast('Please select a target date.', 'info');
    return;
  }

  const oldDate = new Date(schedules[0].collection_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const targetDate = new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Block moving to past dates
  if (isDatePast(newDate)) {
    showToast('Cannot move routes to past dates. Select today or a future date.', 'info');
    return;
  }

  if (!confirm('Move all ' + schedules.length + ' route' + (schedules.length > 1 ? 's' : '') + ' from ' + oldDate + ' to ' + targetDate + '?')) return;

  const btn = document.querySelector('.move-btn');
  btn.disabled = true;
  btn.textContent = 'Moving...';

  var moved = 0;
  var promises = schedules.map(function(s) {
    return updateSchedule(s.id, { collection_date: newDate }, true).then(function(result) {
      if (result) moved++;
    });
  });

  Promise.all(promises).then(function() {
    btn.disabled = false;
    btn.textContent = 'Move All';
    if (moved > 0) {
      showToast(moved + ' route' + (moved > 1 ? 's' : '') + ' moved to ' + targetDate + '!', 'success');
    }
    renderCalendar();
  }).catch(function() {
    btn.disabled = false;
    btn.textContent = 'Move All';
  });
}

function bulkUpdateDayStatus() {
  const select = $id('bulk-status-select');
  const btn = document.querySelector('.bulk-status-btn');
  const newStatus = select.value;
  
  if (!newStatus) {
    showToast('Please select a status first.', 'info');
    return;
  }

  const schedules = state.selectedDateSchedules;
  if (!schedules || schedules.length === 0) {
    showToast('No routes to update.', 'info');
    return;
  }

  if (!confirm('Set all ' + schedules.length + ' route' + (schedules.length > 1 ? 's' : '') + ' to "' + newStatus + '"?')) return;

  btn.disabled = true;
  btn.textContent = 'Updating...';

  var updated = 0;
  var promises = schedules.map(function(s) {
    return updateSchedule(s.id, { status: newStatus }, true).then(function(result) {
      if (result) updated++;
    });
  });

  Promise.all(promises).then(function() {
    btn.disabled = false;
    btn.textContent = 'Update All';
    select.value = '';
    if (updated > 0) {
      showToast(updated + ' route' + (updated > 1 ? 's' : '') + ' updated to ' + newStatus + '!', 'success');
    }
    renderCalendar();
  }).catch(function() {
    btn.disabled = false;
    btn.textContent = 'Update All';
  });
}

function showScheduleInSidebar(schedule) {
  state.currentSchedule = schedule;
  dayActions.style.display = 'flex';

  const zoneColor = ZONE_COLORS[schedule.zone] || ZONE_COLORS.default;
  const time12 = schedule.collection_time ? formatTime12(schedule.collection_time.substring(0, 5)) : '';
  const dateFormatted = new Date(schedule.collection_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const statusColors = {
    'Upcoming': { bg: '#EFF6FF', color: '#1E40AF' },
    'Arriving': { bg: '#FEF3C7', color: '#92400E' },
    'Arrived': { bg: '#F0FDF4', color: '#166534' },
    'Delayed': { bg: '#FEF2F2', color: '#991B1B' },
    'Completed': { bg: '#F0FDF4', color: '#15803D' },
    'Cancelled': { bg: '#F3F4F6', color: '#4B5563' }
  };
  const sc = statusColors[schedule.status] || statusColors.Upcoming;

  var isPast = isDatePast(schedule.collection_date);
  var crewActions = isPast ?
    '<div class="crew-actions">' +
      '<button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button>' +
    '</div>' :
    '<div class="crew-actions">' +
      '<button class="crew-action-btn" onclick="openEditModal(' + schedule.id + ')" title="Edit">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '</button>' +
      '<button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button>' +
    '</div>';

  sidebarDetails.innerHTML = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header"><h3>Schedule Details</h3>' + crewActions + '</div>' +
    '<div class="sidebar-card-body">' +
      '<div class="details-status"><span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + '"><span class="status-dot" style="background:' + sc.color + '"></span>' + schedule.status + '</span></div>' +
      '<div class="details-grid">' +
        '<div class="detail-item"><span class="detail-label">Barangay</span><span class="detail-value" style="color:' + zoneColor.bg + '">' + escapeHtml(schedule.barangay) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Zone</span><span class="detail-value">' + escapeHtml(schedule.zone) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">' + dateFormatted + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Time</span><span class="detail-value">' + time12 + '</span></div>' +
        '<div class="detail-item full-width"><span class="detail-label">Personnel</span><span class="detail-value">' + escapeHtml(schedule.assigned_personnel || '-') + '</span></div>' +
      '</div>' +
      getStatusActions(schedule) +
      '<button class="btn btn-sm day-route-back-btn" onclick="updateSidebarForDate(new Date(state.selectedDate || state.today))">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to Day View' +
      '</button>' +
    '</div></div>';

  // Show single route on map
  renderRouteMapSvg([schedule.barangay], dateFormatted + ' - ' + time12);
}

// ---------- Route Map SVG (Right Sidebar) - Premium Map Style ----------
function renderRouteMapSvg(stops, label) {
  if (!stops || stops.length === 0) {
    routePreviewInfo.innerHTML = '';
    routePreviewMap.innerHTML = '<div class="route-map-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;color:#D1D5DB;margin-bottom:8px"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>' +
      '<p>No stops configured</p></div>';
    return;
  }

  routePreviewInfo.innerHTML = '<div class="route-preview-stat"><div class="stat-value" style="color:var(--sc-primary)">' + stops.length + '</div><div class="stat-label">Route' + (stops.length > 1 ? 's' : '') + '</div></div>' +
    (label ? '<div class="route-preview-stat" style="flex:1;min-width:0;text-align:left"><div class="stat-value" style="font-size:10px;color:var(--sc-text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(label) + '</div></div>' : '');

  var w = 280;
  var h = Math.max(160, stops.length * 58 + 40);

  // Calculate waypoints with alternating x for road feel
  var pts = [];
  var startY = 35;
  var gap = Math.min(54, (h - 60) / Math.max(1, stops.length - 1));

  stops.forEach(function(name, i) {
    var x = (i % 2 === 0) ? 58 : 72;
    if (stops.length > 2 && i > 0 && i < stops.length - 1) {
      x = (i % 2 === 0) ? 62 : 78;
    }
    pts.push({ x: x, y: startY + i * gap, name: name });
  });

  var svg = '';

  // DEFS
  svg += '<defs>';
  // Map gradient
  svg += '<linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#F8F6F0"/>' +
    '<stop offset="50%" stop-color="#F2EEE4"/>' +
    '<stop offset="100%" stop-color="#EAE4D6"/>' +
  '</linearGradient>';
  // Topo line pattern
  svg += '<pattern id="topo" width="40" height="40" patternUnits="userSpaceOnUse">' +
    '<path d="M0 20 Q10 15 20 20 T40 20" fill="none" stroke="rgba(139,92,246,0.04)" stroke-width="1"/>' +
    '<path d="M0 10 Q10 5 20 10 T40 10" fill="none" stroke="rgba(59,130,246,0.03)" stroke-width="0.8"/>' +
    '<path d="M0 30 Q10 25 20 30 T40 30" fill="none" stroke="rgba(22,163,74,0.03)" stroke-width="0.8"/>' +
  '</pattern>';
  // Pin shadow filter
  svg += '<filter id="pinShadow">' +
    '<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.2)"/>' +
  '</filter>';
  // Glow filter
  svg += '<filter id="glow">' +
    '<feGaussianBlur stdDeviation="3" result="blur"/>' +
    '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  '</filter>';
  // Compass
  svg += '<g id="compass">' +
    '<circle cx="0" cy="0" r="12" fill="rgba(255,255,255,0.95)" stroke="#E5E7EB" stroke-width="0.8"/>' +
    '<circle cx="0" cy="0" r="10" fill="none" stroke="#F3F4F6" stroke-width="0.5"/>' +
    '<polygon points="0,-8 -3,1 0,-1 3,1" fill="#EF4444"/>' +
    '<polygon points="0,8 -3,-1 0,1 3,-1" fill="#9CA3AF"/>' +
    '<text x="0" y="-12" text-anchor="middle" font-size="6.5" fill="#EF4444" font-weight="800" font-family="Arial, sans-serif">N</text>' +
  '</g>';
  svg += '</defs>';

  // Background
  svg += '<rect width="' + w + '" height="' + h + '" fill="url(#mapBg)" rx="12"/>';
  svg += '<rect width="' + w + '" height="' + h + '" fill="url(#topo)" rx="12"/>';

  // Subtle terrain blobs (greenery)
  var blobs = [
    { cx: 25, cy: 25, r: 50 }, { cx: 215, cy: 40, r: 45 },
    { cx: 240, cy: 75, r: 35 }, { cx: 30, cy: 95, r: 40 },
    { cx: 200, cy: 120, r: 38 }, { cx: 60, cy: 145, r: 42 }
  ];
  var blobColors = ['rgba(22,163,74,0.05)', 'rgba(59,130,246,0.04)', 'rgba(245,158,11,0.04)', 'rgba(139,92,246,0.03)', 'rgba(22,163,74,0.04)', 'rgba(59,130,246,0.03)'];
  blobs.forEach(function(b, i) {
    svg += '<circle cx="' + b.cx + '" cy="' + (b.cy % Math.max(h - 10, 1)) + '" r="' + b.r + '" fill="' + blobColors[i % 6] + '"/>';
  });

  // Road path (smooth curved)
  if (pts.length > 1) {
    var pathD = '';
    for (var p = 0; p < pts.length; p++) {
      if (p === 0) {
        pathD += 'M ' + pts[p].x + ' ' + pts[p].y;
      } else {
        var prev = pts[p - 1];
        var midY = (prev.y + pts[p].y) / 2;
        var cpx = (prev.x + pts[p].x) / 2 + (p % 2 === 0 ? 12 : -12);
        pathD += ' Q ' + cpx + ' ' + midY + ' ' + pts[p].x + ' ' + pts[p].y;
      }
    }
    // Road shadow
    svg += '<path d="' + pathD + '" stroke="rgba(0,0,0,0.07)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(1,1.5)"/>';
    // Road body (wider)
    svg += '<path d="' + pathD + '" stroke="#FDFDFD" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    // Road edge
    svg += '<path d="' + pathD + '" stroke="#E5E7EB" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>';
    // Center line (dashed)
    svg += '<path d="' + pathD + '" stroke="#F59E0B" stroke-width="1.8" stroke-dasharray="6 6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>';
  }

  // Map pin markers
  pts.forEach(function(p, i) {
    var isStart = i === 0;
    var isEnd = i === pts.length - 1;
    var color = isStart ? '#16A34A' : (isEnd ? '#EF4444' : '#3B82F6');
    var colorLight = isStart ? '#DCFCE7' : (isEnd ? '#FEE2E2' : '#DBEAFE');

    // Pin shadow
    svg += '<ellipse cx="' + p.x + '" cy="' + (p.y + 14) + '" rx="7" ry="3.5" fill="rgba(0,0,0,0.15)"/>';

    // Pin body (teardrop shape)
    svg += '<g filter="url(#pinShadow)">';
    svg += '<path d="M' + p.x + ',' + (p.y - 12) + ' C' + (p.x - 9) + ',' + (p.y - 12) + ' ' + (p.x - 13) + ',' + (p.y - 5) + ' ' + (p.x - 13) + ',' + (p.y + 1) + ' C' + (p.x - 13) + ',' + (p.y + 6) + ' ' + (p.x - 3) + ',' + (p.y + 12) + ' ' + p.x + ',' + (p.y + 14) + ' C' + (p.x + 3) + ',' + (p.y + 12) + ' ' + (p.x + 13) + ',' + (p.y + 6) + ' ' + (p.x + 13) + ',' + (p.y + 1) + ' C' + (p.x + 13) + ',' + (p.y - 5) + ' ' + (p.x + 9) + ',' + (p.y - 12) + ' ' + p.x + ',' + (p.y - 12) + 'Z" fill="#fff" stroke="' + color + '" stroke-width="2"/>';
    // Inner dot
    svg += '<circle cx="' + p.x + '" cy="' + (p.y) + '" r="6" fill="' + color + '"/>';
    // Number
    svg += '<text x="' + p.x + '" y="' + (p.y + 3) + '" text-anchor="middle" font-size="8" fill="#fff" font-weight="800" font-family="Arial, sans-serif">' + (i + 1) + '</text>';
    svg += '</g>';

    // Label card
    var name = p.name.length > 18 ? p.name.substring(0, 16) + '...' : p.name;
    var labelW = Math.min(175, Math.max(name.length * 7 + 28, 65));

    svg += '<g filter="url(#pinShadow)">';
    svg += '<rect x="' + (p.x + 16) + '" y="' + (p.y - 12) + '" width="' + labelW + '" height="28" rx="7" fill="rgba(255,255,255,0.96)" stroke="' + color + '" stroke-width="1" opacity="0.95"/>';
    // Left accent bar
    svg += '<rect x="' + (p.x + 16) + '" y="' + (p.y - 12) + '" width="4" height="28" rx="2" fill="' + color + '" opacity="0.8"/>';
    // Name text
    svg += '<text x="' + (p.x + 24) + '" y="' + (p.y + 2) + '" font-size="11" fill="#1E293B" font-weight="700" font-family="Arial, sans-serif">' + escapeHtml(name) + '</text>';
    // Badge
    var badge = isStart ? 'START' : (isEnd ? 'END' : 'STOP ' + (i + 1));
    svg += '<text x="' + (p.x + 24) + '" y="' + (p.y + 13) + '" font-size="7.5" fill="' + color + '" font-weight="800" font-family="Arial, sans-serif" letter-spacing="0.5">' + badge + '</text>';
    svg += '</g>';
  });

  // Compass (top-right)
  svg += '<use href="#compass" x="' + (w - 22) + '" y="22"/>';

  // Route badge (top-left)
  svg += '<g filter="url(#pinShadow)">';
  svg += '<rect x="10" y="12" rx="6" width="80" height="22" fill="rgba(255,255,255,0.92)" stroke="#E5E7EB" stroke-width="0.5"/>';
  svg += '<circle cx="20" cy="23" r="6" fill="var(--sc-primary)"/>';
  svg += '<text x="20" y="27" text-anchor="middle" font-size="8" fill="#fff" font-weight="800">' + stops.length + '</text>';
  svg += '<text x="32" y="26" font-size="10" fill="#4B5563" font-weight="600" font-family="Arial, sans-serif">' + (stops.length > 1 ? 'stops' : 'stop') + '</text>';
  svg += '</g>';

  routePreviewMap.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:8px;overflow:hidden">' + svg + '</svg>';
}

// ---------- Status Actions ----------
function getStatusActions(schedule) {
  var status = schedule.status;
  var id = schedule.id;
  var buttons = '';
  
  if (status === 'Upcoming') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF3C7;color:#92400E;border:none" onclick="quickUpdateStatus(' + id + ',\'Arriving\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Mark Arriving' +
      '</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF2F2;color:#991B1B;border:none" onclick="quickUpdateStatus(' + id + ',\'Cancelled\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel' +
      '</button>' +
    '</div>';
  } else if (status === 'Arriving') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#F0FDF4;color:#166534;border:none" onclick="quickUpdateStatus(' + id + ',\'Arrived\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Mark Arrived' +
      '</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF3C7;color:#92400E;border:none" onclick="quickUpdateStatus(' + id + ',\'Delayed\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Delayed' +
      '</button>' +
    '</div>';
  } else if (status === 'Arrived') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;border:none;font-weight:700" onclick="quickUpdateStatus(' + id + ',\'Completed\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Mark Completed' +
      '</button>' +
    '</div>';
  } else if (status === 'Delayed') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#F0FDF4;color:#166534;border:none" onclick="quickUpdateStatus(' + id + ',\'Arrived\')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Arrived' +
      '</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#EFF6FF;color:#1E40AF;border:none" onclick="openEditModal(' + id + ')">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Reschedule' +
      '</button>' +
    '</div>';
  }
  
  return buttons;
}

function quickUpdateStatus(id, newStatus) {
  updateSchedule(id, { status: newStatus }).then(function () {
    renderCalendar();
  });
}

// =====================================================================
// MODAL: Multi-Route Entry System
// =====================================================================

function openScheduleModalForDate(date) {
  state.editingId = null;
  state.routeEntries = [createEmptyRoute(formatDate(date))];

  modalTitle.textContent = 'New Routes';
  modalSaveText.textContent = 'Save All Routes';
  scheduleForm.reset();
  fId.value = '';
  fDate.value = formatDate(date);

  const dateObj = new Date(date);
  modalDateLabel.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

  renderRouteEntries();
  modalOverlay.classList.add('active');
}

function openEditModal(id) {
  const s = state.schedules.find(sch => sch.id === id);
  if (!s) return;
  
  // Block editing schedules for past dates
  if (isDatePast(s.collection_date)) {
    showToast('Cannot edit schedules for past dates.', 'info');
    return;
  }
  
  // For editing a single schedule, show just that one
  state.editingId = id;
  state.routeEntries = [{
    time: s.collection_time ? s.collection_time.substring(0, 5) : '07:00',
    barangay: s.barangay,
    zone: s.zone || '',
    personnel: s.assigned_personnel || '',
    status: s.status || 'Upcoming'
  }];

  modalTitle.textContent = 'Edit Route';
  modalSaveText.textContent = 'Update Route';
  scheduleForm.reset();
  fId.value = s.id;
  fDate.value = s.collection_date.substring(0, 10);

  const dateObj = new Date(s.collection_date + 'T00:00:00');
  modalDateLabel.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

  renderRouteEntries();
  modalOverlay.classList.add('active');
}

function createEmptyRoute(dateStr) {
  return {
    time: '07:00',
    barangay: '',
    zone: '',
    personnel: '',
    status: getAutoStatus(dateStr || formatDate(new Date()))
  };
}

function renderRouteEntries() {
  const entries = state.routeEntries;
  let html = '';

  entries.forEach(function(entry, i) {
    const timeOptions = [];
    for (let h = 6; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = pad(h) + ':' + pad(m);
        const sel = entry.time === val ? ' selected' : '';
        const label12 = formatTime12(val);
        timeOptions.push('<option value="' + val + '"' + sel + '>' + label12 + '</option>');
      }
    }

    html += '<div class="route-entry" data-index="' + i + '">' +
      '<div class="route-entry-header">' +
        '<div class="route-entry-number">' +
          '<span class="route-entry-badge" style="background:' + (i === 0 ? 'linear-gradient(135deg,#16A34A,#15803D)' : 'linear-gradient(135deg,#3B82F6,#2563EB)') + '">Route #' + (i + 1) + '</span>' +
          '<span class="route-entry-time-display">' + (entry.time ? formatTime12(entry.time) : 'Set time') + '</span>' +
        '</div>' +
        (entries.length > 1 ? '<button type="button" class="route-entry-remove" onclick="removeRouteEntry(' + i + ')" title="Remove this route">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          ' Remove' +
        '</button>' : '') +
      '</div>' +
      '<div class="route-entry-grid">' +
        '<div class="re-field">' +
          '<label class="re-label">Collection Time <span class="required">*</span></label>' +
          '<select class="re-select re-time" data-index="' + i + '">' + timeOptions.join('') + '</select>' +
        '</div>' +
        '<div class="re-field">' +
          '<label class="re-label">Barangay <span class="required">*</span></label>' +
          '<select class="re-select re-barangay" data-index="' + i + '">' +
            '<option value="">Select Barangay...</option>' +
            BARANGAYS.map(function(b) {
              return '<option value="' + b + '"' + (entry.barangay === b ? ' selected' : '') + '>' + b + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="re-field">' +
          '<label class="re-label">Zone</label>' +
          '<select class="re-select re-zone" data-index="' + i + '">' +
            '<option value="">Select Zone...</option>' +
            ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'].map(function(z) {
              return '<option value="' + z + '"' + (entry.zone === z ? ' selected' : '') + '>' + z + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="re-field">' +
          '<label class="re-label">Assigned Personnel</label>' +
          '<input type="text" class="re-input re-personnel" data-index="' + i + '" placeholder="e.g. Juan Dela Cruz" value="' + escapeHtml(entry.personnel) + '">' +
        '</div>' +
      '</div>' +
    '</div>';
  });

  routeEntriesContainer.innerHTML = html;
  updateFooterSummary();

  // Attach change listeners to update state
  $all('.route-entry-grid').forEach(function(grid) {
    grid.addEventListener('change', function(e) {
      const target = e.target;
      if (target.classList.contains('re-time') || target.classList.contains('re-barangay') ||
          target.classList.contains('re-zone')) {
        syncRouteEntry(target);
      }
    });
    grid.addEventListener('input', function(e) {
      const target = e.target;
      if (target.classList.contains('re-personnel')) {
        syncRouteEntry(target);
      }
    });
  });
}

function syncRouteEntry(el) {
  const idx = parseInt(el.dataset.index);
  if (isNaN(idx) || !state.routeEntries[idx]) return;

  const entry = state.routeEntries[idx];
  const grid = el.closest('.route-entry-grid');
  if (!grid) return;

  entry.time = grid.querySelector('.re-time').value;
  entry.barangay = grid.querySelector('.re-barangay').value;
  entry.zone = grid.querySelector('.re-zone').value;
  entry.personnel = grid.querySelector('.re-personnel').value;
  // Update time display
  const header = el.closest('.route-entry');
  if (header) {
    const disp = header.querySelector('.route-entry-time-display');
    if (disp) disp.textContent = entry.time ? formatTime12(entry.time) : 'Set time';
  }

  updateFooterSummary();
}

function updateFooterSummary() {
  const entries = state.routeEntries;
  const valid = entries.filter(function(e) { return e.barangay && e.time; });
  modalFooterSummary.innerHTML = 
    '<span class="footer-routes-count">' + entries.length + ' route' + (entries.length !== 1 ? 's' : '') + '</span>' +
    '<span class="footer-routes-valid">' + valid.length + ' ready to save</span>';
}

function addRouteEntry() {
  var currentDate = fDate.value || formatDate(new Date());
  state.routeEntries.push(createEmptyRoute(currentDate));
  renderRouteEntries();
  // Scroll to bottom
  setTimeout(function() {
    routeEntriesContainer.scrollTop = routeEntriesContainer.scrollHeight;
  }, 50);
}

function removeRouteEntry(index) {
  if (state.routeEntries.length <= 1) {
    showToast('You need at least one route.', 'info');
    return;
  }
  state.routeEntries.splice(index, 1);
  renderRouteEntries();
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

function openDeleteModal(id, name) {
  state.deletingId = id;
  deleteText.innerHTML = 'Are you sure you want to delete the schedule for <strong>' + escapeHtml(name) + '</strong>?';
  deleteOverlay.classList.add('active');
}

function closeDeleteModal() {
  deleteOverlay.classList.remove('active');
  state.deletingId = null;
}

// ---------- Save: Create multiple schedules ----------
async function handleSaveSchedule() {
  // Sync all entries from DOM first
  syncAllEntries();

  const entries = state.routeEntries;
  const date = fDate.value;

  // Validate date is not in the past
  if (isDatePast(date)) {
    showToast('Cannot save schedules for past dates.', 'error');
    return;
  }

  // Validate entries
  var hasErrors = false;
  entries.forEach(function(entry, i) {
    if (!entry.time) { showToast('Route #' + (i + 1) + ': Please select a time.', 'error'); hasErrors = true; }
    if (!entry.barangay) { showToast('Route #' + (i + 1) + ': Please select a barangay.', 'error'); hasErrors = true; }
  });
  if (hasErrors) return;

  modalSaveBtn.disabled = true;
  modalSaveText.textContent = state.editingId ? 'Updating...' : 'Saving ' + entries.length + ' route' + (entries.length > 1 ? 's' : '') + '...';

  let success = true;

  if (state.editingId) {
    // Update single schedule
    const entry = entries[0];
    const data = {
      barangay: entry.barangay,
      zone: entry.zone || '',
      collection_date: date,
      collection_time: entry.time + ':00',
      assigned_personnel: entry.personnel || '',
      status: entry.status || 'Upcoming'
    };
    const result = await updateSchedule(state.editingId, data);
    if (!result) success = false;
  } else {
    // Create multiple schedules
    var created = 0;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var data = {
        barangay: entry.barangay,
        zone: entry.zone || '',
        collection_date: date,
        collection_time: entry.time + ':00',
        assigned_personnel: entry.personnel || '',
        status: entry.status || 'Upcoming'
      };
      var result = await createSchedule(data);
      if (result) {
        created++;
      } else {
        success = false;
        break;
      }
    }
    if (created > 0) {
      showToast(created + ' route' + (created > 1 ? 's' : '') + ' created successfully!', 'success');
    }
  }

  modalSaveBtn.disabled = false;
  modalSaveText.textContent = state.editingId ? 'Update Route' : 'Save All Routes';

  if (success) {
    closeModal();
    await renderCalendar();
  }
}

function syncAllEntries() {
  const grids = $all('.route-entry-grid');
  grids.forEach(function(grid) {
    const timeEl = grid.querySelector('.re-time');
    if (timeEl) syncRouteEntry(timeEl);
  });
}

// ---------- Delete ----------
async function handleDelete() {
  if (!state.deletingId) return;
  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.innerHTML = 'Deleting...';

  const success = await deleteSchedule(state.deletingId);

  deleteConfirmBtn.disabled = false;
  deleteConfirmBtn.innerHTML = 'Delete';

  if (success) {
    closeDeleteModal();
    await renderCalendar();
  }
}

// ---------- Init ----------
async function init() {
  if (!checkAuth()) return;

  try {
    const res = await fetch(API_BASE + '/api/auth/me', { headers: getHeaders() });
    if (res.ok) {
      const user = await res.json();
      $id('user-name').textContent = user.fullname || 'Admin';
      const r = (user.role || 'admin');
      $id('user-role').textContent = r.charAt(0).toUpperCase() + r.slice(1);
    }
  } catch (e) {
    $id('user-name').textContent = 'Admin';
    $id('user-role').textContent = 'Administrator';
  }

  await renderCalendar();
}

// ---------- Event Listeners ----------
$id('prev-month').addEventListener('click', async () => {
  state.currentMonth--;
  if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
  await renderCalendar();
});

$id('next-month').addEventListener('click', async () => {
  state.currentMonth++;
  if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
  await renderCalendar();
});

$id('today-btn').addEventListener('click', async () => {
  const now = new Date();
  state.currentMonth = now.getMonth();
  state.currentYear = now.getFullYear();
  state.selectedDate = now;
  await renderCalendar();
});

// Modal events
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSaveBtn.addEventListener('click', handleSaveSchedule);

// Add Route button
addRouteBtn.addEventListener('click', addRouteEntry);

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) closeModal();
    if (deleteOverlay.classList.contains('active')) closeDeleteModal();
  }
});

// Delete All Routes button
if (deleteAllRoutesBtn) {
  deleteAllRoutesBtn.addEventListener('click', function () {
    deleteAllDayRoutes();
  });
}

// Delete modal
deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteConfirmBtn.addEventListener('click', handleDelete);
deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) closeDeleteModal(); });

// Logout
$id('logout-btn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

// Start
init();
