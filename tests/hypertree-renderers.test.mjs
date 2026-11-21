import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsHypertreeCircleNode,
  containsHypertreeEllipseNode,
  containsHypertreeNoneNode,
  containsHypertreeRectangleNode,
  containsHypertreeSquareNode,
  containsHypertreeStarNode,
  containsHypertreeTriangleNode,
  renderHypertreeCircleNode,
  renderHypertreeEllipseNode,
  renderHypertreeNoneNode,
  renderHypertreeRectangleNode,
  renderHypertreeSquareNode,
  renderHypertreeStarNode,
  renderHypertreeTriangleNode,
} from "../dist/visualizations/hypertree-node-renderers.js";
import {
  containsHypertreeArrowEdge,
  containsHypertreeHyperlineEdge,
  containsHypertreeLineEdge,
  containsHypertreeNoneEdge,
  renderHypertreeArrowEdge,
  renderHypertreeHyperlineEdge,
  renderHypertreeLineEdge,
  renderHypertreeNoneEdge,
} from "../dist/visualizations/hypertree-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.Hypertree.Plot.NodeTypes();
const legacyEdges = new legacy.Hypertree.Plot.EdgeTypes();
const legacyPlot = {
  nodeHelper: legacy.Graph.Plot.nodeHelper,
  edgeHelper: legacy.Graph.Plot.edgeHelper,
  node: { transform: true },
  edge: { epsilon: 2.5 },
  viz: { getRadius: () => 120 },
};

const nodeAdapters = {
  circle: {
    render: renderHypertreeCircleNode,
    contains: containsHypertreeCircleNode,
  },
  ellipse: {
    render: renderHypertreeEllipseNode,
    contains: containsHypertreeEllipseNode,
  },
  none: {
    render: renderHypertreeNoneNode,
    contains: containsHypertreeNoneNode,
  },
  rectangle: {
    render: renderHypertreeRectangleNode,
    contains: containsHypertreeRectangleNode,
  },
  square: {
    render: renderHypertreeSquareNode,
    contains: containsHypertreeSquareNode,
  },
  star: {
    render: renderHypertreeStarNode,
    contains: containsHypertreeStarNode,
  },
  triangle: {
    render: renderHypertreeTriangleNode,
    contains: containsHypertreeTriangleNode,
  },
};

function createContext() {
  const calls = [];
  const record = (method, ...arguments_) => calls.push([method, ...arguments_]);
  return {
    calls,
    context: {
      arc(...arguments_) { record("arc", ...arguments_); },
      beginPath() { record("beginPath"); },
      closePath() { record("closePath"); },
      fill() { record("fill"); },
      fillRect(...arguments_) { record("fillRect", ...arguments_); },
      lineTo(...arguments_) { record("lineTo", ...arguments_); },
      moveTo(...arguments_) { record("moveTo", ...arguments_); },
      restore() { record("restore"); },
      rotate(...arguments_) { record("rotate", ...arguments_); },
      save() { record("save"); },
      scale(...arguments_) { record("scale", ...arguments_); },
      stroke() { record("stroke"); },
      strokeRect(...arguments_) { record("strokeRect", ...arguments_); },
      translate(...arguments_) { record("translate", ...arguments_); },
    },
  };
}

function createCanvas() {
  const result = createContext();
  return {
    calls: result.calls,
    canvas: { getCtx: () => result.context },
  };
}

function createNode(id, values, position = { x: 0.2, y: -0.1 }) {
  const reads = [];
  return {
    reads,
    node: {
      id,
      scale: 120,
      Node: { transform: true },
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return {
            ...position,
            squaredNorm() {
              return this.x * this.x + this.y * this.y;
            },
            $scale(factor) {
              reads.push(["scale", factor]);
              this.x *= factor;
              this.y *= factor;
              return this;
            },
          };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return values[property];
      },
    },
  };
}

function createEdge(direction) {
  const from = createNode("from", {}, { x: -0.25, y: 0.1 });
  const to = createNode("to", {}, { x: 0.35, y: 0.3 });
  const reads = [];
  const data = {};
  if (direction !== undefined) data.$direction = direction;
  return {
    reads,
    endpointReads: { from: from.reads, to: to.reads },
    edge: {
      nodeFrom: from.node,
      nodeTo: to.node,
      data,
      getData(property) {
        reads.push(["data", property]);
        return property === "dim" ? 8 : undefined;
      },
    },
  };
}

test("named Hypertree node render adapters match JIT 2.0.1", () => {
  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    const modern = createNode("node", { dim: 6, height: 10, width: 18 });
    const old = createNode("node", { dim: 6, height: 10, width: 18 });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();

    adapter.render(name, modern.node, modernCanvas.canvas, true);
    legacyNodes[name].render.call(legacyPlot, old.node, oldCanvas.canvas, true);
    assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
  }
});

test("named Hypertree node contains adapters retain legacy quirks", () => {
  const positions = [
    { x: 24, y: -12 },
    { x: 30, y: -12 },
    { x: 50, y: 20 },
  ];
  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    for (const position of positions) {
      const modern = createNode("node", { dim: 6, height: 10, width: 18 });
      const old = createNode("node", { dim: 6, height: 10, width: 18 });
      const actual = adapter.contains(modern.node, position);
      const expected = legacyNodes[name].contains.call(legacyPlot, old.node, position);
      assert.equal(actual, expected, `${name}: ${JSON.stringify(position)}`);
      assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    }
  }
});

test("Hypertree edge adapters match scaled line, arrow, and hyperline rendering", () => {
  const cases = [
    ["line", renderHypertreeLineEdge, containsHypertreeLineEdge],
    ["arrow", renderHypertreeArrowEdge, containsHypertreeArrowEdge],
    ["hyperline", renderHypertreeHyperlineEdge, containsHypertreeHyperlineEdge],
  ];
  for (const [name, render, contains] of cases) {
    const modern = createEdge(["to", "from"]);
    const old = createEdge(["to", "from"]);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    render(name, modern.edge, modernCanvas.canvas, true);
    legacyEdges[name].render.call(legacyPlot, old.edge, oldCanvas.canvas, true);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
    assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    assert.deepEqual(modern.endpointReads, old.endpointReads, `${name} endpoints`);

    const hitModern = createEdge(["to", "from"]);
    const hitOld = createEdge(["to", "from"]);
    const position = { x: 0, y: 0 };
    assert.equal(
      contains(hitModern.edge, position, 2.5),
      legacyEdges[name].contains.call(legacyPlot, hitOld.edge, position),
      `${name} contains`,
    );
    assert.deepEqual(hitModern.endpointReads, hitOld.endpointReads, `${name} hit reads`);
  }
});

test("Hypertree none edge adapter stays inert", () => {
  const edge = createEdge(undefined);
  const canvas = createCanvas();
  renderHypertreeNoneEdge("none", edge.edge, canvas.canvas, true);
  assert.equal(containsHypertreeNoneEdge(edge.edge, { x: 0, y: 0 }, 2), false);
  assert.deepEqual(canvas.calls, []);
  assert.deepEqual(edge.endpointReads, { from: [], to: [] });
});

test("Hypertree renderer entries stay split and import-safe", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(new URL("../dist/visualizations/hypertree-renderer-contracts.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/hypertree-node-renderers.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/hypertree-edge-renderers.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|hypertree\.js|canvas\/|browser\//);
  assert.match(edges, /graph\/rendering\/edge-shapes\.js/);
  assert.doesNotMatch(edges, /node-shapes|hypertree\.js|canvas\/|browser\//);
  assert.doesNotMatch(`${contracts}${nodes}${edges}`, /\$jit|globalThis|document|window/);
});
