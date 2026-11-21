import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ForceDirected3DVisualization } from "../dist/visualizations/force-directed3d.js";

const graphJson = [
  {
    id: "left",
    name: "Left",
    data: {},
    adjacencies: [{ nodeTo: "right", data: {} }],
  },
  { id: "right", name: "Right", data: {}, adjacencies: [] },
];

function createDriver(events) {
  return {
    options: undefined,
    setOptions(options) {
      this.options = options;
      events.push(["animation-options", options.modes, options.duration]);
      return this;
    },
    start() {
      events.push(["animation-start"]);
      return this;
    },
  };
}

function createVisualization() {
  const events = [];
  const canvas = {
    getCtx() {
      events.push(["context"]);
      return {};
    },
    clear() {
      events.push(["clear"]);
    },
    getSize() {
      return { width: 400, height: 300 };
    },
  };
  const config = {
    iterations: 2,
    levelDistance: 50,
    clearCanvas: true,
    withLabels: true,
    Node: { overridable: true, type: "sphere", alpha: 1, dim: 5 },
    Edge: { overridable: true, type: "tube", alpha: 1, lineWidth: 1 },
    Label: {},
    onBeforeCompute(node) { events.push(["before-compute", node?.id]); },
    onBeforePlotLine(edge) { events.push(["before-edge", edge.nodeFrom.id, edge.nodeTo.id]); },
    onAfterPlotLine(edge) { events.push(["after-edge", edge.nodeFrom.id, edge.nodeTo.id]); },
    onBeforePlotNode(node) { events.push(["before-node", node.id]); },
    onAfterPlotNode(node) { events.push(["after-node", node.id]); },
    onComplete() { events.push(["config-complete"]); },
  };
  const labels = {
    clearLabels(force) { events.push(["labels-clear", force]); },
    hideLabels(hidden) { events.push(["labels-hidden", hidden]); },
    plotLabel(_canvas, node) { events.push(["label", node.id]); },
    hideLabel(node, show) { events.push(["label-hide", node.id, show]); },
  };
  const driver = createDriver(events);
  const visualization = new ForceDirected3DVisualization({
    canvas,
    config,
    labels,
    animation: driver,
    random: () => 0.6,
    timer(callback) {
      callback();
      return 0;
    },
    renderNode(node, _canvas, animating) {
      events.push(["render-node", node.getData("type"), node.id, animating ?? null]);
    },
    renderEdge(edge, _canvas, animating) {
      events.push(["render-edge", edge.getData("type"), edge.nodeFrom.id, edge.nodeTo.id, animating ?? null]);
    },
  });
  return { visualization, events, driver };
}

test("ForceDirected3D façade owns loading, layout, rendering, and serialization", () => {
  const { visualization, events } = createVisualization();
  assert.throws(() => visualization.plot(), /No graph data has been loaded/);
  visualization.loadJSON(graphJson, 1);
  assert.equal(visualization.root, "right");
  assert.equal(visualization.graph.getNode("left").pos.z, 0);
  assert.deepEqual(events.shift(), ["labels-clear", true]);

  visualization.refresh();
  assert.ok(events.some(([kind]) => kind === "render-edge"));
  assert.equal(events.filter(([kind]) => kind === "render-node").length, 2);
  assert.equal(events.filter(([kind]) => kind === "label").length, 2);
  assert.deepEqual(
    visualization.toJSON("graph").map(({ id }) => id).sort(),
    ["left", "right"],
  );
});

test("incremental ForceDirected3D computation keeps source callback ordering", () => {
  const { visualization, events } = createVisualization();
  visualization.loadJSON(graphJson);
  events.length = 0;
  const progress = [];
  visualization.computeIncremental({
    iter: 1,
    onStep(value) { progress.push(value); },
    onComplete() { progress.push("complete"); },
  });
  assert.deepEqual(events[0], ["before-compute", "left"]);
  assert.deepEqual(progress, [100, "complete"]);
});

test("default 3D animation interpolates x, y, and z and restores labels", () => {
  const { visualization, events, driver } = createVisualization();
  visualization.loadJSON(graphJson);
  const left = visualization.graph.getNode("left");
  const right = visualization.graph.getNode("right");
  left.pos.setc(0, 2, 4);
  left.endPos.setc(20, 12, 14);
  right.pos.setc(10, 0, -10);
  right.endPos.setc(30, 10, 10);
  events.length = 0;

  const selected = visualization.animate({
    duration: 40,
    hideLabels: true,
    onComplete() { events.push(["request-complete"]); },
  });
  assert.strictEqual(selected, driver);
  driver.options.compute(0.5);
  assert.deepEqual({ x: left.pos.x, y: left.pos.y, z: left.pos.z }, { x: 10, y: 7, z: 9 });
  driver.options.complete();
  assert.deepEqual(events[0], ["labels-hidden", true]);
  assert.ok(events.some(([kind]) => kind === "render-edge"));
  assert.ok(events.some(([kind, hidden]) => kind === "labels-hidden" && hidden === false));
  assert.deepEqual(events.at(-1), ["request-complete"]);
});

test("ForceDirected3D façade keeps Canvas3D, O3D, DOM, labels, and extras optional", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/force-directed3d.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /canvas\/canvas3d|geometry\/o3d|browser\/dom|graph\/labels|extras\//);
  assert.doesNotMatch(output, /\b(?:window|document)\b|\$jit/);
});
