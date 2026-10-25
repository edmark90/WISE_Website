/**
 * Comprehensive Automated Test Suite for WISE Route Preview
 * Verifies:
 *  1. Default Truck Depot Configuration (Arandia St, Tunasan: 14.384538, 121.051391)
 *  2. Official Muntinlupa Administrative Boundary & Point-in-Polygon Validation
 *  3. Out-of-bounds collection locations flagging
 *  4. Schedule-based truck position matrix (5:59 AM -> 6:00 AM -> 6:30 AM -> 7:00 AM -> 8:00 AM)
 *  5. Multi-truck independent schedule isolation
 *  6. Future & past route date handling
 */

const fs = require('fs');
const assert = require('assert');

// 1. Load boundary GeoJSON and route-map.js
const boundaryGeoJson = JSON.parse(fs.readFileSync('assets/data/muntinlupa-boundary.json', 'utf8'));

// Mock browser window/document environment
global.window = {};
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};
global.MUNTINLUPA_BOUNDARY_GEOJSON = boundaryGeoJson;

// Evaluate route-map.js in this context
const routeMapCode = fs.readFileSync('assets/js/components/route-map.js', 'utf8');
eval(routeMapCode);

console.log("============================================================");
console.log("   WISE SYSTEM: ROUTE PREVIEW COMPREHENSIVE TEST SUITE      ");
console.log("============================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`\x1b[32m✔ PASS\x1b[0m: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`\x1b[31m✘ FAIL\x1b[0m: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// ------------------------------------------------------------
// TEST GROUP 1: Depot Configuration & Coordinate Ordering
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 1: Configured Truck Depot ---");

test("Depot has exact configured coordinates (Arandia St, Tunasan)", () => {
  const depot = window.DEFAULT_DEPOT;
  assert.strictEqual(depot.lat, 14.384538, "Latitude must be 14.384538");
  assert.strictEqual(depot.lng, 121.051391, "Longitude must be 121.051391");
  assert.deepStrictEqual(depot.coord, [14.384538, 121.051391], "Leaflet coord must be [lat, lng]");
  assert.deepStrictEqual(depot.orsCoord, [121.051391, 14.384538], "ORS coord must be [lng, lat]");
  assert(depot.address.includes("Arandia Street"), "Address must include Arandia Street");
  assert(depot.address.includes("Tunasan"), "Address must include Tunasan");
});

test("Depot is strictly inside the official Muntinlupa boundary", () => {
  const inside = window.isCoordInsideMuntinlupa(14.384538, 121.051391);
  assert.strictEqual(inside, true, "Tunasan Depot must be inside Muntinlupa boundary");
});

// ------------------------------------------------------------
// TEST GROUP 2: Muntinlupa Boundary Enforcement
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 2: Official Boundary & Point-in-Polygon ---");

test("Muntinlupa barangay centroids are all inside the boundary", () => {
  for (const [bName, coords] of Object.entries(window.BARANGAY_COORDS)) {
    const inside = window.isCoordInsideMuntinlupa(coords[0], coords[1]);
    assert.strictEqual(inside, true, `Barangay ${bName} centroid [${coords.join(', ')}] must be inside boundary`);
  }
});

test("External Metro Manila landmarks are correctly flagged as OUTSIDE", () => {
  const manilaCityHall = [14.5896, 120.9815];
  const quezonCityHall = [14.6483, 121.0504];
  const taguigCityHall = [14.5264, 121.0583];
  
  assert.strictEqual(window.isCoordInsideMuntinlupa(manilaCityHall[0], manilaCityHall[1]), false, "Manila City Hall must be outside");
  assert.strictEqual(window.isCoordInsideMuntinlupa(quezonCityHall[0], quezonCityHall[1]), false, "Quezon City Hall must be outside");
  assert.strictEqual(window.isCoordInsideMuntinlupa(taguigCityHall[0], taguigCityHall[1]), false, "Taguig City Hall must be outside");
});

test("Coordinates outside Muntinlupa are flagged for review by resolveStopCoords", () => {
  // Test resolveStopCoords for an out-of-boundary landmark (San Martin de Porres / Parañaque border)
  const res = window.resolveStopCoords("Sucat", "Sitio Pagkakaisa Covered Court");
  assert.strictEqual(res.isOutOfBoundary, true, "Border stop must be detected as out-of-boundary");
  assert.strictEqual(res.isFlagged, true, "Border stop must be flagged for review");
  assert(res.reason.includes("outside Muntinlupa City"), "Reason must specify outside boundary");
  assert(res.coord !== null, "Coordinates must be preserved for review rather than deleted");
});

// ------------------------------------------------------------
// TEST GROUP 3: Schedule-based Truck Position Matrix
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 3: Exact Schedule Logic Matrix ---");

const testStops = [
  { barangay: 'Alabang', street: 'Alabang Market', collection_time: '06:00:00' },
  { barangay: 'Buli', street: 'Buli Covered Court', collection_time: '07:00:00' },
  { barangay: 'Sucat', street: 'Sucat Barangay Hall', collection_time: '08:00:00' }
];

// Helper to create a specific time on 2026-10-25 in Manila time
function makeTime(hour, min) {
  // In Manila (UTC+8), local time 2026-10-25 HH:MM is 2026-10-25 (HH-8):MM UTC
  const d = new Date(Date.UTC(2026, 9, 25, hour - 8, min, 0));
  return d;
}

test("5:59 AM: Truck remains at Tunasan Depot BEFORE Stop 1", () => {
  const t = makeTime(5, 59);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, true, "Must be at depot at 5:59 AM");
  assert.strictEqual(pos.status, "At Depot");
  assert.deepStrictEqual(pos.coord, [14.384538, 121.051391], "Coord must be Tunasan Depot");
  assert.strictEqual(pos.nextStopIdx, 0, "Next stop must be Stop 1");
  assert(pos.detailText.includes("Departs at 6:00 AM"), "Detail must specify 6:00 AM departure");
});

test("6:00 AM: Truck jumps directly to Stop 1 (Alabang Market)", () => {
  const t = makeTime(6, 0);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false, "Must not be at depot at 6:00 AM");
  assert.strictEqual(pos.stopIdx, 0, "Must be at Stop 1 (index 0)");
  assert.strictEqual(pos.status, "At Scheduled Stop");
  assert.strictEqual(pos.nextStopIdx, 1, "Next stop must be Stop 2");
  assert(pos.detailText.includes("At Alabang Market"), "Must indicate location at Alabang Market");
  assert(pos.detailText.includes("Next: Buli Covered Court at 7:00 AM"), "Must indicate next stop at 7:00 AM");
});

test("6:30 AM: Truck stays stationary at Stop 1 (Alabang Market)", () => {
  const t = makeTime(6, 30);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 0, "Must stay stationary at Stop 1 at 6:30 AM");
  assert.strictEqual(pos.nextStopIdx, 1);
});

test("6:59 AM: Truck stays stationary at Stop 1 until the exact next minute", () => {
  const t = makeTime(6, 59);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 0, "Must still be at Stop 1 at 6:59 AM");
});

test("7:00 AM: Truck jumps directly to Stop 2 (Buli Covered Court)", () => {
  const t = makeTime(7, 0);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 1, "Must jump directly to Stop 2 at 7:00 AM");
  assert.strictEqual(pos.nextStopIdx, 2, "Next stop must be Stop 3");
  assert(pos.detailText.includes("At Buli Covered Court"), "Must indicate location at Buli");
  assert(pos.detailText.includes("Next: Sucat Barangay Hall at 8:00 AM"), "Must indicate next stop at 8:00 AM");
});

test("7:30 AM: Truck stays stationary at Stop 2 (Buli Covered Court)", () => {
  const t = makeTime(7, 30);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 1, "Must stay stationary at Stop 2 at 7:30 AM");
  assert.strictEqual(pos.nextStopIdx, 2);
});

test("8:00 AM: Truck reaches final Stop 3 (Sucat) and marks status Completed", () => {
  const t = makeTime(8, 0);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 2, "Must be at Stop 3 (index 2)");
  assert.strictEqual(pos.status, "Completed");
  assert.strictEqual(pos.nextStopIdx, null, "No next stop after final stop");
});

test("9:00 AM: Truck stays stationary at final Stop 3 after route completion", () => {
  const t = makeTime(9, 0);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-25', t);
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.stopIdx, 2, "Must remain at final Stop 3");
  assert.strictEqual(pos.status, "Completed");
});

// ------------------------------------------------------------
// TEST GROUP 4: Date Isolation & Multi-truck Independence
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 4: Date Isolation & Multi-truck Independence ---");

test("Future route date places truck at Tunasan Depot", () => {
  const t = makeTime(10, 0); // Current time is 10:00 AM on 2026-10-25
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-26', t); // Route is for tomorrow
  assert.strictEqual(pos.isAtDepot, true, "Future route truck must be at depot");
  assert.strictEqual(pos.status, "At Depot");
  assert.deepStrictEqual(pos.coord, [14.384538, 121.051391], "Coord must be Tunasan Depot");
  assert(pos.detailText.includes("Scheduled for 2026-10-26 at 6:00 AM"), "Detail must specify route date & departure time");
});

test("Past route date marks truck route as Completed", () => {
  const t = makeTime(10, 0);
  const pos = window.calcTruckSchedulePosition(testStops, '2026-10-24', t); // Route was yesterday
  assert.strictEqual(pos.isAtDepot, false);
  assert.strictEqual(pos.status, "Completed");
  assert.strictEqual(pos.stopIdx, 2, "Should reference final stop");
});

test("Two trucks have completely independent schedules and positions", () => {
  const truck1Stops = [
    { barangay: 'Alabang', street: 'Alabang Market', collection_time: '06:00:00' },
    { barangay: 'Buli', street: 'Buli Covered Court', collection_time: '07:00:00' }
  ];
  const truck2Stops = [
    { barangay: 'Putatan', street: 'Puregold Putatan', collection_time: '09:00:00' },
    { barangay: 'Tunasan', street: 'Tunasan Covered Court', collection_time: '10:00:00' }
  ];

  // At 6:30 AM:
  const t630 = makeTime(6, 30);
  const posTruck1 = window.calcTruckSchedulePosition(truck1Stops, '2026-10-25', t630);
  const posTruck2 = window.calcTruckSchedulePosition(truck2Stops, '2026-10-25', t630);

  // Truck 1 is active at Stop 1 (Alabang Market)
  assert.strictEqual(posTruck1.isAtDepot, false, "Truck 1 should be active");
  assert.strictEqual(posTruck1.stopIdx, 0, "Truck 1 should be at Stop 1");
  assert.strictEqual(posTruck1.status, "At Scheduled Stop");

  // Truck 2 is STILL AT TUNASAN DEPOT (departs at 9:00 AM)
  assert.strictEqual(posTruck2.isAtDepot, true, "Truck 2 must still be at depot");
  assert.strictEqual(posTruck2.status, "At Depot");
  assert.deepStrictEqual(posTruck2.coord, [14.384538, 121.051391], "Truck 2 coord must be Tunasan Depot");
  assert(posTruck2.detailText.includes("Departs at 9:00 AM"), "Truck 2 detail must indicate 9:00 AM departure");
});

console.log("\n============================================================");
console.log(`RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("============================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
