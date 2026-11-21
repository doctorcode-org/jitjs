import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { linearPlotInterpolator } from "../dist/graph/plot-interpolators.js";
import { ForceDirectedVisualization } from "../dist/visualizations/force-directed.js";

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
  const context = {
    save() {
      events.push(["save"]);
    },
    restore() {
      events.push(["restore"]);
    },
    lineWidth: 0,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
  };
  const canvas = {
    getCtx() {
      events.push(["context"]);
      return context;
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
    Node: {
      overridable: true,
      type: "circle",
      lineWidth: 1,
      color: "#112233",
      alpha: 1,
      dim: 5,
      width: 10,
      height: 10,
      CanvasStyles: {},
    },
    Edge: {
      overridable: true,
      type: "line",
      lineWidth: 1,
      color: "#445566",
      alpha: 1,
      CanvasStyles: {},
    },
    Label: {},
    onBeforeCompute(node) {
      events.push(["before-compute", node?.id]);
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
    onComplete() {
      events.push(["config-complete"]);
    },
  };
  const labels = {
    clearLabels(force) {
      events.push(["labels-clear", force]);
    },
    hideLabels(hidden) {
      events.push(["labels-hidden", hidden]);
    },
    plotLabel(_canvas, node) {
      events.push(["label", node.id]);
    },
    hideLabel(node, show) {
      events.push(["label-hide", node.id, show]);
    },
  };
  const driver = createDriver(events);
  const visualization = new ForceDirectedVisualization({
    canvas,
    config,
    labels,
    animation: driver,
    random: () => 0.5,
    timer(callback) {
      callback();
      return 0;
    },
    renderNode(type, node, _canvas, animating) {
      events.push(["render-node", type, node.id, animating ?? null]);
    },
    renderEdge(type, edge, _canvas, animating) {
      events.push([
        "render-edge",
        type,
        edge.nodeFrom.id,
        edge.nodeTo.id,
        animating ?? null,
      ]);
    },
    interpolate(mode, node, properties, delta, versor) {
      events.push([
        "interpolate",
        mode,
        node.id,
        [...properties],
        delta,
        versor,
      ]);
      if (mode === "linear") {
        linearPlotInterpolator(node, properties, delta, versor);
      }
    },
  });
  return { visualization, events, driver };
}

test("ForceDirected façade owns loading, layout, plotting, and serialization", () => {
  const { visualization, events } = createVisualization();
  assert.throws(() => visualization.plot(), /No graph data has been loaded/);

  visualization.loadJSON(graphJson, 1);
  assert.equal(visualization.root, "right");
  assert.equal(visualization.graph.getNode("left").drawn, true);
  assert.equal(visualization.graph.getNode("left").exist, true);
  assert.deepEqual(events.shift(), ["labels-clear", true]);

  visualization.refresh();
  assert.ok(events.some(([kind]) => kind === "render-edge"));
  assert.equal(
    events.filter(([kind]) => kind === "render-node").length,
    2,
  );
  assert.equal(events.filter(([kind]) => kind === "label").length, 2);

  const serialized = visualization.toJSON("graph");
  assert.deepEqual(
    serialized.map(({ id }) => id).sort(),
    ["left", "right"],
  );
});

test("incremental compute retains legacy callback defaults and ordering", () => {
  const { visualization, events } = createVisualization();
  visualization.loadJSON(graphJson);
  events.length = 0;
  const progress = [];

  visualization.computeIncremental({
    iter: 1,
    onStep(value) {
      progress.push(value);
    },
    onComplete() {
      progress.push("complete");
    },
  });

  assert.deepEqual(events[0], ["before-compute", "left"]);
  assert.deepEqual(progress, [100, "complete"]);
});

test("animation composes preparation, interpolation, plotting, and labels", () => {
  const { visualization, events, driver } = createVisualization();
  visualization.loadJSON(graphJson);
  visualization.graph.getNode("left").pos.setc(0, 0);
  visualization.graph.getNode("left").endPos.setc(20, 10);
  visualization.graph.getNode("right").pos.setc(10, 0);
  visualization.graph.getNode("right").endPos.setc(30, 10);
  events.length = 0;
  const versor = { id: "versor" };

  const selected = visualization.animate(
    {
      duration: 40,
      hideLabels: true,
      onComplete() {
        events.push(["request-complete"]);
      },
    },
    versor,
  );
  assert.strictEqual(selected, driver);
  driver.options.compute(0.5);
  assert.deepEqual(
    {
      x: visualization.graph.getNode("left").pos.x,
      y: visualization.graph.getNode("left").pos.y,
    },
    { x: 10, y: 5 },
  );
  driver.options.complete();

  assert.deepEqual(events[0], ["labels-hidden", true]);
  assert.ok(events.some(([kind]) => kind === "interpolate"));
  assert.ok(events.some(([kind]) => kind === "render-edge"));
  const unhideIndex = events.findIndex(
    ([kind, hidden]) => kind === "labels-hidden" && hidden === false,
  );
  assert.ok(unhideIndex > 0);
  assert.ok(
    events.findIndex(([kind], index) =>
      index > unhideIndex && kind === "render-node",
    ) > unhideIndex,
  );
  assert.deepEqual(events.at(-1), ["request-complete"]);
});

test("visualization entry imports no Canvas, DOM, extras, labels, or shapes", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/force-directed.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels|graph\/rendering\/(?:node|edge)-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\b(?:window|document)\b|\$jit/);
});
