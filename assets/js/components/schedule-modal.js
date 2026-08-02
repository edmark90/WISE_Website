/**
 * WISE System - Schedule Modal Component
 * Multi-route entry form: open (new/edit), dynamic time/barangay/zone fields, save.
 */

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
  return { time: '07:00', barangay: '', zone: '', personnel: '', status: 'Upcoming' };
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
    ok = !!(await updateSchedule(state.editingId, { barangay: e.barangay, zone: e.zone||'', collection_date: date, collection_time: e.time+':00', assigned_personnel: e.personnel||'' }));
  } else {
    const payload = entries.map(function(e) {
      return { barangay: e.barangay, zone: e.zone||'', collection_date: date, collection_time: e.time+':00', assigned_personnel: e.personnel||'' };
    });
    const created = await createBatchSchedules(payload);
    if (created && created.length > 0) {
      ok = true;
      showToast(created.length + ' route' + (created.length>1?'s':'') + ' created!', 'success');
    } else {
      ok = false;
    }
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
