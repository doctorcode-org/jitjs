import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { BarChart } from "../dist/charts/bar-chart.js";
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
      getSize: () => ({ width: 360, height: 240 }),
    };
    this.calls = [];
    this.animations = [];
    this.fx = {
      animate: (animation) => {
        this.animations.push(animation);
        this.calls.push(["animate", normalizeRealm({
          modes: animation.modes,
          duration: animation.duration,
        })]);
      },
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

  compute() { this.calls.push(["compute"]); }
  select(id) { this.calls.push(["select", id]); }
  plot() { this.calls.push(["plot"]); }
}

function makeOptions(overrides = {}) {
  return {
    injectInto: "chart",
    animate: false,
    orientation: "horizontal",
    type: "stacked:gradient",
    barsOffset: 4,
    labelOffset: 3,
    Margin: { top: 5, right: 7, bottom: 11, left: 13 },
    Label: {
      type: "HTML",
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
  return new BarChart(options, {
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
    const chart = new legacy.BarChart(options);
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
  color: ["#111111", "#222222", "#333333"],
  values: [
    { label: "alpha", values: [6, 3, 1] },
    { label: "beta", values: [2, 7, 4] },
  ],
};

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
    if (!node.name) return;
    answer[node.name] = {
      valueArray: node.getData("valueArray", "current", true),
      colorArray: node.getData("colorArray", "current", true),
      stringArray: node.getData("stringArray", "current", true),
      gradient: node.getData("gradient", "current", true),
      border: normalizeRealm(node.getData("border", "current", true)),
      width: node.getData("width", "current", true),
      height: node.getData("height", "current", true),
      endWidth: node.getData("width", "end", true),
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

for (const orientation of ["horizontal", "vertical"]) {
  for (const type of ["stacked:gradient", "grouped"]) {
    test(`BarChart ${orientation} ${type} loading and normalization match legacy`, () => {
      const options = makeOptions({ orientation, type });
      const modern = createModern(options);
      const old = createLegacy(options);
      assert.deepEqual(optionSnapshot(modern), optionSnapshot(old));

      modern.loadJSON(json);
      old.loadJSON(json);
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

test("BarChart hover selection, type switching, and DOM labels match legacy", () => {
  const options = makeOptions();
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(json);
  old.loadJSON(json);
  const modernNode = modern.delegate.graph.getByName("alpha");
  const oldNode = old.delegate.graph.getByName("alpha");

  modern.select(modernNode.id, "second");
  old.select(oldNode.id, "second");
  assert.deepEqual(normalizeRealm(modern.selected), normalizeRealm(old.selected));
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));

  modern.setBarType("grouped:gradient");
  old.setBarType("grouped:gradient");
  assert.equal(modern.config.type, old.config.type);
  assert.equal(modern.delegate.config.Node.type, old.delegate.config.Node.type);

  const modernElement = new FakeElement(document);
  const oldElement = new FakeElement(document);
  modernElement.style.top = oldElement.style.top = "100px";
  modern.delegate.options.onCreateLabel(modernElement, modernNode);
  old.delegate.options.onCreateLabel(oldElement, oldNode);
  modern.delegate.options.onPlaceLabel(modernElement, modernNode);
  old.delegate.options.onPlaceLabel(oldElement, oldNode);
  assert.deepEqual(elementSnapshot(modernElement), elementSnapshot(oldElement));
});

test("BarChart animated load and update preserve callback and busy semantics", () => {
  const options = makeOptions({ animate: true, Label: { type: "Native" } });
  const modern = createModern(options);
  const old = createLegacy(options);
  modern.loadJSON(json);
  old.loadJSON(json);
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(
    modern.delegate.animations[0].modes,
    normalizeRealm(old.delegate.animations[0].modes),
  );
  modern.delegate.animations[0].onComplete();
  old.delegate.animations[0].onComplete();
  assert.equal(modern.busy, old.busy);

  const completed = [];
  const update = {
    label: ["updated-a", "updated-b", "updated-c"],
    values: [
      { label: "alpha", values: [10, 2, 5] },
      { label: "beta", values: [1, 1, 1] },
    ],
  };
  modern.updateJSON(update, { onComplete: () => completed.push("modern") });
  old.updateJSON(update, { onComplete: () => completed.push("legacy") });
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
  assert.deepEqual(
    modern.delegate.animations[1].modes,
    normalizeRealm(old.delegate.animations[1].modes),
  );
  modern.delegate.animations[1].onComplete();
  old.delegate.animations[1].onComplete();
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(completed.sort(), ["legacy", "modern"]);
});

test("BarChart retains the legacy non-animated update busy-state quirk", () => {
  const modern = createModern(makeOptions());
  const old = createLegacy(makeOptions());
  modern.loadJSON(json);
  old.loadJSON(json);
  modern.updateJSON({ values: [{ label: "alpha", values: 9 }] });
  old.updateJSON({ values: [{ label: "alpha", values: 9 }] });
  assert.equal(modern.busy, true);
  assert.equal(modern.busy, old.busy);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(old));
});
