/**
 * WISE Route Preview - render pipeline test
 *
 * Drives the real renderRouteDiagram / renderRouteMap code with a stubbed Leaflet
 * and a stubbed ORS response, then inspects the layers that were produced:
 *   - two trucks at the depot get two separable markers (pixel offsets, unchanged coords)
 *   - each route gets its own stable colour and its own polyline
 *   - a schedule whose final stop is passed renders no active route line
 *   - the legend identifies both trucks
 *   - clock ticks do not trigger new routing requests
 *
 * Run: node scratch/test_render_pipeline.js
 */

const fs = require('fs');
const assert = require('assert');

// ---------- Leaflet stub ----------
class Layer {
  addTo(map) { map.addLayer(this); return this; }
}

class Polyline extends Layer {
  constructor(latlngs, options) {
    super();
    this.latlngs = latlngs;
    this.options = options || {};
    this.tooltip = null;
  }
  bindTooltip(content) { this.tooltip = content; return this; }
}

class Marker extends Layer {
  constructor(latlng, options) {
    super();
    this.latlng = latlng;
    this.options = options || {};
    this.icon = this.options.icon;
    this.tooltip = null;
    this.popup = null;
  }
  setLatLng(latlng) { this.latlng = latlng; return this; }
  setIcon(icon) { this.icon = icon; return this; }
  bindTooltip(content, options) { this.tooltip = content; this.tooltipOptions = options; return this; }
  unbindTooltip() { this.tooltip = null; return this; }
  bindPopup(content, options) { this.popup = content; this.popupOptions = options; return this; }
  unbindPopup() { this.popup = null; return this; }
  setPopupContent(content) { this.popup = content; return this; }
  getTooltip() { return this.tooltip ? {} : null; }
}

class LayerGroup extends Layer {
  constructor() { super(); this._layers = []; }
  addLayer(layer) { this._layers.push(layer); return this; }
  clearLayers() { this._layers = []; return this; }
}

const maps = [];

global.L = {
  map: function () {
    const map = {
      layers: [],
      addLayer(l) { this.layers.push(l); return this; },
      removeLayer(l) { const i = this.layers.indexOf(l); if (i >= 0) this.layers.splice(i, 1); return this; },
      fitBounds(b) { this.lastFit = b; },
      invalidateSize() {}
    };
    maps.push(map);
    return map;
  },
  tileLayer: function () { return new Layer(); },
  polygon: function (rings) { const p = new Layer(); p.rings = rings; return p; },
  polyline: function (latlngs, options) { return new Polyline(latlngs, options); },
  marker: function (latlng, options) { return new Marker(latlng, options); },
  layerGroup: function () { return new LayerGroup(); },
  divIcon: function (options) { return { options: options, html: options.html }; }
};

// ---------- DOM / util stubs ----------
const elements = {};
function el(id) { return elements[id] || (elements[id] = { id: id, style: {}, innerHTML: '' }); }

global.document = {
  getElementById: (id) => (id === 'route-leaflet-map' || id === 'route-preview-info') ? el(id) : null,
  addEventListener: () => {}
};
global.window = {};
global.MUNTINLUPA_BOUNDARY_GEOJSON = JSON.parse(fs.readFileSync('assets/data/muntinlupa-boundary.json', 'utf8'));
global.BARANGAY_COLORS = {};
global.escapeHtml = (s) => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
global.formatTime12 = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
};

// ORS geometry stub (depot -> Alabang Market -> Buli -> Sucat) with road vertices
const DEPOT = [14.384538, 121.051391];
const ROAD_LATLNG = [
  DEPOT,
  [14.3900, 121.0460],
  [14.4193, 121.0445],
  [14.4300, 121.0470],
  [14.4433, 121.0506],
  [14.4500, 121.0520],
  [14.4570, 121.0532]
];

let routingCalls = 0;
global.apiRequest = async (path) => {
  if (path === '/api/routing/directions') {
    routingCalls++;
    return {
      ok: true,
      json: async () => ({
        features: [{
          geometry: { coordinates: ROAD_LATLNG.map(p => [p[1], p[0]]) },
          properties: { summary: { distance: 9800, duration: 1500 } }
        }]
      })
    };
  }
  throw new Error('unexpected apiRequest ' + path);
};

eval(fs.readFileSync('assets/js/components/route-map.js', 'utf8'));

// ---------- helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function manilaDateStr(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

function schedule(id, truck, date, times) {
  return {
    id: id,
    truck_number: truck,
    route_name: truck + ' Route',
    assigned_personnel: 'Crew ' + id,
    collection_date: date,
    collection_time: times[0],
    barangay: 'Alabang',
    zone: 'Alabang Market',
    status: 'Upcoming',
    stops: [
      { id: id * 10 + 1, barangay: 'Alabang', street: 'Alabang Market', collection_time: times[0] },
      { id: id * 10 + 2, barangay: 'Buli', street: 'Buli Covered Court', collection_time: times[1] },
      { id: id * 10 + 3, barangay: 'Sucat', street: 'Sucat Barangay Hall', collection_time: times[2] }
    ]
  };
}

function mapLayersOfType(type) {
  const map = maps[maps.length - 1];
  return map.layers.filter(l => l instanceof type);
}

function truckMarkers() {
  return mapLayersOfType(Marker).filter(m => m.icon && m.icon.html && m.icon.html.indexOf('wise-truck-slot') !== -1);
}

function routeGroups() {
  return mapLayersOfType(LayerGroup);
}

function activePolylines() {
  return routeGroups().reduce((acc, g) => acc.concat(g._layers.filter(l => l instanceof Polyline)), []);
}

function markerOffset(marker) {
  const match = /--wise-truck-dx:(-?\d+)px;--wise-truck-dy:(-?\d+)px/.exec(marker.icon.html);
  assert(match, 'truck icon must carry spread offsets');
  return match[1] + ',' + match[2];
}

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m: ' + name);
    passed++;
  } catch (err) {
    console.error('\x1b[31mFAIL\x1b[0m: ' + name);
    console.error('      ' + err.message);
  }
}

(async () => {
  console.log('\n=== Render pipeline: trucks at the depot ===');

  await test('Two trucks at the depot are visually separated without moving coordinates', async () => {
    routingCalls = 0;
    window.renderRouteDiagram([
      schedule(1, 'Truck 01', manilaDateStr(1), ['06:00:00', '07:00:00', '08:00:00']),
      schedule(2, 'Truck 02', manilaDateStr(1), ['06:30:00', '07:30:00', '08:30:00'])
    ], 'Tomorrow');
    await sleep(80);

    const trucks = truckMarkers();
    assert.strictEqual(trucks.length, 2, 'both trucks must be drawn');

    trucks.forEach(m => assert.deepStrictEqual(m.latlng, DEPOT, 'truck coordinates stay at the depot'));

    const offsets = trucks.map(markerOffset);
    assert.notStrictEqual(offsets[0], offsets[1], 'icons must not stack on top of each other');

    trucks.forEach(m => {
      assert(m.icon.html.indexOf('wise-truck-leader') !== -1, 'shifted icons keep a leader to the real location');
      assert(m.icon.html.indexOf('wise-truck-label') !== -1, 'icons show the truck identifier');
    });
  });

  await test('Simultaneous routes use different, stable colours', async () => {
    const groups = routeGroups();
    const first = activePolylines().map(l => l.options.color);
    assert.strictEqual(first.length, 4, 'two trucks -> halo + line each');

    window.renderRouteDiagram([
      schedule(1, 'Truck 01', manilaDateStr(1), ['06:00:00', '07:00:00', '08:00:00']),
      schedule(2, 'Truck 02', manilaDateStr(1), ['06:30:00', '07:30:00', '08:30:00'])
    ], 'Tomorrow');
    await sleep(80);

    const second = activePolylines().map(l => l.options.color);
    assert.deepStrictEqual(second, first, 'colours must not change between renders');
    assert.notStrictEqual(second[0], second[2], 'the two routes must use different colours');
    assert.strictEqual(groups.length, 2, 'one route layer group per truck');
  });

  await test('Legend identifies each truck, route and colour', async () => {
    const html = el('route-preview-info').innerHTML;
    assert(html.indexOf('Truck 01') !== -1 && html.indexOf('Truck 02') !== -1, 'truck names in the legend');
    assert(html.indexOf('T01') !== -1 && html.indexOf('T02') !== -1, 'truck ids in the legend');
    assert(html.indexOf('Truck 01 Route') !== -1 && html.indexOf('Truck 02 Route') !== -1, 'route names in the legend');
    assert(html.indexOf('At Tunasan Depot') !== -1, 'current scheduled location shown');
    assert(html.indexOf('rmd-tc-badge') !== -1, 'status badge shown');
  });

  await test('Truck markers expose route, current stop, next stop and status', async () => {
    const marker = truckMarkers()[0];
    assert(marker.popup.indexOf('Truck 01 Route') !== -1, 'popup shows the assigned route');
    assert(marker.popup.indexOf('Current') !== -1, 'popup shows the current location');
    assert(marker.popup.indexOf('Next') !== -1, 'popup shows the next stop');
    assert(marker.popup.indexOf('At Depot') !== -1, 'popup shows the schedule status');
    assert(marker.tooltip.indexOf('Truck 01') !== -1, 'tooltip shows the truck identifier');
  });

  await test('Routing geometry is requested once per unique waypoint chain', async () => {
    const before = routingCalls;
    window.renderRouteDiagram([
      schedule(1, 'Truck 01', manilaDateStr(1), ['06:00:00', '07:00:00', '08:00:00']),
      schedule(2, 'Truck 02', manilaDateStr(1), ['06:30:00', '07:30:00', '08:30:00'])
    ], 'Tomorrow');
    await sleep(80);
    assert.strictEqual(routingCalls, before, 'rerendering reuses the cached geometry');
    assert.strictEqual(before, 1, 'both trucks share one stop chain -> a single ORS request');
  });

  console.log('\n=== Render pipeline: completed route ===');

  await test('A route whose final stop has passed draws no active line', async () => {
    window.renderRouteDiagram([
      schedule(3, 'Truck 03', manilaDateStr(-1), ['06:00:00', '07:00:00', '08:00:00'])
    ], 'Yesterday');
    await sleep(80);

    assert.strictEqual(activePolylines().length, 0, 'no halo and no line for a completed route');
    assert.strictEqual(truckMarkers().length, 1, 'completed truck marker stays visible');

    const html = el('route-preview-info').innerHTML;
    assert(html.indexOf('Completed') !== -1, 'route summary shows the Completed status');
  });

  await test('Clock tick does not request routing data for a completed route', async () => {
    const before = routingCalls;
    window.updateFleetFromSchedule(new Date());
    await sleep(20);
    assert.strictEqual(routingCalls, before, 'ticks must never call OpenRouteService');
  });

  console.log('\n=== Render pipeline: mid-route ===');

  await test('Leftover route line starts at the current scheduled stop', async () => {
    // Today, with the first two stops already in the past -> only Sucat remains ahead.
    window.renderRouteDiagram([
      schedule(4, 'Truck 04', manilaDateStr(0), ['00:01:00', '00:02:00', '23:59:00'])
    ], 'Today');
    await sleep(80);

    const lines = activePolylines().filter(l => l.options.weight === 4.5);
    assert.strictEqual(lines.length, 1, 'one remaining route line');

    const trail = lines[0].latlngs;
    const sucat = [14.457, 121.0532];
    assert.deepStrictEqual(trail[trail.length - 1], sucat, 'line still reaches the future final stop');
    assert(trail[0][0] > 14.44, 'depot and completed segments are gone (line starts at Buli)');
  });

  console.log('\n============================================================');
  console.log('RESULTS: ' + passed + ' / ' + total + ' render tests passed');
  console.log('============================================================\n');

  process.exit(passed === total ? 0 : 1);
})();
