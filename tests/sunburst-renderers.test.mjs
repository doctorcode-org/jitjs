import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsSunburstGradientMultipieNode,
  containsSunburstGradientPieNode,
  containsSunburstMultipieNode,
  containsSunburstNoneNode,
  containsSunburstPieNode,
  renderSunburstGradientMultipieNode,
  renderSunburstGradientPieNode,
  renderSunburstMultipieNode,
  renderSunburstNoneNode,
  renderSunburstPieNode,
} from "../dist/visualizations/sunburst-node-renderers.js";
import {
  containsSunburstArrowEdge,
  containsSunburstHyperlineEdge,
  containsSunburstLineEdge,
  containsSunburstNoneEdge,
  renderSunburstArrowEdge,
  renderSunburstHyperlineEdge,
  renderSunburstLineEdge,
  renderSunburstNoneEdge,
} from "../dist/visualizations/sunburst-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.Sunburst.Plot.NodeTypes();
const legacyEdges = new legacy.Sunburst.Plot.EdgeTypes();
const config = { levelDistance: 45 };
const legacyPlot = {
  nodeTypes: legacyNodes,
  edgeHelper: legacy.Graph.Plot.edgeHelper,
  edge: { epsilon: 2.5 },
  config,
};

const nodeAdapters = {
  none: { render: renderSunburstNoneNode, contains: containsSunburstNoneNode },
  pie: { render: renderSunburstPieNode, contains: containsSunburstPieNode },
  multipie: {
    render: renderSunburstMultipieNode,
    contains: containsSunburstMultipieNode,
  },
  "gradient-pie": {
    render: renderSunburstGradientPieNode,
    contains: containsSunburstGradientPieNode,
  },
  "gradient-multipie": {
    render: renderSunburstGradientMultipieNode,
    contains: containsSunburstGradientMultipieNode,
  },
};

function createContext() {
  const calls = [];
  const context = {
    arc(...arguments_) { calls.push(["arc", ...arguments_]); },
    beginPath() { calls.push(["beginPath"]); },
    closePath() { calls.push(["closePath"]); },
    createRadialGradient(...arguments_) {
      calls.push(["createRadialGradient", ...arguments_]);
      return {
        marker: "gradient",
        addColorStop(...stop) { calls.push(["addColorStop", ...stop]); },
      };
    },
    fill() { calls.push(["fill"]); },
    fillRect(...arguments_) { calls.push(["fillRect", ...arguments_]); },
    lineTo(...arguments_) { calls.push(["lineTo", ...arguments_]); },
    moveTo(...arguments_) { calls.push(["moveTo", ...arguments_]); },
    restore() { calls.push(["restore"]); },
    rotate(...arguments_) { calls.push(["rotate", ...arguments_]); },
    save() { calls.push(["save"]); },
    scale(...arguments_) { calls.push(["scale", ...arguments_]); },
    stroke() { calls.push(["stroke"]); },
    strokeRect(...arguments_) { calls.push(["strokeRect", ...arguments_]); },
    translate(...arguments_) { calls.push(["translate", ...arguments_]); },
  };
  Object.defineProperty(context, "fillStyle", {
    set(value) { calls.push(["fillStyle", value?.marker ?? value]); },
    get() { return undefined; },
  });
  Object.defineProperty(context, "lineWidth", {
    set(value) { calls.push(["lineWidth", value]); },
    get() { return undefined; },
  });
  return { calls, canvas: { getCtx: () => context } };
}

function createCartesian(reads, source) {
  return {
    ...source,
    squaredNorm() { return this.x * this.x + this.y * this.y; },
    norm() { return Math.sqrt(this.squaredNorm()); },
    $scale(factor) {
      reads.push(["scale", factor]);
      this.x *= factor;
      this.y *= factor;
      return this;
    },
  };
}

function createNode(id = "node", point = { x: 30, y: 20 }) {
  const reads = [];
  const values = {
    span: 0.8,
    height: 14,
    "dim-quotient": 0.75,
    color: "#336699",
  };
  const rho = Math.sqrt(point.x * point.x + point.y * point.y);
  const theta = Math.atan2(point.y, point.x);
  const position = {
    theta,
    rho,
    getp(simple) {
      reads.push(["getp", simple]);
      return { theta: this.theta, rho: this.rho };
    },
    getc(simple) {
      reads.push(["getc", simple]);
      return createCartesian(reads, point);
    },
  };
  return {
    reads,
    node: {
      id,
      _depth: 2,
      collapsed: true,
      pos: position,
      getPos() {
        reads.push(["getPos"]);
        return position;
      },
      getData(property) {
        reads.push(["data", property]);
        return values[property];
      },
    },
  };
}

function createEdge(direction) {
  const from = createNode("from", { x: -20, y: 12 });
  const to = createNode("to", { x: 35, y: 28 });
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

test("Sunburst node render adapters match JIT 2.0.1", () => {
  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    const modern = createNode();
    const old = createNode();
    const modernCanvas = createContext();
    const oldCanvas = createContext();
    adapter.render(name, modern.node, modernCanvas.canvas, true, config);
    legacyNodes[name].render.call(legacyPlot, old.node, oldCanvas.canvas, true);
    assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
  }
});

test("Sunburst node contains adapters match angular and radial boundaries", () => {
  const positions = [
    { x: 30, y: 20 },
    { x: 80, y: 20 },
    { x: -30, y: -20 },
    { x: 0, y: 0 },
  ];
  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    for (const position of positions) {
      const modern = createNode();
      const old = createNode();
      assert.equal(
        adapter.contains(modern.node, position, config),
        legacyNodes[name].contains.call(legacyPlot, old.node, position),
        `${name}: ${JSON.stringify(position)}`,
      );
      assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    }
  }
});

test("Sunburst line, arrow, and hyperline edge adapters match legacy", () => {
  const cases = [
    ["line", renderSunburstLineEdge, containsSunburstLineEdge],
    ["arrow", renderSunburstArrowEdge, containsSunburstArrowEdge],
    ["hyperline", renderSunburstHyperlineEdge, containsSunburstHyperlineEdge],
  ];
  for (const [name, render, contains] of cases) {
    const modern = createEdge(["to", "from"]);
    const old = createEdge(["to", "from"]);
    const modernCanvas = createContext();
    const oldCanvas = createContext();
    render(name, modern.edge, modernCanvas.canvas, true);
    legacyEdges[name].render.call(legacyPlot, old.edge, oldCanvas.canvas, true);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
    assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    assert.deepEqual(modern.endpointReads, old.endpointReads, `${name} endpoints`);

    const hitModern = createEdge();
    const hitOld = createEdge();
    const point = { x: 4, y: 5 };
    assert.equal(
      contains(hitModern.edge, point, 2.5),
      legacyEdges[name].contains.call(legacyPlot, hitOld.edge, point),
      `${name} contains`,
    );
    assert.deepEqual(hitModern.endpointReads, hitOld.endpointReads, `${name} hit reads`);
  }
});

test("Sunburst none edge adapter stays inert", () => {
  const edge = createEdge();
  const canvas = createContext();
  renderSunburstNoneEdge("none", edge.edge, canvas.canvas, true);
  assert.equal(containsSunburstNoneEdge(edge.edge, { x: 0, y: 0 }, 2), false);
  assert.deepEqual(canvas.calls, []);
  assert.deepEqual(edge.endpointReads, { from: [], to: [] });
});

test("Sunburst renderer entries stay split and registry-free", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(new URL("../dist/visualizations/sunburst-renderer-contracts.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/sunburst-node-renderers.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/sunburst-edge-renderers.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.doesNotMatch(nodes, /edge-shapes|sunburst\.js|canvas\/|browser\//);
  assert.match(edges, /graph\/rendering\/edge-shapes\.js/);
  assert.doesNotMatch(edges, /node-shapes|sunburst\.js|canvas\/|browser\//);
  assert.doesNotMatch(`${contracts}${nodes}${edges}`, /\$jit|globalThis|document|window/);
});
