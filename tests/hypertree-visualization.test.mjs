import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { HypertreeVisualization } from "../dist/visualizations/hypertree.js";
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
    radius: "auto",
    offset: 0.1,
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
      transform: true,
      CanvasStyles: {},
    },
    Edge: {
      type: "hyperline",
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
  const visualization = new HypertreeVisualization({
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
    id: "legacy-hypertree-canvas",
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
  const visualization = new legacy.Hypertree({
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
      scale: safeNumber(node.scale),
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

test("Hypertree loading, radius, layout, plotting, and serialization match legacy", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);

  assert.equal(modern.visualization.getRadius(), old.visualization.getRadius());
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

test("Hypertree reposition preserves the translated legacy end positions", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  modern.visualization.compute();
  old.visualization.compute();
  modern.visualization.graph.getNode("root").pos.setc(0.2, -0.15);
  old.visualization.graph.getNode("root").pos.setc(0.2, -0.15);
  modern.visualization.graph.getNode("beta").ignore = true;
  old.visualization.graph.getNode("beta").ignore = true;

  modern.visualization.reposition();
  old.visualization.reposition();
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));
});

test("Hypertree move preserves recentering and completion semantics", () => {
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
  old.visualization.fx.animate = (options, versor) => {
    oldAnimation = { options, versor };
  };
  const completed = [];
  assert.equal(
    modern.visualization.move(
      { x: 0.15, y: -0.1 },
      {
        hideLabels: false,
        onComplete: () => completed.push("modern"),
      },
    ),
    true,
  );
  old.visualization.move(
    { x: 0.15, y: -0.1 },
    {
      hideLabels: false,
      onComplete: () => completed.push("legacy"),
    },
  );

  assert.equal(modern.visualization.busy, old.visualization.busy);
  assert.equal(driver.starts, 1);
  assert.deepEqual(driver.options.modes, normalizeRealm(oldAnimation.options.modes));
  assert.equal(driver.options.hideLabels, oldAnimation.options.hideLabels);
  assert.deepEqual(
    { x: 0.15, y: -0.1 },
    normalizeRealm({ x: oldAnimation.versor.x, y: oldAnimation.versor.y }),
  );
  assert.deepEqual(snapshot(modern.visualization.graph), snapshot(old.visualization.graph));

  driver.options.complete();
  oldAnimation.options.onComplete();
  assert.equal(modern.visualization.busy, false);
  assert.equal(old.visualization.busy, false);
  assert.deepEqual(completed.sort(), ["legacy", "modern"]);
  assert.equal(modern.visualization.move({ x: 1, y: 0 }), false);
});

test("Hypertree rejects use before loading and unknown click targets", () => {
  const { visualization } = createModern();
  assert.throws(() => visualization.refresh(), /No graph data has been loaded/);
  visualization.loadJSON(tree);
  visualization.compute();
  assert.throws(() => visualization.onClick("missing"), /Unknown graph node/);
});

test("Hypertree entry keeps browser and renderer choices outside its closure", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/hypertree.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels\/(?:dom|html|native|svg)|node-shapes|edge-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
