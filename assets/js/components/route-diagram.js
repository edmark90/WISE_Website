/**
 * WISE System - Route Diagram Component
 * SVG "center road" route visualization with alternating stop cards and pins.
 */

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
    '<div class="route-preview-stat">' +
      '<div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>' +
      '<div class="stat-value" style="color:var(--sc-primary)">' + totalStops + '</div>' +
      '<div class="stat-label">Stop' + (totalStops > 1 ? 's' : '') + '</div>' +
    '</div>' +
    (label ? '<div class="route-preview-stat" style="flex:1;min-width:0;text-align:left"><div class="stat-value" style="font-size:10px;color:var(--sc-text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(label) + '</div></div>' : '') +
    '<div class="route-preview-stat route-direction-badge"><span class="direction-label">' + (totalStops > 1 ? stops[0].barangay + ' <span class="dir-arrow">→</span> ' + stops[totalStops-1].barangay : stops[0].barangay) + '</span></div>';

  var html = '<div class="route-journey' + (totalStops === 1 ? ' single' : '') + '" id="route-journey">';

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
  renderTruckIndicator(stops);
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

  var classes = ['route-road-glow', 'route-road-bg', 'route-road-fill', 'route-road-center'];
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

// ---------- Truck Indicator ----------
function renderTruckIndicator(stops) {
  var contentEl = document.getElementById('route-diagram-content');
  var journeyEl = document.getElementById('route-journey');
  if (!contentEl || !journeyEl) return;

  // Remove any existing truck
  var oldTruck = contentEl.querySelector('.rs-truck');
  if (oldTruck) oldTruck.remove();

  if (!stops || stops.length < 1) return;

  // Determine truck position based on statuses
  // Priority: find the furthest "active" stop
  var truckIdx = -1;
  var isFinished = false;
  var allUpcoming = true;

  for (var i = 0; i < stops.length; i++) {
    var st = (stops[i].status || 'Upcoming').toLowerCase();
    if (st !== 'upcoming' && st !== 'cancelled') allUpcoming = false;
  }

  // If all upcoming, no truck
  if (allUpcoming) return;

  // Find truck position: place truck at the latest non-upcoming stop
  for (var i = stops.length - 1; i >= 0; i--) {
    var st = (stops[i].status || 'Upcoming').toLowerCase();
    if (st === 'arriving' || st === 'arrived' || st === 'completed' || st === 'delayed') {
      truckIdx = i;
      break;
    }
  }

  if (truckIdx === -1) return;

  // Check if all routes are completed (finished state)
  var completedCount = 0;
  for (var i = 0; i < stops.length; i++) {
    var st = (stops[i].status || 'Upcoming').toLowerCase();
    if (st === 'completed' || st === 'arrived') completedCount++;
  }
  isFinished = (completedCount === stops.length);

  // Get the pin element to position near
  var pinEls = journeyEl.querySelectorAll('.route-stop');
  if (truckIdx >= pinEls.length) return;

  var targetStop = pinEls[truckIdx];
  var pin = targetStop.querySelector('.rs-pin');
  if (!pin) return;

  var pRect = contentEl.getBoundingClientRect();
  var pinRect = pin.getBoundingClientRect();
  var side = targetStop.getAttribute('data-side');

  // Build truck HTML
  var truckSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  var flagSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

  var truckLabel = isFinished ? 'DONE' : (stops[truckIdx].status || '');

  var truck = document.createElement('div');
  truck.className = 'rs-truck' + (isFinished ? ' finished' : '');
  truck.innerHTML =
    '<div class="rs-truck-icon">' + truckSvg + '</div>' +
    '<div class="rs-truck-flag">' + flagSvg + '</div>' +
    '<span class="rs-truck-label">' + truckLabel + '</span>';

  // Position the truck next to the pin
  var topPos = pinRect.top - pRect.top + (pinRect.height / 2) - 14;

  if (side === 'left') {
    // Place truck to the left of the pin
    truck.style.position = 'absolute';
    truck.style.top = topPos + 'px';
    truck.style.right = (pRect.right - pinRect.left + 6) + 'px';
    truck.style.flexDirection = 'row-reverse';
  } else {
    // Place truck to the right of the pin
    truck.style.position = 'absolute';
    truck.style.top = topPos + 'px';
    truck.style.left = (pinRect.right - pRect.left + 6) + 'px';
  }

  contentEl.appendChild(truck);
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
