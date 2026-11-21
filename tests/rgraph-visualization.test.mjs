import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RGraphVisualization } from "../dist/visualizations/rgraph.js";
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
  data: { $dim: 8, $angularWidth: 4 },
  children: [
    {
      id: "alpha",
      name: "Alpha",
      data: { $dim: 5, $angularWidth: 2 },
      children: [
        {
          id: "alpha-one",
          name: "Alpha one",
          data: { $dim: 3, $angularWidth: 1 },
        },
      ],
    },
    { id: "beta", name: "Beta", data: { $dim: 6, $angularWidth: 3 } },
  ],
};

function configuration(events) {
  return {
    interpolation: "polar",
    levelDistance: 45,
    clearCanvas: true,
    withLabels: false,
    Node: {
      type: "circle",
      overridable: true,
      alpha: 1,
      color: "#123456",
      lineWidth: 1,
      dim: 4,
      angularWidth: 1,
      CanvasStyles: {},
    },
    Edge: {
      type: "line",
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
      textAlign: "center",
      textBaseline: "middle",
      color: "#000000",
    },
    onBeforeCompute(node) {
      events.push(["before-compute", node.id]);
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
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    measureText() {
      return { width: 0 };
    },
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
    clear() {
      events.push(["clear"]);
    },
    getCtx() {
      return context;
    },
    getSize() {
      return { width: 400, height: 300 };
    },
  };
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
      events.push(["label", node.id]);
    },
  };
  const visualization = new RGraphVisualization({
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
  const element = {
    addEventListener() {},
    attachEvent() {},
  };
  const context = createContext();
  context.canvas = element;
  const canvas = {
    id: "legacy-rgraph-canvas",
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
      return { width: 400, height: 300 };
    },
  };
  const visualization = new legacy.RGraph({
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
      current: {
        theta: safeNumber(node.pos.theta),
        rho: safeNumber(node.pos.rho),
      },
      start: {
        theta: safeNumber(node.startPos.theta),
        rho: safeNumber(node.startPos.rho),
      },
      end: {
        theta: safeNumber(node.endPos.theta),
        rho: safeNumber(node.endPos.rho),
      },
      span: safeNumber(node.getData("span", "current", true)),
    };
  }
  return normalizeRealm(result);
}

function plotTrace(events) {
  return events.filter(([kind]) =>
    [
      "clear",
      "before-edge",
      "after-edge",
      "before-node",
      "after-node",
    ].includes(kind),
  );
}

test("RGraph loading, radial computation, plotting, and serialization match legacy", () => {
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

test("RGraph onClick preserves recentering, child ordering, and completion", () => {
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
  const modern = createModern(driver);
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();

  let oldAnimation;
  old.visualization.fx.animate = (options) => {
    oldAnimation = options;
  };
  const completed = [];
  assert.equal(
    modern.visualization.onClick("alpha", {
      hideLabels: false,
      onComplete: () => completed.push("modern"),
    }),
    true,
  );
  old.visualization.onClick("alpha", {
    hideLabels: false,
    onComplete: () => completed.push("legacy"),
  });

  assert.equal(modern.visualization.root, old.visualization.root);
  assert.equal(modern.visualization.parent.id, old.visualization.parent.id);
  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.equal(driver.starts, 1);
  assert.deepEqual(driver.options.modes, normalizeRealm(oldAnimation.modes));
  assert.equal(driver.options.hideLabels, oldAnimation.hideLabels);
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));

  driver.options.complete();
  oldAnimation.onComplete();
  assert.equal(modern.visualization.busy, false);
  assert.equal(old.visualization.busy, false);
  assert.deepEqual(completed.sort(), ["legacy", "modern"]);
  assert.equal(modern.visualization.onClick("alpha"), false);
});

test("RGraph rejects use before loading and unknown click targets", () => {
  const { visualization } = createModern();
  assert.throws(() => visualization.refresh(), /No graph data has been loaded/);
  visualization.loadJSON(tree);
  visualization.compute();
  assert.throws(() => visualization.onClick("missing"), /Unknown graph node/);
});

test("RGraph entry keeps browser and renderer choices outside its closure", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/rgraph.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels\/(?:dom|html|native|svg)|node-shapes|edge-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
