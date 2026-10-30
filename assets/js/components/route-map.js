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
var _renderChain = Promise.resolve();
var _lastRenderContext = null;

// High-contrast palette for simultaneously displayed truck routes.
// Saturated mid-tones stay legible over OpenStreetMap's yellow/green tiles.
var ROUTE_COLORS = [
  '#1D4ED8', // Blue
  '#DC2626', // Red
  '#047857', // Emerald
  '#7E22CE', // Purple
  '#C2410C', // Burnt orange
  '#0F766E', // Teal
  '#BE185D', // Pink
  '#4338CA', // Indigo
  '#A16207', // Ochre
  '#0E7490', // Cyan
  '#7C2D12', // Brown
  '#4D7C0F'  // Olive
];

// Dash patterns used only when more routes are shown than palette entries,
// so route identity never depends on colour alone.
var ROUTE_DASH_PATTERNS = [null, '14, 8', '3, 7', '18, 6, 4, 6'];

// Truck marker layout. Pure pixel offsets — scheduled coordinates are never changed.
// The slot is deliberately large enough that spread icons never cover the depot pin.
var TRUCK_SLOT_SIZE = 168;
var TRUCK_CLUSTER_TOLERANCE = 0.0002; // ~22 m: icons closer than this are spread apart

/**
 * Stable identity key for a route.
 * Uses the persisted schedule id, so a route keeps the same colour across renders,
 * page refreshes and partial selections.
 */
function routeIdentityKey(a) {
  if (!a) return 'route:';
  if (a.id !== undefined && a.id !== null && a.id !== '') return 'id:' + a.id;
  return 'route:' + (a.routeName || '') + '|' + (a.truck || '');
}

/** FNV-1a hash -> deterministic palette index source (never random). */
function hashStringToUint(str) {
  var h = 2166136261;
  var s = String(str || '');
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Assigns each assignment a unique, deterministic route colour.
 * - Base colour = hash of the stable route id (never random, never per-render).
 * - Collisions between simultaneously displayed routes are resolved in sorted-key
 *   order, so the same set of routes always receives the same colours regardless of
 *   the order the assignments arrive in.
 * - With more routes than palette entries, colours repeat but every repeat gets its
 *   own dash pattern so routes stay distinguishable without relying on colour alone.
 *
 * @param {Array} assignments
 * @returns {Object} assignment index -> { color, colorIndex, dashArray }
 */
function assignRouteColors(assignments) {
  var result = {};
  if (!assignments || assignments.length === 0) return result;

  var entries = assignments.map(function (a, idx) {
    return { idx: idx, key: routeIdentityKey(a) };
  });

  entries.sort(function (x, y) {
    if (x.key === y.key) return x.idx - y.idx;
    return x.key < y.key ? -1 : 1;
  });

  var paletteUses = {};

  entries.forEach(function (entry) {
    var start = hashStringToUint(entry.key) % ROUTE_COLORS.length;
    var chosen = -1;
    for (var step = 0; step < ROUTE_COLORS.length; step++) {
      var cand = (start + step) % ROUTE_COLORS.length;
      if (!paletteUses[cand]) { chosen = cand; break; }
    }
    var repeat = 0;
    if (chosen === -1) {
      chosen = start;
      repeat = paletteUses[chosen] || 0;
    }
    paletteUses[chosen] = (paletteUses[chosen] || 0) + 1;

    result[entry.idx] = {
      color: ROUTE_COLORS[chosen],
      colorIndex: chosen,
      dashArray: repeat > 0 ? ROUTE_DASH_PATTERNS[repeat % ROUTE_DASH_PATTERNS.length] : null
    };
  });

  return result;
}

/** True only for a real calendar date string (YYYY-MM-DD). */
function isValidScheduleDate(value) {
  var s = String(value || '').slice(0, 10);
  var parts = s.split('-');
  if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) return false;
  if (!/^[0-9]+$/.test(parts[0] + parts[1] + parts[2])) return false;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  var probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

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
  return enrichSchedulePosition(calcTruckScheduleBase(stops, collectionDate, customNow), stops);
}

function calcTruckScheduleBase(stops, collectionDate, customNow) {
  if (!stops || stops.length === 0) return null;

  var manilaNow = customNow ? getManilaDate(customNow) : getManilaDate();
  var todayStr = getManilaTodayStr(manilaNow);
  var schedDateStr = (collectionDate || '').slice(0, 10);
  var hasValidDate = isValidScheduleDate(schedDateStr);

  var isToday = hasValidDate && (schedDateStr === todayStr);
  var isPast = hasValidDate && (schedDateStr < todayStr);
  var isFuture = hasValidDate && (schedDateStr > todayStr);

  var parsedTimes = stops.map(function (s) {
    return parseTimeToMinutes(s.collection_time);
  });

  var firstStopName = stops[0].street || stops[0].barangay || 'Stop 1';

  // 0. Missing or invalid collection date -> schedule unknown. Never "Completed".
  if (!hasValidDate) {
    return {
      status: 'Scheduled',
      isAtDepot: true,
      stopIdx: null,
      nextStopIdx: 0,
      currentStop: null,
      nextStop: stops[0],
      coord: DEFAULT_DEPOT.coord,
      isToday: false,
      isPast: false,
      isFuture: false,
      detailText: 'At Tunasan Depot - collection date pending for ' + firstStopName,
      badgeClass: 'status-scheduled'
    };
  }

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

/**
 * Adds the derived fields the map UI needs (current / next stop labels and times)
 * without changing the tested schedule-position contract above.
 */
function enrichSchedulePosition(pos, stops) {
  if (!pos) return pos;

  var cur = (pos.stopIdx !== null && pos.stopIdx !== undefined) ? stops[pos.stopIdx] : null;
  var nxt = (pos.nextStopIdx !== null && pos.nextStopIdx !== undefined) ? stops[pos.nextStopIdx] : null;
  var curMinutes = cur ? parseTimeToMinutes(cur.collection_time) : null;
  var nextMinutes = nxt ? parseTimeToMinutes(nxt.collection_time) : null;

  pos.isCompleted = pos.status === 'Completed';
  pos.isCancelled = false;
  pos.currentStopName = cur ? (cur.street || cur.barangay || ('Stop ' + (pos.stopIdx + 1))) : '';
  pos.currentStopTimeStr = curMinutes !== null ? formatMinutes12(curMinutes) : '';
  pos.nextStopName = nxt ? (nxt.street || nxt.barangay || ('Stop ' + (pos.nextStopIdx + 1))) : '';
  pos.nextStopTimeStr = nextMinutes !== null ? formatMinutes12(nextMinutes) : '';

  return pos;
}

/** Normalises a persisted/manual route status to 'Completed' | 'Cancelled' | null. */
function normalizeManualRouteStatus(status) {
  var s = String(status || '').trim().toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'completed') return 'Completed';
  return null;
}

/**
 * Combines the schedule-based position with the route's persisted status.
 * A manually completed or cancelled assignment is respected and never overwritten
 * by the clock, and an invalid schedule is never reported as completed.
 *
 * @param {Object} a - normalised assignment ({ id, schedule, routeName, truck, status, stops })
 * @param {Date} [now]
 * @returns {Object|null} schedule position with status overrides applied
 */
function deriveRouteState(a, now) {
  if (!a || !a.stops || a.stops.length === 0) return null;

  var collDate = a.schedule ? String(a.schedule.collection_date || '').slice(0, 10) : '';
  var pos = calcTruckSchedulePosition(a.stops, collDate, now);
  if (!pos) return null;

  pos.isCancelled = false;
  var manual = normalizeManualRouteStatus(a.status);

  if (manual === 'Cancelled') {
    pos.status = 'Cancelled';
    pos.isCancelled = true;
    pos.isCompleted = false;
    pos.isAtDepot = true;
    pos.stopIdx = null;
    pos.nextStopIdx = null;
    pos.currentStop = null;
    pos.nextStop = null;
    pos.coord = DEFAULT_DEPOT.coord;
    pos.currentStopName = '';
    pos.currentStopTimeStr = '';
    pos.nextStopName = '';
    pos.nextStopTimeStr = '';
    pos.detailText = 'Route cancelled - no collection run scheduled';
    pos.badgeClass = 'status-cancelled';
    return pos;
  }

  if (manual === 'Completed' && !pos.isCompleted) {
    var lastIdx = a.stops.length - 1;
    var lastMinutes = parseTimeToMinutes(a.stops[lastIdx].collection_time);
    pos.status = 'Completed';
    pos.isCompleted = true;
    pos.isAtDepot = false;
    pos.stopIdx = lastIdx;
    pos.nextStopIdx = null;
    pos.nextStop = null;
    pos.nextStopName = '';
    pos.nextStopTimeStr = '';
    pos.currentStop = a.stops[lastIdx];
    pos.currentStopName = a.stops[lastIdx].street || a.stops[lastIdx].barangay || ('Stop ' + (lastIdx + 1));
    pos.currentStopTimeStr = lastMinutes !== null ? formatMinutes12(lastMinutes) : '';
    pos.coord = null;
    pos.detailText = 'Completed route at ' + pos.currentStopName + (pos.currentStopTimeStr ? ' (' + pos.currentStopTimeStr + ')' : '');
    pos.badgeClass = 'status-completed';
    return pos;
  }

  return pos;
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
  // Always painted above the truck markers so the depot pin never gets buried.
  var depotMarker = L.marker(DEFAULT_DEPOT.coord, { icon: depotIcon, zIndexOffset: 2600 });
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
  _lastRenderContext = null;
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

  // Re-checks scheduled boundaries every 20 s. Route geometry is cached on each
  // truck record, so a tick never issues a routing request and never animates.
  _truckClockInterval = setInterval(function () {
    updateFleetFromSchedule(getManilaDate());
  }, 20000);
}

/** Stable signature of a truck's scheduled state, used to skip redundant redraws. */
function routeStateKey(posInfo) {
  if (!posInfo) return '';
  return [
    posInfo.status,
    posInfo.isAtDepot ? 1 : 0,
    posInfo.stopIdx === null || posInfo.stopIdx === undefined ? '-' : posInfo.stopIdx,
    posInfo.nextStopIdx === null || posInfo.nextStopIdx === undefined ? '-' : posInfo.nextStopIdx
  ].join('|');
}

/**
 * Recalculates every truck against its own schedule and redraws only what changed.
 * Trucks advance independently; a completed truck keeps its marker and stop pins but
 * loses its active route line. No GPS, no interpolation, no API calls.
 */
function updateFleetFromSchedule(now) {
  if (!_leafletMap || !_truckDataList || _truckDataList.length === 0) return;

  var stateChanged = false;

  _truckDataList.forEach(function (td) {
    if (!td || !td.assignment) return;

    var nextState = deriveRouteState(td.assignment, now);
    if (!nextState) return;

    var previousKey = routeStateKey(td.posInfo);
    td.posInfo = nextState;

    if (previousKey !== routeStateKey(td.posInfo)) {
      stateChanged = true;
      renderTruckRouteLine(td);
      refreshStopMarkers(td);
    }

    td.currentCoord = resolveTruckCoord(td);
  });

  // Spread depends on current coordinates only - recompute (cheap) and reposition.
  computeTruckSpread(_truckDataList);
  _truckDataList.forEach(function (td) {
    if (td && td.marker) refreshTruckMarker(td);
  });

  if (stateChanged) refreshRouteInfoBar();
}

/** Re-renders the summary / legend from the last render context. */
function refreshRouteInfoBar() {
  var ctx = _lastRenderContext;
  if (!ctx || !ctx.infoEl) return;
  renderRouteInfoBar(ctx.assignments, ctx.label, ctx.truckList, ctx.warnings, ctx.infoEl);
}

// =========================================================================
// 5. ICONS, MARKER SPREAD & STYLING (STOP PINS & TRUCK MARKER)
// =========================================================================

/** Short truck identifier shown on the marker and in the legend (e.g. T01). */
function truckShortId(assignment, index) {
  var name = String((assignment && assignment.truck) || '');
  var digits = name.match(/[0-9]+/);
  if (digits && digits[0]) return 'T' + digits[0];
  return 'T' + (index + 1);
}

/**
 * Pixel offsets for n markers that share one location.
 * Pure screen-space math: latitude/longitude are never modified.
 */
function computeClusterOffsets(count) {
  if (count <= 1) return [[0, 0]];
  // Wide enough that the icons, their name chips and the depot pin never overlap.
  if (count === 2) return [[-52, 0], [52, 0]];
  var radius = count === 3 ? 56 : (count <= 8 ? 60 : 64);
  var offsets = [];
  for (var i = 0; i < count; i++) {
    var angle = (-Math.PI / 2) + (i * 2 * Math.PI / count);
    offsets.push([Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]);
  }
  return offsets;
}

/**
 * Groups trucks standing at (nearly) the same coordinate and gives each one a small
 * pixel offset so icons never sit exactly on top of each other. Mutates only the
 * render offset (spreadDx / spreadDy) on each truck record - never the coordinates.
 */
function computeTruckSpread(truckList) {
  var groups = [];
  var toleranceSq = TRUCK_CLUSTER_TOLERANCE * TRUCK_CLUSTER_TOLERANCE;

  (truckList || []).forEach(function (td) {
    if (!td) return;
    if (!td.currentCoord) {
      td.spreadDx = 0;
      td.spreadDy = 0;
      return;
    }
    var group = null;
    for (var g = 0; g < groups.length; g++) {
      var rep = groups[g][0].currentCoord;
      var dLat = rep[0] - td.currentCoord[0];
      var dLng = rep[1] - td.currentCoord[1];
      if (dLat * dLat + dLng * dLng <= toleranceSq) { group = groups[g]; break; }
    }
    if (!group) { group = []; groups.push(group); }
    group.push(td);
  });

  groups.forEach(function (group) {
    var offsets = computeClusterOffsets(group.length);
    group.forEach(function (td, i) {
      td.spreadDx = offsets[i][0];
      td.spreadDy = offsets[i][1];
    });
  });
}

/**
 * Truck marker.
 * The divIcon is a fixed pixel slot centred on the real coordinate; the icon inside
 * may be shifted for legibility and a dashed leader shows where the truck actually is.
 */
function makeTruckIcon(color, titleText, opts) {
  opts = opts || {};
  var dx = Math.round(opts.dx || 0);
  var dy = Math.round(opts.dy || 0);
  var label = opts.label || '';
  var half = TRUCK_SLOT_SIZE / 2;

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

  // Dashed stem from the shifted icon toward the real coordinate. It stops short of
  // the centre so the depot (or stop) pin itself is never drawn over.
  var leader = '';
  var distance = Math.sqrt(dx * dx + dy * dy);
  var iconRadius = 19;
  var stemStart = 20;
  var stemEnd = distance - iconRadius;
  if (distance > 0 && stemEnd - stemStart >= 4) {
    var ux = dx / distance;
    var uy = dy / distance;
    leader = '<svg class="wise-truck-leader" width="' + TRUCK_SLOT_SIZE + '" height="' + TRUCK_SLOT_SIZE + '" aria-hidden="true">' +
      '<line x1="' + (half + ux * stemStart).toFixed(1) + '" y1="' + (half + uy * stemStart).toFixed(1) + '"' +
      ' x2="' + (half + ux * stemEnd).toFixed(1) + '" y2="' + (half + uy * stemEnd).toFixed(1) + '"' +
      ' stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3" opacity="0.95"/>' +
      '</svg>';
  }

  var labelHtml = label
    ? '<span class="wise-truck-label" style="color:' + color + ';border-color:' + color + '">' + escapeHtml(label) + '</span>'
    : '';

  var html = '<div class="wise-truck-slot">' + leader +
    '<div class="wise-truck-marker" style="--wise-truck-dx:' + dx + 'px;--wise-truck-dy:' + dy + 'px" title="' + escapeHtml(titleText) + '">' +
    '<span class="wise-truck-icon">' + svg + '</span>' +
    labelHtml +
    '</div>' +
    '</div>';

  return L.divIcon({
    html: html,
    className: '',
    iconSize: [TRUCK_SLOT_SIZE, TRUCK_SLOT_SIZE],
    iconAnchor: [half, half]
  });
}

/**
 * Stop pin in the route's own colour. Completed stops are muted and marked with a
 * tick; the start pin is labelled S and the final stop F so they stay recognisable
 * without relying on colour.
 */
function makeStopPinIcon(label, color, opts) {
  opts = opts || {};
  var classes = 'wise-stop-pin';
  if (opts.isFirst) classes += ' start-pin';
  if (opts.isLast) classes += ' end-pin';
  if (opts.phase === 'completed') classes += ' passed-pin';
  if (opts.phase === 'current') classes += ' current-pin';
  if (opts.isCancelled) classes += ' cancelled-pin';

  var background = opts.phase === 'completed' ? '#94A3B8' : color;
  var text = opts.phase === 'completed' ? '&#10003;' : escapeHtml(label);
  var ring = opts.phase === 'current'
    ? ';box-shadow:0 0 0 3px ' + color + '66,0 2px 7px rgba(0,0,0,0.35)'
    : '';

  return L.divIcon({
    html: '<div class="' + classes + '" style="background:' + background + ';border-color:#ffffff' + ring + '">' + text + '</div>',
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
// 7. ROUTE GEOMETRY, SEGMENT SPLITTING & MAIN ROUTE MAP RENDERER
// =========================================================================

/**
 * Straight-line legs used only when OpenRouteService is unavailable.
 * Always labelled in the UI - never used while real road geometry exists.
 */
function buildStraightLegs(waypoints) {
  var legs = [];
  for (var i = 0; i < waypoints.length - 1; i++) {
    legs.push([waypoints[i], waypoints[i + 1]]);
  }
  return legs;
}

/** Index of the polyline vertex closest to a waypoint, searched forward only. */
function findNearestVertexIndex(latlngs, target, fromIndex) {
  var bestIdx = -1;
  var bestDist = Infinity;
  for (var i = Math.max(0, fromIndex); i < latlngs.length; i++) {
    var dLat = latlngs[i][0] - target[0];
    var dLng = latlngs[i][1] - target[1];
    var dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  if (bestIdx === -1) return null;
  // Reject matches further than roughly 1.5 km: a bad geometry must never be cut blindly.
  if (bestDist > 0.00018) return null;
  return bestIdx;
}

/**
 * Splits one continuous road polyline into ordered legs between consecutive stops.
 * The ORS geometry is preserved untouched - only cut indices are computed, so every
 * leg still follows real roads (no synthetic straight lines are introduced).
 *
 * @param {Array} latlngs - full road geometry as [lat, lng] pairs
 * @param {Array} waypoints - [depot, stop1, stop2, ...] as [lat, lng] pairs
 * @returns {Array|null} legs[i] = polyline from waypoint i to waypoint i + 1
 */
function splitRouteIntoLegs(latlngs, waypoints) {
  if (!latlngs || latlngs.length < 2 || !waypoints || waypoints.length < 2) return null;

  var cuts = [0];
  var cursor = 0;
  for (var w = 1; w < waypoints.length - 1; w++) {
    // Search forward only: stops must stay in their scheduled order. Two stops that
    // share one coordinate simply produce a zero-length leg.
    var idx = findNearestVertexIndex(latlngs, waypoints[w], cursor);
    if (idx === null || idx < cursor) return null;
    cuts.push(idx);
    cursor = idx;
  }
  cuts.push(latlngs.length - 1);

  var legs = [];
  for (var i = 0; i < cuts.length - 1; i++) {
    legs.push(latlngs.slice(cuts[i], cuts[i + 1] + 1));
  }
  return legs;
}

/**
 * Fetches (or reuses) road geometry for a waypoint chain.
 * Successful road geometry is cached by chain, so schedule ticks and repeated
 * renders never trigger another OpenRouteService request.
 */
async function getRouteGeometry(waypoints) {
  var cacheKey = waypoints.map(function (c) { return c.join(','); }).join('|');
  var cached = _routeGeometries[cacheKey];
  if (cached) return cached;

  var result = await fetchRouteGeometry(waypoints);
  var entry;

  if (result && result.fullGeometry && result.fullGeometry.coordinates && result.fullGeometry.coordinates.length >= 2) {
    var latlngs = result.fullGeometry.coordinates.map(function (c) { return [c[1], c[0]]; });
    var legs = splitRouteIntoLegs(latlngs, waypoints);
    entry = {
      latlngs: latlngs,
      legs: legs || buildStraightLegs(waypoints),
      summary: result.summary || null,
      isFallback: !legs,
      // Never pass straight stop-to-stop lines off as road geometry: label them.
      isStraightFallback: !legs
    };
    // Cache only real road geometry - a failed request is retried on the next render.
    if (legs) _routeGeometries[cacheKey] = entry;
  } else {
    entry = {
      latlngs: waypoints.slice(),
      legs: buildStraightLegs(waypoints),
      summary: null,
      isFallback: true,
      isStraightFallback: true
    };
  }

  return entry;
}

/** Waypoint index (0 = depot) from which a truck's remaining route starts. */
function startWaypointIndex(td, stopIdx) {
  if (!td || stopIdx === null || stopIdx === undefined) return null;
  var map = td.waypointOfStop || [];
  if (map[stopIdx] !== undefined && map[stopIdx] !== null) return map[stopIdx];
  for (var s = stopIdx - 1; s >= 0; s--) {
    if (map[s] !== undefined && map[s] !== null) return map[s];
  }
  return 0;
}

/**
 * Builds the polyline of the truck's REMAINING planned journey.
 * Legs already driven (up to and including the current scheduled stop) are dropped.
 * Completed or cancelled routes return null so no active line is drawn at all.
 */
function buildRemainingTrail(td, state) {
  if (!td || !td.legs || td.legs.length === 0) return null;
  if (!state || state.isCompleted || state.isCancelled) return null;

  var startLeg = 0;
  if (!state.isAtDepot) {
    var wpIdx = startWaypointIndex(td, state.stopIdx);
    if (wpIdx === null) return null;
    startLeg = wpIdx;
  }
  if (startLeg >= td.legs.length) return null;

  var trail = [];
  for (var i = startLeg; i < td.legs.length; i++) {
    var leg = td.legs[i];
    if (!leg) continue;
    for (var j = 0; j < leg.length; j++) {
      var point = leg[j];
      var last = trail[trail.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) trail.push(point);
    }
  }
  return trail.length >= 2 ? trail : null;
}

/** Where the truck icon belongs right now - a scheduled stop, never interpolated. */
function resolveTruckCoord(td) {
  if (!td) return DEFAULT_DEPOT.coord;
  var state = td.posInfo;
  if (!state || state.isCancelled || state.isAtDepot) return DEFAULT_DEPOT.coord;
  if (state.stopIdx !== null && state.stopIdx !== undefined) {
    for (var s = state.stopIdx; s >= 0; s--) {
      if (td.stopCoords && td.stopCoords[s]) return td.stopCoords[s];
    }
  }
  return DEFAULT_DEPOT.coord;
}

/** 'completed' | 'current' | 'pending' for one stop of a truck's route. */
function stopPhase(td, sIdx) {
  var state = td && td.posInfo;
  if (!state || state.isCancelled) return 'pending';
  if (state.isCompleted) return 'completed';
  if (state.stopIdx === null || state.stopIdx === undefined) return 'pending';
  if (sIdx < state.stopIdx) return 'completed';
  if (sIdx === state.stopIdx) return 'current';
  return 'pending';
}

/** S / F / sequence number for a stop pin. */
function stopPinLabel(td, sIdx) {
  var total = td.stops ? td.stops.length : 0;
  if (sIdx === 0) return 'S';
  if (sIdx === total - 1 && total > 1) return 'F';
  return String(sIdx + 1);
}

function stopPlaceName(stop, idx) {
  if (!stop) return 'Stop ' + (idx + 1);
  return stop.street || stop.barangay || ('Stop ' + (idx + 1));
}

function buildStopPopupHtml(td, sIdx) {
  var stop = td.stops[sIdx];
  var phase = stopPhase(td, sIdx);
  var total = td.stops.length;
  var timeStr = stop && stop.collection_time ? formatTime12((stop.collection_time + '').substring(0, 5)) : '';
  var resolved = (td.resolvedStops && td.resolvedStops[sIdx]) || {};
  var isFirst = sIdx === 0;
  var isLast = sIdx === total - 1 && total > 1;
  var roleLabel = isFirst ? 'First Scheduled Stop' : (isLast ? 'Final Destination' : ('Collection Stop ' + (sIdx + 1)));

  var phaseNote = '';
  if (phase === 'completed') {
    phaseNote = '<div class="wmp-phase wmp-phase-done">Completed - removed from the active route</div>';
  } else if (phase === 'current') {
    phaseNote = '<div class="wmp-phase wmp-phase-now">Current scheduled position</div>';
  }

  var warning = '';
  if (resolved.isOutOfBoundary) {
    warning = '<div class="wmp-warning" style="background:#FEE2E2;color:#991B1B;padding:4px 6px;border-radius:4px;margin-top:4px">Outside Muntinlupa City - flagged for review</div>';
  } else if (resolved.isApproximate) {
    warning = '<div class="wmp-warning">Approximate center (exact address unmapped)</div>';
  }

  return '<div class="wise-map-popup">' +
    '<div class="wmp-header" style="border-left:3.5px solid ' + td.color + '">' +
    '<span class="wmp-badge" style="color:' + td.color + ';background:' + td.color + '1a">' + escapeHtml(roleLabel) + '</span>' +
    '<strong>' + escapeHtml((stop && stop.barangay) || '') + '</strong>' +
    (stop && stop.street ? '<div class="wmp-street">' + escapeHtml(stop.street) + '</div>' : '') +
    '</div>' +
    (timeStr ? '<div class="wmp-time">' + timeStr + '</div>' : '') +
    '<div class="wmp-meta">' + escapeHtml(td.truckLabel) + ' &middot; Stop ' + (sIdx + 1) + ' of ' + total + '</div>' +
    phaseNote +
    warning +
    '<div class="wmp-notice">Scheduled itinerary - not live GPS</div>' +
    '</div>';
}

function buildTruckPopupHtml(td) {
  var a = td.assignment || {};
  var state = td.posInfo || {};
  var currentLabel = state.isAtDepot ? DEFAULT_DEPOT.name : (state.currentStopName || 'Scheduled stop');
  var currentTime = state.isAtDepot ? '' : (state.currentStopTimeStr || '');
  var nextLabel = state.nextStopName || '';
  var nextTime = state.nextStopTimeStr || '';
  var stopsCount = td.stops ? td.stops.length : 0;

  return '<div class="wise-map-popup">' +
    '<div class="wmp-header" style="border-left:3.5px solid ' + td.color + '">' +
    '<span class="wmp-badge wmp-badge-truck" style="color:' + td.color + ';background:' + td.color + '1a">Assigned Fleet</span>' +
    '<strong>' + escapeHtml(td.truckLabel) + '</strong>' +
    '<div class="wmp-street">' + escapeHtml(a.routeName || 'Collection Route') + (a.personnel ? ' &middot; ' + escapeHtml(a.personnel) : '') + '</div>' +
    '</div>' +
    '<div class="wmp-status-pill ' + (state.badgeClass || '') + '">' + escapeHtml(state.status || 'Scheduled') + '</div>' +
    '<div class="wmp-rows">' +
    '<div class="wmp-row"><span class="wmp-row-label">Current</span><span class="wmp-row-value">' + escapeHtml(currentLabel) + (currentTime ? ' &middot; ' + escapeHtml(currentTime) : '') + '</span></div>' +
    (nextLabel ? '<div class="wmp-row"><span class="wmp-row-label">Next</span><span class="wmp-row-value">' + escapeHtml(nextLabel) + (nextTime ? ' &middot; ' + escapeHtml(nextTime) : '') + '</span></div>' : '') +
    '<div class="wmp-row"><span class="wmp-row-label">Stops</span><span class="wmp-row-value">' + stopsCount + ' scheduled' + (td.routeDistance ? ' &middot; ' + escapeHtml(td.routeDistance) : '') + '</span></div>' +
    '</div>' +
    (state.detailText ? '<div class="wmp-detail">' + escapeHtml(state.detailText) + '</div>' : '') +
    '<div class="wmp-notice">Schedule-based simulation - not a live GPS tracker</div>' +
    '</div>';
}

function buildTruckTooltipHtml(td) {
  var state = td.posInfo || {};
  var routeName = td.assignment && td.assignment.routeName ? td.assignment.routeName : '';
  return '<strong>' + escapeHtml(td.truckLabel) + '</strong>' +
    (routeName ? '<br><span style="font-size:10px;opacity:.85">' + escapeHtml(routeName) + '</span>' : '') +
    '<br><span class="wmp-status-pill ' + (state.badgeClass || '') + '">' + escapeHtml(state.status || 'Scheduled') + '</span>' +
    (state.detailText ? '<br><small style="opacity:.8;font-size:10px">' + escapeHtml(state.detailText) + '</small>' : '') +
    '<br><small style="opacity:.7;font-size:9px">Schedule-based - no GPS</small>';
}

/**
 * Repositions / relabels a truck marker. Returns true when the DOM changed.
 * Pixel spread offsets keep coincident trucks separable; coordinates are untouched.
 */
function refreshTruckMarker(td) {
  if (!td || !td.marker || !td.posInfo) return false;

  var key = routeStateKey(td.posInfo) + '#' +
    (td.currentCoord ? td.currentCoord.join(',') : '') + '#' +
    (td.spreadDx || 0) + ',' + (td.spreadDy || 0);

  if (td.markerKey === key) return false;
  td.markerKey = key;

  if (td.currentCoord) td.marker.setLatLng(td.currentCoord);

  td.marker.setIcon(makeTruckIcon(td.color, '[' + td.posInfo.status + '] ' + td.truckLabel, {
    dx: td.spreadDx || 0,
    dy: td.spreadDy || 0,
    label: td.truckLabel
  }));

  td.marker.unbindTooltip();
  td.marker.bindTooltip(buildTruckTooltipHtml(td), {
    direction: 'top',
    offset: [td.spreadDx || 0, -20 + (td.spreadDy || 0)]
  });

  td.marker.unbindPopup();
  td.marker.bindPopup(buildTruckPopupHtml(td), {
    offset: [td.spreadDx || 0, td.spreadDy || 0]
  });

  return true;
}

/**
 * Draws only the truck's remaining journey. Called on first render and whenever the
 * scheduled stop index changes; cached legs are reused (no new routing request).
 */
function renderTruckRouteLine(td) {
  if (!td || !td.routeGroup) return;
  td.routeGroup.clearLayers();

  var trail = buildRemainingTrail(td, td.posInfo);
  if (!trail) return;

  var dash = td.dashArray ? { dashArray: td.dashArray } : {};
  var straightFallback = !!td.isStraightFallback;

  var haloStyle = { color: td.color, weight: 9, opacity: 0.14, lineCap: 'round', lineJoin: 'round' };
  if (straightFallback) haloStyle.dashArray = '8, 6';
  td.routeGroup.addLayer(L.polyline(trail, haloStyle));

  var lineStyle = {
    color: td.color,
    weight: straightFallback ? 3.5 : 4.5,
    opacity: straightFallback ? 0.7 : 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  };
  if (straightFallback) lineStyle.dashArray = '8, 6';

  var line = L.polyline(trail, Object.assign(lineStyle, dash));
  var state = td.posInfo || {};
  var label = (td.assignment.routeName || td.truckLabel) +
    (td.routeDistance ? ' - ' + td.routeDistance : '') +
    (!state.isAtDepot && state.nextStopName ? ' - next: ' + state.nextStopName : '') +
    (straightFallback ? ' - road routing unavailable' : '');
  line.bindTooltip(escapeHtml(label), { sticky: true });
  td.routeGroup.addLayer(line);
}

/** Re-styles existing stop pins when the scheduled stop index advances. */
function refreshStopMarkers(td) {
  if (!td || !td.stopMarkers) return;
  var isCancelled = !!(td.posInfo && td.posInfo.isCancelled);

  td.stopMarkers.forEach(function (item) {
    if (!item || !item.marker) return;
    item.marker.setIcon(makeStopPinIcon(stopPinLabel(td, item.index), td.color, {
      isFirst: item.index === 0,
      isLast: item.index === td.stops.length - 1 && td.stops.length > 1,
      phase: stopPhase(td, item.index),
      isCancelled: isCancelled
    }));
    item.marker.setPopupContent(buildStopPopupHtml(td, item.index));
  });
}

/** Creates stop pins, the remaining-route layer group and the truck marker. */
function drawTruckLayers(td) {
  if (!td || !td.stops || !td.validCoords || td.validCoords.length === 0) return;
  var isCancelled = !!(td.posInfo && td.posInfo.isCancelled);

  td.stops.forEach(function (stop, sIdx) {
    var coord = td.stopCoords[sIdx];
    if (!coord) return;

    var marker = L.marker(coord, {
      icon: makeStopPinIcon(stopPinLabel(td, sIdx), td.color, {
        isFirst: sIdx === 0,
        isLast: sIdx === td.stops.length - 1 && td.stops.length > 1,
        phase: stopPhase(td, sIdx),
        isCancelled: isCancelled
      }),
      zIndexOffset: 200
    });

    marker.bindPopup(buildStopPopupHtml(td, sIdx));
    marker.bindTooltip(
      (sIdx === 0 ? 'Start: ' : (sIdx === td.stops.length - 1 && td.stops.length > 1 ? 'Final: ' : ('Stop ' + (sIdx + 1) + ': '))) +
      escapeHtml(stopPlaceName(stop, sIdx)) +
      (stop.collection_time ? ' - ' + formatTime12((stop.collection_time + '').substring(0, 5)) : ''),
      { direction: 'top', offset: [0, -14] }
    );

    addLayer(marker);
    td.stopMarkers.push({ index: sIdx, marker: marker });
  });

  td.routeGroup = L.layerGroup();
  addLayer(td.routeGroup);
  renderTruckRouteLine(td);

  if (td.currentCoord) {
    td.marker = L.marker(td.currentCoord, {
      icon: makeTruckIcon(td.color, td.truckLabel, {
        dx: td.spreadDx || 0,
        dy: td.spreadDy || 0,
        label: td.truckLabel
      }),
      zIndexOffset: 1500
    });
    addLayer(td.marker);
    refreshTruckMarker(td);
  }
}

/** Tunasan dispatch depot pin, shared by the overview and route views. */
function addDepotMarker() {
  var depotIcon = L.divIcon({
    html: '<div class="wise-depot-pin" title="' + escapeHtml(DEFAULT_DEPOT.name) + '">D</div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  // Always painted above the truck markers so the depot pin never gets buried.
  var depotMarker = L.marker(DEFAULT_DEPOT.coord, { icon: depotIcon, zIndexOffset: 2600 });
  depotMarker.bindTooltip('<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong><br><small>' + escapeHtml(DEFAULT_DEPOT.address) + '</small>', { direction: 'top', offset: [0, -15] });
  depotMarker.bindPopup('<div class="wise-map-popup">' +
    '<div class="wmp-header" style="border-left:3.5px solid #F59E0B">' +
    '<span class="wmp-badge" style="background:#FEF3C7;color:#B45309">Fleet Dispatch Depot</span>' +
    '<strong>' + escapeHtml(DEFAULT_DEPOT.name) + '</strong>' +
    '<div class="wmp-street">' + escapeHtml(DEFAULT_DEPOT.address) + '</div>' +
    '</div>' +
    '<div class="wmp-notice">Starting depot for all scheduled routes before Stop 1</div>' +
    '</div>');
  addLayer(depotMarker);
  return depotMarker;
}

function fitMapToServiceArea() {
  if (!_leafletMap) return;
  try {
    _leafletMap.fitBounds(MUNTINLUPA_BOUNDS, { padding: [12, 12] });
  } catch (e) { }
}

/**
 * Prepares one assignment for rendering: stop coordinates, cached road legs and the
 * current schedule state. The assignment object itself is never modified.
 */
async function prepareTruck(assignment, aIdx, colorInfo, now, warnings) {
  var a = assignment || {};
  var stops = a.stops || [];
  var truckLabel = a.truck || ('Truck ' + (aIdx + 1));

  var resolvedStops = stops.map(function (s) {
    return resolveStopCoords(s.barangay, s.street || s.zone || '');
  });

  var stopCoords = [];
  resolvedStops.forEach(function (r, idx) {
    var place = stopPlaceName(stops[idx], idx);
    if (r.coord) {
      stopCoords[idx] = r.coord;
      if (r.isOutOfBoundary) {
        warnings.push(truckLabel + ' Stop ' + (idx + 1) + ' (' + place + '): Outside Muntinlupa boundary - flagged for review');
      } else if (r.isApproximate && r.reason) {
        warnings.push(truckLabel + ' Stop ' + (idx + 1) + ': ' + r.reason);
      }
    } else {
      stopCoords[idx] = null;
      warnings.push(truckLabel + ' Stop ' + (idx + 1) + ': ' + (r.reason || 'Missing coordinates.'));
    }
  });

  var waypointOfStop = [];
  var validCoords = [];
  stopCoords.forEach(function (coord, idx) {
    if (coord) {
      validCoords.push(coord);
      waypointOfStop[idx] = validCoords.length; // waypoint 0 is the depot
    } else {
      waypointOfStop[idx] = null;
    }
  });

  var td = {
    index: aIdx,
    assignment: a,
    stops: stops,
    resolvedStops: resolvedStops,
    stopCoords: stopCoords,
    validCoords: validCoords,
    waypointOfStop: waypointOfStop,
    color: (colorInfo && colorInfo.color) || ROUTE_COLORS[0],
    dashArray: (colorInfo && colorInfo.dashArray) || null,
    truckLabel: truckLabel,
    collectionDate: a.schedule ? String(a.schedule.collection_date || '').slice(0, 10) : '',
    posInfo: null,
    currentCoord: null,
    legs: null,
    routeGroup: null,
    stopMarkers: [],
    routeDistance: '',
    routeDuration: '',
    isFallback: false,
    isStraightFallback: false,
    spreadDx: 0,
    spreadDy: 0,
    marker: null,
    markerKey: ''
  };

  td.posInfo = deriveRouteState(a, now);
  td.currentCoord = resolveTruckCoord(td);

  if (validCoords.length > 0) {
    var waypoints = [DEFAULT_DEPOT.coord].concat(validCoords);
    var geo = await getRouteGeometry(waypoints);
    td.legs = geo.legs;
    td.isFallback = !!geo.isFallback;
    td.isStraightFallback = !!geo.isStraightFallback;
    if (geo.summary && geo.summary.distance) td.routeDistance = (geo.summary.distance / 1000).toFixed(1) + ' km';
    if (geo.summary && geo.summary.duration) td.routeDuration = Math.round(geo.summary.duration / 60) + ' min';
    if (geo.isFallback) {
      warnings.push(truckLabel + ': road geometry could not be matched to its scheduled stops - showing direct stop-to-stop lines.');
    }
  } else {
    warnings.push(truckLabel + ': no resolvable stop coordinates - route line unavailable.');
  }

  return td;
}

async function renderRouteMapInternal(assignments, label) {
  var mapEl = document.getElementById('route-leaflet-map');
  var infoEl = document.getElementById('route-preview-info');
  if (!mapEl) return;

  clearMapLayers();
  _lastRenderContext = null;

  if (!assignments || assignments.length === 0) {
    mapEl.style.display = 'none';
    if (infoEl) infoEl.innerHTML = '';
    return;
  }

  mapEl.style.display = 'block';
  if (infoEl) {
    infoEl.innerHTML = '<div class="route-map-loading"><span class="rml-spinner"></span> Loading road route...</div>';
  }

  if (!ensureMapInitialised()) {
    if (infoEl) infoEl.innerHTML = '<div class="route-map-error">Map could not be initialised.</div>';
    return;
  }

  var now = getManilaDate();
  var colors = assignRouteColors(assignments);
  var warnings = [];
  var truckList = [];

  addDepotMarker();

  for (var aIdx = 0; aIdx < assignments.length; aIdx++) {
    var td = await prepareTruck(assignments[aIdx], aIdx, colors[aIdx], now, warnings);
    truckList.push(td);
  }

  // All coordinates are known now - separate trucks that share a location.
  computeTruckSpread(truckList);

  truckList.forEach(function (prepared) {
    try {
      drawTruckLayers(prepared);
    } catch (err) {
      console.error('[WISE Route Map] Layer render error:', err);
    }
  });

  fitMapToServiceArea();

  _truckDataList = truckList;
  _lastRenderContext = {
    assignments: assignments,
    label: label,
    truckList: truckList,
    warnings: warnings,
    infoEl: infoEl
  };

  startTruckClock(truckList);
  renderRouteInfoBar(assignments, label, truckList, warnings, infoEl);
}

/**
 * Public renderer. Renders are serialised so rapid date / route switches cannot
 * interleave and leave duplicate polylines or stale markers behind.
 */
function renderRouteMap(assignments, label) {
  _renderChain = _renderChain.then(function () {
    return renderRouteMapInternal(assignments, label);
  }).catch(function (err) {
    console.error('[WISE Route Map] Render failed:', err);
  });
  return _renderChain;
}

// =========================================================================
// 8. LOGISTICS DASHBOARD SUMMARY & LEGEND BAR
// =========================================================================

/**
 * Compact legend and status summary. Each card is colour-keyed to its route and also
 * names the truck id, route, current stop, next stop and status in text, so identity
 * never depends on colour alone.
 */
function renderRouteInfoBar(assignments, label, truckList, warnings, infoEl) {
  if (!infoEl) return;

  var now = getManilaDate();
  var colors = assignRouteColors(assignments);
  var prepared = {};
  (truckList || []).forEach(function (td) {
    if (td) prepared[td.index] = td;
  });

  var html = '<div class="route-map-dashboard">';

  html += '<div class="rmd-header">';
  if (label) html += '<span class="rmd-title">' + escapeHtml(label) + '</span>';
  html += '<span class="rmd-schedule-badge">Schedule-based - no GPS</span>';
  html += '</div>';

  html += '<div class="rmd-trucks-grid">';

  assignments.forEach(function (a, idx) {
    var colorInfo = colors[idx] || { color: ROUTE_COLORS[0], dashArray: null };
    var color = colorInfo.color;
    var td = prepared[idx];
    var state = td && td.posInfo ? td.posInfo : deriveRouteState(a, now);

    var stopCount = a.stops ? a.stops.length : 0;
    var truckLabel = a.truck || ('Truck ' + (idx + 1));
    var routeName = a.routeName || 'Collection Route';
    var statusText = state ? state.status : 'Scheduled';
    var statusClass = state ? state.badgeClass : 'status-scheduled';

    var currentLine;
    if (!state) {
      currentLine = 'Schedule data unavailable';
    } else if (state.isCancelled) {
      currentLine = 'Cancelled - no active run';
    } else if (state.isCompleted) {
      currentLine = 'Completed at ' + (state.currentStopName || 'final stop') +
        (state.currentStopTimeStr ? ' - ' + state.currentStopTimeStr : '');
    } else if (state.isAtDepot) {
      currentLine = 'At Tunasan Depot' + (state.nextStopTimeStr ? ' - departs ' + state.nextStopTimeStr : '');
    } else {
      currentLine = 'At ' + (state.currentStopName || 'scheduled stop') +
        (state.currentStopTimeStr ? ' - ' + state.currentStopTimeStr : '');
    }

    var nextLine = '';
    if (state && !state.isCompleted && !state.isCancelled && state.nextStopName) {
      nextLine = 'Next: ' + state.nextStopName + (state.nextStopTimeStr ? ' - ' + state.nextStopTimeStr : '');
    }

    var distance = td ? td.routeDistance : '';

    html += '<div class="rmd-truck-card" style="border-left:4px solid ' + color + '">' +
      '<div class="rmd-tc-top">' +
      '<span class="rmd-tc-name">' +
      '<span class="rmd-swatch" style="background:' + color + '"></span>' +
      '<span class="rmd-tc-id" style="background:' + color + '">' + escapeHtml(truckShortId(a, idx)) + '</span>' +
      escapeHtml(truckLabel) +
      '</span>' +
      '<span class="rmd-tc-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span>' +
      '</div>' +
      '<div class="rmd-tc-route">' + escapeHtml(routeName) + '</div>' +
      '<div class="rmd-tc-meta">' +
      '<span>' + stopCount + ' stop' + (stopCount !== 1 ? 's' : '') + '</span>' +
      (distance ? '<span> - ' + distance + '</span>' : '') +
      '<span> - ' + escapeHtml(a.personnel || 'Crew assigned') + '</span>' +
      '</div>' +
      '<div class="rmd-tc-desc">' + escapeHtml(currentLine) + '</div>' +
      (nextLine ? '<div class="rmd-tc-next">' + escapeHtml(nextLine) + '</div>' : '') +
      '</div>';
  });

  html += '</div>';

  if (warnings && warnings.length > 0) {
    var shown = warnings.slice(0, 2);
    html += '<div class="rmd-warning-note">Note: ' + escapeHtml(shown.join('; ')) +
      (warnings.length > 2 ? ' (+' + (warnings.length - 2) + ' more)' : '') + '</div>';
  }

  html += '<div class="rmd-legend-note">Legend: <strong>S</strong> start &middot; <strong>F</strong> final stop &middot; <strong>&#10003;</strong> completed stop. Trucks sharing a location are offset with a dashed leader - their real stop position is unchanged.</div>';

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
window.ROUTE_COLORS = ROUTE_COLORS;
window.ROUTE_DASH_PATTERNS = ROUTE_DASH_PATTERNS;
window.assignRouteColors = assignRouteColors;
window.routeIdentityKey = routeIdentityKey;
window.isValidScheduleDate = isValidScheduleDate;
window.deriveRouteState = deriveRouteState;
window.splitRouteIntoLegs = splitRouteIntoLegs;
window.getRouteGeometry = getRouteGeometry;
window.buildStraightLegs = buildStraightLegs;
window.buildRemainingTrail = buildRemainingTrail;
window.startWaypointIndex = startWaypointIndex;
window.computeClusterOffsets = computeClusterOffsets;
window.computeTruckSpread = computeTruckSpread;
window.truckShortId = truckShortId;
window.routeStateKey = routeStateKey;
window.stopPhase = stopPhase;
window.updateFleetFromSchedule = updateFleetFromSchedule;
