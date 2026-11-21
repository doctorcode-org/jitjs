import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { AreaChart, createAreaChartConfig } from "../dist/charts/area-chart.js";
import { Graph } from "../dist/graph/graph.js";
import { constructGraph } from "../dist/loader/loader.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

class FakeElement {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.style = {};
    this.children = [];
    this.innerHTML = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

function createDocument() {
  const document = {
    body: { appendChild() {} },
    createElement() {
      return new FakeElement(document);
    },
  };
  return document;
}

const document = createDocument();
setLegacyDocument(document);

class FakeDelegate {
  constructor(options) {
    this.options = options;
    this.config = { ...options, Node: { ...options.Node } };
    this.canvas = {
      getSize: () => ({ width: 420, height: 260 }),
    };
    this.calls = [];
    this.animations = [];
    this.fx = {
      animate: (animation) => {
        this.animations.push(animation);
        this.calls.push([
          "animate",
          normalizeRealm({
            modes: animation.modes,
            duration: animation.duration,
          }),
        ]);
      },
    };
    this.tips = {
      hide: () => this.calls.push(["hideTips"]),
    };
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
      graph: {
        klass: Complex,
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.options.Node,
      edge: this.options.Edge,
      label: this.options.Label,
    });
    this.root = json.id;
  }

  compute() {
    this.calls.push(["compute"]);
  }

  select(id) {
    this.calls.push(["select", id]);
  }

  plot() {
    this.calls.push(["plot"]);
  }
}

function makeOptions(overrides = {}) {
  return {
    injectInto: "chart",
    animate: false,
    type: "stacked:gradient",
    labelOffset: 4,
    selectOnHover: true,
    Margin: { top: 5, right: 7, bottom: 11, left: 13 },
    Label: {
      type: "HTML",
      style: "bold",
      size: 10,
      family: "sans-serif",
      color: "#ffffff",
    },
    showLabels: true,
    showAggregates: true,
    ...overrides,
  };
}

function createModern(options) {
  return new AreaChart(options, {
    createDelegate: (delegateOptions) => new FakeDelegate(delegateOptions),
    now: () => 12345,
    document,
  });
}

function createLegacy(options) {
  const OriginalSpaceTree = legacy.ST;
  const originalTime = legacy.util.time;
  legacy.ST = FakeDelegate;
  legacy.util.time = () => 12345;
  try {
    const chart = new legacy.AreaChart(options);
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
    legacy.ST = OriginalSpaceTree;
    legacy.util.time = originalTime;
  }
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionSnapshot(chart) {
  const options = chart.delegate.options;
  return normalizeRealm({
    orientation: options.orientation,
    levelDistance: options.levelDistance,
    siblingOffset: options.siblingOffset,
    subtreeOffset: options.subtreeOffset,
    withLabels: options.withLabels,
    Label: options.Label,
    Node: options.Node,
    Edge: options.Edge,
    offsetX: chart.delegate.config.offsetX,
    offsetY: chart.delegate.config.offsetY,
  });
}

function graphSnapshot(chart) {
  const answer = {};
  chart.delegate.graph.eachNode((node) => {
    answer[node.name || "$root"] = {
      valueArray: node.getData("valueArray", "current", true),
      colorArray: node.getData("colorArray", "current", true),
      stringArray: node.getData("stringArray", "current", true),
      next: node.getData("next", "current", true),
      prev: node.getData("prev", "current", true),
      gradient: node.getData("gradient", "current", true),
      border: node.getData("border", "current", true),
      width: node.getData("width", "current", true),
      height: node.getData("height", "current", true),
      endHeight: node.getData("height", "end", true),
      dimArray: node.getData("dimArray", "current", true),
      endDimArray: node.getData("dimArray", "end", true),
    };
  });
  return normalizeRealm(answer);
}

function elementSnapshot(element) {
  return {
    style: { ...element.style },
    innerHTML: element.innerHTML,
    children: element.children.map(elementSnapshot),
  };
}

test("AreaChart option composition preserves the legacy formatter semantics", () => {
  const labelCalls = [];
  const config = createAreaChartConfig(
    makeOptions({
      showLabels: (...args) => {
        labelCalls.push(args);
        return "label";
      },
      showAggregates: false,
      Margin: { left: 23 },
    }),
  );
  assert.equal(config.Margin.left, 23);
  assert.equal(config.Margin.right, 0);
  assert.equal(config.Label.type, "HTML");
  assert.equal(config.showLabels("n", 1, 2, {}), "label");
  assert.equal(labelCalls.length, 1);
  assert.equal(config.showAggregates("n", 1, 2, {}), false);
});

for (const type of ["stacked", "stacked:gradient"]) {
  for (const labelType of ["Native", "HTML"]) {
    test(`AreaChart ${type} with ${labelType} labels matches legacy loading`, () => {
      const options = makeOptions({ type, Label: { type: labelType } });
      const modern = createModern(options);
      const old = createLegacy(options);
      assert.deepEqual(optionSnapshot(modern), optionSnapshot(old));

      modern.loadJSON(clone(json));
      old.loadJSON(clone(json));
      assert.equal(modern.busy, old.busy);
      assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
      assert.deepEqual(modern.getLegend(), normalizeRealm(old.getLegend()));
      assert.equal(modern.getMaxValue(), old.getMaxValue());
      assert.deepEqual(
        modern.delegate.calls.map((call) => call[0]),
        old.delegate.calls.map((call) => call[0]),
      );
    });
  }
}

test("AreaChart hover selection links both sides and clears them like legacy", () => {
  const modern = createModern(makeOptions());
  const old = createLegacy(makeOptions());
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));

  const modernBeta = modern.delegate.graph.getByName("beta");
  const oldBeta = old.delegate.graph.getByName("beta");
  modern.select(modernBeta.id, "second", 0);
  old.select(oldBeta.id, "second", 0);
  assert.deepEqual(normalizeRealm(modern.selected), normalizeRealm(old.selected));
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));

  modern.select(modernBeta.id, "third", 1);
  old.select(oldBeta.id, "third", 1);
  assert.deepEqual(normalizeRealm(modern.selected), normalizeRealm(old.selected));
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));

  modern.select(false, false, false);
  old.select(false, false, false);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.equal(
    modern.delegate.calls.filter((call) => call[0] === "plot").length,
    old.delegate.calls.filter((call) => call[0] === "plot").length,
  );
});

test("AreaChart DOM label creation and placement match legacy", () => {
  const options = makeOptions({
    showLabels: (name) => name !== "gamma",
    showAggregates: (name, left, right, _node, accumulated) =>
      name === "gamma" ? false : `${left}/${right}/${accumulated ?? "create"}`,
  });
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));

  for (const name of ["alpha", "beta", "gamma"]) {
    const modernNode = modern.delegate.graph.getByName(name);
    const oldNode = old.delegate.graph.getByName(name);
    const modernElement = new FakeElement(document);
    const oldElement = new FakeElement(document);
    modernElement.style.top = oldElement.style.top = "140px";

    modern.delegate.options.onCreateLabel(modernElement, modernNode);
    old.delegate.options.onCreateLabel(oldElement, oldNode);
    modern.delegate.options.onPlaceLabel(modernElement, modernNode);
    old.delegate.options.onPlaceLabel(oldElement, oldNode);
    assert.deepEqual(
      elementSnapshot(modernElement),
      elementSnapshot(oldElement),
      `DOM label mismatch for ${name}`,
    );
  }
});

test("AreaChart click, right-click, hover, and tip adapters match legacy", () => {
  const modernEvents = [];
  const oldEvents = [];
  const common = {
    filterOnClick: false,
    restoreOnRightClick: false,
    selectOnHover: true,
    Tips: {
      enable: true,
      onShow: (_tip, element, node) => modernEvents.push(["tip", element.name, node.name]),
    },
    Events: {
      enable: true,
      onClick: (element) => modernEvents.push(["click", element.name]),
    },
  };
  const modern = createModern(makeOptions(common));
  const old = createLegacy(
    makeOptions({
      ...common,
      Tips: {
        enable: true,
        onShow: (_tip, element, node) => oldEvents.push(["tip", element.name, node.name]),
      },
      Events: {
        enable: true,
        onClick: (element) => oldEvents.push(["click", element.name]),
      },
    }),
  );
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));
  const modernNode = modern.delegate.graph.getByName("beta");
  const oldNode = old.delegate.graph.getByName("beta");
  const modernElement = { name: "second", color: "#338855", value: 7, index: 0 };
  const oldElement = { ...modernElement };
  const modernInfo = { getContains: () => modernElement };
  const oldInfo = { getContains: () => oldElement };

  modern.delegate.options.Tips.onShow({}, modernNode, modernElement);
  old.delegate.options.Tips.onShow({}, oldNode, oldElement);
  modern.delegate.options.Events.onClick(modernNode, modernInfo, {});
  old.delegate.options.Events.onClick(oldNode, oldInfo, {});
  modern.delegate.options.Events.onMouseMove(modernNode, modernInfo, {});
  old.delegate.options.Events.onMouseMove(oldNode, oldInfo, {});
  modern.delegate.options.Events.onMouseMove(false, modernInfo, {});
  old.delegate.options.Events.onMouseMove(false, oldInfo, {});
  modern.delegate.options.Events.onRightClick(modernNode, modernInfo, {});
  old.delegate.options.Events.onRightClick(oldNode, oldInfo, {});

  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(normalizeRealm(modern.selected), normalizeRealm(old.selected));
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
});

test("AreaChart filter-on-click and restore-on-right-click match legacy", () => {
  const options = makeOptions({
    animate: true,
    filterOnClick: true,
    restoreOnRightClick: true,
    Tips: { enable: true },
  });
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));
  const modernNode = modern.delegate.graph.getByName("beta");
  const oldNode = old.delegate.graph.getByName("beta");
  const element = { name: "second", color: "#338855", value: 7, index: 0 };
  const eventInfo = { getContains: () => element };

  modern.delegate.options.Events.onClick(modernNode, eventInfo, {});
  old.delegate.options.Events.onClick(oldNode, eventInfo, {});
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  modern.delegate.animations[1].onComplete();
  old.delegate.animations[1].onComplete();

  modern.delegate.options.Events.onRightClick(modernNode, eventInfo, {});
  old.delegate.options.Events.onRightClick(oldNode, eventInfo, {});
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(
    normalizeRealm(modern.delegate.animations[2].modes),
    normalizeRealm(old.delegate.animations[2].modes),
  );
  modern.delegate.animations[2].onComplete();
  old.delegate.animations[2].onComplete();
  assert.equal(modern.busy, old.busy);
});

test("AreaChart animated update preserves values, labels, callbacks, and busy state", () => {
  const options = makeOptions({ animate: true, Label: { type: "Native" } });
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));
  assert.deepEqual(
    normalizeRealm(modern.delegate.animations[0].modes),
    normalizeRealm(old.delegate.animations[0].modes),
  );

  const completed = [];
  const update = {
    label: ["renamed-a", "renamed-b", "renamed-c"],
    values: [
      { label: "alpha", values: [10, 2, 5] },
      { label: "beta", values: [1, 1, 1] },
      { label: "gamma", values: [9, 4, 2] },
      { label: "delta", values: [3, 8, 6] },
    ],
  };
  modern.updateJSON(clone(update), { onComplete: () => completed.push("modern") });
  old.updateJSON(clone(update), { onComplete: () => completed.push("legacy") });
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(
    normalizeRealm(modern.delegate.animations[1].modes),
    normalizeRealm(old.delegate.animations[1].modes),
  );
  modern.delegate.animations[1].onComplete();
  old.delegate.animations[1].onComplete();
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(completed.sort(), ["legacy", "modern"]);
});

test("AreaChart filter and restore preserve end-state dimensions and callbacks", () => {
  const options = makeOptions({ animate: true, Tips: { enable: true } });
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));

  const completed = [];
  modern.filter(["first", "third"], { onComplete: () => completed.push("modern-filter") });
  old.filter(["first", "third"], { onComplete: () => completed.push("legacy-filter") });
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(
    normalizeRealm(modern.delegate.animations[1].modes),
    normalizeRealm(old.delegate.animations[1].modes),
  );
  modern.delegate.animations[1].onComplete();
  old.delegate.animations[1].onComplete();

  modern.restore({ onComplete: () => completed.push("modern-restore") });
  old.restore({ onComplete: () => completed.push("legacy-restore") });
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  modern.delegate.animations[2].onComplete();
  old.delegate.animations[2].onComplete();
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(completed.sort(), [
    "legacy-filter",
    "legacy-restore",
    "modern-filter",
    "modern-restore",
  ]);
  assert.equal(
    modern.delegate.calls.filter((call) => call[0] === "hideTips").length,
    old.delegate.calls.filter((call) => call[0] === "hideTips").length,
  );
});

test("AreaChart retains the legacy non-animated update busy-state quirk", () => {
  const modern = createModern(makeOptions());
  const old = createLegacy(makeOptions());
  modern.loadJSON(clone(json));
  old.loadJSON(clone(json));
  const update = { values: [{ label: "alpha", values: 9 }] };
  modern.updateJSON(clone(update));
  old.updateJSON(clone(update));
  assert.equal(modern.busy, true);
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
});
