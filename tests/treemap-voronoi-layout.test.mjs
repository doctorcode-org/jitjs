import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { area, pointInPolygon } from "../dist/geometry/computational.js";
import { VoronoiTreemapLayout } from "../dist/layouts/treemap/voronoi.js";
import { constructGraph } from "../dist/loader/loader.js";

const tree = {
  id: "root",
  name: "Root",
  data: { $area: 100 },
  children: [
    { id: "left", name: "Left", data: { $area: 40 } },
    { id: "right", name: "Right", data: { $area: 60 } },
  ],
};

function createLayout(overrides = {}) {
  const graph = constructGraph(tree, {
    graph: { klass: Complex, Node: { selected: false, exist: true, drawn: true } },
    node: { overridable: true, alpha: 1, width: 0, height: 0 },
    edge: {},
    label: {},
  });
  graph.getNode("left").histoPos = [undefined, new Complex(-30, 0)];
  graph.getNode("right").histoPos = [undefined, new Complex(30, 0)];
  const events = [];
  const layout = new VoronoiTreemapLayout({
    graph,
    root: "root",
    getSize: () => ({ width: 200, height: 100 }),
    config: { offset: 0, centroidType: "centroid", ...overrides },
    controller: {
      onBeforeCompute(node) { events.push(["before", node.id]); },
      onAfterCompute(node) { events.push(["after", node.id]); },
    },
  });
  return { graph, layout, events };
}

test("Voronoi treemap partitions the rectangular root and preserves source callbacks", () => {
  const { graph, layout, events } = createLayout();
  layout.compute();

  const root = graph.getNode("root");
  const left = graph.getNode("left");
  const right = graph.getNode("right");
  const rootVertices = root.getData("vertices");
  const leftVertices = left.getData("vertices");
  const rightVertices = right.getData("vertices");

  assert.deepEqual(events, [["before", "root"], ["after", "root"]]);
  assert.deepEqual(root.pos.getc(true), new Complex(0, 0));
  assert.equal(area(rootVertices), 20000);
  assert.ok(Math.abs(area(leftVertices) + area(rightVertices) - area(rootVertices)) < 1e-8);
  assert.deepEqual(pointInPolygon(new Complex(-30, 0), leftVertices), [true]);
  assert.deepEqual(pointInPolygon(new Complex(30, 0), rightVertices), [true]);
  assert.equal(left.getData("width"), 0);
  assert.equal(right.getData("height"), 0);
});

test("Voronoi treemap reuses historical sites and writes requested phases", () => {
  const { graph, layout } = createLayout();
  layout.compute("end");
  const before = graph.getNode("left").histoPos[1];
  const originalRandom = Math.random;
  Math.random = () => { throw new Error("historical sites should avoid randomness"); };
  try {
    layout.compute("end");
  } finally {
    Math.random = originalRandom;
  }
  assert.strictEqual(graph.getNode("left").histoPos[1], before);
  assert.equal(graph.getNode("left").getData("vertices", "end").length >= 3, true);
});

test("centroid relaxation converges symmetrically and keeps sites inside cells", () => {
  const { layout } = createLayout();
  const boundary = [
    new Complex(-100, -50),
    new Complex(100, -50),
    new Complex(100, 50),
    new Complex(-100, 50),
  ];
  const sites = layout.centroid(
    [new Complex(-50, 20), new Complex(50, -20)],
    boundary,
  );
  assert.ok(Math.abs(sites[0].x + 50) < 0.01);
  assert.ok(Math.abs(sites[1].x - 50) < 0.01);
  assert.ok(Math.abs(sites[0].y) < 0.01);
  assert.ok(Math.abs(sites[1].y) < 0.01);
});

test("weighted and pressure centroid strategies retain area metadata", () => {
  const { layout } = createLayout();
  const boundary = [
    new Complex(-100, -50), new Complex(100, -50),
    new Complex(100, 50), new Complex(-100, 50),
  ];
  const makeSites = () => [
    Object.assign(new Complex(-30, 0), { area: 40 }),
    Object.assign(new Complex(30, 0), { area: 60 }),
  ];
  for (const sites of [
    layout.weightedCentroid(makeSites(), boundary),
    layout.byArea(makeSites(), boundary),
  ]) {
    assert.deepEqual(sites.map((site) => site.area), [40, 60]);
    assert.equal(sites.every((site) => Number.isFinite(site.x) && Number.isFinite(site.y)), true);
  }
  assert.equal(layout.doLayoutPressure(), undefined);
});
