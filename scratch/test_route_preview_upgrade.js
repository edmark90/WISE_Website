/**
 * WISE Route Preview - multi-truck map upgrade tests
 *
 * Covers:
 *   1. Deterministic, unique route colours (stable across renders / ordering)
 *   2. Route geometry split into ordered legs (road vertices preserved)
 *   3. Remaining-route trail shrinking as scheduled stops are reached
 *   4. Completion rules (final stop, manual statuses, invalid schedules)
 *   5. Independent progress per truck, and pixel spread for coincident markers
 *
 * Run: node scratch/test_route_preview_upgrade.js
 */

const fs = require('fs');
const assert = require('assert');

global.window = {};
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};

const boundaryGeoJson = JSON.parse(fs.readFileSync('assets/data/muntinlupa-boundary.json', 'utf8'));
global.MUNTINLUPA_BOUNDARY_GEOJSON = boundaryGeoJson;

eval(fs.readFileSync('assets/js/components/route-map.js', 'utf8'));

let passed = 0;
let total = 0;
const pending = [];

function test(name, fn) {
  total++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      pending.push({ name: name, promise: result });
      return;
    }
    console.log('\x1b[32mPASS\x1b[0m: ' + name);
    passed++;
  } catch (err) {
    console.error('\x1b[31mFAIL\x1b[0m: ' + name);
    console.error('      ' + err.message);
  }
}

// ---------- fixtures ----------
const STOPS = [
  { barangay: 'Alabang', street: 'Alabang Market', collection_time: '06:00:00' },
  { barangay: 'Buli', street: 'Buli Covered Court', collection_time: '07:00:00' },
  { barangay: 'Sucat', street: 'Sucat Barangay Hall', collection_time: '08:00:00' }
];

function assignment(id, truck, stops, status, date) {
  return {
    id: id,
    truck: truck,
    routeName: truck + ' Route',
    personnel: 'Crew ' + id,
    status: status || 'Upcoming',
    schedule: { collection_date: date || '2026-10-25' },
    stops: stops || STOPS
  };
}

// 2026-10-25 HH:MM in Asia/Manila
function manilaTime(hour, minute) {
  return new Date(Date.UTC(2026, 9, 25, hour - 8, minute, 0));
}

// A tiny road polyline: depot -> stop1 -> stop2 -> stop3 with intermediate vertices
const ROAD = [
  [14.3800, 121.0510],
  [14.3850, 121.0490],
  [14.3900, 121.0460],
  [14.4193, 121.0445], // stop 1 (Alabang Market)
  [14.4300, 121.0470],
  [14.4433, 121.0506], // stop 2 (Buli)
  [14.4500, 121.0520],
  [14.4570, 121.0532]  // stop 3 (Sucat)
];
const WAYPOINTS = [
  [14.3800, 121.0510],
  [14.4193, 121.0445],
  [14.4433, 121.0506],
  [14.4570, 121.0532]
];

function legsFixture() {
  const legs = window.splitRouteIntoLegs(ROAD, WAYPOINTS);
  assert(legs, 'splitRouteIntoLegs must return legs for a well formed geometry');
  return legs;
}

function truckRecord(id, legs, waypointOfStop) {
  return {
    id: id,
    legs: legs,
    waypointOfStop: waypointOfStop || [1, 2, 3],
    stops: STOPS,
    stopCoords: [WAYPOINTS[1], WAYPOINTS[2], WAYPOINTS[3]]
  };
}

console.log('\n=== 1. Deterministic, unique route colours ===');

test('Two simultaneous routes receive different colours', () => {
  const picked = window.assignRouteColors([assignment(1, 'Truck 01'), assignment(2, 'Truck 02')]);
  assert.notStrictEqual(picked[0].color, picked[1].color, 'Colours must differ');
});

test('Colour assignment is identical on every render (no randomness)', () => {
  const a = assignment(1, 'Truck 01');
  const b = assignment(2, 'Truck 02');
  const first = window.assignRouteColors([a, b]);
  const second = window.assignRouteColors([a, b]);
  assert.deepStrictEqual(first, second, 'Same input must produce the same colour map');
});

test('Colours follow the route identity, not the array order', () => {
  const a = assignment(1, 'Truck 01');
  const b = assignment(2, 'Truck 02');
  const forward = window.assignRouteColors([a, b]);
  const reversed = window.assignRouteColors([b, a]);
  assert.strictEqual(forward[0].color, reversed[1].color, 'Route 1 keeps its colour when order changes');
  assert.strictEqual(forward[1].color, reversed[0].color, 'Route 2 keeps its colour when order changes');
});

test('More routes than palette entries stay distinguishable (dash patterns)', () => {
  const many = [];
  for (let i = 1; i <= window.ROUTE_COLORS.length + 3; i++) {
    many.push(assignment(i, 'Truck ' + i));
  }
  const picked = window.assignRouteColors(many);
  const colors = many.map((_, i) => picked[i].color);
  const uniqueColors = new Set(colors);
  assert.strictEqual(uniqueColors.size, window.ROUTE_COLORS.length, 'Palette colours are exhausted before repeats');
  const dashed = Object.keys(picked).filter(k => picked[k].dashArray);
  assert(dashed.length >= 3, 'Repeated colours must get their own dash pattern');
});

test('Truck identifier is derived from the truck name', () => {
  assert.strictEqual(window.truckShortId({ truck: 'Truck 01' }, 0), 'T01');
  assert.strictEqual(window.truckShortId({ truck: 'Truck 12' }, 3), 'T12');
  assert.strictEqual(window.truckShortId({}, 4), 'T5');
});

console.log('\n=== 2. Route geometry split into ordered legs ===');

test('Geometry is cut at every scheduled stop, keeping road vertices', () => {
  const legs = legsFixture();
  assert.strictEqual(legs.length, 3, 'One leg per waypoint gap');
  assert.deepStrictEqual(legs[0][0], WAYPOINTS[0], 'Leg 1 starts at the depot');
  assert.deepStrictEqual(legs[0][legs[0].length - 1], WAYPOINTS[1], 'Leg 1 ends at stop 1');
  assert.deepStrictEqual(legs[1][legs[1].length - 1], WAYPOINTS[2], 'Leg 2 ends at stop 2');
  assert.deepStrictEqual(legs[2][legs[2].length - 1], WAYPOINTS[3], 'Leg 3 ends at stop 3');
  assert(legs[0].some(p => p[0] === 14.39), 'Intermediate road vertices are preserved (no straight-line fallback)');
});

test('Two stops that share one coordinate produce a zero-length leg, not a failure', () => {
  const waypoints = [WAYPOINTS[0], WAYPOINTS[1], WAYPOINTS[1], WAYPOINTS[3]];
  const legs = window.splitRouteIntoLegs(ROAD, waypoints);
  assert(legs, 'shared coordinates must still split');
  assert.strictEqual(legs.length, 3, 'one leg per waypoint gap');
  assert.strictEqual(legs[1].length, 1, 'the duplicate stop yields a zero-length leg');
});

test('Geometry that does not contain a waypoint is not cut blindly', () => {
  const faraway = [[0, 0], [0.5, 0.5], [1, 1]];
  const result = window.splitRouteIntoLegs(faraway, [[0, 0], [30, 30], [1, 1]]);
  assert.strictEqual(result, null, 'Unsafe split must be refused');
});

console.log('\n=== 3. Remaining route trail as the schedule advances ===');

test('Before 6:00 AM the full depot -> final stop route is drawn', () => {
  const legs = legsFixture();
  const td = truckRecord(1, legs);
  const state = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(5, 59));
  assert.strictEqual(state.isAtDepot, true);
  const trail = window.buildRemainingTrail(td, state);
  assert.deepStrictEqual(trail[0], WAYPOINTS[0], 'Trail starts at the depot');
  assert.deepStrictEqual(trail[trail.length - 1], WAYPOINTS[3], 'Trail reaches the final stop');
});

test('At 6:00 AM the depot -> stop 1 segment disappears', () => {
  const legs = legsFixture();
  const td = truckRecord(1, legs);
  const state = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(6, 0));
  assert.strictEqual(state.stopIdx, 0);
  const trail = window.buildRemainingTrail(td, state);
  assert.deepStrictEqual(trail[0], WAYPOINTS[1], 'Remaining trail starts at stop 1');
  assert(!trail.some(p => p[0] === 14.385), 'Driven depot segment is gone');
  assert.deepStrictEqual(trail[trail.length - 1], WAYPOINTS[3], 'Future stops still shown');
});

test('At 7:00 AM and 8:00 AM only the future segments remain', () => {
  const legs = legsFixture();
  const td = truckRecord(1, legs);

  const atSeven = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(7, 0));
  const trailSeven = window.buildRemainingTrail(td, atSeven);
  assert.deepStrictEqual(trailSeven[0], WAYPOINTS[2], 'Trail starts at Buli at 7:00');
  assert.deepStrictEqual(trailSeven[trailSeven.length - 1], WAYPOINTS[3], 'Final stop still ahead');

  const atEight = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(8, 0));
  assert.strictEqual(atEight.status, 'Completed');
  assert.strictEqual(window.buildRemainingTrail(td, atEight), null, 'No active line after the final stop');
});

test('Refresh at a later time restores the correct remaining route', () => {
  const legs = legsFixture();
  const td = truckRecord(1, legs);
  const state = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(7, 30));
  const trail = window.buildRemainingTrail(td, state);
  assert.deepStrictEqual(trail[0], WAYPOINTS[2], 'Position is recomputed from the schedule, not from history');
});

console.log('\n=== 4. Completion rules ===');

test('Final stop time marks the route Completed and hides the line', () => {
  const state = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(8, 0));
  assert.strictEqual(state.status, 'Completed');
  assert.strictEqual(state.isCompleted, true);
  assert.strictEqual(state.nextStopIdx, null);
});

test('A route stays Completed on later rerenders', () => {
  const state = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(11, 45));
  assert.strictEqual(state.status, 'Completed');
});

test('Manually cancelled routes are not shown as active', () => {
  const a = assignment(1, 'Truck 01', STOPS, 'Cancelled');
  const state = window.deriveRouteState(a, manilaTime(6, 30));
  assert.strictEqual(state.status, 'Cancelled');
  assert.strictEqual(state.isCancelled, true);
  assert.strictEqual(window.buildRemainingTrail(truckRecord(1, legsFixture()), state), null);
});

test('Manually completed routes stay completed even before the clock reaches the final stop', () => {
  const a = assignment(1, 'Truck 01', STOPS, 'Completed');
  const state = window.deriveRouteState(a, manilaTime(6, 30));
  assert.strictEqual(state.status, 'Completed');
  assert.strictEqual(state.isCompleted, true);
});

test('Missing stop times keep the truck at the depot (not completed)', () => {
  const stops = [
    { barangay: 'Alabang', street: 'Alabang Market' },
    { barangay: 'Buli', street: 'Buli Covered Court' }
  ];
  const state = window.deriveRouteState(assignment(1, 'Truck 01', stops), manilaTime(9, 0));
  assert.strictEqual(state.isAtDepot, true);
  assert.strictEqual(state.isCompleted, false);
});

test('Invalid or missing collection date is never reported as completed', () => {
  const noDate = assignment(1, 'Truck 01');
  noDate.schedule = {};
  const invalid = assignment(2, 'Truck 02', STOPS, 'Upcoming', '2026-02-31');

  [noDate, invalid].forEach(a => {
    const state = window.deriveRouteState(a, manilaTime(23, 0));
    assert.notStrictEqual(state.status, 'Completed', 'Invalid schedule must not complete the route');
    assert.strictEqual(state.isAtDepot, true);
  });
});

console.log('\n=== 5. Independent trucks and marker separation ===');

test('One truck completing does not affect another truck\'s route line', () => {
  const legs = legsFixture();
  const truckOne = truckRecord(1, legs);
  const truckTwo = truckRecord(2, legs);

  const doneState = window.deriveRouteState(assignment(1, 'Truck 01', STOPS), manilaTime(9, 0));
  const activeStops = [
    { barangay: 'Putatan', street: 'Puregold Putatan', collection_time: '09:00:00' },
    { barangay: 'Tunasan', street: 'Tunasan Covered Court', collection_time: '10:00:00' }
  ];
  const activeState = window.deriveRouteState(assignment(2, 'Truck 02', activeStops), manilaTime(9, 0));

  assert.strictEqual(window.buildRemainingTrail(truckOne, doneState), null, 'Completed truck has no line');
  assert(window.buildRemainingTrail(truckTwo, activeState) !== null, 'Second truck keeps its line');
  assert.notStrictEqual(window.routeStateKey(doneState), window.routeStateKey(activeState));
});

test('Trucks that share a location get distinct pixel offsets', () => {
  const offsets = window.computeClusterOffsets(2);
  assert.strictEqual(offsets.length, 2);
  assert.notDeepStrictEqual(offsets[0], offsets[1], 'Offsets must differ');
  assert(offsets[0][0] !== 0 || offsets[0][1] !== 0, 'Icons must not sit on the depot point');

  const depot = window.DEFAULT_DEPOT.coord.slice();
  const truckA = { currentCoord: depot.slice() };
  const truckB = { currentCoord: depot.slice() };
  window.computeTruckSpread([truckA, truckB]);

  assert.deepStrictEqual(truckA.currentCoord, depot, 'Coordinates are never modified');
  assert.deepStrictEqual(truckB.currentCoord, depot, 'Coordinates are never modified');
  assert.notDeepStrictEqual([truckA.spreadDx, truckA.spreadDy], [truckB.spreadDx, truckB.spreadDy]);
});

test('Trucks at different locations are not offset', () => {
  const truckA = { currentCoord: [14.4193, 121.0445] };
  const truckB = { currentCoord: [14.4433, 121.0506] };
  window.computeTruckSpread([truckA, truckB]);
  assert.strictEqual(truckA.spreadDx, 0);
  assert.strictEqual(truckA.spreadDy, 0);
  assert.strictEqual(truckB.spreadDx, 0);
  assert.strictEqual(truckB.spreadDy, 0);
});

test('Stop phases reflect the scheduled progress', () => {
  const legs = legsFixture();
  const td = truckRecord(1, legs);
  td.posInfo = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(7, 0));
  assert.strictEqual(window.stopPhase(td, 0), 'completed');
  assert.strictEqual(window.stopPhase(td, 1), 'current');
  assert.strictEqual(window.stopPhase(td, 2), 'pending');

  td.posInfo = window.deriveRouteState(assignment(1, 'Truck 01'), manilaTime(8, 0));
  assert.strictEqual(window.stopPhase(td, 2), 'completed');
});

test('Route geometry is requested once per waypoint chain (cached)', async () => {
  let calls = 0;
  global.apiRequest = async (path, options) => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        features: [{
          geometry: { coordinates: ROAD.map(p => [p[1], p[0]]) },
          properties: { summary: { distance: 12000, duration: 1800 } }
        }]
      })
    };
  };

  try {
    const first = await window.getRouteGeometry(WAYPOINTS);
    const second = await window.getRouteGeometry(WAYPOINTS);
    assert.strictEqual(calls, 1, 'Second request must come from the cache');
    assert.strictEqual(first.legs.length, 3);
    assert.strictEqual(second.legs.length, 3);
  } finally {
    delete global.apiRequest;
  }
});

(async () => {
  for (const item of pending) {
    try {
      await item.promise;
      console.log('\x1b[32mPASS\x1b[0m: ' + item.name);
      passed++;
    } catch (err) {
      console.error('\x1b[31mFAIL\x1b[0m: ' + item.name);
      console.error('      ' + err.message);
    }
  }

  console.log('\n============================================================');
  console.log('RESULTS: ' + passed + ' / ' + total + ' tests passed');
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
})();
