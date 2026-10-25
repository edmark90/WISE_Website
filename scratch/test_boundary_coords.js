const fs = require('fs');
const boundary = JSON.parse(fs.readFileSync('assets/data/muntinlupa-boundary.json', 'utf8'));

function isInside(lat, lng) {
  const ring = boundary.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

console.log("DEPOT [14.384538, 121.051391]:", isInside(14.384538, 121.051391));

const routeMapContent = fs.readFileSync('assets/js/components/route-map.js', 'utf8');

// Extract LANDMARK_COORDS
const lmMatch = routeMapContent.match(/var LANDMARK_COORDS = \{([\s\S]*?)\n\};/);
if (lmMatch) {
  const lmText = '{' + lmMatch[1] + '}';
  const lmObj = eval('(' + lmText + ')');
  let outsideCount = 0;
  for (const [k, v] of Object.entries(lmObj)) {
    const inPoly = isInside(v[0], v[1]);
    if (!inPoly) {
      outsideCount++;
      console.log("OUTSIDE:", k, v);
    }
  }
  console.log("Total landmarks tested:", Object.keys(lmObj).length, "Outside:", outsideCount);
}

// Test known outside locations:
console.log("Manila City Hall [14.5896, 120.9815] (should be false):", isInside(14.5896, 120.9815));
console.log("Quezon City [14.6760, 121.0437] (should be false):", isInside(14.6760, 121.0437));
