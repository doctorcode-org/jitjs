import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  linearPlotInterpolator,
  nodePropertyPlotInterpolator,
} from "../dist/graph/plot-interpolators.js";
import { IcicleVisualization } from "../dist/visualizations/icicle.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const treeJson = {
  id: "root",
  name: "Root",
  data: { $dim: 6 },
  children: [
    {
      id: "alpha",
      name: "Alpha",
      data: { $dim: 4 },
      children: [
        { id: "alpha-one", name: "Alpha one", data: { $dim: 2 } },
        { id: "alpha-two", name: "Alpha two", data: { $dim: 2 } },
      ],
    },
    { id: "beta", name: "Beta", data: { $dim: 2 } },
  ],
};

function edgeName(edge) {
  return `${edge.nodeFrom.id}->${edge.nodeTo.id}`;
}

function controller(events, animate = false) {
  return {
    animate,
    orientation: "h",
    offset: 2,
    constrained: true,
    levelsToShow: 3,
    clearCanvas: false,
    withLabels: false,
    Node: {
      type: "rectangle",
      overridable: true,
      alpha: 1,
      color: "#123456",
      lineWidth: 1,
      dim: 1,
      width: 1,
      height: 1,
      CanvasStyles: {},
    },
    Edge: {
      type: "none",
      overridable: true,
      alpha: 1,
      color: "#654321",
      lineWidth: 1,
      CanvasStyles: {},
    },
    Label: {
      type: "Native",
      size: 1,
      style: "",
      family: "sans-serif",
      textAlign: "center",
      textBaseline: "middle",
      color: "#000000",
    },
    onBeforeCompute(node) {
      events.push(["before-compute", node.id]);
    },
    onBeforePlotLine(edge) {
      events.push(["before-edge", edgeName(edge)]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edgeName(edge)]);
    },
    onBeforePlotNode(node) {
      events.push(["before-node", node.id]);
    },
    onAfterPlotNode(node) {
      events.push(["after-node", node.id]);
    },
    onComplete() {},
  };
}

function createContext(events) {
  return {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    measureText() {
      return { width: 0 };
    },
    fillText(name) {
      events.push(["label", name]);
    },
    lineWidth: 0,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
  };
}

function createModern(animate = false, driver) {
  const events = [];
  const context = createContext(events);
  const canvas = {
    clear() {
      events.push(["clear"]);
    },
    getCtx() {
      return context;
    },
    getSize() {
      return { width: 300, height: 180 };
    },
  };
  const config = controller(events, animate);
  const labels = {
    clearLabels(force) {
      events.push(["labels-clear", force]);
    },
    hideLabels(hidden) {
      events.push(["labels-hidden", hidden]);
    },
    hideLabel(node, show) {
      events.push(["hide-label", node.id, show]);
    },
    plotLabel(_canvas, node) {
      events.push(["label", node.name]);
    },
  };
  const visualization = new IcicleVisualization({
    canvas,
    config,
    labels,
    ...(driver === undefined ? {} : { animation: driver }),
    renderNode(_type, _node) {},
    renderEdge() {},
    interpolate(mode, node, properties, delta, versor) {
      events.push(["interpolate", mode, node.id, delta, versor ?? null]);
      if (mode === "linear") {
        linearPlotInterpolator(node, properties, delta, versor);
      } else if (mode === "node-property") {
        nodePropertyPlotInterpolator(node, properties, delta, versor);
      }
    },
  });
  return { visualization, events };
}

function createLegacy() {
  const events = [];
  const element = {
    addEventListener() {},
    attachEvent() {},
  };
  const context = createContext(events);
  context.canvas = element;
  const canvas = {
    id: "legacy-icicle-canvas",
    clear() {
      events.push(["clear"]);
    },
    getCtx() {
      return context;
    },
    getElement() {
      return element;
    },
    getSize() {
      return { width: 300, height: 180 };
    },
  };
  const visualization = new legacy.Icicle({
    ...controller(events),
    useCanvas: canvas,
    Events: { enable: false },
    Navigation: { enable: false },
    NodeStyles: { enable: false },
    Tips: { enable: false },
  });
  return { visualization, events };
}

function trace(events) {
  return events.filter(([kind]) =>
    [
      "before-compute",
      "clear",
      "before-edge",
      "after-edge",
      "before-node",
      "after-node",
      "label",
    ].includes(kind),
  );
}

test("refresh and non-animated subtree navigation match Icicle 2.0.1", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(treeJson);
  old.visualization.loadJSON(treeJson);
  modern.events.length = 0;
  old.events.length = 0;

  modern.visualization.refresh();
  old.visualization.refresh();
  assert.deepEqual(trace(modern.events), normalizeRealm(trace(old.events)));

  modern.events.length = 0;
  old.events.length = 0;
  assert.equal(
    modern.visualization.enter(modern.visualization.graph.getNode("alpha")),
    true,
  );
  old.visualization.enter(old.visualization.graph.getNode("alpha"));
  assert.equal(modern.visualization.clickedNode.id, old.visualization.clickedNode.id);
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.deepEqual(trace(modern.events), normalizeRealm(trace(old.events)));
  assert.equal(
    modern.events.some(
      ([kind, id]) => kind === "before-node" && id === "root",
    ),
    false,
  );

  modern.events.length = 0;
  old.events.length = 0;
  assert.equal(modern.visualization.out(), true);
  old.visualization.out();
  assert.equal(modern.visualization.clickedNode.id, old.visualization.clickedNode.id);
  assert.equal(modern.visualization.clickedNode.id, "root");
  assert.deepEqual(trace(modern.events), normalizeRealm(trace(old.events)));
});

test("loading, orientation, constrained plotting, and serialization are owned by the façade", () => {
  const { visualization, events } = createModern();
  assert.throws(() => visualization.plot(), /No graph data has been loaded/);

  visualization.loadJSON(treeJson);
  assert.deepEqual(events.shift(), ["labels-clear", true]);
  assert.equal(visualization.horizontal(), true);
  visualization.changeOrientation();
  assert.equal(visualization.vertical(), true);

  visualization.refresh();
  assert.ok(events.some(([kind]) => kind === "before-compute"));
  assert.ok(events.some(([kind]) => kind === "before-node"));
  assert.equal(visualization.graph.getNode("root").getData("height"), 60);
  assert.equal(visualization.toJSON().id, "root");
  assert.deepEqual(
    visualization.toJSON("graph").map(({ id }) => id).sort(),
    ["alpha", "alpha-one", "alpha-two", "beta", "root"],
  );
});

test("animated enter preserves the legacy fade-then-resize stages", () => {
  const driver = {
    options: undefined,
    starts: 0,
    setOptions(options) {
      this.options = options;
      return this;
    },
    start() {
      this.starts += 1;
      return this;
    },
  };
  const { visualization, events } = createModern(true, driver);
  visualization.loadJSON(treeJson);
  visualization.refresh();
  events.length = 0;

  const alpha = visualization.graph.getNode("alpha");
  assert.equal(visualization.enter(alpha), true);
  assert.equal(visualization.busy, true);
  assert.equal(driver.starts, 1);
  assert.deepEqual(driver.options.modes, ["node-property:alpha"]);
  assert.equal(driver.options.duration, 500);
  driver.options.compute(1);
  driver.options.complete();

  assert.equal(driver.starts, 2);
  assert.deepEqual(driver.options.modes, [
    "linear",
    "node-property:width:height",
  ]);
  assert.equal(driver.options.duration, 1000);
  driver.options.compute(1);
  driver.options.complete();
  assert.strictEqual(visualization.clickedNode, alpha);
  assert.equal(visualization.busy, false);
  assert.ok(events.some(([kind, mode]) => kind === "interpolate" && mode === "linear"));
  assert.ok(
    events.some(
      ([kind, mode]) => kind === "interpolate" && mode === "node-property",
    ),
  );
});

test("animated out resizes the selected subtree before revealing its parent", () => {
  const driver = {
    options: undefined,
    starts: 0,
    setOptions(options) {
      this.options = options;
      return this;
    },
    start() {
      this.starts += 1;
      return this;
    },
  };
  const { visualization } = createModern(true, driver);
  visualization.loadJSON(treeJson);
  visualization.refresh();

  const alpha = visualization.graph.getNode("alpha");
  visualization.enter(alpha);
  driver.options.compute(1);
  driver.options.complete();
  driver.options.compute(1);
  driver.options.complete();
  assert.strictEqual(visualization.clickedNode, alpha);

  assert.equal(visualization.out(), true);
  assert.equal(visualization.busy, true);
  assert.equal(driver.options.duration, 1000);
  assert.deepEqual(driver.options.modes, [
    "linear",
    "node-property:width:height",
  ]);
  driver.options.compute(1);
  driver.options.complete();

  assert.equal(driver.options.duration, 500);
  assert.deepEqual(driver.options.modes, ["node-property:alpha"]);
  driver.options.compute(1);
  driver.options.complete();
  assert.equal(visualization.clickedNode.id, "root");
  assert.equal(visualization.busy, false);
  assert.equal(driver.starts, 4);
});

test("Icicle entry imports no Canvas, DOM, labels backend, extras, or shape registry", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/icicle.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels|graph\/rendering\/(?:node|edge)-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\b(?:window|document)\b|\$jit/);
});
