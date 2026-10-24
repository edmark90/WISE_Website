/**
 * WISE System - Schedule Modal Component
 * Multi-assignment entry form: supports Truck selection, Personnel, Route Name,
 * Multiple Collection Stops per Route (ordered sequence with independent collection times),
 * and Remarks.
 */

// Standard truck fleet list
const TRUCK_FLEET = [
  'Truck 01', 'Truck 02', 'Truck 03', 'Truck 04', 'Truck 05',
  'Truck 06', 'Truck 07', 'Truck 08', 'Truck 09', 'Truck 10'
];

// Helper to generate 15-minute time options
function buildTimeOptions(selectedTime) {
  var opts = [];
  for (let h = 5; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = pad(h) + ':' + pad(m);
      const isSelected = selectedTime === val;
      opts.push('<option value="' + val + '"' + (isSelected ? ' selected' : '') + '>' + formatTime12(val) + '</option>');
    }
  }
  return opts.join('');
}

// ---------- Modal ----------
function openScheduleModalForDate(date) {
  state.editingId = null;
  state.routeEntries = [createEmptyRoute(formatDate(date))];
  modalTitle.textContent = 'Add Collection Assignment';
  modalSaveText.textContent = 'Save Assignment';
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
  
  var stops = [];
  if (s.stops && s.stops.length > 0) {
    stops = s.stops.map(function(st, idx) {
      var stopTime = st.collection_time ? st.collection_time.substring(0, 5) : (s.collection_time ? s.collection_time.substring(0, 5) : '07:00');
      return {
        id: st.id,
        barangay: st.barangay,
        street: st.street || '',
        time: stopTime,
        sequence: st.sequence || (idx + 1)
      };
    });
  } else {
    stops = [{
      barangay: s.barangay,
      street: s.zone || '',
      time: s.collection_time ? s.collection_time.substring(0, 5) : '07:00',
      sequence: 1
    }];
  }

  state.routeEntries = [{
    truck_number: s.truck_number || 'Truck 01',
    personnel: s.assigned_personnel || '',
    route_name: s.route_name || '',
    remarks: s.remarks || '',
    status: s.status || 'Upcoming',
    stops: stops
  }];
  modalTitle.textContent = 'Edit Collection Assignment';
  modalSaveText.textContent = 'Update Assignment';
  scheduleForm.reset();
  fId.value = s.id;
  fDate.value = s.collection_date.substring(0,10);
  modalDateLabel.textContent = new Date(s.collection_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });
  renderRouteEntries();
  modalOverlay.classList.add('active');
}

function createEmptyRoute(dateStr) {
  var nextTruckIdx = 0;
  if (state.selectedDateSchedules && state.selectedDateSchedules.length > 0) {
    nextTruckIdx = state.selectedDateSchedules.length % TRUCK_FLEET.length;
  }
  return {
    truck_number: TRUCK_FLEET[nextTruckIdx] || 'Truck 01',
    personnel: '',
    route_name: '',
    remarks: 'Regular Scheduled Collection',
    status: 'Upcoming',
    stops: [
      { barangay: '', street: '', time: '06:00', sequence: 1 }
    ]
  };
}

function closeModal() { modalOverlay.classList.remove('active'); }

function renderRouteEntries() {
  const entries = state.routeEntries;
  let html = '';
  entries.forEach(function(entry, i) {
    const truckOpts = TRUCK_FLEET.map(function(trk) {
      return '<option value="' + trk + '"' + (entry.truck_number === trk ? ' selected' : '') + '>' + trk + '</option>';
    }).join('');

    // Format times for display header
    var timeHeader = entry.stops.map(function(s) { return s.time ? formatTime12(s.time) : ''; }).filter(Boolean).join(' \u2192 ');
    if (!timeHeader) timeHeader = 'Set times';

    // Render Stops inside this assignment
    var stopsHtml = '';
    entry.stops.forEach(function(st, sIdx) {
      var streets = (st.barangay && BARANGAY_STREETS[st.barangay]) ? BARANGAY_STREETS[st.barangay] : [];
      var streetOpts = '<option value="">Select Street / Area...</option>' +
        streets.map(function(street) {
          return '<option value="' + street + '"' + (st.street === street ? ' selected' : '') + '>' + street + '</option>';
        }).join('');
      if (st.street && !streets.includes(st.street)) {
        streetOpts += '<option value="' + escapeHtml(st.street) + '" selected>' + escapeHtml(st.street) + '</option>';
      }

      var timeOptionsHtml = buildTimeOptions(st.time || '06:00');

      stopsHtml += '<div class="stop-row-item" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '">' +
        '<div class="stop-badge-pill">' + (sIdx + 1) + '</div>' +
        '<select class="re-select stop-barangay-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '">' +
          '<option value="">Select Barangay...</option>' +
          BARANGAYS.map(function(b) {
            return '<option value="' + b + '"' + (st.barangay === b ? ' selected' : '') + '>' + b + '</option>';
          }).join('') +
        '</select>' +
        '<select class="re-select stop-street-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '">' +
          streetOpts +
        '</select>' +
        '<select class="re-select stop-time-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '" title="Stop Collection Time">' +
          timeOptionsHtml +
        '</select>' +
        (entry.stops.length > 1 ? '<button type="button" class="stop-remove-btn" onclick="removeStopFromEntry(' + i + ', ' + sIdx + ')" title="Remove Stop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : '<div></div>') +
      '</div>';
    });

    html += '<div class="route-entry" data-index="' + i + '">' +
      '<div class="route-entry-header">' +
        '<div class="route-entry-number"><span class="route-entry-badge" style="background:' + (i===0 ? 'linear-gradient(135deg,#16A34A,#15803D)' : 'linear-gradient(135deg,#3B82F6,#2563EB)') + '">Assignment #' + (i+1) + '</span>' +
        '<span class="route-entry-time-display">' + (entry.truck_number ? escapeHtml(entry.truck_number) + ' \u00B7 ' : '') + timeHeader + '</span></div>' +
        (entries.length > 1 ? '<button type="button" class="route-entry-remove" onclick="removeRouteEntry(' + i + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Remove Assignment</button>' : '') +
      '</div>' +
      
      '<div class="route-entry-grid" style="grid-template-columns: repeat(3, 1fr);">' +
        '<div class="re-field"><label class="re-label">Truck Assignment <span class="required">*</span></label>' +
          '<select class="re-select re-truck" data-index="' + i + '">' +
            '<option value="">Select Truck...</option>' +
            truckOpts +
            (entry.truck_number && !TRUCK_FLEET.includes(entry.truck_number) ? '<option value="' + escapeHtml(entry.truck_number) + '" selected>' + escapeHtml(entry.truck_number) + '</option>' : '') +
          '</select>' +
        '</div>' +
        '<div class="re-field"><label class="re-label">Assigned Personnel <span class="required">*</span></label>' +
          '<input type="text" class="re-input re-personnel" data-index="' + i + '" placeholder="e.g. Juan Dela Cruz" value="' + escapeHtml(entry.personnel) + '">' +
        '</div>' +
        '<div class="re-field"><label class="re-label">Route Name</label>' +
          '<input type="text" class="re-input re-route-name" data-index="' + i + '" placeholder="e.g. Putatan Morning Route" value="' + escapeHtml(entry.route_name) + '">' +
        '</div>' +
      '</div>' +

      '<!-- Collection Stops Section with Independent Time per Stop -->' +
      '<div class="stops-sub-section">' +
        '<div class="stops-sub-header">' +
          '<span class="stops-sub-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Collection Stops & Times (' + entry.stops.length + ')</span>' +
          '<button type="button" class="add-stop-sub-btn" onclick="addStopToEntry(' + i + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Add Stop</button>' +
        '</div>' +
        '<div class="stops-list-container">' +
          stopsHtml +
        '</div>' +
      '</div>' +

      '<div class="re-field" style="margin-top:10px"><label class="re-label">Remarks / Collection Notes</label>' +
        '<input type="text" class="re-input re-remarks" data-index="' + i + '" placeholder="e.g. Regular Scheduled Collection" value="' + escapeHtml(entry.remarks || '') + '">' +
      '</div>' +

    '</div>';
  });
  routeEntriesContainer.innerHTML = html;
  updateFooterSummary();

  // Attach change/input listeners
  $all('.route-entry').forEach(function(card) {
    const i = parseInt(card.dataset.index);
    card.addEventListener('change', function(e) {
      const t = e.target;
      if (t.classList.contains('re-truck')) syncRouteEntry(i, card);
      if (t.classList.contains('stop-barangay-select')) onStopBarangayChange(i, t);
      if (t.classList.contains('stop-street-select')) onStopStreetChange(i, t);
      if (t.classList.contains('stop-time-select')) onStopTimeChange(i, t);
    });
    card.addEventListener('input', function(e) {
      const t = e.target;
      if (t.classList.contains('re-personnel') || t.classList.contains('re-route-name') || t.classList.contains('re-remarks')) syncRouteEntry(i, card);
    });
  });
}

function onStopBarangayChange(entryIdx, selectEl) {
  var stopIdx = parseInt(selectEl.dataset.stopIdx);
  if (isNaN(stopIdx) || !state.routeEntries[entryIdx] || !state.routeEntries[entryIdx].stops[stopIdx]) return;
  var bgy = selectEl.value;
  state.routeEntries[entryIdx].stops[stopIdx].barangay = bgy;
  state.routeEntries[entryIdx].stops[stopIdx].street = '';

  // Auto populate route name if empty and first stop
  if (stopIdx === 0 && !state.routeEntries[entryIdx].route_name && bgy) {
    state.routeEntries[entryIdx].route_name = bgy + ' Route';
  }

  // Update street select options
  var row = selectEl.closest('.stop-row-item');
  if (row) {
    var streetSelect = row.querySelector('.stop-street-select');
    if (streetSelect) {
      var streets = (bgy && BARANGAY_STREETS[bgy]) ? BARANGAY_STREETS[bgy] : [];
      streetSelect.innerHTML = '<option value="">Select Street / Area...</option>' +
        streets.map(function(st) { return '<option value="' + st + '">' + st + '</option>'; }).join('');
    }
  }
  updateFooterSummary();
}

function onStopStreetChange(entryIdx, selectEl) {
  var stopIdx = parseInt(selectEl.dataset.stopIdx);
  if (isNaN(stopIdx) || !state.routeEntries[entryIdx] || !state.routeEntries[entryIdx].stops[stopIdx]) return;
  state.routeEntries[entryIdx].stops[stopIdx].street = selectEl.value;
}

function onStopTimeChange(entryIdx, selectEl) {
  var stopIdx = parseInt(selectEl.dataset.stopIdx);
  if (isNaN(stopIdx) || !state.routeEntries[entryIdx] || !state.routeEntries[entryIdx].stops[stopIdx]) return;
  // Update ONLY this specific stop's time
  state.routeEntries[entryIdx].stops[stopIdx].time = selectEl.value;
  updateFooterSummary();

  const card = selectEl.closest('.route-entry');
  if (card) {
    const disp = card.querySelector('.route-entry-time-display');
    if (disp) {
      var e = state.routeEntries[entryIdx];
      var timeHeader = e.stops.map(function(s) { return s.time ? formatTime12(s.time) : ''; }).filter(Boolean).join(' \u2192 ');
      disp.textContent = (e.truck_number ? escapeHtml(e.truck_number) + ' \u00B7 ' : '') + timeHeader;
    }
  }
}

function addStopToEntry(entryIdx) {
  if (!state.routeEntries[entryIdx]) return;
  syncAllEntries();
  var prevStop = state.routeEntries[entryIdx].stops[state.routeEntries[entryIdx].stops.length - 1];
  var defaultBgy = prevStop ? prevStop.barangay : '';
  
  // Default next stop time = previous stop time + 1 hour
  var nextTime = '07:00';
  if (prevStop && prevStop.time) {
    var parts = prevStop.time.split(':');
    var h = (parseInt(parts[0], 10) + 1);
    if (h > 21) h = 21;
    nextTime = pad(h) + ':' + (parts[1] || '00');
  }

  state.routeEntries[entryIdx].stops.push({
    barangay: defaultBgy,
    street: '',
    time: nextTime,
    sequence: state.routeEntries[entryIdx].stops.length + 1
  });
  renderRouteEntries();
}

function removeStopFromEntry(entryIdx, stopIdx) {
  if (!state.routeEntries[entryIdx] || state.routeEntries[entryIdx].stops.length <= 1) {
    showToast('An assignment must have at least one stop.', 'info');
    return;
  }
  syncAllEntries();
  state.routeEntries[entryIdx].stops.splice(stopIdx, 1);
  state.routeEntries[entryIdx].stops.forEach(function(st, idx) { st.sequence = idx + 1; });
  renderRouteEntries();
}

function syncRouteEntry(idx, card) {
  if (!state.routeEntries[idx]) return;
  const entry = state.routeEntries[idx];
  if (!card) card = document.querySelector('.route-entry[data-index="' + idx + '"]');
  if (!card) return;

  entry.truck_number = card.querySelector('.re-truck') ? card.querySelector('.re-truck').value : entry.truck_number;
  entry.personnel = card.querySelector('.re-personnel') ? card.querySelector('.re-personnel').value : entry.personnel;
  entry.route_name = card.querySelector('.re-route-name') ? card.querySelector('.re-route-name').value : entry.route_name;
  entry.remarks = card.querySelector('.re-remarks') ? card.querySelector('.re-remarks').value : entry.remarks;

  const disp = card.querySelector('.route-entry-time-display');
  if (disp) {
    var timeHeader = entry.stops.map(function(s) { return s.time ? formatTime12(s.time) : ''; }).filter(Boolean).join(' \u2192 ');
    disp.textContent = (entry.truck_number ? escapeHtml(entry.truck_number) + ' \u00B7 ' : '') + timeHeader;
  }
  updateFooterSummary();
}

function updateFooterSummary() {
  const entries = state.routeEntries;
  var totalStops = 0;
  var validAssignments = 0;
  entries.forEach(function(e) {
    totalStops += e.stops.length;
    var hasValidStops = e.stops.every(function(s) { return s.barangay && s.time; });
    if (e.truck_number && hasValidStops) validAssignments++;
  });

  modalFooterSummary.innerHTML = '<span class="footer-routes-count">' + entries.length + ' assignment' + (entries.length!==1?'s':'') + ' (' + totalStops + ' stop' + (totalStops!==1?'s':'') + ')</span>' +
    '<span class="footer-routes-valid">' + validAssignments + ' ready</span>';
}

function addRouteEntry() {
  syncAllEntries();
  state.routeEntries.push(createEmptyRoute(fDate.value || formatDate(new Date())));
  renderRouteEntries();
  setTimeout(() => { routeEntriesContainer.scrollTop = routeEntriesContainer.scrollHeight; }, 50);
}

function removeRouteEntry(index) {
  if (state.routeEntries.length <= 1) { showToast('Need at least one assignment.', 'info'); return; }
  syncAllEntries();
  state.routeEntries.splice(index, 1);
  renderRouteEntries();
}

function syncAllEntries() {
  $all('.route-entry').forEach(function(card) {
    const idx = parseInt(card.dataset.index);
    if (!isNaN(idx)) syncRouteEntry(idx, card);
  });
}

async function handleSaveSchedule() {
  syncAllEntries();
  const entries = state.routeEntries;
  const date = fDate.value;
  if (isDatePast(date)) { showToast('Cannot save to past dates.', 'error'); return; }

  var hasErr = false;
  entries.forEach(function(e, i) {
    if (!e.truck_number) { showToast('Assignment #' + (i+1) + ': Select truck assignment.', 'error'); hasErr = true; }
    if (!e.personnel || !e.personnel.trim()) { showToast('Assignment #' + (i+1) + ': Enter assigned personnel.', 'error'); hasErr = true; }
    if (!e.stops || e.stops.length === 0) { showToast('Assignment #' + (i+1) + ': Add at least one stop.', 'error'); hasErr = true; }
    e.stops.forEach(function(st, sIdx) {
      if (!st.barangay) { showToast('Assignment #' + (i+1) + ', Stop #' + (sIdx+1) + ': Select barangay.', 'error'); hasErr = true; }
      if (!st.time) { showToast('Assignment #' + (i+1) + ', Stop #' + (sIdx+1) + ': Select collection time.', 'error'); hasErr = true; }
    });
  });
  if (hasErr) return;

  modalSaveBtn.disabled = true;
  modalSaveText.textContent = state.editingId ? 'Updating...' : 'Saving...';
  let ok = true;

  if (state.editingId) {
    const e = entries[0];
    const firstStopTime = e.stops[0].time;
    const payload = {
      barangay: e.stops[0].barangay,
      zone: e.stops[0].street || '',
      route_name: e.route_name || (e.stops[0].barangay + ' Route'),
      starting_point: e.stops[0].street || (e.stops[0].barangay + ' Center'),
      truck_number: e.truck_number || '',
      collection_date: date,
      collection_time: firstStopTime.length === 5 ? firstStopTime + ':00' : firstStopTime,
      assigned_personnel: e.personnel || '',
      remarks: e.remarks || 'Regular Scheduled Collection',
      stops: e.stops.map(function(st, sIdx) {
        var sTime = st.time || firstStopTime;
        return {
          barangay: st.barangay,
          street: st.street || '',
          collection_time: sTime.length === 5 ? sTime + ':00' : sTime,
          sequence: sIdx + 1
        };
      })
    };
    ok = !!(await updateSchedule(state.editingId, payload));
  } else {
    const payload = entries.map(function(e) {
      const firstStopTime = e.stops[0].time;
      return {
        barangay: e.stops[0].barangay,
        zone: e.stops[0].street || '',
        route_name: e.route_name || (e.stops[0].barangay + ' Route'),
        starting_point: e.stops[0].street || (e.stops[0].barangay + ' Center'),
        truck_number: e.truck_number || '',
        collection_date: date,
        collection_time: firstStopTime.length === 5 ? firstStopTime + ':00' : firstStopTime,
        assigned_personnel: e.personnel || '',
        remarks: e.remarks || 'Regular Scheduled Collection',
        stops: e.stops.map(function(st, sIdx) {
          var sTime = st.time || firstStopTime;
          return {
            barangay: st.barangay,
            street: st.street || '',
            collection_time: sTime.length === 5 ? sTime + ':00' : sTime,
            sequence: sIdx + 1
          };
        })
      };
    });
    const created = await createBatchSchedules(payload);
    if (created && created.length > 0) {
      ok = true;
      showToast(created.length + ' assignment' + (created.length>1?'s':'') + ' created successfully!', 'success');
    } else {
      ok = false;
    }
  }

  modalSaveBtn.disabled = false;
  modalSaveText.textContent = state.editingId ? 'Update Assignment' : 'Save Assignment';
  if (ok) {
    closeModal();
    await renderCalendar();
  }
}

