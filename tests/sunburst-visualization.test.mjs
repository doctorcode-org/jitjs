import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SunburstVisualization } from "../dist/visualizations/sunburst.js";
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
  data: { $dim: 8, $height: 20, $angularWidth: 4 },
  children: [
    {
      id: "alpha",
      name: "Alpha",
      data: { $dim: 5, $height: 18, $angularWidth: 2 },
      children: [
        {
          id: "alpha-one",
          name: "Alpha one",
          data: { $dim: 3, $height: 15, $angularWidth: 1 },
        },
      ],
    },
    {
      id: "beta",
      name: "Beta",
      data: { $dim: 6, $height: 16, $angularWidth: 3 },
    },
  ],
};

function configuration(events) {
  return {
    interpolation: "linear",
    levelDistance: 45,
    clearCanvas: true,
    withLabels: false,
    Node: {
      type: "multipie",
      overridable: true,
      alpha: 1,
      color: "#123456",
      lineWidth: 1,
      dim: 4,
      height: 0,
      angularWidth: 1,
      CanvasStyles: {},
    },
    Edge: {
      type: "none",
      overridable: true,
      alpha: 1,
      color: "#654321",
      lineWidth: 1,
      dim: 3,
      epsilon: 2,
      CanvasStyles: {},
    },
    Label: {
      type: "Native",
      size: 10,
      style: "",
      family: "sans-serif",
      textAlign: "start",
      textBaseline: "middle",
      color: "#000000",
    },
    onBeforePlotLine(edge) {
      events.push(["before-edge", edge.nodeFrom.id, edge.nodeTo.id]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edge.nodeFrom.id, edge.nodeTo.id]);
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

function createContext() {
  return {
    arc() {},
    beginPath() {},
    closePath() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
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

function createModern(driver) {
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
  const visualization = new SunburstVisualization({
    canvas,
    labels,
    config: configuration(events),
    ...(driver === undefined ? {} : { animation: driver }),
    renderNode() {},
    renderEdge() {},
    interpolate() {},
  });
  return { visualization, events };
}

function createLegacy() {
  const events = [];
  const element = { addEventListener() {}, attachEvent() {} };
  const context = createContext();
  context.canvas = element;
  const canvas = {
    id: "legacy-sunburst-canvas",
    clear() { events.push(["clear"]); },
    getCtx() { return context; },
    getElement() { return element; },
    getSize() { return { width: 400, height: 300 }; },
  };
  const visualization = new legacy.Sunburst({
    ...configuration(events),
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
      angleSpan: {
        begin: safeNumber(node.angleSpan.begin),
        end: safeNumber(node.angleSpan.end),
      },
      current: { theta: safeNumber(node.pos.theta), rho: safeNumber(node.pos.rho) },
      start: { theta: safeNumber(node.startPos.theta), rho: safeNumber(node.startPos.rho) },
      end: { theta: safeNumber(node.endPos.theta), rho: safeNumber(node.endPos.rho) },
      span: safeNumber(node.getData("span", "current", true)),
    };
  }
  return normalizeRealm(result);
}

function plotTrace(events) {
  return events.filter(([kind]) =>
    ["clear", "before-edge", "after-edge", "before-node", "after-node"].includes(kind),
  );
}

test("Sunburst loading, radial layout, plotting, and serialization match legacy", () => {
  const modern = createModern();
  const old = createLegacy();
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
  assert.equal(modern.visualization.toJSON().id, "root");
  assert.deepEqual(
    modern.visualization.toJSON("graph").map(({ id }) => id).sort(),
    ["alpha", "alpha-one", "beta", "root"],
  );
});

test("Sunburst replot rotation matches legacy angles and state", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();
  modern.visualization.busy = true;
  old.visualization.busy = true;
  modern.visualization.plot = () => modern.events.push(["rotation-plot"]);
  old.visualization.fx.plot = () => old.events.push(["rotation-plot"]);

  modern.visualization.rotate(
    modern.visualization.graph.getNode("alpha"),
    "replot",
    { property: "current" },
  );
  old.visualization.rotate(
    old.visualization.graph.getNode("alpha"),
    "replot",
    { property: "current" },
  );
  assert.equal(modern.visualization.rotated.id, old.visualization.rotated.id);
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));
  assert.deepEqual(modern.events.at(-1), normalizeRealm(old.events.at(-1)));
});

test("Sunburst animated rotation pauses and schedules polar interpolation", () => {
  const driver = {
    options: undefined,
    pauses: 0,
    starts: 0,
    pause() { this.pauses += 1; return this; },
    setOptions(options) { this.options = options; return this; },
    start() { this.starts += 1; return this; },
  };
  const modern = createModern(driver);
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();

  let oldAnimation;
  let oldPauses = 0;
  old.visualization.fx.animation.pause = () => { oldPauses += 1; };
  old.visualization.fx.animate = (options) => { oldAnimation = options; };
  modern.visualization.rotate(
    modern.visualization.graph.getNode("beta"),
    "animate",
    { property: "end", hideLabels: false },
  );
  old.visualization.rotate(
    old.visualization.graph.getNode("beta"),
    "animate",
    { property: "end", hideLabels: false },
  );

  assert.equal(driver.pauses, oldPauses);
  assert.equal(driver.starts, 1);
  assert.deepEqual(driver.options.modes, normalizeRealm(oldAnimation.modes));
  assert.equal(driver.options.hideLabels, oldAnimation.hideLabels);
  for (const id of Object.keys(modern.visualization.graph.nodes)) {
    assert.equal(
      modern.visualization.graph.getNode(id).endPos.theta,
      old.visualization.graph.getNode(id).endPos.theta,
      id,
    );
  }
});

test("Sunburst rejects layout and rotation before data is loaded", () => {
  const { visualization } = createModern();
  assert.throws(() => visualization.refresh(), /No graph data has been loaded/);
  assert.throws(
    () => visualization.rotateAngle(1, "replot"),
    /No graph data has been loaded/,
  );
});

test("Sunburst entry keeps optional browser and renderer modules outside", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/sunburst.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels\/(?:dom|html|native|svg)|node-shapes|edge-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
