/**
 * WISE System - Route Preview Map Component
 * OpenStreetMap + Leaflet + OpenRouteService (via wise-backend proxy)
 *
 * CRITICAL REQUIREMENTS:
 *  1. NO GPS, NO BROWSER GEOLOCATION, NO CONTINUOUS MOVEMENT, NO TRAVEL PROGRESS SIMULATION.
 *  2. Truck icon is positioned strictly at the current scheduled stop and jumps directly
 *     to the next scheduled stop ONLY when that stop's scheduled time is reached.
 *  3. Accurate, verified coordinates for all Muntinlupa barangays and landmarks.
 *  4. Road-following route geometry via OpenRouteService backend proxy.
 *  5. Independent tracking for multiple trucks with distinct colors.
 *  6. Clear "Schedule-based — Not live GPS" notices across all UI elements.
 */

// =========================================================================
// 0. DEPOT & ADMINISTRATIVE BOUNDARY CONFIGURATION
// =========================================================================

/**
 * Default Truck Dispatch Depot (Arandia Street, Barangay Tunasan, Muntinlupa City)
 * Leaflet requires [latitude, longitude].
 * OpenRouteService requires [longitude, latitude].
 */
var DEFAULT_DEPOT = {
  name: 'Tunasan Dispatch Depot',
  address: 'Arandia Street, Barangay Tunasan, Muntinlupa City',
  lat: 14.384538,
  lng: 121.051391,
  coord: [14.384538, 121.051391],   // Leaflet [latitude, longitude]
  orsCoord: [121.051391, 14.384538] // ORS Directions [longitude, latitude]
};

// Official Muntinlupa City Administrative Extents
var MUNTINLUPA_BOUNDS = [
  [14.3472, 121.0079], // Southwest [lat, lng]
  [14.4680, 121.1344]  // Northeast [lat, lng]
];

// Panning boundary restrictions with comfort padding
var MUNTINLUPA_PAN_BOUNDS = [
  [14.3300, 120.9800], // Southwest [lat, lng]
  [14.4850, 121.1600]  // Northeast [lat, lng]
];

// Module state
var _leafletMap = null;
var _baseLayers = [];   // Permanent mask & boundary layers
var _routeLayers = [];  // Dynamic route markers, lines, truck icons
var _truckDataList = [];
var _truckClockInterval = null;
var _routeGeometries = {};

// Palette for up to 10 distinct truck routes
var ROUTE_COLORS = [
  '#16A34A', // Green
  '#2563EB', // Blue
  '#D97706', // Amber
  '#9333EA', // Purple
  '#DC2626', // Red
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#0284C7'  // Sky
];

/**
 * Creates an inverted polygon mask that shades regions outside Muntinlupa City.
 * Leaves the official administrative area of Muntinlupa fully clear and illuminated.
 */
function createMuntinlupaMask() {
  if (typeof MUNTINLUPA_BOUNDARY_GEOJSON === 'undefined' || !MUNTINLUPA_BOUNDARY_GEOJSON.coordinates) {
    return null;
  }
  var outerRing = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180]
  ];
  var hole = MUNTINLUPA_BOUNDARY_GEOJSON.coordinates[0].map(function (pt) {
    return [pt[1], pt[0]]; // [lon, lat] -> Leaflet [lat, lng]
  });
  return L.polygon([outerRing, hole], {
    fillColor: '#0f172a',
    fillOpacity: 0.32,
    stroke: false,
    interactive: false
  });
}

/**
 * Creates a clean boundary line along the official Muntinlupa administrative perimeter.
 */
function createMuntinlupaBoundaryOutline() {
  if (typeof MUNTINLUPA_BOUNDARY_GEOJSON === 'undefined' || !MUNTINLUPA_BOUNDARY_GEOJSON.coordinates) {
    return null;
  }
  var ring = MUNTINLUPA_BOUNDARY_GEOJSON.coordinates[0].map(function (pt) {
    return [pt[1], pt[0]];
  });
  return L.polyline(ring, {
    color: '#16A34A',
    weight: 2,
    dashArray: '6, 6',
    opacity: 0.85,
    interactive: false
  });
}

/**
 * Ray-casting Point-in-Polygon check against the official Muntinlupa administrative boundary.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean} true if inside Muntinlupa City
 */
function isCoordInsideMuntinlupa(lat, lng) {
  if (typeof MUNTINLUPA_BOUNDARY_GEOJSON === 'undefined' || !MUNTINLUPA_BOUNDARY_GEOJSON.coordinates) {
    return true; // Fallback if GeoJSON not loaded
  }
  var ring = MUNTINLUPA_BOUNDARY_GEOJSON.coordinates[0];
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    var intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// =========================================================================
// 1. ACCURATE COORDINATES REGISTRY (Muntinlupa City, verified via OSM)
// =========================================================================

// Official centroid coordinates for the 9 Muntinlupa Barangays [lat, lng]
var BARANGAY_COORDS = {
  'Sucat': [14.45698, 121.05316],
  'Buli': [14.44330, 121.05058],
  'Cupang': [14.43788, 121.05032],
  'Alabang': [14.41903, 121.04434],
  'Ayala Alabang': [14.42261, 121.02694],
  'New Alabang Village': [14.42261, 121.02694],
  'Bayanan': [14.41095, 121.05163],
  'Putatan': [14.39497, 121.04483],
  'Poblacion': [14.38923, 121.04491],
  'Tunasan': [14.38011, 121.05148]
};

// Verified landmark and street coordinates [lat, lng]
var LANDMARK_COORDS = {
  // --- Alabang ---
  'Alabang|Alabang Public Market': [14.41928, 121.04453],
  'Alabang|Alabang Market': [14.41928, 121.04453],
  'Alabang|Muntinlupa City Public Market': [14.41928, 121.04453],
  'Alabang|Festival Mall': [14.41673, 121.04078],
  'Alabang|Asian Hospital and Medical Center': [14.41317, 121.04356],
  'Alabang|Alabang Town Center': [14.42423, 121.03209],
  'Alabang|Filinvest City Central Park': [14.41690, 121.03574],
  'Alabang|Filinvest Covered Court': [14.41289, 121.04428],
  'Alabang|Northgate Cyberzone': [14.42508, 121.03895],
  'Alabang|South Station': [14.42132, 121.04278],
  'Alabang|St. Jerome Emiliani and Sta. Susana Parish': [14.42208, 121.03162],
  'Alabang|Saint Jerome Emiliani': [14.42208, 121.03162],
  'Alabang|Zone 1': [14.42100, 121.04400],
  'Alabang|Zone 2': [14.41800, 121.04200],

  // --- New Alabang Village / Ayala Alabang ---
  'New Alabang Village|New Alabang Village (Ayala Alabang)': [14.42261, 121.02694],
  'New Alabang Village|Ayala Alabang Barangay Hall': [14.41832, 121.02435],
  'New Alabang Village|Alabang Country Club': [14.40247, 121.02210],
  'New Alabang Village|The Palms Country Club': [14.41071, 121.03460],
  'New Alabang Village|San James the Great Parish': [14.39160, 121.01412],
  'New Alabang Village|Saint James the Great Parish': [14.39160, 121.01412],
  'New Alabang Village|Molito Lifestyle Center': [14.42432, 121.02677],
  'New Alabang Village|Madrigal Avenue': [14.42306, 121.02707],
  'New Alabang Village|Acacia Avenue': [14.39929, 121.01326],
  'New Alabang Village|Molave Street': [14.41664, 121.02188],
  'New Alabang Village|Narra Street': [14.41258, 121.02033],
  'New Alabang Village|Yakal Street': [14.42178, 121.02569],
  'New Alabang Village|Zone 1': [14.42300, 121.02700],
  'New Alabang Village|Zone 2': [14.41800, 121.02400],
  // Aliases for Ayala Alabang
  'Ayala Alabang|New Alabang Village (Ayala Alabang)': [14.42261, 121.02694],
  'Ayala Alabang|Ayala Alabang Barangay Hall': [14.41832, 121.02435],
  'Ayala Alabang|Alabang Country Club': [14.40247, 121.02210],
  'Ayala Alabang|The Palms Country Club': [14.41071, 121.03460],
  'Ayala Alabang|San James the Great Parish': [14.39160, 121.01412],
  'Ayala Alabang|Saint James the Great Parish': [14.39160, 121.01412],
  'Ayala Alabang|Molito Lifestyle Center': [14.42432, 121.02677],
  'Ayala Alabang|Madrigal Avenue': [14.42306, 121.02707],
  'Ayala Alabang|Acacia Avenue': [14.39929, 121.01326],
  'Ayala Alabang|Molave Street': [14.41664, 121.02188],
  'Ayala Alabang|Narra Street': [14.41258, 121.02033],
  'Ayala Alabang|Yakal Street': [14.42178, 121.02569],
  'Ayala Alabang|Zone 1': [14.42300, 121.02700],
  'Ayala Alabang|Zone 2': [14.41800, 121.02400],

  // --- Bayanan ---
  'Bayanan|Bayanan Barangay Hall': [14.41141, 121.05130],
  'Bayanan|Bayanan Public Market': [14.41095, 121.05163],
  'Bayanan|Bayanan Covered Court': [14.41095, 121.05163],
  'Bayanan|Bayanan Health Center': [14.41095, 121.05163],
  'Bayanan|Bayanan Elementary School': [14.40696, 121.04527],
  'Bayanan|Bayanan National High School': [14.41095, 121.05163],
  'Bayanan|National Road': [14.40957, 121.04628],
  'Bayanan|Bayanan Road': [14.41095, 121.05163],
  'Bayanan|San Guillermo Chapel': [14.40702, 121.05003],
  'Bayanan|Bayanan Multi-Purpose Hall': [14.41095, 121.05163],
  'Bayanan|Zone 1': [14.41100, 121.05100],
  'Bayanan|Zone 2': [14.40900, 121.04800],

  // --- Buli ---
  'Buli|Buli': [14.44330, 121.05058],
  'Buli|Buli Barangay Hall': [14.44330, 121.05058],
  'Buli|Buli Covered Court': [14.44335, 121.04804],
  'Buli|Buli Health Center': [14.44330, 121.05058],
  'Buli|Buli Elementary School': [14.44335, 121.04804],
  'Buli|Marina Road': [14.44350, 121.04950],
  'Buli|Buli Road': [14.44330, 121.05058],
  'Buli|East Service Road': [14.44555, 121.04548],
  'Buli|Lakefront Area': [14.45020, 121.05100],
  'Buli|Buli Multi-Purpose Hall': [14.44330, 121.05058],
  'Buli|Buli Concepcion Road': [14.44330, 121.05058],
  'Buli|Zone 1': [14.44400, 121.04900],
  'Buli|Zone 2': [14.44200, 121.05100],

  // --- Cupang ---
  'Cupang|Barangay Cupang Hall (NEW)': [14.43893, 121.05131],
  'Cupang|Old Barangay Cupang Hall': [14.43788, 121.05032],
  'Cupang|Barangay Cupang Multi-Purpose Hall': [14.43788, 121.05032],
  'Cupang|Cupang Covered Court': [14.43788, 121.05032],
  'Cupang|Cupang Elementary School': [14.43040, 121.04949],
  'Cupang|Cupang Health Center': [14.43788, 121.05032],
  'Cupang|Soldiers Hills Road': [14.40011, 121.03921],
  'Cupang|Daang Hari Road': [14.42340, 121.02256],
  'Cupang|East Service Road': [14.43577, 121.04557],
  'Cupang|Posadas Open Area': [14.45940, 121.04869],
  'Cupang|Zone 1': [14.43800, 121.05000],
  'Cupang|Zone 2': [14.43500, 121.04800],

  // --- Poblacion ---
  'Poblacion|Barangay Poblacion Hall': [14.38923, 121.04491],
  'Poblacion|Muntinlupa Central Market': [14.38992, 121.04808],
  'Poblacion|Southville 3 Covered Court': [14.37185, 121.02370],
  'Poblacion|KVHAI Covered Court': [14.38508, 121.02261],
  'Poblacion|Covered Court': [14.38508, 121.02261],
  'Poblacion|Muntinlupa City Hall': [14.39511, 121.04419],
  'Poblacion|Medical Center Muntinlupa': [14.39496, 121.04520],
  'Poblacion|National Road': [14.38836, 121.04541],
  'Poblacion|Rizal Street': [14.38992, 121.04808],
  'Poblacion|Katarungan Road': [14.38508, 121.02261],
  'Poblacion|Zone 1': [14.39000, 121.04600],
  'Poblacion|Zone 2': [14.38700, 121.04400],

  // --- Putatan ---
  'Putatan|Barangay Putatan Barangay Hall': [14.39500, 121.04832],
  'Putatan|Mutual Homes 1&2 Covered Court': [14.40099, 121.03288],
  'Putatan|SMB Hills Covered Court': [14.39497, 121.04483],
  'Putatan|Puregold Putatan': [14.39831, 121.04637],
  'Putatan|Savemore Putatan': [14.39681, 121.04418],
  'Putatan|Pedro Diaz Street': [14.39223, 121.04199],
  'Putatan|Country Homes Avenue': [14.39125, 121.04463],
  'Putatan|Putatan Health Center': [14.39497, 121.04483],
  'Putatan|Putatan Elementary School': [14.39433, 121.05009],
  'Putatan|National Road': [14.39722, 121.04511],
  'Putatan|Zone 1': [14.39600, 121.04600],
  'Putatan|Zone 2': [14.39300, 121.04300],

  // --- Sucat ---
  'Sucat|Sucat': [14.45698, 121.05316],
  'Sucat|Sucat Barangay Hall': [14.45680, 121.05358],
  'Sucat|Sucat Multi-Purpose Covered Court': [14.45698, 121.05316],
  'Sucat|Bagong Silang Plaza Covered Court': [14.44482, 121.04257],
  'Sucat|Sitio Pagkakaisa Covered Court': [14.46608, 121.04709],
  'Sucat|Lakefront Open Area': [14.46632, 121.05422],
  'Sucat|Dr. A. Santos Avenue': [14.45361, 121.04565],
  'Sucat|East Service Road': [14.44977, 121.04547],
  'Sucat|West Service Road': [14.44790, 121.04516],
  'Sucat|Sucat Health Center': [14.45698, 121.05316],
  'Sucat|Sucat Elementary School': [14.45754, 121.05269],
  'Sucat|Zone 1': [14.45700, 121.05200],
  'Sucat|Zone 2': [14.45400, 121.04800],

  // --- Tunasan ---
  'Tunasan|Tunasan Barangay Hall': [14.37684, 121.04791],
  'Tunasan|Tunasan Covered Court': [14.38011, 121.05148],
  'Tunasan|Covered Court': [14.38011, 121.05148],
  "Tunasan|Tunasan People's Market": [14.37567, 121.04759],
  'Tunasan|Tunasan Health Center': [14.38011, 121.05148],
  'Tunasan|Tunasan Elementary School': [14.38105, 121.05149],
  'Tunasan|National Road': [14.38739, 121.04543],
  'Tunasan|Rodriguez Street': [14.37768, 121.04953],
  'Tunasan|Buendia Street': [14.37956, 121.05250],
  'Tunasan|Golden Gate Park Homes': [14.37502, 121.04505],
  'Tunasan|Zone 1': [14.38000, 121.05000],
  'Tunasan|Zone 2': [14.37700, 121.04800]
};

/**
 * Validates coordinate array and detects swapped lat/long values.
 * Returns sanitized [lat, lng] or null.
 */
function validateAndSanitizeCoord(raw) {
  if (!raw || !Array.isArray(raw) || raw.length < 2) return null;
  var lat = Number(raw[0]);
  var lng = Number(raw[1]);
  if (isNaN(lat) || isNaN(lng)) return null;

  // Detect swapped coordinates where longitude was placed in the first position
  if (lat > 90 && lng <= 90) {
    console.warn('[WISE Coordinate Validator] Detected swapped [lng, lat] coordinate, auto-correcting:', raw);
    var tmp = lat;
    lat = lng;
    lng = tmp;
  }

  // Range validation: lat [-90, 90], lng [-180, 180]
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.error('[WISE Coordinate Validator] Out-of-bounds coordinate:', raw);
    return null;
  }

  return [lat, lng];
}

/**
 * Resolves a stop's geographic coordinate [lat, lng].
 * Checks specific street/landmark first, falls back to barangay centroid,
 * and flags approximate or missing coordinates.
 *
 * @param {string} barangay
 * @param {string} street
 * @returns {Object} { coord: [lat, lng]|null, isExact: boolean, isApproximate: boolean, isFlagged: boolean, reason: string|null }
 */
function resolveStopCoords(barangay, street) {
  var bNorm = (barangay || '').trim();
  var sNorm = (street || '').trim();

  // Normalize aliases
  var bLookup = bNorm;
  if (/ayala\s*alabang/i.test(bNorm)) bLookup = 'New Alabang Village';
  if (/^barangay\s+/i.test(bLookup)) bLookup = bLookup.replace(/^barangay\s+/i, '').trim();

  var result = null;

  // 1. Direct landmark match (Exact)
  if (bLookup && sNorm) {
    var key = bLookup + '|' + sNorm;
    if (LANDMARK_COORDS[key]) {
      var c1 = validateAndSanitizeCoord(LANDMARK_COORDS[key]);
      if (c1) result = { coord: c1, isExact: true, isApproximate: false, isFlagged: false, reason: null };
    }
    if (!result) {
      var keyAlt = bNorm + '|' + sNorm;
      if (LANDMARK_COORDS[keyAlt]) {
        var c2 = validateAndSanitizeCoord(LANDMARK_COORDS[keyAlt]);
        if (c2) result = { coord: c2, isExact: true, isApproximate: false, isFlagged: false, reason: null };
      }
    }
  }

  // 2. Case-insensitive / partial match in LANDMARK_COORDS
  if (!result && sNorm) {
    var sLower = sNorm.toLowerCase();
    for (var lk in LANDMARK_COORDS) {
      var parts = lk.split('|');
      var bPart = parts[0].toLowerCase();
      var sPart = parts[1].toLowerCase();
      var bMatches = !bLookup || bPart === bLookup.toLowerCase() || bPart === bNorm.toLowerCase();
      if (bMatches && (sPart === sLower || sPart.indexOf(sLower) !== -1 || sLower.indexOf(sPart) !== -1)) {
        var c3 = validateAndSanitizeCoord(LANDMARK_COORDS[lk]);
        if (c3) {
          result = { coord: c3, isExact: true, isApproximate: false, isFlagged: false, reason: null };
          break;
        }
      }
    }
  }

  // 3. Fallback to Barangay centroid (Approximate)
  if (!result) {
    var bCenter = BARANGAY_COORDS[bLookup] || BARANGAY_COORDS[bNorm];
    if (bCenter) {
      var c4 = validateAndSanitizeCoord(bCenter);
      if (c4) {
        result = {
          coord: c4,
          isExact: false,
          isApproximate: true,
          isFlagged: false,
          reason: sNorm ? ('Exact address "' + sNorm + '" not mapped; using barangay center.') : null
        };
      }
    }
  }

  // 4. Missing / unresolvable
  if (!result) {
    console.warn('[WISE Coordinate Resolver] Unresolvable location:', bNorm, sNorm);
    return {
      coord: null,
      isExact: false,
      isApproximate: false,
      isFlagged: true,
      reason: 'Coordinates could not be found for ' + (bNorm || 'Unknown Barangay') + (sNorm ? (' - ' + sNorm) : '')
    };
  }

  // 5. Official Muntinlupa City Administrative Boundary Validation
  if (result.coord) {
    var inside = isCoordInsideMuntinlupa(result.coord[0], result.coord[1]);
    if (!inside) {
      result.isOutOfBoundary = true;
      result.isFlagged = true;
      result.reason = 'Coordinates [' + result.coord.join(', ') + '] fall outside Muntinlupa City boundary. Flagged for review.';
    }
  }

  return result;
}

// =========================================================================
// 2. SCHEDULE-BASED POSITION ALGORITHM (NO GPS, NO CONTINUOUS MOVEMENT)
// =========================================================================

/**
 * Parses a time string (HH:MM or HH:MM:SS) into integer minutes since midnight.
 */
function parseTimeToMinutes(t) {
  if (!t) return null;
  var str = (t + '').trim();
  var match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  var h = parseInt(match[1], 10);
  var m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Formats minutes since midnight into 12-hour string (e.g. 7:00 AM).
 */
function formatMinutes12(minutes) {
  if (minutes === null || isNaN(minutes)) return '';
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

/**
 * Obtains a Date object reflecting the current instant in Asia/Manila.
 */
function getManilaDate(customDate) {
  var d = customDate ? (customDate instanceof Date ? customDate : new Date(customDate)) : new Date();
  var str = d.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  return new Date(str);
}

/**
 * Formats a Date object into YYYY-MM-DD in Asia/Manila.
 */
function getManilaTodayStr(manilaDate) {
  var d = manilaDate || getManilaDate();
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/**
 * Pure calculation of the truck's schedule-based location.
 * - Stationary at the configured Tunasan Depot BEFORE the first stop's scheduled time or for future dates.
 * - Jumps directly to Stop 1 at Stop 1's exact scheduled time.
 * - Jumps directly to each subsequent stop at its scheduled time and remains stationary.
 * - Stays at the final stop once reached.
 * - NO GPS, NO continuous movement, NO interpolation between stops.
 *
 * @param {Array} stops - List of collection stop objects with .collection_time
 * @param {string} collectionDate - 'YYYY-MM-DD' date string
 * @param {Date|null} customNow - Optional moment for testing
 * @returns {Object|null}
 */
function calcTruckSchedulePosition(stops, collectionDate, customNow) {
  if (!stops || stops.length === 0) return null;

  var manilaNow = customNow ? getManilaDate(customNow) : getManilaDate();
  var todayStr = getManilaTodayStr(manilaNow);
  var schedDateStr = (collectionDate || '').slice(0, 10) || todayStr;

  var isToday = (schedDateStr === todayStr);
  var isPast = (schedDateStr < todayStr);
  var isFuture = (schedDateStr > todayStr);

  var parsedTimes = stops.map(function (s) {
    return parseTimeToMinutes(s.collection_time);
  });

  var firstStopName = stops[0].street || stops[0].barangay || 'Stop 1';

  // 1. PAST collection date -> Route completed; stationary at final stop
  if (isPast) {
    var lastIdx = stops.length - 1;
    var finalStopName = stops[lastIdx].street || stops[lastIdx].barangay || ('Stop ' + (lastIdx + 1));
    return {
      status: 'Completed',
      isAtDepot: false,
      stopIdx: lastIdx,
      nextStopIdx: null,
      currentStop: stops[lastIdx],
      nextStop: null,
      coord: null,
      isToday: false,
      isPast: true,
      isFuture: false,
      detailText: 'Route completed on ' + schedDateStr + ' at ' + finalStopName,
      badgeClass: 'status-completed'
    };
  }

  // 2. FUTURE collection date -> Truck stationary at Tunasan Depot
  if (isFuture) {
    var depTimeStr = parsedTimes[0] !== null ? (' at ' + formatMinutes12(parsedTimes[0])) : '';
    return {
      status: 'At Depot',
      isAtDepot: true,
      stopIdx: null,
      nextStopIdx: 0,
      currentStop: null,
      nextStop: stops[0],
      coord: DEFAULT_DEPOT.coord,
      isToday: false,
      isPast: false,
      isFuture: true,
      detailText: 'At Tunasan Depot \u2014 Scheduled for ' + schedDateStr + depTimeStr + ' (' + firstStopName + ')',
      badgeClass: 'status-scheduled'
    };
  }

  // 3. TODAY: Compare current Manila time to scheduled stop times
  var currentMinutes = manilaNow.getHours() * 60 + manilaNow.getMinutes();

  // Before first scheduled stop time: Truck remains stationary at the configured depot
  if (parsedTimes[0] !== null && currentMinutes < parsedTimes[0]) {
    return {
      status: 'At Depot',
      isAtDepot: true,
      stopIdx: null,
      nextStopIdx: 0,
      currentStop: null,
      nextStop: stops[0],
      coord: DEFAULT_DEPOT.coord,
      isToday: true,
      isPast: false,
      isFuture: false,
      detailText: 'At Tunasan Depot \u2014 Departs at ' + formatMinutes12(parsedTimes[0]) + ' for ' + firstStopName,
      badgeClass: 'status-scheduled'
    };
  }

  // If first stop has no valid time: stay safely at depot
  if (parsedTimes[0] === null) {
    return {
      status: 'At Depot',
      isAtDepot: true,
      stopIdx: null,
      nextStopIdx: 0,
      currentStop: null,
      nextStop: stops[0],
      coord: DEFAULT_DEPOT.coord,
      isToday: true,
      isPast: false,
      isFuture: false,
      detailText: 'At Tunasan Depot \u2014 Departure time pending for ' + firstStopName,
      badgeClass: 'status-scheduled'
    };
  }

  // At or after first stop's scheduled time:
  // Select the latest stop whose scheduled time has been reached
  var activeStopIdx = 0;
  for (var i = 0; i < stops.length; i++) {
    if (parsedTimes[i] !== null && currentMinutes >= parsedTimes[i]) {
      activeStopIdx = i;
    }
  }

  // If latest reached stop is the final stop:
  if (activeStopIdx === stops.length - 1) {
    var lastStopPlace = stops[activeStopIdx].street || stops[activeStopIdx].barangay || ('Stop ' + (activeStopIdx + 1));
    return {
      status: 'Completed',
      isAtDepot: false,
      stopIdx: activeStopIdx,
      nextStopIdx: null,
      currentStop: stops[activeStopIdx],
      nextStop: null,
      coord: null,
      isToday: true,
      isPast: false,
      isFuture: false,
      detailText: 'Completed route at ' + lastStopPlace + ' (' + formatMinutes12(parsedTimes[activeStopIdx]) + ')',
      badgeClass: 'status-completed'
    };
  }

  // Stationary at the active scheduled stop; next stop pending arrival time
  var nextIdx = activeStopIdx + 1;
  var nextTimeStr = parsedTimes[nextIdx] !== null ? (' at ' + formatMinutes12(parsedTimes[nextIdx])) : '';
  var currentName = stops[activeStopIdx].street || stops[activeStopIdx].barangay || ('Stop ' + (activeStopIdx + 1));
  var nextName = stops[nextIdx].street || stops[nextIdx].barangay || ('Stop ' + (nextIdx + 1));

  return {
    status: 'At Scheduled Stop',
    isAtDepot: false,
    stopIdx: activeStopIdx,
    nextStopIdx: nextIdx,
    currentStop: stops[activeStopIdx],
    nextStop: stops[nextIdx],
    coord: null,
    isToday: true,
    isPast: false,
    isFuture: false,
    detailText: 'At ' + currentName + ' \u2192 Next: ' + nextName + nextTimeStr,
    badgeClass: 'status-active'
  };
}

// =========================================================================
// 3. MAP INITIALIZATION & CLEANUP
// =========================================================================

function ensureMapInitialised() {
  var container = document.getElementById('route-leaflet-map');
  if (!container) return false;
  if (_leafletMap) {
    setTimeout(function () {
      if (_leafletMap) _leafletMap.invalidateSize();
    }, 60);
    return true;
  }

  try {
    _leafletMap = L.map('route-leaflet-map', {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      minZoom: 11,
      maxBounds: MUNTINLUPA_PAN_BOUNDS,
      maxBoundsViscosity: 0.85
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(_leafletMap);

    // Visually mask regions outside official Muntinlupa boundary without covering city
    var mask = createMuntinlupaMask();
    if (mask) {
      mask.addTo(_leafletMap);
      _baseLayers.push(mask);
    }

    var outline = createMuntinlupaBoundaryOutline();
    if (outline) {
      outline.addTo(_leafletMap);
      _baseLayers.push(outline);
    }

    // Initial fit strictly to Muntinlupa City official boundary
    _leafletMap.fitBounds(MUNTINLUPA_BOUNDS, { padding: [12, 12] });

    setTimeout(function () {
      if (_leafletMap) _leafletMap.invalidateSize();
    }, 100);
    return true;
  } catch (err) {
    console.error('[WISE Route Map] Leaflet init error:', err);
    return false;
  }
}

/**
 * Renders the default Muntinlupa City service area overview map
 * when no specific route or assignment is active.
 * Ensures the map is NEVER blank or hidden!
 */
function renderMuntinlupaOverview(customNote) {
  var mapEl = document.getElementById('route-leaflet-map');
  var infoEl = document.getElementById('route-preview-info');
  var emptyEl = document.getElementById('route-diagram-empty');
  if (emptyEl) emptyEl.style.display = 'none';
  if (!mapEl) return;

  mapEl.style.display = 'block';
  clearMapLayers();
  if (!ensureMapInitialised()) return;

  // Add Tunasan Dispatch Depot Pin ("D")
  var depotIcon = L.divIcon({
    html: '<div class="wise-depot-pin" title="' + escapeHtml(DEFAULT_DEPOT.name) + '">D</div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  var depotMarker = L.marker(DEFAULT_DEPOT.coord, { icon: depotIcon, zIndexOffset: 300 });
  depotMarker.bindTooltip('<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong><br><small>' + escapeHtml(DEFAULT_DEPOT.address) + '</small>', { direction: 'top', offset: [0, -15] });
  depotMarker.bindPopup('<div class="wise-map-popup">' +
    '<div class="wmp-header" style="border-left:3.5px solid #F59E0B">' +
    '<span class="wmp-badge" style="background:#FEF3C7;color:#B45309">Fleet Dispatch Depot</span>' +
    '<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong>' +
    '<div class="wmp-street">' + escapeHtml(DEFAULT_DEPOT.address) + '</div>' +
    '</div>' +
    '<div class="wmp-notice">\ud83c\udfed Starting depot for all scheduled routes before Stop 1</div>' +
    '</div>');
  addLayer(depotMarker);

  // Add all Muntinlupa Barangay zone pins
  for (var bName in BARANGAY_COORDS) {
    if (bName === 'Ayala Alabang') continue; // Avoid duplicate marker over New Alabang Village
    var coord = BARANGAY_COORDS[bName];
    var bColor = (BARANGAY_COLORS && BARANGAY_COLORS[bName] ? BARANGAY_COLORS[bName].bg : '#4B5563');

    var pinIcon = L.divIcon({
      html: '<div class="wise-stop-pin" style="background:' + bColor + ';border-color:#ffffff;width:24px;height:24px;font-size:10px" title="' + escapeHtml(bName) + '">' + escapeHtml(bName.substring(0, 1)) + '</div>',
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    var marker = L.marker(coord, { icon: pinIcon });
    marker.bindTooltip('<strong>Barangay ' + escapeHtml(bName) + '</strong><br><small style="color:#6B7280">WISE Collection Zone</small>', {
      direction: 'top',
      offset: [0, -12]
    });
    addLayer(marker);
  }

  if (_leafletMap) {
    _leafletMap.fitBounds(MUNTINLUPA_BOUNDS, { padding: [12, 12] });
    setTimeout(function () {
      if (_leafletMap) _leafletMap.invalidateSize();
    }, 80);
  }

  if (infoEl) {
    infoEl.innerHTML = '<div class="route-map-dashboard">' +
      '<div class="rmd-header">' +
      '<span class="rmd-title">\ud83d\uddfa\ufe0f Muntinlupa Collection Zones</span>' +
      '<span class="rmd-schedule-badge">\ud83d\udcc5 System Overview</span>' +
      '</div>' +
      '<div style="font-size:11.5px;color:var(--sc-text-secondary);padding:4px 0">' +
      escapeHtml(customNote || 'Select an assignment or date in the calendar to view its road route & schedule.') +
      '</div>' +
      '</div>';
  }
}

/**
 * Clear route diagram callback called by sidebar.js when no schedules exist for a day.
 */
function clearRouteDiagram() {
  renderMuntinlupaOverview('No collection assignments scheduled for this date. Click another date in the calendar.');
}

function clearMapLayers() {
  if (_leafletMap) {
    _routeLayers.forEach(function (l) {
      try { _leafletMap.removeLayer(l); } catch (e) { }
    });
  }
  _routeLayers = [];
  _truckDataList = [];
  stopTruckClock();
}

function addLayer(layer) {
  if (_leafletMap && layer) {
    layer.addTo(_leafletMap);
    _routeLayers.push(layer);
  }
}

// =========================================================================
// 4. LIGHTWEIGHT CLOCK (BOUNDARY DETECTION ONLY — NO RE-ROUTING)
// =========================================================================

function stopTruckClock() {
  if (_truckClockInterval) {
    clearInterval(_truckClockInterval);
    _truckClockInterval = null;
  }
}

function startTruckClock(truckList) {
  stopTruckClock();
  if (!truckList || truckList.length === 0) return;

  function tick() {
    var now = getManilaDate();
    truckList.forEach(function (td) {
      updateTruckMarkerPosition(td, now);
    });
  }

  // Update position every 20 seconds; does NOT make any API calls
  _truckClockInterval = setInterval(tick, 20000);
}

/**
 * Updates marker location and popups when a scheduled time boundary is crossed.
 * Truck jumps directly to the new stop marker and remains stationary.
 */
function updateTruckMarkerPosition(td, now) {
  if (!td.marker || !td.assignment || !td.assignment.stops) return;
  var posInfo = calcTruckSchedulePosition(td.assignment.stops, td.collectionDate, now);
  if (!posInfo) return;

  var targetCoord;
  if (posInfo.isAtDepot) {
    targetCoord = DEFAULT_DEPOT.coord;
  } else if (posInfo.stopIdx !== null && td.stopCoords[posInfo.stopIdx]) {
    targetCoord = td.stopCoords[posInfo.stopIdx];
  } else {
    targetCoord = DEFAULT_DEPOT.coord;
  }

  // Direct stationary placement — NO INTERPOLATION
  td.marker.setLatLng(targetCoord);

  var truckName = td.assignment.truck || 'Truck';
  var statusBadge = posInfo.status;

  td.marker.setIcon(makeTruckIcon(td.color, '[' + statusBadge + '] ' + truckName));

  if (td.marker.getTooltip()) {
    td.marker.setTooltipContent(
      '<strong>' + escapeHtml(truckName) + '</strong><br>' +
      '<span class="wmp-status-pill ' + posInfo.badgeClass + '">' + escapeHtml(statusBadge) + '</span><br>' +
      '<small style="opacity:0.85;font-size:10px">\u26a0 Schedule-based \u2014 No GPS<br>' + escapeHtml(posInfo.detailText) + '</small>'
    );
  }
}

// =========================================================================
// 5. ICONS & STYLING (STOP PINS & TRUCK MARKER)
// =========================================================================

function makeTruckIcon(color, titleText) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">' +
    '<circle cx="19" cy="19" r="18" fill="' + color + '" opacity="0.22"/>' +
    '<circle cx="19" cy="19" r="14.5" fill="' + color + '" stroke="#ffffff" stroke-width="2.5"/>' +
    '<g transform="translate(8.5,11) scale(0.9)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="1" y="1" width="12" height="10"/>' +
    '<polygon points="13 5 17 5 19 8 19 13 13 13 13 5"/>' +
    '<circle cx="4" cy="15" r="2"/>' +
    '<circle cx="16" cy="15" r="2"/>' +
    '</g>' +
    '</svg>';

  return L.divIcon({
    html: '<div class="wise-truck-marker" title="' + escapeHtml(titleText) + '">' + svg + '</div>',
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });
}

function makeStopPinIcon(label, bColor, borderColor, isFirst, isLast) {
  var pinClass = 'wise-stop-pin' + (isFirst ? ' start-pin' : (isLast ? ' end-pin' : ''));
  return L.divIcon({
    html: '<div class="' + pinClass + '" style="background:' + bColor + ';border-color:' + borderColor + '">' + escapeHtml(label) + '</div>',
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

// =========================================================================
// 6. ROAD ROUTING (VIA BACKEND ORS PROXY)
// =========================================================================

async function fetchRouteGeometry(waypoints) {
  // ORS Directions API expects [longitude, latitude]
  var orsCoords = waypoints.map(function (w) { return [w[1], w[0]]; });

  try {
    var res = await apiRequest('/api/routing/directions', {
      method: 'POST',
      body: JSON.stringify({ coordinates: orsCoords })
    });

    if (!res || !res.ok) {
      var errDetail = 'HTTP ' + (res ? res.status : 'error');
      try {
        var errBody = await res.json();
        if (errBody && errBody.detail) errDetail = errBody.detail;
      } catch (e) { }
      throw new Error(errDetail);
    }

    var geojson = await res.json();
    var feature = geojson && (geojson.features ? geojson.features[0] : geojson);
    if (!feature || !feature.geometry) throw new Error('No geometry in response');

    return {
      fullGeometry: feature.geometry,
      summary: feature.properties && feature.properties.summary
    };
  } catch (err) {
    console.warn('[WISE Route Map] ORS routing notice:', err.message);
    return null;
  }
}

// =========================================================================
// 7. MAIN ROUTE MAP RENDERER
// =========================================================================

async function renderRouteMap(assignments, label) {
  var mapEl = document.getElementById('route-leaflet-map');
  var infoEl = document.getElementById('route-preview-info');

  if (!mapEl) return;
  clearMapLayers();

  if (!assignments || assignments.length === 0) {
    mapEl.style.display = 'none';
    if (infoEl) infoEl.innerHTML = '';
    return;
  }

  mapEl.style.display = 'block';
  if (infoEl) {
    infoEl.innerHTML = '<div class="route-map-loading"><span class="rml-spinner"></span> Loading road route\u2026</div>';
  }

  if (!ensureMapInitialised()) {
    if (infoEl) infoEl.innerHTML = '<div class="route-map-error">Map could not be initialised.</div>';
    return;
  }

  var allBounds = [DEFAULT_DEPOT.coord];
  var newTruckList = [];
  var warningNotes = [];

  // Render the default configured Tunasan Dispatch Depot Pin ("D")
  var depotIcon = L.divIcon({
    html: '<div class="wise-depot-pin" title="' + escapeHtml(DEFAULT_DEPOT.name) + '">D</div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  var depotMarker = L.marker(DEFAULT_DEPOT.coord, { icon: depotIcon, zIndexOffset: 300 });
  depotMarker.bindTooltip('<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong><br><small>' + escapeHtml(DEFAULT_DEPOT.address) + '</small>', { direction: 'top', offset: [0, -15] });
  depotMarker.bindPopup('<div class="wise-map-popup">' +
    '<div class="wmp-header" style="border-left:3.5px solid #F59E0B">' +
    '<span class="wmp-badge" style="background:#FEF3C7;color:#B45309">Fleet Dispatch Depot</span>' +
    '<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong>' +
    '<div class="wmp-street">' + escapeHtml(DEFAULT_DEPOT.address) + '</div>' +
    '</div>' +
    '<div class="wmp-notice">\ud83c\udfed Starting depot for all scheduled routes before Stop 1</div>' +
    '</div>');
  addLayer(depotMarker);

  for (var aIdx = 0; aIdx < assignments.length; aIdx++) {
    var a = assignments[aIdx];
    var color = ROUTE_COLORS[aIdx % ROUTE_COLORS.length];

    // Resolve stop coordinates
    var resolvedStops = a.stops.map(function (s) {
      return resolveStopCoords(s.barangay, s.street || s.zone || '');
    });

    var stopCoords = [];
    resolvedStops.forEach(function (r, idx) {
      var stopPlace = (a.stops[idx] && (a.stops[idx].street || a.stops[idx].barangay)) || ('Stop ' + (idx + 1));
      if (r.coord) {
        stopCoords[idx] = r.coord;
        allBounds.push(r.coord);
        if (r.isOutOfBoundary) {
          warningNotes.push(a.truck + ' Stop ' + (idx + 1) + ' (' + stopPlace + '): Outside Muntinlupa boundary \u2014 Flagged for review');
        } else if (r.isApproximate && r.reason) {
          warningNotes.push(a.truck + ' Stop ' + (idx + 1) + ': ' + r.reason);
        }
      } else {
        stopCoords[idx] = null;
        warningNotes.push(a.truck + ' Stop ' + (idx + 1) + ': ' + (r.reason || 'Missing coordinates.'));
      }
    });

    var validCoords = stopCoords.filter(Boolean);
    if (validCoords.length === 0) {
      console.warn('[WISE Route Map] No valid coordinates for route:', a.routeName);
      continue;
    }

    // 1. Draw Stop Markers (Numbered 1, 2, 3...)
    a.stops.forEach(function (s, sIdx) {
      var coord = stopCoords[sIdx];
      if (!coord) return;

      var isFirst = (sIdx === 0);
      var isLast = (sIdx === a.stops.length - 1 && a.stops.length > 1);
      var numLabel = String(sIdx + 1);
      var borderColor = isFirst ? '#16A34A' : (isLast ? '#DC2626' : '#ffffff');
      var bColor = (BARANGAY_COLORS && BARANGAY_COLORS[s.barangay] ? BARANGAY_COLORS[s.barangay].bg : '#4B5563');

      var timeStr = s.collection_time ? formatTime12((s.collection_time + '').substring(0, 5)) : '';
      var pinIcon = makeStopPinIcon(numLabel, bColor, borderColor, isFirst, isLast);

      var placeName = escapeHtml(s.street || s.barangay || 'Collection Stop');
      var stopType = isFirst ? 'First Scheduled Stop' : (isLast ? 'Final Destination' : ('Collection Stop ' + (sIdx + 1)));

      var popupHtml = '<div class="wise-map-popup">' +
        '<div class="wmp-header" style="border-left:3.5px solid ' + bColor + '">' +
        '<span class="wmp-badge">' + stopType + '</span>' +
        '<strong>' + escapeHtml(s.barangay || '') + '</strong>' +
        (s.street ? '<div class="wmp-street">' + escapeHtml(s.street) + '</div>' : '') +
        '</div>' +
        (timeStr ? '<div class="wmp-time">\ud83d\udd50 ' + timeStr + '</div>' : '') +
        '<div class="wmp-meta">' + escapeHtml(a.truck || 'Truck') + ' \u00b7 Stop ' + (sIdx + 1) + ' of ' + a.stops.length + '</div>' +
        (resolvedStops[sIdx].isOutOfBoundary ? '<div class="wmp-warning" style="background:#FEE2E2;color:#991B1B;padding:4px 6px;border-radius:4px;margin-top:4px">\u26a0 Outside Muntinlupa City \u2014 Flagged for review</div>' : (resolvedStops[sIdx].isApproximate ? '<div class="wmp-warning">\u26a0 Approximate center (exact address unmapped)</div>' : '')) +
        '<div class="wmp-notice">\ud83d\udcc5 Scheduled itinerary \u2014 Not live GPS</div>' +
        '</div>';

      var stopMarker = L.marker(coord, { icon: pinIcon, zIndexOffset: 200 });
      stopMarker.bindPopup(popupHtml);
      stopMarker.bindTooltip('Stop ' + numLabel + ': ' + placeName + (timeStr ? ' \u00b7 ' + timeStr : ''), {
        direction: 'top',
        offset: [0, -14]
      });
      addLayer(stopMarker);
    });

    // 2. Fetch and Draw Road Route Line Starting from Tunasan Depot
    // Depot -> First scheduled stop -> Remaining scheduled stops
    var waypoints = [DEFAULT_DEPOT.coord].concat(validCoords);
    var routeResult = null;
    if (waypoints.length >= 2) {
      var cacheKey = waypoints.map(function (c) { return c.join(','); }).join('|');
      if (_routeGeometries[cacheKey]) {
        routeResult = _routeGeometries[cacheKey];
      } else {
        routeResult = await fetchRouteGeometry(waypoints);
        if (routeResult) _routeGeometries[cacheKey] = routeResult;
      }
    }

    var routeDistance = '';
    var routeDuration = '';

    if (routeResult && routeResult.fullGeometry) {
      // ORS coordinates are [longitude, latitude] -> convert to Leaflet [lat, lng]
      var latlngs = routeResult.fullGeometry.coordinates.map(function (c) {
        return [c[1], c[0]];
      });
      latlngs.forEach(function (ll) { allBounds.push(ll); });

      if (routeResult.summary) {
        routeDistance = (routeResult.summary.distance / 1000).toFixed(1) + ' km';
        routeDuration = Math.round(routeResult.summary.duration / 60) + ' min';
      }

      // Route Shadow Layer (halo)
      addLayer(L.polyline(latlngs, {
        color: color,
        weight: 9,
        opacity: 0.14,
        lineCap: 'round',
        lineJoin: 'round'
      }));

      // Main Road Route Polyline
      var roadLine = L.polyline(latlngs, {
        color: color,
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });

      var tooltipSummary = escapeHtml(a.routeName || a.truck) +
        (routeDistance ? ' \u00b7 ' + routeDistance : '') +
        (routeDuration ? ' \u00b7 ' + routeDuration : '');
      roadLine.bindTooltip(tooltipSummary, { sticky: true });
      addLayer(roadLine);
    } else if (waypoints.length >= 2) {
      // Fallback: dashed route line connecting Depot to stops
      var fallbackLine = L.polyline(waypoints, {
        color: color,
        weight: 3.5,
        opacity: 0.65,
        dashArray: '8, 6'
      });
      fallbackLine.bindTooltip('\u26a0 Road routing unavailable \u2014 straight line path from depot', { sticky: true });
      addLayer(fallbackLine);
    }

    // 3. Position Stationary Truck Icon
    // Must remain at Tunasan Depot until Stop 1 scheduled time arrives!
    var collDate = a.schedule ? String(a.schedule.collection_date || '').slice(0, 10) : '';
    var manilaNow = getManilaDate();
    var posInfo = calcTruckSchedulePosition(a.stops, collDate, manilaNow);

    var truckCoord;
    if (posInfo && posInfo.isAtDepot) {
      truckCoord = DEFAULT_DEPOT.coord;
    } else if (posInfo && posInfo.stopIdx !== null && stopCoords[posInfo.stopIdx]) {
      truckCoord = stopCoords[posInfo.stopIdx];
    } else {
      truckCoord = DEFAULT_DEPOT.coord;
    }

    if (truckCoord) {
      var truckTitle = '[' + (posInfo ? posInfo.status : 'At Depot') + '] ' + (a.truck || 'Truck');
      var truckMarker = L.marker(truckCoord, {
        icon: makeTruckIcon(color, truckTitle),
        zIndexOffset: 1500
      });

      var truckPopup = '<div class="wise-map-popup">' +
        '<div class="wmp-header" style="border-left:3.5px solid ' + color + '">' +
        '<span class="wmp-badge wmp-badge-truck">Assigned Fleet</span>' +
        '<strong>' + escapeHtml(a.truck || 'Collection Truck') + '</strong>' +
        '<div class="wmp-street">' + escapeHtml(a.personnel || 'Crew Assigned') + '</div>' +
        '</div>' +
        '<div class="wmp-status-pill ' + (posInfo ? posInfo.badgeClass : '') + '">' +
        escapeHtml(posInfo ? posInfo.status : 'At Depot') +
        '</div>' +
        '<div class="wmp-detail" style="margin:6px 0;font-size:11.5px">' +
        escapeHtml(posInfo ? posInfo.detailText : '') +
        '</div>' +
        (routeDistance ? '<div class="wmp-meta">\ud83d\udee3 ' + routeDistance + (routeDuration ? ' \u00b7 \u2248' + routeDuration : '') + ' (from Tunasan Depot)</div>' : '') +
        '<div class="wmp-notice">\u26a0 Schedule-based simulation \u2014 NOT a live GPS tracker</div>' +
        '</div>';

      truckMarker.bindPopup(truckPopup);
      truckMarker.bindTooltip(
        '<strong>' + escapeHtml(a.truck || 'Truck') + '</strong><br>' +
        '<span style="font-size:10.5px">' + escapeHtml(posInfo ? posInfo.status : 'At Depot') + '</span><br>' +
        '<small style="opacity:0.8;font-size:9.5px">\u26a0 Schedule-based \u2014 No GPS</small>',
        { direction: 'top', offset: [0, -18] }
      );
      addLayer(truckMarker);

      newTruckList.push({
        assignment: a,
        stopCoords: stopCoords,
        color: color,
        collectionDate: collDate,
        marker: truckMarker,
        routeDistance: routeDistance,
        routeDuration: routeDuration
      });
    }
  }

  // 4. Fit map strictly to full Muntinlupa boundary
  if (_leafletMap) {
    try {
      _leafletMap.fitBounds(MUNTINLUPA_BOUNDS, {
        padding: [12, 12]
      });
    } catch (e) { }
  }

  _truckDataList = newTruckList;
  startTruckClock(newTruckList);

  // 5. Render Logistics Summary & Legend
  renderRouteInfoBar(assignments, label, newTruckList, warningNotes, infoEl);
}

// =========================================================================
// 8. LOGISTICS DASHBOARD SUMMARY & LEGEND BAR
// =========================================================================

function renderRouteInfoBar(assignments, label, truckList, warnings, infoEl) {
  if (!infoEl) return;

  var manilaNow = getManilaDate();
  var html = '<div class="route-map-dashboard">';

  // Header / Title Row
  html += '<div class="rmd-header">';
  if (label) {
    html += '<span class="rmd-title">' + escapeHtml(label) + '</span>';
  }
  html += '<span class="rmd-schedule-badge">\ud83d\udcc5 Schedule-Based Simulation \u00b7 No GPS</span>';
  html += '</div>';

  // Per-truck summary cards
  html += '<div class="rmd-trucks-grid">';
  assignments.forEach(function (a, idx) {
    var color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
    var td = truckList ? truckList[idx] : null;
    var collDate = a.schedule ? String(a.schedule.collection_date || '').slice(0, 10) : '';
    var posInfo = calcTruckSchedulePosition(a.stops, collDate, manilaNow);

    var stopCount = a.stops ? a.stops.length : 0;
    var distStr = (td && td.routeDistance) ? td.routeDistance : '';
    var statusText = posInfo ? posInfo.status : 'Scheduled';
    var statusClass = posInfo ? posInfo.badgeClass : 'status-scheduled';

    html += '<div class="rmd-truck-card" style="border-left:4px solid ' + color + '">' +
      '<div class="rmd-tc-top">' +
      '<span class="rmd-tc-name"><span class="rmd-swatch" style="background:' + color + '"></span>' + escapeHtml(a.truck || 'Truck') + '</span>' +
      '<span class="rmd-tc-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span>' +
      '</div>' +
      '<div class="rmd-tc-body">' +
      '<div class="rmd-tc-meta">' +
      '<span>' + stopCount + ' stop' + (stopCount !== 1 ? 's' : '') + '</span>' +
      (distStr ? '<span>\u00b7 ' + distStr + '</span>' : '') +
      '<span>\u00b7 ' + escapeHtml(a.personnel || 'Crew assigned') + '</span>' +
      '</div>' +
      '<div class="rmd-tc-desc">' + escapeHtml(posInfo ? posInfo.detailText : '') + '</div>' +
      '</div>' +
      '</div>';
  });
  html += '</div>';

  // Warnings / Approximate notices if any
  if (warnings && warnings.length > 0) {
    var shownWarnings = warnings.slice(0, 2);
    html += '<div class="rmd-warning-note">\u26a0 Note: ' + escapeHtml(shownWarnings.join('; ')) + (warnings.length > 2 ? ' (+' + (warnings.length - 2) + ' more)' : '') + '</div>';
  }

  html += '</div>';
  infoEl.innerHTML = html;
}

// =========================================================================
// 9. PUBLIC ENTRY POINT (Replaces legacy renderRouteDiagram)
// =========================================================================

function renderRouteDiagram(schedulesOrStops, label) {
  var emptyEl = document.getElementById('route-diagram-empty');
  var contentEl = document.getElementById('route-diagram-content');
  var mapEl = document.getElementById('route-leaflet-map');
  var infoEl = document.getElementById('route-preview-info');

  if (!mapEl) return;

  if (!schedulesOrStops || schedulesOrStops.length === 0) {
    renderMuntinlupaOverview('No collection assignments scheduled for this date. Click another date in the calendar.');
    return;
  }

  // Normalize input into unified assignments array
  var assignments = schedulesOrStops.map(function (s) {
    var routeName = s.route_name || s.starting_point || (s.barangay ? s.barangay + ' Route' : 'Collection Route');
    var truck = s.truck_number || 'Truck Assigned';
    var personnel = s.assigned_personnel || 'Unassigned';
    var timeStr = s.collection_time ? formatTime12((s.collection_time + '').substring(0, 5)) : (s.time || '');
    var status = s.status || 'Upcoming';

    var stops = [];
    if (s.stops && s.stops.length > 0) {
      stops = s.stops.map(function (st, sidx) {
        return {
          id: st.id || s.id,
          barangay: st.barangay,
          street: st.street || st.zone || '',
          zone: st.street || st.zone || st.barangay,
          sequence: st.sequence || (sidx + 1),
          time: st.collection_time ? formatTime12((st.collection_time + '').substring(0, 5)) : timeStr,
          collection_time: st.collection_time || s.collection_time,
          status: st.status || status
        };
      });
    } else {
      stops.push({
        id: s.id,
        barangay: s.barangay,
        street: s.zone || '',
        zone: s.zone || '',
        time: timeStr,
        collection_time: s.collection_time,
        status: status,
        sequence: 1
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
      status: status,
      stops: stops
    };
  });

  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'none';
  if (mapEl) mapEl.style.display = 'block';

  renderRouteMap(assignments, label);
}

// Ensure map is rendered immediately on page load
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var mapEl = document.getElementById('route-leaflet-map');
      if (mapEl && !_leafletMap) {
        renderMuntinlupaOverview('Select an assignment or date in the calendar to view its road route & schedule.');
      }
    }, 150);
  });
}

// Cleanup on unload to prevent timers or memory leaks
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', function () {
    stopTruckClock();
    clearMapLayers();
  });
}

// Expose public API and algorithm helpers for testing
window.DEFAULT_DEPOT = DEFAULT_DEPOT;
window.MUNTINLUPA_BOUNDS = MUNTINLUPA_BOUNDS;
window.isCoordInsideMuntinlupa = isCoordInsideMuntinlupa;
window.renderRouteDiagram = renderRouteDiagram;
window.clearRouteDiagram = clearRouteDiagram;
window.renderMuntinlupaOverview = renderMuntinlupaOverview;
window.calcTruckSchedulePosition = calcTruckSchedulePosition;
window.resolveStopCoords = resolveStopCoords;
window.parseTimeToMinutes = parseTimeToMinutes;
window.formatMinutes12 = formatMinutes12;
window.BARANGAY_COORDS = BARANGAY_COORDS;
window.LANDMARK_COORDS = LANDMARK_COORDS;
