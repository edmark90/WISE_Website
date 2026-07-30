/**
 * WISE System - Schedule Management Module
 * Multi-route entry system with route timeline diagram.
 */

const API_BASE = 'http://127.0.0.1:8000';
const $id = (id) => document.getElementById(id);
const $all = (sel) => document.querySelectorAll(sel);

// Barangays of Muntinlupa City
const BARANGAYS = [
  'Alabang', 'Bayanan', 'Buli', 'Cupang',
  'New Alabang Village', 'Poblacion', 'Putatan', 'Sucat', 'Tunasan'
];

// Barangay streets/zones
const BARANGAY_STREETS = {
  'Alabang': [
    'Alabang Public Market', 'Muntinlupa City Public Market', 'Filinvest Covered Court',
    'Festival Mall', 'Asian Hospital and Medical Center', 'Alabang Town Center',
    'Filinvest City Central Park', 'Northgate Cyberzone', 'South Station',
    'St. Jerome Emiliani and Sta. Susana Parish'
  ],
  'New Alabang Village': [
    'New Alabang Village (Ayala Alabang)', 'Ayala Alabang Barangay Hall',
    'Alabang Country Club', 'The Palms Country Club', 'San James the Great Parish',
    'Molito Lifestyle Center', 'Madrigal Avenue', 'Acacia Avenue',
    'Molave Street', 'Narra Street', 'Yakal Street'
  ],
  'Bayanan': [
    'Bayanan Barangay Hall', 'Bayanan Public Market', 'Bayanan Covered Court',
    'Bayanan Health Center', 'Bayanan Elementary School', 'Bayanan National High School',
    'National Road', 'Bayanan Road', 'San Guillermo Chapel', 'Bayanan Multi-Purpose Hall'
  ],
  'Buli': [
    'Buli Barangay Hall', 'Buli Covered Court', 'Buli Health Center',
    'Buli Elementary School', 'Marina Road', 'Buli Road', 'East Service Road',
    'Lakefront Area', 'Buli Multi-Purpose Hall', 'Buli Concepcion Road'
  ],
  'Cupang': [
    'Barangay Cupang Hall (NEW)', 'Old Barangay Cupang Hall',
    'Barangay Cupang Multi-Purpose Hall', 'Cupang Covered Court',
    'Cupang Elementary School', 'Cupang Health Center', 'Soldiers Hills Road',
    'Daang Hari Road', 'East Service Road', 'Posadas Open Area'
  ],
  'Poblacion': [
    'Barangay Poblacion Hall', 'Muntinlupa Central Market',
    'Southville 3 Covered Court', 'KVHAI Covered Court', 'Covered Court',
    'Muntinlupa City Hall', 'Medical Center Muntinlupa', 'National Road',
    'Rizal Street', 'Katarungan Road'
  ],
  'Putatan': [
    'Barangay Putatan Barangay Hall', 'Mutual Homes 1&2 Covered Court',
    'SMB Hills Covered Court', 'Puregold Putatan', 'Savemore Putatan',
    'Pedro Diaz Street', 'Country Homes Avenue', 'Putatan Health Center',
    'Putatan Elementary School', 'National Road'
  ],
  'Sucat': [
    'Sucat Barangay Hall', 'Sucat Multi-Purpose Covered Court',
    'Bagong Silang Plaza Covered Court', 'Sitio Pagkakaisa Covered Court',
    'Lakefront Open Area', 'Dr. A. Santos Avenue', 'East Service Road',
    'West Service Road', 'Sucat Health Center', 'Sucat Elementary School'
  ],
  'Tunasan': [
    'Tunasan Barangay Hall', 'Tunasan Covered Court', 'Covered Court',
    "Tunasan People's Market", 'Tunasan Health Center', 'Tunasan Elementary School',
    'National Road', 'Rodriguez Street', 'Buendia Street', 'Golden Gate Park Homes'
  ]
};

// Colors per barangay
const BARANGAY_COLORS = {
  'Alabang':           { bg: '#16A34A', gradient: 'linear-gradient(135deg, #16A34A, #15803D)' },
  'Bayanan':           { bg: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  'Buli':              { bg: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  'Cupang':            { bg: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)' },
  'New Alabang Village': { bg: '#0EA5E9', gradient: 'linear-gradient(135deg, #0EA5E9, #0284C7)' },
  'Poblacion':         { bg: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  'Putatan':           { bg: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
  'Sucat':             { bg: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  'Tunasan':           { bg: '#14B8A6', gradient: 'linear-gradient(135deg, #14B8A6, #0D9488)' },
  default:             { bg: '#6B7280', gradient: 'linear-gradient(135deg, #6B7280, #4B5563)' }
};

// Allowed statuses
const STATUSES = ['Upcoming', 'Arriving', 'Arrived', 'Delayed', 'Completed', 'Cancelled'];

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
const routePreviewMap = $id('route-preview-map');
const routePreviewInfo = $id('route-preview-info');
const toastContainer = $id('toast-container');

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
const deleteAllRoutesBtn = $id('delete-all-routes-btn');

// ---------- Auth ----------
function getHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}
function checkAuth() {
  if (!localStorage.getItem('access_token')) { window.location.href = 'index.html'; return false; }
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

// ---------- Helpers ----------
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function timeToMinutes(t) {
  if (!t) return -1;
  var p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}
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

// ---------- Auto Status ----------
function getAutoStatus(dateStr, currentStatus) {
  if (currentStatus === 'Cancelled' || currentStatus === 'Delayed') return currentStatus;
  if (currentStatus === 'Completed' || currentStatus === 'Arrived') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
    if (currentStatus === 'Arrived' && schedDate.toDateString() === today.toDateString()) return 'Arrived';
    if (currentStatus === 'Completed' && schedDate < today) return 'Completed';
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  if (schedDate < today) return 'Completed';
  else if (schedDate.toDateString() === today.toDateString()) return 'Arriving';
  else return 'Upcoming';
}

// ---------- API ----------
async function fetchSchedulesByMonth(year, month) {
  const startDate = year + '-' + pad(month + 1) + '-01';
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = year + '-' + pad(month + 1) + '-' + lastDay;
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/by-date-range/?start_date=' + startDate + '&end_date=' + endDate, { headers: getHeaders() });
    if (res.status === 401) { logout(); return []; }
    if (!res.ok) return [];
    return await res.json();
  } catch (err) { console.error('Fetch schedules error:', err); return []; }
}
async function createSchedule(data) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/', { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to create schedule', 'error'); return null; }
    return await res.json();
  } catch (err) { showToast('Connection error.', 'error'); return null; }
}
async function updateSchedule(id, data, silent) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/' + id, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to update schedule', 'error'); return null; }
    if (!silent) showToast('Schedule updated!', 'success');
    return await res.json();
  } catch (err) { showToast('Connection error.', 'error'); return null; }
}
async function deleteSchedule(id) {
  try {
    const res = await fetch(API_BASE + '/api/collection-schedules/' + id, { method: 'DELETE', headers: getHeaders() });
    if (res.status === 401) { logout(); return false; }
    if (!res.ok) { showToast('Failed to delete.', 'error'); return false; }
    showToast('Schedule deleted.', 'success');
    return true;
  } catch (err) { showToast('Connection error.', 'error'); return false; }
}

// ---------- Calendar ----------
async function renderCalendar() {
  const year = state.currentYear;
  const month = state.currentMonth;
  const today = state.today;
  calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var fetched = await fetchSchedulesByMonth(year, month);
  state.schedules = fetched.map(function(s) {
    var autoStatus = getAutoStatus(s.collection_date, s.status);
    if (autoStatus !== s.status) updateSchedule(s.id, { status: autoStatus }, true);
    s.status = autoStatus;
    return s;
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const scheduleMap = {};
  state.schedules.forEach(s => {
    const key = s.collection_date.substring(0, 10);
    if (!scheduleMap[key]) scheduleMap[key] = [];
    scheduleMap[key].push(s);
  });
  let html = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { html += '<div class="calendar-day-header">' + d + '</div>'; });
  for (let i = firstDay - 1; i >= 0; i--) html += '<div class="calendar-day other-month"><span class="day-number">' + (daysInPrevMonth - i) + '</span></div>';
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
        const bColor = BARANGAY_COLORS[s.barangay] || BARANGAY_COLORS.default;
        const timeStr = s.collection_time ? formatTime12(s.collection_time.substring(0, 5)) : '';
        const title = s.barangay || 'Collection';
        html += '<div class="calendar-event" data-id="' + s.id + '" style="background:' + bColor.gradient + '">';
        if (timeStr) html += '<span class="event-time">' + timeStr + '</span>';
        html += '<span class="event-dot"></span><span>' + escapeHtml(title) + '</span></div>';
      });
      if (remaining > 0) html += '<div class="calendar-event more">+' + remaining + ' more</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  const totalCells = firstDay + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) html += '<div class="calendar-day other-month"><span class="day-number">' + i + '</span></div>';
  calendarGrid.innerHTML = html;
  attachCalendarListeners();
  updateSidebarForDate(state.selectedDate || today);
}

function attachCalendarListeners() {
  $all('.calendar-day:not(.other-month)').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.calendar-event')) return;
      const dateStr = this.dataset.date;
      if (!dateStr) return;
      state.selectedDate = new Date(dateStr + 'T00:00:00');
      renderCalendar();
      const hasSchedules = state.schedules.some(s => s.collection_date.substring(0, 10) === dateStr);
      if (!hasSchedules) {
        if (isDatePast(dateStr)) { showToast('Cannot create schedules for past dates.', 'info'); return; }
        openScheduleModalForDate(state.selectedDate);
      }
    });
  });
  $all('.calendar-event:not(.more)').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = parseInt(this.dataset.id);
      if (!id) return;
      const schedule = state.schedules.find(s => s.id === id);
      if (schedule) showScheduleInSidebar(schedule);
    });
  });
}

// ---------- Sidebar ----------
function updateSidebarForDate(date) {
  const dateStr = formatDate(date);
  const daySchedules = state.schedules.filter(s => s.collection_date.substring(0, 10) === dateStr);
  state.selectedDateSchedules = daySchedules;
  renderSidebar(date, daySchedules);
}

function renderSidebar(date, schedules) {
  const dateFormatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (schedules.length > 0) {
    const sorted = [...schedules].sort((a,b) => (a.collection_time||'00:00').localeCompare(b.collection_time||'00:00'));
    showDayRouteMap(sorted, dateFormatted);
  } else {
    state.currentSchedule = null;
    clearRouteDiagram();
    dayActions.style.display = 'none';
    sidebarDetails.innerHTML = '<div class="sidebar-card"><div class="sidebar-card-header"><h3>Schedule Details</h3></div><div class="sidebar-card-body"><div class="empty-state" style="text-align:center;padding:20px 0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:#D1D5DB;margin-bottom:12px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p style="margin:0;color:var(--sc-text-secondary);font-size:14px">No schedules for <br><strong>' + dateFormatted + '</strong></p><p style="margin:8px 0 0;color:var(--sc-text-secondary);font-size:13px">Click on the date to add new routes.</p></div></div></div>';
    routePreviewInfo.innerHTML = '';
  }
}

function clearRouteDiagram() {
  var emptyEl = document.getElementById('route-diagram-empty');
  var contentEl = document.getElementById('route-diagram-content');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
}

const STATUS_COLORS = {
  'Upcoming':   { bg: '#EFF6FF', color: '#1E40AF' },
  'Arriving':   { bg: '#FEF3C7', color: '#92400E' },
  'Arrived':    { bg: '#F0FDF4', color: '#166534' },
  'Delayed':    { bg: '#FEF2F2', color: '#991B1B' },
  'Completed':  { bg: '#F0FDF4', color: '#15803D' },
  'Cancelled':  { bg: '#F3F4F6', color: '#4B5563' }
};

function showDayRouteMap(schedules, dateFormatted) {
  state.currentSchedule = schedules[0];
  dayActions.style.display = 'flex';

  let detailsHtml = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header"><h3>' + dateFormatted + '</h3></div>' +
    '<div class="sidebar-card-body" style="padding-top:12px">';

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
    const bColor = BARANGAY_COLORS[s.barangay] || BARANGAY_COLORS.default;
    const time12 = s.collection_time ? formatTime12(s.collection_time.substring(0,5)) : '';
    const sc = STATUS_COLORS[s.status] || STATUS_COLORS.Upcoming;
    detailsHtml += '<div class="day-route-item" onclick="showScheduleInSidebar(state.selectedDateSchedules[' + idx + '])">' +
      '<div class="day-route-index" style="background:' + bColor.gradient + '">#' + (idx + 1) + '</div>' +
      '<div class="day-route-info">' +
        '<div class="day-route-barangay">' + escapeHtml(s.barangay) + '</div>' +
        '<div class="day-route-meta">' + time12 + ' \u00B7 ' + escapeHtml(s.zone || '-') + ' \u00B7 ' + escapeHtml(s.assigned_personnel || '-') + '</div>' +
      '</div>' +
      '<span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';font-size:10px;padding:2px 8px">' + s.status + '</span>' +
      '<button class="day-route-delete-btn" onclick="event.stopPropagation();deleteDayRoute(' + s.id + ')" title="Delete">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button></div>';
  });

  detailsHtml += '<div class="day-action-section reschedule-section">' +
    '<div class="day-action-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Move All Routes</span></div>' +
    '<div class="day-action-row">' +
      '<input type="date" class="day-action-input" id="reschedule-date-input" value="" min="' + formatDate(new Date()) + '">' +
      '<button class="day-action-btn move-btn" onclick="rescheduleAllRoutes()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg> Move All</button>' +
    '</div></div>';

  detailsHtml += '</div></div>';
  sidebarDetails.innerHTML = detailsHtml;

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var dateInput = $id('reschedule-date-input');
  if (dateInput) dateInput.value = formatDate(tomorrow);

  const stops = schedules.map(function(s) {
    return { id: s.id, barangay: s.barangay, zone: s.zone, collection_time: s.collection_time, assigned_personnel: s.assigned_personnel, status: s.status };
  });
  renderRouteDiagram(stops, dateFormatted);
}

// ---------- Route Diagram (Center Road Layout) ----------
function renderRouteDiagram(stops, label) {
  var emptyEl = document.getElementById('route-diagram-empty');
  var contentEl = document.getElementById('route-diagram-content');
  if (!contentEl || !emptyEl) return;

  if (!stops || stops.length === 0) {
    contentEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    routePreviewInfo.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';

  var totalStops = stops.length;
  routePreviewInfo.innerHTML =
    '<div class="route-preview-stat"><div class="stat-value" style="color:var(--sc-primary)">' + totalStops + '</div><div class="stat-label">Stop' + (totalStops > 1 ? 's' : '') + '</div></div>' +
    (label ? '<div class="route-preview-stat" style="flex:1;min-width:0;text-align:left"><div class="stat-value" style="font-size:10px;color:var(--sc-text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(label) + '</div></div>' : '') +
    '<div class="route-preview-stat route-direction-badge"><span class="direction-label">' + (totalStops > 1 ? stops[0].barangay + ' → ' + stops[totalStops-1].barangay : stops[0].barangay) + '</span></div>';

  var html = '<div class="route-journey" id="route-journey">';

  stops.forEach(function(s, idx) {
    var bgyName = s.barangay || s.name || '';
    var streetName = s.zone || s.street || '';
    var timeStr = s.collection_time ? formatTime12(s.collection_time.substring(0,5)) : s.time || '';
    var personnel = s.assigned_personnel || s.personnel || '';
    var status = s.status || 'Upcoming';
    var sc = STATUS_COLORS[status] || STATUS_COLORS.Upcoming;
    var bgyColor = BARANGAY_COLORS[bgyName] || BARANGAY_COLORS.default;
    var isFirst = idx === 0;
    var isLast = idx === stops.length - 1;
    var isLeft = idx % 2 === 0;
    var pinColor = bgyColor.bg;
    var sid = s.id != null ? s.id : '';

    var labelText = bgyName;
    if (isFirst) labelText += ' <span class="rs-badge start-badge">START</span>';
    if (isLast && totalStops > 1) labelText += ' <span class="rs-badge end-badge">END</span>';

    html += '<div class="route-stop" data-side="' + (isLeft ? 'left' : 'right') + '" data-sid="' + sid + '" onclick="onRouteStopClick(this)">';

    // Tooltip
    html += '<div class="rs-tooltip">';
    html += '<div class="rs-tooltip-title">' + escapeHtml(bgyName) + '</div>';
    html += '<span class="rs-tooltip-status status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';font-size:8px;padding:1px 6px">' + status + '</span>';
    if (timeStr) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + escapeHtml(timeStr) + '</div>';
    if (streetName) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + escapeHtml(streetName) + '</div>';
    if (personnel) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + escapeHtml(personnel) + '</div>';
    html += '</div>';

    // Left side (has content for left-side stops, empty for right-side)
    html += '<div class="rs-side left">';
    if (isLeft) {
      html += '<div class="rs-block">';
      html += '<div class="rs-card">';
      html += '<div class="rs-card-name">' + labelText + '</div>';
      if (timeStr) html += '<div class="rs-card-meta">' + escapeHtml(timeStr) + '</div>';
      html += '</div>';
      html += '<div class="rs-pin">';
      html += '<svg viewBox="0 0 24 36" width="22" height="28"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="' + pinColor + '"/><circle cx="12" cy="11" r="4" fill="#fff" opacity="0.85"/></svg>';
      html += '<span class="rs-pin-label">' + (isFirst ? 'S' : (isLast ? 'E' : (idx + 1))) + '</span>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Right side (empty for left-side stops, has content for right-side)
    html += '<div class="rs-side right">';
    if (!isLeft) {
      html += '<div class="rs-block">';
      html += '<div class="rs-pin">';
      html += '<svg viewBox="0 0 24 36" width="22" height="28"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="' + pinColor + '"/><circle cx="12" cy="11" r="4" fill="#fff" opacity="0.85"/></svg>';
      html += '<span class="rs-pin-label">' + (isFirst ? 'S' : (isLast ? 'E' : (idx + 1))) + '</span>';
      html += '</div>';
      html += '<div class="rs-card">';
      html += '<div class="rs-card-name">' + labelText + '</div>';
      if (timeStr) html += '<div class="rs-card-meta">' + escapeHtml(timeStr) + '</div>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
  });

  html += '</div>';
  contentEl.innerHTML = html;
  drawRouteRoad();
}

// ---------- SVG S-Curve Road ----------
function drawRouteRoad() {
  var contentEl = document.getElementById('route-diagram-content');
  var journeyEl = document.getElementById('route-journey');
  if (!contentEl || !journeyEl) return;

  var cH = contentEl.offsetHeight;
  var pRect = contentEl.getBoundingClientRect();
  var w = Math.max(pRect.width, 1);
  var h = Math.max(pRect.height, 1);

  var pinEls = journeyEl.querySelectorAll('.route-stop');
  var points = [];
  pinEls.forEach(function(el) {
    var pin = el.querySelector('.rs-pin');
    if (!pin) return;
    var r = pin.getBoundingClientRect();
    points.push({
      x: r.left - pRect.left + r.width / 2,
      y: r.top - pRect.top + r.height / 2
    });
  });

  if (points.length < 2) return;

  var pathD = 'M ' + points[0].x.toFixed(1) + ' ' + points[0].y.toFixed(1);

  for (var i = 1; i < points.length; i++) {
    var prev = points[i - 1];
    var curr = points[i];
    var dy = curr.y - prev.y;
    var midY = (prev.y + curr.y) / 2;
    pathD += ' C ' + prev.x.toFixed(1) + ' ' + (prev.y + dy * 0.4).toFixed(1) +
             ', ' + curr.x.toFixed(1) + ' ' + (curr.y - dy * 0.4).toFixed(1) +
             ', ' + curr.x.toFixed(1) + ' ' + curr.y.toFixed(1);
  }

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'route-road-svg');
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  var classes = ['route-road-bg', 'route-road-fill', 'route-road-center'];
  for (var ci = 0; ci < classes.length; ci++) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('class', classes[ci]);
    el.setAttribute('d', pathD);
    svg.appendChild(el);
  }

  var oldSvg = contentEl.querySelector('.route-road-svg');
  if (oldSvg) oldSvg.remove();
  contentEl.insertBefore(svg, journeyEl);
}

// ---------- Route Stop Click Handler ----------
function onRouteStopClick(el) {
  var sid = el.getAttribute('data-sid');
  if (!sid) return;
  var schedule = state.selectedDateSchedules.find(function(s) { return s.id == sid; });
  if (schedule) showScheduleInSidebar(schedule);
}

// ---------- Schedule Detail in Sidebar ----------
function showScheduleInSidebar(schedule) {
  state.currentSchedule = schedule;
  dayActions.style.display = 'flex';

  const bColor = BARANGAY_COLORS[schedule.barangay] || BARANGAY_COLORS.default;
  const time12 = schedule.collection_time ? formatTime12(schedule.collection_time.substring(0,5)) : '';
  const dateFormatted = new Date(schedule.collection_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const sc = STATUS_COLORS[schedule.status] || STATUS_COLORS.Upcoming;

  var isPast = isDatePast(schedule.collection_date);
  var crewActions = isPast
    ? '<div class="crew-actions"><button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>'
    : '<div class="crew-actions"><button class="crew-action-btn" onclick="openEditModal(' + schedule.id + ')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>';

  sidebarDetails.innerHTML = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header"><h3>Schedule Details</h3>' + crewActions + '</div>' +
    '<div class="sidebar-card-body">' +
      '<div class="details-status"><span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + '"><span class="status-dot" style="background:' + sc.color + '"></span>' + schedule.status + '</span></div>' +
      '<div class="details-grid">' +
        '<div class="detail-item"><span class="detail-label">Barangay</span><span class="detail-value" style="color:' + bColor.bg + '">' + escapeHtml(schedule.barangay) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Street</span><span class="detail-value">' + escapeHtml(schedule.zone || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">' + dateFormatted + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Time</span><span class="detail-value">' + time12 + '</span></div>' +
        '<div class="detail-item full-width"><span class="detail-label">Personnel</span><span class="detail-value">' + escapeHtml(schedule.assigned_personnel || '-') + '</span></div>' +
      '</div>' +
      getStatusActions(schedule) +
      '<button class="btn btn-sm day-route-back-btn" onclick="updateSidebarForDate(new Date(state.selectedDate || state.today))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to Day View</button>' +
    '</div></div>';

  renderRouteDiagram([{ barangay: schedule.barangay, zone: schedule.zone, collection_time: schedule.collection_time, assigned_personnel: schedule.assigned_personnel, status: schedule.status }], dateFormatted + ' - ' + time12);
}

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
  const btn = document.querySelector('.bulk-status-btn');
  const newStatus = sel.value;
  if (!newStatus) { showToast('Select a status first.', 'info'); return; }
  const scheds = state.selectedDateSchedules;
  if (!scheds || scheds.length === 0) { showToast('No routes to update.', 'info'); return; }
  if (!confirm('Set all ' + scheds.length + ' route' + (scheds.length > 1 ? 's' : '') + ' to "' + newStatus + '"?')) return;
  btn.disabled = true; btn.textContent = 'Updating...';
  var updated = 0;
  Promise.all(scheds.map(s => updateSchedule(s.id, { status: newStatus }, true).then(r => { if (r) updated++; })))
    .then(() => { btn.disabled = false; btn.textContent = 'Update All'; sel.value = ''; if (updated > 0) showToast(updated + ' route' + (updated > 1 ? 's' : '') + ' updated!', 'success'); renderCalendar(); })
    .catch(() => { btn.disabled = false; btn.textContent = 'Update All'; });
}

// ---------- Status Actions ----------
function getStatusActions(schedule) {
  var status = schedule.status;
  var id = schedule.id;
  var buttons = '';
  if (status === 'Upcoming') {
    buttons = '<div style="display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--sc-border)">' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF3C7;color:#92400E;border:none" onclick="quickUpdateStatus(' + id + ',\'Arriving\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Mark Arriving</button>' +
      '<button class="btn btn-sm" style="flex:1;background:#FEF2F2;color:#991B1B;border:none" onclick="quickUpdateStatus(' + id + ',\'Cancelled\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</button></div>';
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

// ---------- Modal ----------
function openScheduleModalForDate(date) {
  state.editingId = null;
  state.routeEntries = [createEmptyRoute(formatDate(date))];
  modalTitle.textContent = 'New Routes';
  modalSaveText.textContent = 'Save All Routes';
  scheduleForm.reset();
  fId.value = '';
  fDate.value = formatDate(date);
  modalDateLabel.textContent = new Date(date).toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });
  renderRouteEntries();
  modalOverlay.classList.add('active');
}
function openEditModal(id) {
  const s = state.schedules.find(sch => sch.id === id);
  if (!s) return;
  if (isDatePast(s.collection_date)) { showToast('Cannot edit past dates.', 'info'); return; }
  state.editingId = id;
  state.routeEntries = [{ time: s.collection_time ? s.collection_time.substring(0,5) : '07:00', barangay: s.barangay, zone: s.zone||'', personnel: s.assigned_personnel||'', status: s.status||'Upcoming' }];
  modalTitle.textContent = 'Edit Route';
  modalSaveText.textContent = 'Update Route';
  scheduleForm.reset();
  fId.value = s.id;
  fDate.value = s.collection_date.substring(0,10);
  modalDateLabel.textContent = new Date(s.collection_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });
  renderRouteEntries();
  modalOverlay.classList.add('active');
}
function createEmptyRoute(dateStr) {
  return { time: '07:00', barangay: '', zone: '', personnel: '', status: getAutoStatus(dateStr||formatDate(new Date())) };
}
function closeModal() { modalOverlay.classList.remove('active'); }

function renderRouteEntries() {
  const entries = state.routeEntries;
  let html = '';
  entries.forEach(function(entry, i) {
    // Calculate max time from all previous entries
    var prevMaxMins = -1;
    for (var j = 0; j < i; j++) {
      if (entries[j] && entries[j].time) {
        var m = timeToMinutes(entries[j].time);
        if (m > prevMaxMins) prevMaxMins = m;
      }
    }

    const timeOpts = [];
    for (let h = 6; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = pad(h) + ':' + pad(m);
        var valMins = timeToMinutes(val);
        var isDisabled = prevMaxMins >= 0 && valMins <= prevMaxMins;
        var isSelected = entry.time === val;
        // If current entry's time is now invalid, reset it
        if (isSelected && isDisabled) {
          entry.time = '';
          isSelected = false;
        }
        timeOpts.push('<option value="' + val + '"' + (isSelected ? ' selected' : '') + (isDisabled ? ' disabled' : '') + '>' + formatTime12(val) + '</option>');
      }
    }
    html += '<div class="route-entry" data-index="' + i + '">' +
      '<div class="route-entry-header">' +
        '<div class="route-entry-number"><span class="route-entry-badge" style="background:' + (i===0 ? 'linear-gradient(135deg,#16A34A,#15803D)' : 'linear-gradient(135deg,#3B82F6,#2563EB)') + '">Route #' + (i+1) + '</span>' +
        '<span class="route-entry-time-display">' + (entry.time ? formatTime12(entry.time) : 'Set time') + '</span></div>' +
        (entries.length > 1 ? '<button type="button" class="route-entry-remove" onclick="removeRouteEntry(' + i + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Remove</button>' : '') +
      '</div>' +
      '<div class="route-entry-grid">' +
        '<div class="re-field"><label class="re-label">Time <span class="required">*</span></label><select class="re-select re-time" data-index="' + i + '">' + timeOpts.join('') + '</select></div>' +
        '<div class="re-field"><label class="re-label">Barangay <span class="required">*</span></label><select class="re-select re-barangay" data-index="' + i + '">' +
          '<option value="">Select Barangay...</option>' +
          BARANGAYS.map(function(b) { return '<option value="' + b + '"' + (entry.barangay === b ? ' selected' : '') + '>' + b + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="re-field"><label class="re-label">Street / Zone</label><select class="re-select re-zone" data-index="' + i + '">' +
          '<option value="">Select Street...</option>' +
          (entry.barangay && BARANGAY_STREETS[entry.barangay]
            ? BARANGAY_STREETS[entry.barangay].map(function(st) { return '<option value="' + st + '"' + (entry.zone === st ? ' selected' : '') + '>' + st + '</option>'; }).join('')
            : '') +
        '</select></div>' +
        '<div class="re-field"><label class="re-label">Personnel</label><input type="text" class="re-input re-personnel" data-index="' + i + '" placeholder="e.g. Juan Dela Cruz" value="' + escapeHtml(entry.personnel) + '"></div>' +
      '</div></div>';
  });
  routeEntriesContainer.innerHTML = html;
  updateFooterSummary();
  // Attach change listeners
  $all('.route-entry-grid').forEach(function(grid) {
    grid.addEventListener('change', function(e) {
      const t = e.target;
      if (t.classList.contains('re-time') || t.classList.contains('re-barangay') || t.classList.contains('re-zone')) syncRouteEntry(t);
    });
    grid.addEventListener('input', function(e) { if (e.target.classList.contains('re-personnel')) syncRouteEntry(e.target); });
  });
}

function syncRouteEntry(el) {
  const idx = parseInt(el.dataset.index);
  if (isNaN(idx) || !state.routeEntries[idx]) return;
  const entry = state.routeEntries[idx];
  const grid = el.closest('.route-entry-grid');
  if (!grid) return;
  var oldBarangay = entry.barangay;
  entry.time = grid.querySelector('.re-time').value;
  entry.barangay = grid.querySelector('.re-barangay').value;
  entry.personnel = grid.querySelector('.re-personnel').value;

  // When barangay changes, dynamically update zone/street dropdown
  if (el.classList.contains('re-barangay') && entry.barangay !== oldBarangay) {
    entry.zone = '';
    var zoneSelect = grid.querySelector('.re-zone');
    if (zoneSelect) {
      var streets = BARANGAY_STREETS[entry.barangay] || [];
      zoneSelect.innerHTML = '<option value="">Select Street...</option>' +
        streets.map(function(st) { return '<option value="' + st + '">' + st + '</option>'; }).join('');
    }
  } else {
    entry.zone = grid.querySelector('.re-zone').value;
  }

  const header = el.closest('.route-entry');
  if (header) {
    const disp = header.querySelector('.route-entry-time-display');
    if (disp) disp.textContent = entry.time ? formatTime12(entry.time) : 'Set time';
  }
  updateFooterSummary();

  // When time changes, re-render all entries to enforce time ordering
  if (el.classList.contains('re-time')) {
    renderRouteEntries();
  }
}
function updateFooterSummary() {
  const entries = state.routeEntries;
  const valid = entries.filter(function(e) { return e.barangay && e.time; });
  modalFooterSummary.innerHTML = '<span class="footer-routes-count">' + entries.length + ' route' + (entries.length!==1?'s':'') + '</span>' +
    '<span class="footer-routes-valid">' + valid.length + ' ready</span>';
}
function addRouteEntry() {
  state.routeEntries.push(createEmptyRoute(fDate.value || formatDate(new Date())));
  renderRouteEntries();
  setTimeout(() => { routeEntriesContainer.scrollTop = routeEntriesContainer.scrollHeight; }, 50);
}
function removeRouteEntry(index) {
  if (state.routeEntries.length <= 1) { showToast('Need at least one route.', 'info'); return; }
  state.routeEntries.splice(index, 1);
  renderRouteEntries();
}
function openDeleteModal(id, name) {
  state.deletingId = id;
  deleteText.innerHTML = 'Delete schedule for <strong>' + escapeHtml(name) + '</strong>?';
  deleteOverlay.classList.add('active');
}
function closeDeleteModal() { deleteOverlay.classList.remove('active'); state.deletingId = null; }

async function handleSaveSchedule() {
  syncAllEntries();
  const entries = state.routeEntries;
  const date = fDate.value;
  if (isDatePast(date)) { showToast('Cannot save to past dates.', 'error'); return; }
  var hasErr = false;
  entries.forEach(function(e,i) {
    if (!e.time) { showToast('Route #'+(i+1)+': Select time.', 'error'); hasErr = true; }
    if (!e.barangay) { showToast('Route #'+(i+1)+': Select barangay.', 'error'); hasErr = true; }
  });
  if (hasErr) return;
  modalSaveBtn.disabled = true;
  modalSaveText.textContent = state.editingId ? 'Updating...' : 'Saving...';
  let ok = true;
  if (state.editingId) {
    const e = entries[0];
    ok = !!(await updateSchedule(state.editingId, { barangay: e.barangay, zone: e.zone||'', collection_date: date, collection_time: e.time+':00', assigned_personnel: e.personnel||'', status: e.status||'Upcoming' }));
  } else {
    var created = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var r = await createSchedule({ barangay: e.barangay, zone: e.zone||'', collection_date: date, collection_time: e.time+':00', assigned_personnel: e.personnel||'', status: e.status||'Upcoming' });
      if (r) created++; else { ok = false; break; }
    }
    if (created > 0) showToast(created + ' route' + (created>1?'s':'') + ' created!', 'success');
  }
  modalSaveBtn.disabled = false;
  modalSaveText.textContent = state.editingId ? 'Update Route' : 'Save All Routes';
  if (ok) { closeModal(); await renderCalendar(); }
}
function syncAllEntries() {
  $all('.route-entry-grid').forEach(function(grid) {
    const t = grid.querySelector('.re-time'); if (t) syncRouteEntry(t);
  });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', function() {
  if (!checkAuth()) return;
  $id('user-name').textContent = localStorage.getItem('user_name') || 'Admin User';
  $id('user-role').textContent = localStorage.getItem('user_role') || 'Administrator';
  $id('logout-btn').addEventListener('click', function(e) { e.preventDefault(); logout(); });
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
