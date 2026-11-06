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

/**
 * Helper to generate 15-minute time options.
 * Disables any time <= minTime (from previous stops) AND any time already used by another stop in the same route.
 */
function buildTimeOptions(selectedTime, minTime, otherUsedTimes) {
  var opts = [];
  for (let h = 5; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = pad(h) + ':' + pad(m);
      const isBeforeOrEqualPrev = minTime ? (val <= minTime) : false;
      const isUsedByOtherStop = otherUsedTimes ? otherUsedTimes.has(val) : false;
      const isDisabled = isBeforeOrEqualPrev || isUsedByOtherStop;
      const isSelected = !isDisabled && (selectedTime === val);

      opts.push(
        '<option value="' + val + '"' +
        (isSelected ? ' selected' : '') +
        (isDisabled ? ' disabled="disabled" style="color:#94a3b8;background:#f1f5f9;"' : '') +
        '>' +
        formatTime12(val) + (isDisabled ? ' (Unavailable)' : '') +
        '</option>'
      );
    }
  }
  return opts.join('');
}

function getNextAvailableTime(baseTime) {
  if (!baseTime) return '06:00';
  var parts = baseTime.split(':');
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1] || '0', 10);
  m += 30; // Standard 30-minute progression between consecutive collection stops
  if (m >= 60) {
    h += Math.floor(m / 60);
    m = m % 60;
  }
  m = Math.ceil(m / 15) * 15;
  if (m >= 60) {
    h += 1;
    m = 0;
  }
  if (h > 21) {
    h = 21;
    m = 45;
  }
  return pad(h) + ':' + pad(m);
}

/**
 * Returns a Set of truck numbers already saved in the database for the given YYYY-MM-DD date,
 * excluding state.editingId when editing an existing assignment.
 */
function getSavedTrucksForDate(dateStr) {
  var usedOnDate = new Set();
  var targetDate = dateStr || (fDate && fDate.value) || (state.selectedDate ? formatDate(state.selectedDate) : '');
  if (!targetDate) return usedOnDate;

  var list = state.schedules || state.selectedDateSchedules || [];
  list.forEach(function(s) {
    var sDate = (s.collection_date || '').substring(0, 10);
    if (sDate === targetDate && s.truck_number) {
      if (!state.editingId || s.id !== state.editingId) {
        usedOnDate.add(s.truck_number);
      }
    }
  });
  return usedOnDate;
}

function getAvailableTruck(currentEntryIdx, dateStr) {
  var usedInModal = new Set();
  (state.routeEntries || []).forEach(function(e, idx) {
    if (idx !== currentEntryIdx && e && e.truck_number) {
      usedInModal.add(e.truck_number);
    }
  });

  var usedInDate = getSavedTrucksForDate(dateStr);

  // 1. Choose first truck in fleet not used in modal or saved on this date
  for (var i = 0; i < TRUCK_FLEET.length; i++) {
    var trk = TRUCK_FLEET[i];
    if (!usedInModal.has(trk) && !usedInDate.has(trk)) {
      return trk;
    }
  }

  // 2. Fallback: first truck in fleet not used in this modal session
  for (var j = 0; j < TRUCK_FLEET.length; j++) {
    var t = TRUCK_FLEET[j];
    if (!usedInModal.has(t)) {
      return t;
    }
  }

  return TRUCK_FLEET[0];
}

// ---------- Modal ----------
function openScheduleModalForDate(date) {
  var dateStr = formatDate(date);
  state.editingId = null;
  state.routeEntries = [];
  scheduleForm.reset();
  fId.value = '';
  fDate.value = dateStr;
  state.routeEntries = [createEmptyRoute(dateStr)];
  modalTitle.textContent = 'Add Collection Assignment';
  modalSaveText.textContent = 'Save Assignment';
  modalDateLabel.textContent = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });
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
      var stopTime = st.collection_time ? st.collection_time.substring(0, 5) : (s.collection_time ? s.collection_time.substring(0, 5) : '06:00');
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
      time: s.collection_time ? s.collection_time.substring(0, 5) : '06:00',
      sequence: 1
    }];
  }

  scheduleForm.reset();
  fId.value = s.id;
  fDate.value = s.collection_date.substring(0, 10);

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
  modalDateLabel.textContent = new Date(s.collection_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });
  renderRouteEntries();
  modalOverlay.classList.add('active');
}

function createEmptyRoute(dateStr) {
  var autoTruck = getAvailableTruck(-1, dateStr);
  return {
    truck_number: autoTruck,
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
  const currentDateStr = (fDate && fDate.value) ? fDate.value : (state.selectedDate ? formatDate(state.selectedDate) : '');
  const savedTrucksOnDate = getSavedTrucksForDate(currentDateStr);

  // First pass: ensure no two entries share a truck or use an already-saved truck on this date,
  // and ensure all stops within each entry are strictly chronological
  var usedTrucksSoFar = new Set(savedTrucksOnDate);
  entries.forEach(function(entry, i) {
    if (!entry.truck_number || usedTrucksSoFar.has(entry.truck_number)) {
      // Find first available truck
      for (var tIdx = 0; tIdx < TRUCK_FLEET.length; tIdx++) {
        if (!usedTrucksSoFar.has(TRUCK_FLEET[tIdx])) {
          entry.truck_number = TRUCK_FLEET[tIdx];
          break;
        }
      }
    }
    if (entry.truck_number) {
      usedTrucksSoFar.add(entry.truck_number);
    }

    // Enforce chronological stop times across all stops in this route
    if (entry.stops && entry.stops.length > 0) {
      if (!entry.stops[0].time) entry.stops[0].time = '06:00';
      for (var sIdx = 1; sIdx < entry.stops.length; sIdx++) {
        var prevTime = entry.stops[sIdx - 1].time || '06:00';
        if (!entry.stops[sIdx].time || entry.stops[sIdx].time <= prevTime) {
          entry.stops[sIdx].time = getNextAvailableTime(prevTime);
        }
      }
    }
  });

  let html = '';
  entries.forEach(function(entry, i) {
    const truckOpts = TRUCK_FLEET.map(function(trk) {
      var otherModalIdx = entries.findIndex(function(other, oIdx) {
        return oIdx !== i && other.truck_number === trk;
      });
      var isChosenByOtherInModal = otherModalIdx !== -1;
      var isAlreadySavedOnDate = savedTrucksOnDate.has(trk);
      var isDisabled = isChosenByOtherInModal || isAlreadySavedOnDate;
      var isSelected = !isDisabled && (entry.truck_number === trk);

      var extraLabel = '';
      if (isChosenByOtherInModal) {
        extraLabel = ' (In Use - Assignment #' + (otherModalIdx + 1) + ')';
      } else if (isAlreadySavedOnDate) {
        extraLabel = ' (Already Scheduled Today)';
      }

      return '<option value="' + trk + '"' +
        (isSelected ? ' selected' : '') +
        (isDisabled ? ' disabled="disabled" style="color:#94a3b8;background:#f1f5f9;"' : '') +
        '>' + trk + extraLabel + '</option>';
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

      // Minimum allowed time for this stop is the previous stop's collection time
      var minTime = null;
      if (sIdx > 0 && entry.stops[sIdx - 1] && entry.stops[sIdx - 1].time) {
        minTime = entry.stops[sIdx - 1].time;
      }

      // Also collect times used by any other stop in this same route
      var otherUsedTimes = new Set();
      entry.stops.forEach(function(otherStop, oStopIdx) {
        if (oStopIdx !== sIdx && otherStop.time) {
          otherUsedTimes.add(otherStop.time);
        }
      });

      var timeOptionsHtml = buildTimeOptions(st.time || '06:00', minTime, otherUsedTimes);

      stopsHtml += '<div class="stop-row-item" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '">' +
        '<div class="stop-badge-pill">' + (sIdx + 1) + '</div>' +
        '<select class="re-select stop-barangay-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '" onchange="onStopBarangayChange(' + i + ', this)">' +
          '<option value="">Select Barangay...</option>' +
          BARANGAYS.map(function(b) {
            return '<option value="' + b + '"' + (st.barangay === b ? ' selected' : '') + '>' + b + '</option>';
          }).join('') +
        '</select>' +
        '<select class="re-select stop-street-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '" onchange="onStopStreetChange(' + i + ', this)">' +
          streetOpts +
        '</select>' +
        '<select class="re-select stop-time-select" data-entry-idx="' + i + '" data-stop-idx="' + sIdx + '" onchange="onStopTimeChange(' + i + ', this)" title="' + (minTime ? 'Must be after ' + formatTime12(minTime) : 'Stop Collection Time') + '">' +
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
      
      '<div class="route-entry-grid">' +
        '<div class="re-field"><label class="re-label">Truck Assignment <span class="required">*</span></label>' +
          '<select class="re-select re-truck" data-index="' + i + '" onchange="onTruckChange(' + i + ', this)">' +
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

  // Attach input listeners for text fields
  $all('.route-entry').forEach(function(card) {
    const i = parseInt(card.dataset.index);
    card.addEventListener('input', function(e) {
      const t = e.target;
      if (t.classList.contains('re-personnel') || t.classList.contains('re-route-name') || t.classList.contains('re-remarks')) {
        syncRouteEntry(i, card);
      }
    });
  });
}

function onTruckChange(entryIdx, selectEl) {
  if (!state.routeEntries[entryIdx]) return;
  var chosenTruck = selectEl.value;
  state.routeEntries[entryIdx].truck_number = chosenTruck;
  syncAllEntries();
  renderRouteEntries();
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
    var card = selectEl.closest('.route-entry');
    if (card) {
      var rnInput = card.querySelector('.re-route-name');
      if (rnInput && !rnInput.value) rnInput.value = bgy + ' Route';
    }
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
  
  var newTime = selectEl.value;
  syncAllEntries();
  var stops = state.routeEntries[entryIdx].stops;

  // Guard: ensure stopIdx > 0 is strictly after previous stop
  if (stopIdx > 0 && stops[stopIdx - 1] && newTime <= stops[stopIdx - 1].time) {
    newTime = getNextAvailableTime(stops[stopIdx - 1].time);
    showToast('Stop #' + (stopIdx + 1) + ' must be scheduled after Stop #' + stopIdx + '.', 'info');
  }
  stops[stopIdx].time = newTime;

  // Enforce chronological progression for all subsequent stops
  for (var k = stopIdx + 1; k < stops.length; k++) {
    var prevTime = stops[k - 1].time;
    if (!stops[k].time || stops[k].time <= prevTime) {
      stops[k].time = getNextAvailableTime(prevTime);
    }
  }

  renderRouteEntries();
}

function addStopToEntry(entryIdx) {
  if (!state.routeEntries[entryIdx]) return;
  syncAllEntries();
  var stops = state.routeEntries[entryIdx].stops;
  var prevStop = stops[stops.length - 1];
  var defaultBgy = prevStop ? prevStop.barangay : '';
  var nextTime = prevStop && prevStop.time ? getNextAvailableTime(prevStop.time) : '06:30';

  state.routeEntries[entryIdx].stops.push({
    barangay: defaultBgy,
    street: '',
    time: nextTime,
    sequence: stops.length + 1
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

  var truckSelect = card.querySelector('.re-truck');
  if (truckSelect && truckSelect.value) entry.truck_number = truckSelect.value;

  var persInput = card.querySelector('.re-personnel');
  if (persInput) entry.personnel = persInput.value;

  var rnInput = card.querySelector('.re-route-name');
  if (rnInput) entry.route_name = rnInput.value;

  var remInput = card.querySelector('.re-remarks');
  if (remInput) entry.remarks = remInput.value;

  // Also sync all stop rows in this card
  var stopRows = card.querySelectorAll('.stop-row-item');
  stopRows.forEach(function(row, sIdx) {
    if (!entry.stops[sIdx]) return;
    var bgySel = row.querySelector('.stop-barangay-select');
    var strSel = row.querySelector('.stop-street-select');
    var tmSel = row.querySelector('.stop-time-select');
    if (bgySel) entry.stops[sIdx].barangay = bgySel.value;
    if (strSel) entry.stops[sIdx].street = strSel.value;
    if (tmSel && tmSel.value) entry.stops[sIdx].time = tmSel.value;
  });

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
  var dateStr = (fDate && fDate.value) ? fDate.value : formatDate(new Date());
  var newRoute = createEmptyRoute(dateStr);
  state.routeEntries.push(newRoute);
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
  var seenTrucks = getSavedTrucksForDate(date);
  entries.forEach(function(e, i) {
    if (!e.truck_number) { showToast('Assignment #' + (i+1) + ': Select truck assignment.', 'error'); hasErr = true; }
    else if (seenTrucks.has(e.truck_number)) {
      showToast('Assignment #' + (i+1) + ': ' + e.truck_number + ' is already assigned on this date.', 'error');
      hasErr = true;
    } else {
      seenTrucks.add(e.truck_number);
    }

    if (!e.personnel || !e.personnel.trim()) { showToast('Assignment #' + (i+1) + ': Enter assigned personnel.', 'error'); hasErr = true; }
    if (!e.stops || e.stops.length === 0) { showToast('Assignment #' + (i+1) + ': Add at least one stop.', 'error'); hasErr = true; }
    e.stops.forEach(function(st, sIdx) {
      if (!st.barangay) { showToast('Assignment #' + (i+1) + ', Stop #' + (sIdx+1) + ': Select barangay.', 'error'); hasErr = true; }
      if (!st.time) { showToast('Assignment #' + (i+1) + ', Stop #' + (sIdx+1) + ': Select collection time.', 'error'); hasErr = true; }
      if (sIdx > 0 && st.time <= e.stops[sIdx - 1].time) {
        showToast('Assignment #' + (i+1) + ', Stop #' + (sIdx+1) + ': Time must be after Stop #' + sIdx + '.', 'error');
        hasErr = true;
      }
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
