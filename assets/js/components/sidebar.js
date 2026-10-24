/**
 * WISE System - Sidebar Component
 * Renders the day collection assignments list, truck & personnel allocations,
 * and single-assignment detail view.
 */

// ---------- Sidebar ----------
function getScheduleById(id) {
  for (var i = 0; i < state.schedules.length; i++) {
    if (state.schedules[i].id === id) return state.schedules[i];
  }
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
    const isPast = isDatePast(formatDate(date));
    const addBtn = isPast ? '' : '<button class="add-assignment-btn" style="margin-top:16px" onclick="openScheduleModalForDate(state.selectedDate || state.today)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Collection Assignment</button>';
    
    sidebarDetails.innerHTML = '<div class="sidebar-card">' +
      '<div class="sidebar-card-header"><h3>Schedule Details</h3></div>' +
      '<div class="sidebar-card-body">' +
        '<div class="empty-state" style="text-align:center;padding:20px 0">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:#D1D5DB;margin-bottom:12px">' +
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' +
          '</svg>' +
          '<p style="margin:0;color:var(--sc-text-secondary);font-size:14px">No assignments for <br><strong>' + dateFormatted + '</strong></p>' +
          '<p style="margin:8px 0 0;color:var(--sc-text-secondary);font-size:13px">Click below to add a collection assignment.</p>' +
          addBtn +
        '</div>' +
      '</div></div>';
    routePreviewInfo.innerHTML = '';
  }
}

function showDayRouteMap(schedules, dateFormatted) {
  state.currentSchedule = schedules[0];
  dayActions.style.display = 'flex';

  const isPast = isDatePast(schedules[0].collection_date);
  const addBtn = isPast ? '' : '<button class="add-assignment-btn" onclick="openScheduleModalForDate(new Date(state.selectedDate || schedules[0].collection_date))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Add Collection Assignment</button>';

  let detailsHtml = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header">' +
      '<div>' +
        '<h3>' + dateFormatted + '</h3>' +
      '</div>' +
      '<span class="day-assignments-count">' + schedules.length + ' Assignment' + (schedules.length > 1 ? 's' : '') + '</span>' +
    '</div>' +
    '<div class="sidebar-card-body" style="padding-top:14px">';

  detailsHtml += addBtn;

  schedules.forEach(function(s, idx) {
    const bColor = BARANGAY_COLORS[s.barangay] || BARANGAY_COLORS.default;
    const time12 = s.collection_time ? formatTime12(s.collection_time.substring(0,5)) : '';
    const sc = STATUS_COLORS[s.status] || STATUS_COLORS.Upcoming;
    const truckLabel = s.truck_number || 'Truck ' + pad(idx + 1);
    const routeLabel = s.route_name || (s.barangay + ' Route');
    const personnelLabel = s.assigned_personnel || 'Unassigned';

    var stopsList = (s.stops && s.stops.length > 0) ? s.stops : [{ barangay: s.barangay, street: s.zone || '', collection_time: s.collection_time }];
    var stopsPreviewHtml = '<div class="assignment-stops-preview">';
    stopsList.forEach(function(st, sidx) {
      var place = escapeHtml(st.barangay + (st.street ? ' \u2014 ' + st.street : ''));
      var stTime = st.collection_time ? formatTime12(st.collection_time.substring(0, 5)) : time12;
      stopsPreviewHtml += '<div class="assignment-stop-item">' +
        '<span class="stop-seq-dot">' + (sidx + 1) + '</span>' +
        '<span style="flex:1">' + place + '</span>' +
        (stTime ? '<span style="font-size:10px;font-weight:600;color:#2563EB;background:#EFF6FF;padding:1px 6px;border-radius:4px">' + stTime + '</span>' : '') +
      '</div>';
    });
    stopsPreviewHtml += '</div>';

    detailsHtml += '<div class="assignment-card" onclick="showScheduleInSidebar(getScheduleById(' + s.id + '))">' +
      '<div class="assignment-header-row">' +
        '<div class="assignment-title">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + bColor.bg + '"></span>' +
          '<span>' + escapeHtml(routeLabel) + '</span>' +
        '</div>' +
        '<div class="assignment-actions">' +
          '<span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';font-size:10px;padding:2px 7px">' + s.status + '</span>' +
          (!isPast ? '<button class="assignment-action-btn" onclick="event.stopPropagation();openEditModal(' + s.id + ')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' : '') +
          '<button class="assignment-action-btn danger" onclick="event.stopPropagation();deleteDayRoute(' + s.id + ')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="assignment-meta-row">' +
        '<span class="truck-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' + escapeHtml(truckLabel) + '</span>' +
        '<span class="personnel-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' + escapeHtml(personnelLabel) + '</span>' +
        '<span class="time-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + time12 + '</span>' +
      '</div>' +
      stopsPreviewHtml +
    '</div>';
  });

  detailsHtml += '<div class="bulk-status-bar" style="margin-top:14px">' +
    '<label class="bulk-status-label">Set all routes:</label>' +
    '<select class="bulk-status-select" id="bulk-status-select">' +
      '<option value="">Select status...</option>' +
      '<option value="Delayed">Delayed</option>' +
      '<option value="Cancelled">Cancelled</option>' +
    '</select>' +
    '<button class="bulk-status-btn" onclick="bulkUpdateDayStatus()">Update All</button>' +
  '</div>';

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

  renderRouteDiagram(schedules, dateFormatted);
}

// ---------- Schedule Detail in Sidebar ----------
function showScheduleInSidebar(schedule) {
  state.currentSchedule = schedule;
  dayActions.style.display = 'flex';

  const bColor = BARANGAY_COLORS[schedule.barangay] || BARANGAY_COLORS.default;
  const time12 = schedule.collection_time ? formatTime12(schedule.collection_time.substring(0,5)) : '';
  const dateFormatted = new Date(schedule.collection_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const sc = STATUS_COLORS[schedule.status] || STATUS_COLORS.Upcoming;
  const truckLabel = schedule.truck_number || 'Truck Assigned';
  const routeLabel = schedule.route_name || (schedule.barangay + ' Route');

  var isPast = isDatePast(schedule.collection_date);
  var crewActions = isPast
    ? '<div class="crew-actions"><button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>'
    : '<div class="crew-actions"><button class="crew-action-btn" onclick="openEditModal(' + schedule.id + ')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="crew-action-btn danger" onclick="openDeleteModal(' + schedule.id + ',\'' + escapeHtml(schedule.barangay) + '\')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>';

  sidebarDetails.innerHTML = '<div class="sidebar-card">' +
    '<div class="sidebar-card-header"><h3>' + escapeHtml(routeLabel) + '</h3>' + crewActions + '</div>' +
    '<div class="sidebar-card-body">' +
      '<div class="details-status"><span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + '"><span class="status-dot" style="background:' + sc.color + '"></span>' + schedule.status + '</span></div>' +
      '<div class="details-grid">' +
        '<div class="detail-item"><span class="detail-label">Truck</span><span class="detail-value" style="color:#1D4ED8;font-weight:700">' + escapeHtml(truckLabel) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Personnel</span><span class="detail-value" style="color:#6D28D9;font-weight:700">' + escapeHtml(schedule.assigned_personnel || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Barangay</span><span class="detail-value" style="color:' + bColor.bg + '">' + escapeHtml(schedule.barangay) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Street / Area</span><span class="detail-value">' + escapeHtml(schedule.zone || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">' + dateFormatted + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">Time</span><span class="detail-value">' + time12 + '</span></div>' +
        (schedule.remarks ? '<div class="detail-item full-width"><span class="detail-label">Remarks</span><span class="detail-value">' + escapeHtml(schedule.remarks) + '</span></div>' : '') +
      '</div>' +
      getStatusActions(schedule) +
      '<button class="btn btn-sm day-route-back-btn" onclick="updateSidebarForDate(new Date(state.selectedDate || state.today))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to All ' + dateFormatted + ' Assignments</button>' +
    '</div></div>';

  renderRouteDiagram([schedule], dateFormatted + ' \u00B7 ' + truckLabel);
}

