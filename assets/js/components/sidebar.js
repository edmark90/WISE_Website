/**
 * WISE System - Sidebar Component
 * Renders the day route list, bulk actions, and the single-schedule detail view.
 */

// ---------- Sidebar ----------
function getScheduleById(id) {
  for (var i = 0; i < state.schedules.length; i++) { if (state.schedules[i].id === id) return state.schedules[i]; }
  return null;
}

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
      '<option value="Delayed">Delayed</option>' +
      '<option value="Cancelled">Cancelled</option>' +
    '</select>' +
    '<button class="bulk-status-btn" onclick="bulkUpdateDayStatus()">Update All</button>' +
  '</div>';

  schedules.forEach(function(s, idx) {
    const bColor = BARANGAY_COLORS[s.barangay] || BARANGAY_COLORS.default;
    const time12 = s.collection_time ? formatTime12(s.collection_time.substring(0,5)) : '';
    const sc = STATUS_COLORS[s.status] || STATUS_COLORS.Upcoming;
    detailsHtml += '<div class="day-route-item" onclick="showScheduleInSidebar(getScheduleById(' + s.id + '))">' +
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
