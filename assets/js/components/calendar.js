/**
 * WISE System - Calendar Component
 * Renders the month grid with schedule events and handles day/event clicks.
 */

// ---------- Calendar ----------
function renderCalendar() {
  const year = state.currentYear;
  const month = state.currentMonth;
  const today = state.today;
  calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Draw the grid immediately so the UI appears without waiting for the network.
  drawCalendarGrid({});
  // Load schedules in the background, then redraw with events.
  fetchSchedulesByMonth(year, month).then(function (fetched) {
    state.schedules = fetched || [];
    drawCalendarGrid({});
    updateSidebarForDate(state.selectedDate || today);
  });
}

function drawCalendarGrid(scheduleMap) {
  const year = state.currentYear;
  const month = state.currentMonth;
  const today = state.today;
  if (!scheduleMap || Object.keys(scheduleMap).length === 0) {
    const map = {};
    const bFilter = (state.barangayFilter || '').toLowerCase();
    (state.schedules || []).forEach(s => {
      if (bFilter) {
        const matchMain = (s.barangay || '').toLowerCase() === bFilter;
        const matchStop = Array.isArray(s.stops) && s.stops.some(st => (st.barangay || '').toLowerCase() === bFilter);
        if (!matchMain && !matchStop) return;
      }
      const key = s.collection_date.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    scheduleMap = map;
  }
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  let html = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += '<div class="calendar-day-header"><span class="day-header-full">' + d + '</span><span class="day-header-short">' + d[0] + '</span></div>';
  });
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
    html += '<div class="' + classes + '" data-date="' + dateStr + '" role="button" tabindex="0" aria-label="' + escapeHtml(dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + (daySchedules.length ? ', ' + daySchedules.length + ' schedule' + (daySchedules.length > 1 ? 's' : '') : ', no schedules')) + '">';
    html += '<span class="day-number">' + d + '</span>';
    if (daySchedules.length > 0) {
      html += '<div class="calendar-events">';
      const shown = daySchedules.slice(0, 3);
      const remaining = daySchedules.length - 3;
      shown.forEach(s => {
        const bColor = BARANGAY_COLORS[s.barangay] || BARANGAY_COLORS.default;
        const timeStr = s.collection_time ? formatTime12(s.collection_time.substring(0, 5)) : '';
        const title = s.barangay || 'Collection';
        html += '<div class="calendar-event" data-id="' + s.id + '" style="background:' + bColor.gradient + '" title="' + escapeHtml((timeStr ? timeStr + ' · ' : '') + title) + '">';
        if (timeStr) html += '<span class="event-time">' + timeStr + '</span>';
        html += '<span class="event-dot"></span><span class="event-title">' + escapeHtml(title) + '</span></div>';
      });
      if (remaining > 0) html += '<div class="calendar-event more" data-more-date="' + dateStr + '" title="Show all ' + daySchedules.length + ' assignments">+' + remaining + ' more</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  const totalCells = firstDay + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) html += '<div class="calendar-day other-month"><span class="day-number">' + i + '</span></div>';
  calendarGrid.innerHTML = html;
  attachCalendarListeners();
}

function attachCalendarListeners() {
  function handleDayActivate(dateStr) {
    if (!dateStr) return;
    state.selectedDate = new Date(dateStr + 'T00:00:00');
    drawCalendarGrid({});
    updateSidebarForDate(state.selectedDate);
    const hasSchedules = state.schedules.some(s => s.collection_date.substring(0, 10) === dateStr);
    if (!hasSchedules) {
      if (isDatePast(dateStr)) { showToast('Cannot create schedules for past dates.', 'info'); return; }
      openScheduleModalForDate(state.selectedDate);
    } else if (window.innerWidth <= 1024) {
      setTimeout(function() {
        var sidebar = document.getElementById('sidebar-details') || document.getElementById('schedule-sidebar');
        if (sidebar) sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }

  $all('.calendar-day:not(.other-month)').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.calendar-event:not(.more)')) return;
      handleDayActivate(this.dataset.date);
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDayActivate(this.dataset.date);
      }
    });
  });

  $all('.calendar-event.more').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      handleDayActivate(this.dataset.moreDate);
    });
  });

  $all('.calendar-event:not(.more)').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = parseInt(this.dataset.id);
      if (!id) return;
      const schedule = state.schedules.find(s => s.id === id);
      if (schedule) {
        showScheduleInSidebar(schedule);
        if (window.innerWidth <= 1024) {
          setTimeout(function() {
            var sidebar = document.getElementById('sidebar-details') || document.getElementById('schedule-sidebar');
            if (sidebar) sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }
    });
  });
}
