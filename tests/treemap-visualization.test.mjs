import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SliceAndDiceTreemapVisualization } from "../dist/visualizations/treemap-slice-and-dice.js";
import { SquarifiedTreemapVisualization } from "../dist/visualizations/treemap-squarified.js";
import { StripTreemapVisualization } from "../dist/visualizations/treemap-strip.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
setLegacyDocument({
  body: { appendChild() {} },
  createElement() {
    return {
      className: "",
      innerHTML: "",
      offsetHeight: 0,
      offsetWidth: 0,
      style: {},
    };
  },
});

const tree = {
  id: "root",
  name: "Root",
  data: { $area: 100 },
  children: [
    {
      id: "alpha",
      name: "Alpha",
      data: { $area: 60 },
      children: [
        { id: "alpha-one", name: "Alpha one", data: { $area: 35 } },
        { id: "alpha-two", name: "Alpha two", data: { $area: 25 } },
      ],
    },
    { id: "beta", name: "Beta", data: { $area: 40 } },
  ],
};

const variants = [
  ["SliceAndDice", SliceAndDiceTreemapVisualization],
  ["Squarified", SquarifiedTreemapVisualization],
  ["Strip", StripTreemapVisualization],
];

function configuration(events, overrides = {}) {
  return {
    orientation: "h",
    titleHeight: 13,
    offset: 2,
    levelsToShow: 0,
    constrained: false,
    animate: false,
    clearCanvas: true,
    withLabels: true,
    Node: {
      type: "rectangle",
      overridable: true,
      alpha: 1,
      color: "#444444",
      lineWidth: 1,
      width: 3,
      height: 3,
      border: false,
      CanvasStyles: {},
    },
    Edge: {
      type: "none",
      overridable: true,
      alpha: 1,
      color: "#000000",
      lineWidth: 1,
      CanvasStyles: {},
    },
    Label: {
      type: "Native",
      size: 10,
      style: "",
      family: "sans-serif",
      textAlign: "center",
      textBaseline: "top",
      color: "#000000",
    },
    onBeforeCompute(node) { events.push(["before-compute", node.id]); },
    onAfterCompute(node) { events.push(["after-compute", node.id]); },
    onBeforePlotLine(edge) {
      events.push(["before-edge", edge.nodeFrom.id, edge.nodeTo.id]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edge.nodeFrom.id, edge.nodeTo.id]);
    },
    onBeforePlotNode(node) { events.push(["before-node", node.id]); },
    onAfterPlotNode(node) { events.push(["after-node", node.id]); },
    onComplete() {},
    ...overrides,
  };
}

function createContext() {
  return {
    arc() {},
    beginPath() {},
    closePath() {},
    createRadialGradient() { return { addColorStop() {} }; },
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    measureText() { return { width: 0 }; },
    moveTo() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    stroke() {},
    strokeRect() {},
    translate() {},
    fillStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
  };
}

function createModern(Visualization, overrides, driver) {
  const events = [];
  const context = createContext();
  const canvas = {
    clear() { events.push(["clear"]); },
    getCtx() { return context; },
    getSize() { return { width: 400, height: 300 }; },
  };
  const labels = {
    clearLabels(force) { events.push(["labels-clear", force]); },
    hideLabels(hidden) { events.push(["labels-hidden", hidden]); },
    hideLabel(node, show) { events.push(["hide-label", node.id, show]); },
    plotLabel(_canvas, node) { events.push(["label", node.id]); },
  };
  const visualization = new Visualization({
    canvas,
    labels,
    config: configuration(events, overrides),
    ...(driver === undefined ? {} : { animation: driver }),
    renderNode() {},
    renderEdge() {},
    interpolate() {},
    events: { hoveredNode: null },
  });
  return { visualization, events };
}

function createLegacy(name, overrides) {
  const events = [];
  const element = { addEventListener() {}, attachEvent() {} };
  const context = createContext();
  context.canvas = element;
  const canvas = {
    id: `legacy-treemap-${name}`,
    clear() { events.push(["clear"]); },
    getCtx() { return context; },
    getElement() { return element; },
    getSize() { return { width: 400, height: 300 }; },
  };
  const visualization = new legacy.TM[name]({
    ...configuration(events, overrides),
    useCanvas: canvas,
    Events: { enable: false },
    Navigation: { enable: false },
    NodeStyles: { enable: false },
    Tips: { enable: false },
  });
  return { visualization, events };
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : String(value);
}

function snapshot(graph) {
  const result = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.getNode(id);
    result[id] = {
      depth: node._depth,
      current: { x: safeNumber(node.pos.x), y: safeNumber(node.pos.y) },
      start: { x: safeNumber(node.startPos.x), y: safeNumber(node.startPos.y) },
      end: { x: safeNumber(node.endPos.x), y: safeNumber(node.endPos.y) },
      width: safeNumber(node.getData("width", "current", true)),
      height: safeNumber(node.getData("height", "current", true)),
      drawn: node.drawn,
      exist: node.exist,
      ignore: Boolean(node.ignore),
    };
  }
  return normalizeRealm(result);
}

function plotTrace(events) {
  return events.filter(([kind]) =>
    ["clear", "before-edge", "after-edge", "before-node", "after-node"].includes(kind),
  );
}

for (const [name, Visualization] of variants) {
  test(`TM.${name} layout, plot traversal, and serialization match legacy`, () => {
    const modern = createModern(Visualization);
    const old = createLegacy(name);
    modern.visualization.loadJSON(tree);
    old.visualization.loadJSON(tree);
    modern.visualization.compute();
    old.visualization.compute();
    assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));

    modern.events.length = 0;
    old.events.length = 0;
    modern.visualization.plot();
    old.visualization.plot();
    assert.deepEqual(plotTrace(modern.events), normalizeRealm(plotTrace(old.events)));
    assert.equal(modern.visualization.leaf(modern.visualization.graph.getNode("beta")), true);
    assert.equal(modern.visualization.leaf(modern.visualization.graph.getNode("alpha")), false);
    assert.equal(modern.visualization.toJSON().id, "root");
  });
}

test("Treemap synchronous enter and out match legacy selection and geometry", () => {
  const modern = createModern(SquarifiedTreemapVisualization);
  const old = createLegacy("Squarified");
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();

  assert.equal(modern.visualization.enter(modern.visualization.graph.getNode("alpha")), true);
  old.visualization.enter(old.visualization.graph.getNode("alpha"));
  assert.equal(modern.visualization.clickedNode.id, old.visualization.clickedNode.id);
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));

  assert.equal(modern.visualization.out(), true);
  old.visualization.out();
  assert.equal(modern.visualization.clickedNode.id, old.visualization.clickedNode.id);
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));
});

test("Treemap level pruning matches TM.Geom state", () => {
  const overrides = { levelsToShow: 1 };
  const modern = createModern(StripTreemapVisualization, overrides);
  const old = createLegacy("Strip", overrides);
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();
  modern.visualization.setRightLevelToShow(modern.visualization.graph.getNode("root"));
  old.visualization.geom.setRightLevelToShow(old.visualization.graph.getNode("root"));
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));
});

test("Treemap animated enter retains the legacy fade-then-resize sequence", () => {
  const driver = {
    calls: [],
    starts: 0,
    setOptions(options) { this.calls.push(options); return this; },
    start() { this.starts += 1; return this; },
  };
  const overrides = { animate: true };
  const modern = createModern(SquarifiedTreemapVisualization, overrides, driver);
  const old = createLegacy("Squarified", overrides);
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();
  const oldCalls = [];
  old.visualization.fx.animate = (options) => oldCalls.push(options);

  assert.equal(modern.visualization.enter(modern.visualization.graph.getNode("alpha")), true);
  old.visualization.enter(old.visualization.graph.getNode("alpha"));
  assert.equal(driver.calls.length, oldCalls.length);
  assert.deepEqual(driver.calls[0].modes, normalizeRealm(oldCalls[0].modes));
  assert.equal(driver.calls[0].duration, oldCalls[0].duration);
  assert.equal(modern.visualization.busy, old.visualization.busy);

  driver.calls[0].complete();
  oldCalls[0].onComplete();
  assert.equal(driver.calls.length, oldCalls.length);
  assert.deepEqual(driver.calls[1].modes, normalizeRealm(oldCalls[1].modes));
  assert.equal(driver.calls[1].duration, oldCalls[1].duration);
  assert.equal(
    modern.visualization.clickedNode?.id ?? null,
    old.visualization.clickedNode?.id ?? null,
  );

  driver.calls[1].complete();
  oldCalls[1].onComplete();
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.equal(modern.visualization.clickedNode.id, old.visualization.clickedNode.id);
});

test("Treemap lazy request workflow merges returned subtrees like TM.Group", () => {
  const modernRequests = [];
  const oldRequests = [];
  const makeRequest = (trace) => (id, level, controller) => {
    trace.push([id, level]);
    controller.onComplete(id, {
      children: [
        { id: `${id}-lazy`, name: "Lazy", data: { $area: 1 } },
      ],
    });
  };
  const modern = createModern(StripTreemapVisualization, {
    levelsToShow: 2,
    request: makeRequest(modernRequests),
  });
  const old = createLegacy("Strip", {
    levelsToShow: 2,
    request: makeRequest(oldRequests),
  });
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();

  modern.visualization.enter(modern.visualization.graph.getNode("root"));
  old.visualization.enter(old.visualization.graph.getNode("root"));
  assert.deepEqual(modernRequests, normalizeRealm(oldRequests));
  assert.deepEqual(
    Object.keys(modern.visualization.graph.nodes).sort(),
    Object.keys(old.visualization.graph.nodes).sort(),
  );
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));
});

test("Treemap base and concrete entries keep algorithms and browser choices isolated", async () => {
  const [base, slice, square, strip] = await Promise.all([
    readFile(new URL("../dist/visualizations/treemap.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-slice-and-dice.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-squarified.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-strip.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(base, /layouts\/treemap\/(?:slice-and-dice|squarified|strip)/);
  assert.match(slice, /layouts\/treemap\/slice-and-dice\.js/);
  assert.doesNotMatch(slice, /squarified|treemap\/strip/);
  assert.match(square, /layouts\/treemap\/squarified\.js/);
  assert.doesNotMatch(square, /slice-and-dice|treemap\/strip/);
  assert.match(strip, /layouts\/treemap\/strip\.js/);
  assert.doesNotMatch(strip, /slice-and-dice|squarified/);
  assert.doesNotMatch(`${base}${slice}${square}${strip}`, /\$jit|globalThis|document|window|canvas\/canvas|browser\/dom/);
});
