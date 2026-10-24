/**
 * WISE System - Route Diagram Component
 * Multi-route preview engine: supports rendering N independent collection routes
 * for a single date, with truck & personnel allocation, tab switching, and S-curve roads.
 */

var currentPreviewTab = 0; // 0 = All Routes, 1..N = specific route

// ---------- Route Diagram ----------
function renderRouteDiagram(schedulesOrStops, label) {
  var emptyEl = document.getElementById('route-diagram-empty');
  var contentEl = document.getElementById('route-diagram-content');
  if (!contentEl || !emptyEl) return;

  if (!schedulesOrStops || schedulesOrStops.length === 0) {
    contentEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    routePreviewInfo.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';

  // Normalize into assignments
  var assignments = schedulesOrStops.map(function(s) {
    var routeName = s.route_name || s.starting_point || (s.barangay ? s.barangay + ' Route' : 'Collection Route');
    var truck = s.truck_number || 'Truck Assigned';
    var personnel = s.assigned_personnel || 'Unassigned';
    var timeStr = s.collection_time ? formatTime12(s.collection_time.substring(0,5)) : (s.time || '');
    var status = s.status || 'Upcoming';

    // Build stops for this assignment
    var stops = [];
    if (s.stops && s.stops.length > 0) {
      stops = s.stops.map(function(st, sidx) {
        var stopTimeStr = st.collection_time ? formatTime12(st.collection_time.substring(0, 5)) : timeStr;
        return {
          id: st.id || s.id,
          schedule_id: s.id,
          barangay: st.barangay,
          street: st.street || '',
          zone: st.street || st.barangay,
          sequence: st.sequence || (sidx + 1),
          time: stopTimeStr,
          collection_time: st.collection_time || s.collection_time,
          assigned_personnel: personnel,
          truck_number: truck,
          status: st.status || status
        };
      });
    } else if (s.zone && s.zone.includes(',')) {
      var parts = s.zone.split(',');
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p].trim();
        if (part) {
          stops.push({
            id: s.id,
            barangay: s.barangay,
            street: part,
            zone: part,
            time: timeStr,
            collection_time: s.collection_time,
            assigned_personnel: personnel,
            truck_number: truck,
            status: status
          });
        }
      }
    }
    if (stops.length === 0) {
      stops.push({
        id: s.id,
        barangay: s.barangay,
        street: s.zone || '',
        zone: s.zone || '',
        time: timeStr,
        collection_time: s.collection_time,
        assigned_personnel: personnel,
        truck_number: truck,
        status: status
      });
    }

    return {
      id: s.id,
      schedule: s,
      routeName: routeName,
      truck: truck,
      personnel: personnel,
      timeStr: timeStr,
      barangay: s.barangay,
      zone: s.zone || '',
      status: status,
      stops: stops
    };
  });

  var totalAssignments = assignments.length;
  var totalStops = 0;
  assignments.forEach(function(a) { totalStops += a.stops.length; });

  // Render Top Stat Bar
  var statHtml = '<div class="route-preview-stat">' +
    '<div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>' +
    '<div class="stat-value" style="color:var(--sc-primary)">' + totalAssignments + '</div>' +
    '<div class="stat-label">Route' + (totalAssignments > 1 ? 's' : '') + '</div>' +
  '</div>';

  if (label) {
    statHtml += '<div class="route-preview-stat" style="flex:1;min-width:0;text-align:left"><div class="stat-value" style="font-size:10px;color:var(--sc-text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(label) + '</div></div>';
  }

  statHtml += '<div class="route-preview-stat route-direction-badge"><span class="direction-label">' + totalStops + ' Stop' + (totalStops !== 1 ? 's' : '') + ' Total</span></div>';
  routePreviewInfo.innerHTML = statHtml;

  // Build Tabs and Content
  var html = '';

  // If multiple routes, render tab bar
  if (totalAssignments > 1) {
    html += '<div class="route-preview-tabs">';
    html += '<button class="route-tab-btn' + (currentPreviewTab === 0 ? ' active' : '') + '" onclick="switchPreviewTab(0)">All Routes (' + totalAssignments + ')</button>';
    assignments.forEach(function(a, idx) {
      var tabIdx = idx + 1;
      html += '<button class="route-tab-btn' + (currentPreviewTab === tabIdx ? ' active' : '') + '" onclick="switchPreviewTab(' + tabIdx + ')">' +
        '<span class="truck-pill" style="font-size:9.5px;padding:1px 5px">' + escapeHtml(a.truck) + '</span> ' +
        escapeHtml(a.routeName) +
      '</button>';
    });
    html += '</div>';
  }

  // Render Routes
  html += '<div class="route-assignments-stack" id="route-assignments-stack">';
  assignments.forEach(function(a, idx) {
    var tabIdx = idx + 1;
    var isVisible = (currentPreviewTab === 0 || currentPreviewTab === tabIdx);
    var sc = STATUS_COLORS[a.status] || STATUS_COLORS.Upcoming;
    var bColor = BARANGAY_COLORS[a.barangay] || BARANGAY_COLORS.default;

    html += '<div class="route-assignment-section" id="route-assignment-' + idx + '" style="' + (isVisible ? '' : 'display:none;') + '">';
    
    // Route Assignment Header
    html += '<div class="route-assignment-header">' +
      '<div class="route-assignment-title">' +
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + bColor.bg + '"></span>' +
        '<span>' + escapeHtml(a.routeName) + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
        '<span class="truck-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' + escapeHtml(a.truck) + '</span>' +
        '<span class="personnel-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' + escapeHtml(a.personnel) + '</span>' +
        '<span class="status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';font-size:10px;padding:2px 7px">' + a.status + '</span>' +
      '</div>' +
    '</div>';

    // Journey Road Container
    html += '<div class="route-journey' + (a.stops.length === 1 ? ' single' : '') + '" id="route-journey-' + idx + '">';
    a.stops.forEach(function(s, sIdx) {
      var bgyName = s.barangay || '';
      var streetName = s.zone || '';
      var timeStr = s.time || '';
      var personnel = s.assigned_personnel || '';
      var status = s.status || 'Upcoming';
      var stopSc = STATUS_COLORS[status] || STATUS_COLORS.Upcoming;
      var stopBgyColor = BARANGAY_COLORS[bgyName] || BARANGAY_COLORS.default;
      var isFirst = sIdx === 0;
      var isLast = sIdx === a.stops.length - 1;
      var isLeft = sIdx % 2 === 0;
      var pinColor = stopBgyColor.bg;
      var sid = s.id != null ? s.id : '';

      var labelText = bgyName;
      if (isFirst) labelText += ' <span class="rs-badge start-badge">START</span>';
      if (isLast && a.stops.length > 1) labelText += ' <span class="rs-badge end-badge">END</span>';

      html += '<div class="route-stop" data-side="' + (isLeft ? 'left' : 'right') + '" data-sid="' + sid + '" onclick="onRouteStopClick(this)">';

      // Tooltip
      html += '<div class="rs-tooltip">';
      html += '<div class="rs-tooltip-title">' + escapeHtml(bgyName) + '</div>';
      html += '<span class="rs-tooltip-status status-badge" style="background:' + stopSc.bg + ';color:' + stopSc.color + ';font-size:8px;padding:1px 6px">' + status + '</span>';
      if (timeStr) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + escapeHtml(timeStr) + '</div>';
      if (streetName) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + escapeHtml(streetName) + '</div>';
      if (personnel) html += '<div class="rs-tooltip-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + escapeHtml(personnel) + '</div>';
      html += '</div>';

      // Left side
      html += '<div class="rs-side left">';
      if (isLeft) {
        html += '<div class="rs-block">';
        html += '<div class="rs-card">';
        html += '<div class="rs-card-name">' + labelText + '</div>';
        if (streetName) html += '<div style="font-size:10px;color:#6B7280;margin-top:2px">' + escapeHtml(streetName) + '</div>';
        if (timeStr) html += '<div class="rs-card-meta">' + escapeHtml(timeStr) + '</div>';
        html += '</div>';
        html += '<div class="rs-pin">';
        html += '<svg viewBox="0 0 24 36" width="22" height="28"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="' + pinColor + '"/><circle cx="12" cy="11" r="4" fill="#fff" opacity="0.85"/></svg>';
        html += '<span class="rs-pin-label">' + (isFirst ? 'S' : (isLast ? 'E' : (sIdx + 1))) + '</span>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';

      // Right side
      html += '<div class="rs-side right">';
      if (!isLeft) {
        html += '<div class="rs-block">';
        html += '<div class="rs-pin">';
        html += '<svg viewBox="0 0 24 36" width="22" height="28"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="' + pinColor + '"/><circle cx="12" cy="11" r="4" fill="#fff" opacity="0.85"/></svg>';
        html += '<span class="rs-pin-label">' + (isFirst ? 'S' : (isLast ? 'E' : (sIdx + 1))) + '</span>';
        html += '</div>';
        html += '<div class="rs-card">';
        html += '<div class="rs-card-name">' + labelText + '</div>';
        if (streetName) html += '<div style="font-size:10px;color:#6B7280;margin-top:2px">' + escapeHtml(streetName) + '</div>';
        if (timeStr) html += '<div class="rs-card-meta">' + escapeHtml(timeStr) + '</div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';

      html += '</div>';
    });
    html += '</div>'; // close route-journey

    html += '</div>'; // close route-assignment-section
  });
  html += '</div>'; // close route-assignments-stack

  contentEl.innerHTML = html;

  // Draw roads & trucks for each visible assignment
  assignments.forEach(function(a, idx) {
    var journeyEl = document.getElementById('route-journey-' + idx);
    var sectionEl = document.getElementById('route-assignment-' + idx);
    if (journeyEl && sectionEl && sectionEl.style.display !== 'none') {
      drawRouteRoadForJourney(journeyEl);
      renderTruckIndicatorForJourney(journeyEl, a.stops, a.truck);
    }
  });
}

function switchPreviewTab(tabIdx) {
  currentPreviewTab = tabIdx;
  var tabs = document.querySelectorAll('.route-tab-btn');
  tabs.forEach(function(btn, i) {
    if (i === tabIdx) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  var sections = document.querySelectorAll('.route-assignment-section');
  sections.forEach(function(sec, i) {
    var isVis = (tabIdx === 0 || tabIdx === (i + 1));
    sec.style.display = isVis ? 'block' : 'none';
    if (isVis) {
      var journeyEl = sec.querySelector('.route-journey');
      if (journeyEl) {
        drawRouteRoadForJourney(journeyEl);
      }
    }
  });
}

// ---------- SVG S-Curve Road per Journey ----------
function drawRouteRoadForJourney(journeyEl) {
  if (!journeyEl) return;
  var pRect = journeyEl.getBoundingClientRect();
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

  var classes = ['route-road-glow', 'route-road-bg', 'route-road-fill', 'route-road-center'];
  for (var ci = 0; ci < classes.length; ci++) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('class', classes[ci]);
    el.setAttribute('d', pathD);
    svg.appendChild(el);
  }

  var oldSvg = journeyEl.querySelector('.route-road-svg');
  if (oldSvg) oldSvg.remove();
  journeyEl.insertBefore(svg, journeyEl.firstChild);
}

// ---------- Truck Indicator per Journey ----------
function renderTruckIndicatorForJourney(journeyEl, stops, truckName) {
  if (!journeyEl || !stops || stops.length < 1) return;

  var oldTruck = journeyEl.querySelector('.rs-truck');
  if (oldTruck) oldTruck.remove();

  var truckIdx = -1;
  var isFinished = false;
  var allUpcoming = true;

  for (var i = 0; i < stops.length; i++) {
    var st = (stops[i].status || 'Upcoming').toLowerCase();
    if (st !== 'upcoming' && st !== 'cancelled') allUpcoming = false;
  }

  // If all upcoming, place truck at start
  if (allUpcoming) {
    truckIdx = 0;
  } else {
    for (var i = stops.length - 1; i >= 0; i--) {
      var st = (stops[i].status || 'Upcoming').toLowerCase();
      if (st === 'arriving' || st === 'arrived' || st === 'completed' || st === 'delayed') {
        truckIdx = i;
        break;
      }
    }
  }

  if (truckIdx === -1) truckIdx = 0;

  var completedCount = 0;
  for (var i = 0; i < stops.length; i++) {
    var st = (stops[i].status || 'Upcoming').toLowerCase();
    if (st === 'completed' || st === 'arrived') completedCount++;
  }
  isFinished = (completedCount === stops.length && !allUpcoming);

  var pinEls = journeyEl.querySelectorAll('.route-stop');
  if (truckIdx >= pinEls.length) return;

  var targetStop = pinEls[truckIdx];
  var pin = targetStop.querySelector('.rs-pin');
  if (!pin) return;

  var pRect = journeyEl.getBoundingClientRect();
  var pinRect = pin.getBoundingClientRect();
  var side = targetStop.getAttribute('data-side');

  var truckSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  var flagSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

  var statusText = isFinished ? 'DONE' : (stops[truckIdx].status || 'Upcoming');
  var truckLabel = (truckName ? truckName + ': ' : '') + statusText;

  var truck = document.createElement('div');
  truck.className = 'rs-truck' + (isFinished ? ' finished' : '');
  truck.innerHTML =
    '<div class="rs-truck-icon">' + truckSvg + '</div>' +
    (isFinished ? '<div class="rs-truck-flag">' + flagSvg + '</div>' : '') +
    '<span class="rs-truck-label">' + escapeHtml(truckLabel) + '</span>';

  var topPos = pinRect.top - pRect.top + (pinRect.height / 2) - 14;

  if (side === 'left') {
    truck.style.position = 'absolute';
    truck.style.top = topPos + 'px';
    truck.style.right = (pRect.right - pinRect.left + 6) + 'px';
    truck.style.flexDirection = 'row-reverse';
  } else {
    truck.style.position = 'absolute';
    truck.style.top = topPos + 'px';
    truck.style.left = (pinRect.right - pRect.left + 6) + 'px';
  }

  journeyEl.appendChild(truck);
}

// ---------- Route Stop Click Handler ----------
function onRouteStopClick(el) {
  var sid = el.getAttribute('data-sid');
  if (!sid) return;
  var schedule = state.schedules.find(function(s) { return s.id == sid; });
  if (schedule) showScheduleInSidebar(schedule);
}

// ---------- Empty State ----------
function clearRouteDiagram() {
  var emptyEl = document.getElementById('route-diagram-empty');
  var contentEl = document.getElementById('route-diagram-content');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
}

