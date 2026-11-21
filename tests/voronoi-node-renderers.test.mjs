import assert from "node:assert/strict";
import test from "node:test";

import {
  containsVoronoiNoneNode,
  containsVoronoiPolygonNode,
  renderVoronoiNoneNode,
  renderVoronoiPolygonNode,
} from "../dist/visualizations/voronoi-node-renderers.js";

const square = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

function node(id, values, children = []) {
  return {
    id,
    _depth: values.depth ?? 1,
    ignore: values.ignore,
    pos: { getc() { return { x: 0, y: 0 }; } },
    isDescendantOf() { return true; },
    getData(property) { return values[property]; },
    getSubnodes() { return children; },
  };
}

function canvas(trace) {
  const context = {
    beginPath() { trace.push("begin"); },
    closePath() { trace.push("close"); },
    createRadialGradient(...args) {
      trace.push(["gradient", ...args]);
      return { addColorStop(...stop) { trace.push(["stop", ...stop]); } };
    },
    fill() { trace.push("fill"); },
    fillRect() {},
    lineTo(x, y) { trace.push(["line", x, y]); },
    moveTo(x, y) { trace.push(["move", x, y]); },
    restore() { trace.push("restore"); },
    rotate() {},
    save() { trace.push("save"); },
    scale() {},
    stroke() { trace.push("stroke"); },
    strokeRect() {},
    translate() {},
    arc() {},
    fillStyle: "",
    strokeStyle: "",
    lineJoin: "",
    lineWidth: 1,
  };
  return { context, canvas: { getCtx() { return context; } } };
}

test("leaf renderer fills the polygon, applies cushion shading, and draws a border", () => {
  const trace = [];
  const target = node("leaf", {
    vertices: square.slice().reverse(),
    color: "#804020",
    border: "#ffffff",
  });
  const surface = canvas(trace);
  renderVoronoiPolygonNode("polygon", target, surface.canvas, false, { cushion: true }, () => true);

  assert.equal(surface.context.lineJoin, "bevel");
  assert.equal(surface.context.strokeStyle, "#ffffff");
  assert.deepEqual(trace.filter((item) => Array.isArray(item) && item[0] === "stop"), [
    ["stop", 0, "#804020"],
    ["stop", 1, "#402010"],
  ]);
  assert.equal(trace.includes("fill"), true);
  assert.equal(trace.includes("stroke"), true);
});

test("branch renderer strokes an inset polygon with the configured width", () => {
  const trace = [];
  const target = node("branch", { vertices: square });
  const surface = canvas(trace);
  renderVoronoiPolygonNode("polygon", target, surface.canvas, false, { offset: 4, titleHeight: 13 }, () => false);
  assert.equal(trace.includes("fill"), false);
  assert.equal(trace.includes("stroke"), true);
  assert.equal(surface.context.lineWidth, 4);
});

test("Voronoi hit testing respects depth, alpha, ignored nodes, and branch rings", () => {
  const root = node("root", { depth: 0, alpha: 1, vertices: square });
  const leaf = node("leaf", { depth: 1, alpha: 1, vertices: square });
  const branch = node("branch", { depth: 1, alpha: 1, vertices: square }, [leaf]);
  const state = { root: "root", graph: { getNode(id) { return id === "root" ? root : null; } } };

  assert.equal(containsVoronoiPolygonNode(leaf, { x: 0, y: 0 }, { offset: 2 }, state), true);
  assert.equal(containsVoronoiPolygonNode(leaf, { x: 20, y: 0 }, { offset: 2 }, state), false);
  assert.equal(containsVoronoiPolygonNode(branch, { x: 0, y: 0 }, { offset: 2 }, state), false);
  assert.equal(containsVoronoiPolygonNode(branch, { x: 9, y: 0 }, { offset: 2 }, state), true);
  leaf.ignore = true;
  assert.equal(containsVoronoiPolygonNode(leaf, { x: 0, y: 0 }, { offset: 2 }, state), false);
  leaf.ignore = false;
  leaf.getData = (property) => property === "alpha" ? 0.5 : square;
  assert.equal(containsVoronoiPolygonNode(leaf, { x: 0, y: 0 }, { offset: 2 }, state), false);
});

test("none renderer and hit tester remain inert", () => {
  assert.equal(renderVoronoiNoneNode(), undefined);
  assert.equal(containsVoronoiNoneNode(), false);
});
