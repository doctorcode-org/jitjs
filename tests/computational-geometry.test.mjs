import assert from "node:assert/strict";
import test from "node:test";

import {
  area,
  bisector,
  centroid,
  centroid3,
  circum,
  circumcenter,
  cleanConvexHull,
  convexCut,
  convexHull,
  convexIntersect,
  cross,
  dist,
  dist2,
  getExtent,
  hyperbola,
  intersection,
  intersectionSeg,
  inverse,
  offsetConvex,
  offsetLine,
  pointInPolygon,
  polarComparator,
  randPointInPolygon,
  randPointInTriangle,
  voronoi,
  weightedPoint,
  weightOfPoint,
} from "../dist/geometry/computational.js";

const point = (x, y, extra = {}) => ({ x, y, ...extra });
const coordinates = (value) => ({ x: value.x, y: value.y });
const coordinatesOf = (values) => values.map(coordinates);

test("computational geometry installs no legacy registry", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Object.hasOwn(globalThis, "Geometry"), false);
});

test("distance, interpolation, orientation, area, and circumference retain source semantics", () => {
  assert.equal(dist2(point(1, 2), point(4, 6)), 25);
  assert.equal(dist(point(1, 2), point(4, 6)), 5);
  assert.deepEqual(coordinates(weightedPoint(point(2, 4), point(10, 20), 0.25)), { x: 4, y: 8 });
  assert.equal(weightOfPoint(point(2, 9), point(10, -5), point(4, 100)), 0.25);
  assert.equal(cross(point(0, 0), point(2, 0), point(0, 3)), 6);
  assert.equal(area([point(0, 0), point(4, 0), point(4, 3), point(0, 3)]), 12);
  assert.equal(area([point(0, 0), point(0, 3), point(4, 3), point(4, 0)]), -12);
  assert.equal(circum([point(0, 0), point(3, 0), point(3, 4)]), 7);
});

test("point and convex-polygon operations preserve clipping and boundary quirks", () => {
  const square = [point(-1, -1), point(1, -1), point(1, 1), point(-1, 1)];
  assert.deepEqual(pointInPolygon([point(0, 0), point(2, 0), point(1, 0)], square), [true, false, false]);
  assert.equal(pointInPolygon(point(0, 0), [point(0, 0), point(1, 1)]), false);

  const clipped = convexCut(square, [point(0, -2), point(0, 2)], [7]);
  assert.deepEqual(coordinatesOf(clipped), [point(0, -1), point(0, 1), point(-1, 1), point(-1, -1)]);
  assert.deepEqual(clipped[0].attached, [7]);
  assert.deepEqual(
    coordinatesOf(convexIntersect(square.slice(), [point(0, -2), point(2, -2), point(2, 2), point(0, 2)])),
    [point(0, -1), point(1, -1), point(1, 1), point(0, 1)],
  );
});

test("line helpers, extents, centroids, and circumcenters retain numeric results", () => {
  assert.deepEqual(bisector(point(0, 0), point(2, 0)), [4, 0, -4]);
  assert.deepEqual(coordinates(intersection([1, 0, -2], [0, 1, -3])), point(2, 3));
  assert.strictEqual(intersection([1, 0, -2], [2, 0, -4])[0], 1);
  assert.equal(intersection([1, 0, -2], [1, 0, -3]), null);
  assert.deepEqual(getExtent([point(2, 8), point(-1, 3), point(7, -4)]), [-1, -4, 7, 8]);
  assert.deepEqual(getExtent([]), [0, 0, 0, 0]);
  assert.deepEqual(coordinatesOf(offsetLine([point(0, 0), point(2, 0)], 3)), [point(0, 3), point(2, 3)]);
  assert.deepEqual(coordinates(intersectionSeg([point(0, 0), point(4, 4)], [point(0, 4), point(4, 0)], true)), point(2, 2));
  assert.equal(intersectionSeg([point(0, 0), point(1, 0)], [point(2, -1), point(2, 1)], true), null);

  const triangle = [point(0, 0), point(6, 0), point(0, 3)];
  assert.ok(Math.abs(centroid3(triangle).x - 1.999999999998) < 1e-12);
  assert.ok(Math.abs(centroid(triangle).x - 1.999999999998) < 1e-12);
  assert.ok(Math.abs(centroid(triangle).y - 0.999999999999) < 1e-12);
  assert.deepEqual(coordinates(circumcenter([point(0, 0), point(2, 0), point(0, 2)])), point(1, 1));
});

test("offset, hull, comparator, and inverse helpers preserve legacy structures", () => {
  const expanded = offsetConvex([point(-1, -1), point(1, -1), point(1, 1), point(-1, 1)], 1);
  assert.ok(Array.isArray(expanded));
  assert.deepEqual(coordinatesOf(expanded), [point(2, -2), point(2, 2), point(-2, 2), point(-2, -2)]);
  const cleaned = cleanConvexHull([point(0, 0), point(2, 0), point(2, 2), point(0, 2)]);
  assert.ok(Array.isArray(cleaned));
  assert.equal(area(cleaned), 4);

  const sites = [point(1, 1), point(0, 0), point(2, 0), point(2, 2), point(0, 2)];
  assert.deepEqual(coordinatesOf(convexHull(sites)), [point(0, 0), point(2, 0), point(2, 2), point(0, 2)]);
  const base = point(0, 0);
  const near = point(1, 0);
  const far = point(2, 0);
  assert.equal(polarComparator(base)(near, far), -1);
  assert.deepEqual(near.__distBase, [1]);
  assert.equal(inverse({ line: [point(0, 0), point(2, 0)], cline: [point(5, 0), point(3, 0)] }), 1);
  assert.equal(inverse({ line: [point(0, 0), point(0, 2)], cline: [point(0, 5), point(0, 8)] }), 0);
});

test("random helpers retain reflection, segment interpolation, and polygon fan selection", () => {
  const originalRandom = Math.random;
  const values = [0.8, 0.7, 0.25, 0.1, 0.2, 0.3];
  Math.random = () => values.shift();
  try {
    const trianglePoint = randPointInTriangle([point(0, 0), point(10, 0), point(0, 10)]);
    assert.ok(Math.abs(trianglePoint.x - 2) < 1e-12);
    assert.ok(Math.abs(trianglePoint.y - 3) < 1e-12);
    assert.deepEqual(coordinates(randPointInPolygon([point(2, 4), point(10, 12)])), point(4, 6));
    const polygonPoint = randPointInPolygon([point(0, 0), point(4, 0), point(4, 4), point(0, 4)]);
    assert.ok(Math.abs(polygonPoint.x - 2) < 1e-12);
    assert.ok(Math.abs(polygonPoint.y - 1.2) < 1e-12);
  } finally {
    Math.random = originalRandom;
  }
});

test("hyperbola and Voronoi retain the source's completed and unfinished behavior", () => {
  const vertical = hyperbola(point(1, 2), point(1, 8));
  assert.equal(vertical[0](100), 5);
  assert.equal(vertical[1](-100), 5);
  assert.throws(() => hyperbola(point(0, 0), point(2, 2))[0](1), { name: "ReferenceError", message: "x1 is not defined" });

  const boundary = [point(-2, -2), point(2, -2), point(2, 2), point(-2, 2)];
  const cells = voronoi([point(-1, 0, { area: 3 }), point(1, 0, { area: 7 })], boundary);
  assert.equal(cells.length, 2);
  assert.equal(cells[0].area, 3);
  assert.equal(cells[1].area, 7);
  assert.equal(area(cells[0]), 8);
  assert.equal(area(cells[1]), 8);
  assert.deepEqual(pointInPolygon(point(-1, 0), cells[0]), [true]);
  assert.deepEqual(pointInPolygon(point(1, 0), cells[1]), [true]);
});
