import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { Graph } from "../dist/graph/graph.js";
import { constructGraph } from "../dist/loader/loader.js";
import { StreamChart } from "../dist/charts/stream-chart.js";

class FakeDelegate {
  constructor(options) {
    this.options = options;
    this.config = { ...options, Node: { ...options.Node } };
    this.calls = [];
    this.animations = [];
    this.text = [];
    this.cursor = { style: { cursor: "" } };
    this.context = {
      textAlign: "",
      textBaseline: "",
      font: "",
      fillStyle: "",
      strokeStyle: "",
      fillText: (...args) => this.text.push(args),
    };
    this.canvas = {
      getSize: () => ({ width: 420, height: 260 }),
      getCtx: () => this.context,
      getElement: () => this.cursor,
    };
    this.fx = {
      animate: (options) => {
        this.animations.push(options);
        this.calls.push(["animate", options.modes, options.duration]);
      },
    };
    this.tips = { hide: () => this.calls.push(["hideTips"]) };
    this.graph = new Graph(
      { klass: Complex, Node: { selected: false, exist: true, drawn: true } },
      options.Node,
      options.Edge,
      options.Label,
    );
    this.root = "";
  }

  loadJSON(json) {
    this.calls.push(["load", json.id]);
    this.graph = constructGraph(json, {
      graph: { klass: Complex, Node: { selected: false, exist: true, drawn: true } },
      node: this.options.Node,
      edge: this.options.Edge,
      label: this.options.Label,
    });
    this.root = json.id;
  }
  compute() { this.calls.push(["compute"]); }
  select(id) { this.calls.push(["select", id]); }
  plot() { this.calls.push(["plot"]); }
  refresh() { this.calls.push(["refresh"]); }
}

const json = {
  label: ["first", "second", "third"],
  color: ["#111111", "#338855", "#884422"],
  values: [
    { label: "alpha", values: [6, 3, 1] },
    { label: "beta", values: [2, 7, 4] },
    { label: "gamma", values: [5, 1, 8] },
    { label: "delta", values: [4, 9, 2] },
  ],
};

function createChart(overrides = {}) {
  return new StreamChart(
    {
      injectInto: "chart",
      animate: false,
      type: "stacked:gradient",
      labelOffset: 4,
      selectOnHover: true,
      Margin: { top: 5, right: 7, bottom: 11, left: 13 },
      Label: { type: "Native", style: "bold", size: 10, family: "sans-serif", color: "#fff" },
      showLabels: true,
      showAggregates: true,
      ...overrides,
    },
    {
      createDelegate: (options) => new FakeDelegate(options),
      now: () => 12345,
      getLabelName: (key) => ({ second: "Second series" })[key] || key,
    },
  );
}

test("StreamChart configures its centered SpaceTree delegate and interval data", () => {
  const chart = createChart();
  assert.equal(chart.delegate.options.Node.type, "streamchart-stacked");
  assert.equal(chart.delegate.options.Node.align, "center");
  assert.equal(chart.delegate.config.offsetX, -3);
  assert.equal(chart.delegate.config.offsetY, -105);
  chart.loadJSON(structuredClone(json));
  assert.equal(chart.delegate.graph.getByName("alpha").getData("next"), "beta");
  assert.equal(chart.delegate.graph.getByName("alpha").getData("prev"), false);
  assert.deepEqual(chart.delegate.graph.getByName("beta").getData("valueArray"), [[2, 5], [7, 1], [4, 8]]);
  assert.equal(chart.delegate.graph.getByName("beta").getData("gradient"), true);
  assert.equal(chart.delegate.config.levelDistance, 108);
  assert.equal(chart.getMaxValue(), 15);
});

test("StreamChart filtering rescales selected series and completes synchronously when animation is off", () => {
  const chart = createChart();
  chart.loadJSON(structuredClone(json));
  const completed = [];
  chart.filter(["second"], { onComplete: () => completed.push(true) });
  assert.equal(chart.busy, false);
  assert.deepEqual(completed, [true]);
  assert.deepEqual(chart.filterArray, ["second"]);
  assert.ok(chart.delegate.calls.some(([kind]) => kind === "refresh"));
  const beta = chart.delegate.graph.getByName("beta");
  const filtered = beta.getData("dimArray", "end");
  assert.deepEqual(filtered[0], [0, 0]);
  assert.ok(Math.abs(filtered[1][0] - 189.77777777777777) < 1e-12);
  assert.ok(Math.abs(filtered[1][1] - 27.11111111111111) < 1e-12);
  assert.deepEqual(filtered[2], [0, 0]);
  assert.ok(Math.abs(beta.getData("height", "end") - 189.77777777777777) < 1e-12);
});

test("StreamChart selection links adjacent intervals and setupLabels uses injected names", () => {
  const chart = createChart();
  chart.loadJSON(structuredClone(json));
  const beta = chart.delegate.graph.getByName("beta");
  chart.select(beta.id, "second", 0);
  assert.deepEqual(beta.getData("border"), { id: beta.id, name: "second", index: 0 });
  assert.deepEqual(chart.delegate.graph.getByName("alpha").getData("border"), { name: "second", index: 1 });

  beta.setData("left-pos", [[0, 100], [0, 80], [0, 80], [0, 40], [0, 40], [0, 20]]);
  beta.setData("right-pos", [[100, 100], [100, 90], [100, 90], [100, 50], [100, 50], [100, 20]]);
  chart.filterArray = ["second"];
  chart.setupLabels();
  assert.deepEqual(chart.delegate.text, [["Second", 0, 60]]);
});

test("StreamChart hover and cursor adapters retain source behavior", () => {
  const chart = createChart();
  chart.loadJSON(structuredClone(json));
  const beta = chart.delegate.graph.getByName("beta");
  const contains = { name: "second", color: "#338855", value: 7, index: 0 };
  // Position data is normally populated by the renderer before hover labels run.
  beta.setData("left-pos", [[0, 2], [0, 1], [0, 1], [0, 0], [0, 0], [0, -1]]);
  beta.setData("right-pos", [[1, 2], [1, 1], [1, 1], [1, 0], [1, 0], [1, -1]]);
  chart.delegate.options.Events.onMouseEnter();
  assert.equal(chart.delegate.cursor.style.cursor, "pointer");
  chart.delegate.options.Events.onMouseLeave();
  assert.equal(chart.delegate.cursor.style.cursor, "default");
  chart.delegate.options.Events.onMouseMove(beta, { getContains: () => contains }, {});
  assert.equal(chart.selected.name, "second");
});
