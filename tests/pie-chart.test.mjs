import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Polar } from "../dist/core/geometry.js";
import { PieChart } from "../dist/charts/pie-chart.js";
import { Graph } from "../dist/graph/graph.js";
import { constructGraph } from "../dist/loader/loader.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

const document = {
  body: { appendChild() {} },
  createElement() {
    return { className: "", innerHTML: "", style: {} };
  },
};
setLegacyDocument(document);

class FakeDelegate {
  constructor(options) {
    this.options = options;
    this.config = { ...options, Node: { ...options.Node } };
    this.context = { globalCompositeOperation: "source-over" };
    this.canvas = {
      getSize: () => ({ width: 360, height: 240 }),
      getCtx: () => this.context,
    };
    this.calls = [];
    this.animations = [];
    this.fx = {
      animate: (animation) => {
        this.animations.push(animation);
        this.calls.push([
          "animate",
          normalizeRealm({ modes: animation.modes, duration: animation.duration }),
        ]);
      },
    };
    this.graph = new Graph(
      { klass: Polar, Node: { selected: false, exist: true, drawn: true } },
      options.Node,
      options.Edge,
      options.Label,
    );
    this.root = "";
  }

  loadJSON(json) {
    this.calls.push(["load", json.id]);
    this.graph = constructGraph(json, {
      graph: {
        klass: Polar,
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.options.Node,
      edge: this.options.Edge,
      label: this.options.Label,
    });
    this.root = json.id;
  }

  refresh() { this.calls.push(["refresh"]); }
  compute(phase) { this.calls.push(["compute", phase]); }
  plot() { this.calls.push(["plot"]); }
}

function makeOptions(overrides = {}) {
  return {
    injectInto: "chart",
    animate: false,
    offset: 13,
    sliceOffset: 4,
    labelOffset: 3,
    type: "stacked:gradient",
    hoveredColor: "#9fd4ff",
    showLabels: true,
    resizeLabels: 7,
    updateHeights: false,
    Label: {
      type: "Native",
      style: "bold",
      size: 12,
      family: "sans-serif",
      color: "#ffffff",
    },
    ...overrides,
  };
}

function createModern(options) {
  return new PieChart(options, {
    createDelegate: (delegateOptions) => new FakeDelegate(delegateOptions),
    now: () => 12345,
  });
}

function createLegacy(options) {
  const OriginalSunburst = legacy.Sunburst;
  const originalTime = legacy.util.time;
  legacy.Sunburst = FakeDelegate;
  legacy.util.time = () => 12345;
  try {
    const chart = new legacy.PieChart(options);
    const loadJSON = chart.loadJSON;
    chart.loadJSON = function loadWithStablePrefix(json) {
      const currentTime = legacy.util.time;
      legacy.util.time = () => 12345;
      try {
        return loadJSON.call(this, json);
      } finally {
        legacy.util.time = currentTime;
      }
    };
    return chart;
  } finally {
    legacy.Sunburst = OriginalSunburst;
    legacy.util.time = originalTime;
  }
}

const json = {
  label: ["first", "second", "third"],
  color: ["#111111", "#222222", "#333333"],
  values: [
    { label: "alpha", values: [6, 3, 1] },
    { label: "beta", values: [2, 7, 4] },
  ],
};

function optionSnapshot(chart) {
  const options = chart.delegate.options;
  return normalizeRealm({
    injectInto: options.injectInto,
    width: options.width,
    height: options.height,
    useCanvas: options.useCanvas,
    withLabels: options.withLabels,
    Label: options.Label,
    Node: options.Node,
    Edge: options.Edge,
    Tips: {
      enable: options.Tips.enable,
      type: options.Tips.type,
      force: options.Tips.force,
    },
    Events: {
      enable: options.Events.enable,
      type: options.Events.type,
    },
    levelDistance: chart.delegate.config.levelDistance,
    composite: chart.delegate.context.globalCompositeOperation,
  });
}

function graphSnapshot(chart) {
  const answer = {};
  chart.delegate.graph.eachNode((node) => {
    if (!node.name) return;
    answer[node.name] = {
      value: node.data.value,
      valueArray: node.getData("valueArray", "current", true),
      colorArray: node.getData("colorArray", "current", true),
      stringArray: node.getData("stringArray", "current", true),
      gradient: node.getData("gradient", "current", true),
      configType: node.getData("config", "current", true)?.type,
      angularWidth: node.getData("angularWidth", "current", true),
      border: normalizeRealm(node.getData("border", "current", true)),
      dimArray: node.getData("dimArray", "current", true),
      endDimArray: node.getData("dimArray", "end", true),
      normalizedDim: node.getData("normalizedDim", "current", true),
    };
  });
  return normalizeRealm(answer);
}

function elementSnapshot(element) {
  return { style: { ...element.style }, innerHTML: element.innerHTML };
}

test("PieChart delegate composition, loading, and normalization match 2.0.1", () => {
  const modern = createModern(makeOptions());
  const old = createLegacy(makeOptions());
  assert.deepEqual(optionSnapshot(modern), optionSnapshot(old));

  modern.loadJSON(json);
  old.loadJSON(json);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(modern.getLegend(), normalizeRealm(old.getLegend()));
  assert.equal(modern.getMaxValue(), old.getMaxValue());
  assert.deepEqual(modern.delegate.calls, normalizeRealm(old.delegate.calls));
});

test("PieChart mono-series colors and fixed single-value heights match 2.0.1", () => {
  const input = {
    label: "amount",
    color: ["#112233", "#445566"],
    values: [
      { label: "alpha", values: 3 },
      { label: "beta", values: 9 },
      { label: "gamma", values: 1 },
    ],
  };
  const modern = createModern(makeOptions({ type: "stacked", resizeLabels: false }));
  const old = createLegacy(makeOptions({ type: "stacked", resizeLabels: false }));
  modern.loadJSON(input);
  old.loadJSON(input);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(modern.getLegend(), normalizeRealm(old.getLegend()));
  assert.deepEqual(
    Object.values(graphSnapshot(modern)).map(({ dimArray }) => dimArray),
    [[103], [103], [103]],
  );
});

test("PieChart selection and delegated interaction callbacks match 2.0.1", () => {
  const makeInteractiveOptions = (trace) => makeOptions({
    Tips: {
      enable: true,
      onShow(...arguments_) { trace.push(["tip", ...arguments_]); },
    },
    Events: {
      enable: true,
      onClick(...arguments_) { trace.push(["click", ...arguments_]); },
    },
  });
  const modernTrace = [];
  const oldTrace = [];
  const modern = createModern(makeInteractiveOptions(modernTrace));
  const old = createLegacy(makeInteractiveOptions(oldTrace));
  modern.loadJSON(json);
  old.loadJSON(json);
  const modernNode = modern.delegate.graph.getByName("alpha");
  const oldNode = old.delegate.graph.getByName("alpha");

  modern.select(modernNode.id, "second");
  old.select(oldNode.id, "second");
  modern.select(modernNode.id, "second");
  old.select(oldNode.id, "second");
  assert.deepEqual(normalizeRealm(modern.selected), normalizeRealm(old.selected));
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.equal(
    modern.delegate.calls.filter(([name]) => name === "plot").length,
    old.delegate.calls.filter(([name]) => name === "plot").length,
  );

  const modernContains = { name: "second", color: "#222222", value: 3, label: "alpha", index: 1 };
  const oldContains = { ...modernContains };
  const modernInfo = { getContains: () => modernContains };
  const oldInfo = { getContains: () => oldContains };
  modern.delegate.options.Tips.onShow("tip", modernNode, modernContains);
  old.delegate.options.Tips.onShow("tip", oldNode, oldContains);
  modern.delegate.options.Events.onClick(modernNode, modernInfo, "event");
  old.delegate.options.Events.onClick(oldNode, oldInfo, "event");
  assert.deepEqual(
    normalizeRealm(modernTrace.map(([kind, ...values]) => [kind, ...values.map((value) => value?.id ?? value)])),
    normalizeRealm(oldTrace.map(([kind, ...values]) => [kind, ...values.map((value) => value?.id ?? value)])),
  );

  const modernMoves = [];
  const oldMoves = [];
  modern.select = (...arguments_) => modernMoves.push(arguments_);
  old.select = (...arguments_) => oldMoves.push(arguments_);
  modern.delegate.options.Events.onMouseMove(modernNode, modernInfo, "move");
  old.delegate.options.Events.onMouseMove(oldNode, oldInfo, "move");
  modern.delegate.options.Events.onMouseMove(false, modernInfo, "leave");
  old.delegate.options.Events.onMouseMove(false, oldInfo, "leave");
  assert.deepEqual(normalizeRealm(modernMoves), normalizeRealm(oldMoves));
});

test("PieChart native and DOM label hooks match 2.0.1", () => {
  const modern = createModern(makeOptions({ Label: { type: "HTML" } }));
  const old = createLegacy(makeOptions({ Label: { type: "HTML" } }));
  const makeNode = () => {
    const reads = [];
    const data = { dimArray: [10, 20, 5], span: 0.8, normalizedDim: 0.5 };
    return {
      reads,
      node: {
        name: "Alpha",
        pos: {
          theta: 0.7,
          getp(simple) {
            reads.push(["getp", simple]);
            return { theta: this.theta, rho: 0 };
          },
        },
        getData(property) {
          reads.push(["data", property]);
          return data[property];
        },
      },
    };
  };
  const modernNode = makeNode();
  const oldNode = makeNode();
  const modernElement = { style: {}, innerHTML: "" };
  const oldElement = { style: {}, innerHTML: "" };
  modern.delegate.options.onCreateLabel(modernElement, modernNode.node);
  old.delegate.options.onCreateLabel(oldElement, oldNode.node);
  modern.delegate.options.onPlaceLabel(modernElement, modernNode.node);
  old.delegate.options.onPlaceLabel(oldElement, oldNode.node);
  assert.deepEqual(elementSnapshot(modernElement), elementSnapshot(oldElement));
  assert.deepEqual(modernNode.reads, oldNode.reads);
});

test("PieChart animated loading and update lifecycle match 2.0.1", () => {
  const modern = createModern(makeOptions({ animate: true }));
  const old = createLegacy(makeOptions({ animate: true }));
  modern.loadJSON(json);
  old.loadJSON(json);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(
    modern.delegate.animations.map(({ modes, duration }) => ({ modes, duration })),
    normalizeRealm(old.delegate.animations.map(({ modes, duration }) => ({ modes, duration }))),
  );

  const completed = [];
  const update = {
    label: ["new-a", "new-b", "new-c"],
    values: [
      { label: "alpha", values: [10, 2, 5] },
      { label: "beta", values: [1, 1, 1] },
      { label: "missing", values: 200 },
    ],
  };
  modern.updateJSON(update, { onComplete: () => completed.push("modern") });
  old.updateJSON(update, { onComplete: () => completed.push("legacy") });
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(modern.delegate.calls, normalizeRealm(old.delegate.calls));
  modern.delegate.animations.at(-1).onComplete();
  old.delegate.animations.at(-1).onComplete();
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(completed.sort(), ["legacy", "modern"]);
});

test("PieChart retains the legacy non-animated busy-state quirk", () => {
  const modern = createModern(makeOptions());
  const old = createLegacy(makeOptions());
  modern.loadJSON(json);
  old.loadJSON(json);
  const update = { values: [{ label: "alpha", values: [9, 1] }] };
  modern.updateJSON(update);
  old.updateJSON(update);
  assert.equal(modern.busy, true);
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(modern.delegate.calls, normalizeRealm(old.delegate.calls));

  modern.updateJSON({ values: [{ label: "alpha", values: 1000 }] });
  old.updateJSON({ values: [{ label: "alpha", values: 1000 }] });
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
});

test("PieChart facade output stays ESM-only and explicitly composed", async () => {
  const source = await readFile(new URL("../dist/charts/pie-chart.js", import.meta.url), "utf8");
  assert.match(source, /from "\.\.\/core\/util\.js"/);
  assert.doesNotMatch(source, /\$jit|globalThis|window\.|\.implement\(/);
  assert.doesNotMatch(source, /visualizations\/sunburst/);
});
