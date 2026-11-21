import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { IcicleGroup } from "../dist/visualizations/icicle-group.js";
import { IcicleWorkflow } from "../dist/visualizations/icicle-workflow.js";
import { constructGraph } from "../dist/loader/loader.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyGlobal,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const tree = {
  id: "root",
  name: "Root",
  data: {},
  children: [
    {
      id: "a",
      name: "A",
      data: {},
      children: [{ id: "a1", name: "A1", data: {}, children: [] }],
    },
    { id: "b", name: "B", data: {}, children: [] },
  ],
};
const construction = {
  graph: { Node: { drawn: true, exist: true, selected: false } },
  node: { overridable: true, alpha: 1, CanvasStyles: {} },
  edge: { overridable: true, alpha: 1, CanvasStyles: {} },
  label: {},
};

function createGraph() {
  const graph = constructGraph(tree, construction);
  graph.computeLevels("root", 0);
  return graph;
}

function createPair(overrides = {}) {
  const modernGraph = createGraph();
  const oldGraph = createGraph();
  const modernEvents = [];
  const oldEvents = [];
  const modernAnimations = [];
  const oldAnimations = [];
  const modernHovered = { value: true };
  const oldHovered = { value: true };

  function config(events) {
    return {
      animate: false,
      constrained: true,
      levelsToShow: 2,
      request() {},
      onComplete() { events.push(["complete"]); },
      ...overrides,
    };
  }

  function group(events) {
    return {
      requestNodes(nodes, controller) {
        events.push(["request-nodes", nodes.map((node) => [node.id, node._level])]);
        controller.onComplete();
      },
    };
  }

  const modernConfig = config(modernEvents);
  const oldConfig = config(oldEvents);
  const modernVisualization = {
    root: "root",
    clickedNode: modernGraph.getNode("a"),
    busy: false,
    config: modernConfig,
    graph: modernGraph,
    compute(phase) { modernEvents.push(["compute", phase]); },
    plot() { modernEvents.push(["plot"]); },
    refresh() { modernEvents.push(["refresh"]); },
    animate(options) {
      modernEvents.push(["animate", [...options.modes], options.duration]);
      modernAnimations.push(options);
    },
  };
  const old = {
    root: "root",
    clickedNode: oldGraph.getNode("a"),
    busy: false,
    config: oldConfig,
    controller: oldConfig,
    graph: oldGraph,
    group: group(oldEvents),
    events: {},
    compute(phase) { oldEvents.push(["compute", phase]); },
    plot() { oldEvents.push(["plot"]); },
    refresh() { oldEvents.push(["refresh"]); },
    fx: {
      animate(options) {
        oldEvents.push(["animate", normalizeRealm(options.modes), options.duration]);
        oldAnimations.push(options);
      },
    },
  };
  Object.defineProperty(old.events, "hoveredNode", {
    get: () => oldHovered.value,
    set: (value) => { oldHovered.value = value; },
  });
  old.requestNodes = legacy.Icicle.prototype.requestNodes.bind(old);
  old.enter = legacy.Icicle.prototype.enter.bind(old);
  old.out = legacy.Icicle.prototype.out.bind(old);

  const modern = new IcicleWorkflow({
    visualization: modernVisualization,
    group: group(modernEvents),
    controller: modernConfig,
    clearHoveredNode() { modernHovered.value = false; },
  });
  return {
    modern,
    old,
    modernGraph,
    oldGraph,
    modernVisualization,
    modernEvents,
    oldEvents,
    modernAnimations,
    oldAnimations,
    modernHovered,
    oldHovered,
  };
}

function alphaSnapshot(graph) {
  return normalizeRealm(Object.fromEntries(Object.keys(graph.nodes).sort().map((id) => {
    const node = graph.getNode(id);
    return [id, {
      level: node._level,
      alpha: node.getData("alpha"),
      endAlpha: node.getData("alpha", "end"),
    }];
  })));
}

test("Icicle request leaf selection and level values match legacy", () => {
  for (const constrained of [true, false]) {
    const pair = createPair({ constrained });
    pair.modern.requestNodes(pair.modernGraph.getNode("a"));
    setLegacyGlobal("config", pair.old.config);
    pair.old.requestNodes(pair.oldGraph.getNode("a"));
    assert.deepEqual(pair.modernEvents, normalizeRealm(pair.oldEvents));
    assert.deepEqual(alphaSnapshot(pair.modernGraph), alphaSnapshot(pair.oldGraph));
  }
});

test("Icicle group merges asynchronous subtrees and recomputes levels", () => {
  const modernEvents = [];
  const oldEvents = [];
  const modernGraph = createGraph();
  const oldGraph = createGraph();
  const modern = new IcicleGroup({
    root: () => "root",
    computeLevels(root, depth) { modernGraph.computeLevels(root, depth); },
    mergeSubtree(id, data) { modernEvents.push(["sum", id, normalizeRealm(data)]); },
  });
  const oldViz = {
    root: "root",
    graph: oldGraph,
    op: { sum(data) { oldEvents.push(["sum", data.id, normalizeRealm(data)]); } },
    canvas: {},
    config: {},
  };
  const old = new legacy.Icicle.Group(oldViz);
  const modernNodes = [{ id: "a", _level: 2 }, { id: "b", _level: 1 }];
  const oldNodes = [{ id: "a", _level: 2 }, { id: "b", _level: 1 }];
  const modernController = {
    onComplete() { modernEvents.push(["complete"]); },
    request(id, level, callbacks) {
      modernEvents.push(["request", id, level]);
      callbacks.onComplete(id, { children: [{ id: `${id}-child` }] });
    },
  };
  const oldController = {
    onComplete() { oldEvents.push(["complete"]); },
    request(id, level, callbacks) {
      oldEvents.push(["request", id, level]);
      callbacks.onComplete(id, { children: [{ id: `${id}-child` }] });
    },
  };
  modern.requestNodes(modernNodes, modernController);
  old.requestNodes(oldNodes, oldController);
  assert.deepEqual(modernEvents, normalizeRealm(oldEvents));
});

test("Icicle non-animated enter matches legacy when data is already loaded", () => {
  const pair = createPair({ request: null, animate: false });
  assert.equal(pair.modern.enter(pair.modernGraph.getNode("a1")), true);
  pair.old.enter(pair.oldGraph.getNode("a1"));
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
  assert.equal(pair.modernVisualization.clickedNode.id, pair.old.clickedNode.id);
  assert.equal(pair.modernVisualization.busy, pair.old.busy);
});

test("Icicle out with lazy loading matches legacy callback ordering", () => {
  const pair = createPair({ request() {}, animate: false });
  assert.equal(pair.modern.out(), true);
  setLegacyGlobal("config", pair.old.config);
  pair.old.out();
  assert.deepEqual(
    normalizeRealm(pair.modernEvents),
    normalizeRealm(pair.oldEvents),
  );
  assert.equal(pair.modernVisualization.clickedNode.id, pair.old.clickedNode.id);
  assert.equal(pair.modernVisualization.busy, pair.old.busy);
  assert.equal(pair.modernHovered.value, pair.oldHovered.value);
});

test("Icicle workflow repairs the legacy undefined-node lazy-enter branch", () => {
  const pair = createPair({ request() {}, animate: false });
  assert.equal(pair.modern.enter(pair.modernGraph.getNode("a1")), true);
  assert.equal(pair.modernVisualization.clickedNode.id, "a1");
  assert.equal(pair.modernVisualization.busy, false);
  assert.throws(
    () => pair.old.enter(pair.oldGraph.getNode("a1")),
    (error) => error?.name === "ReferenceError",
  );
});

test("Icicle workflow entries stay optional and ambient-global free", async () => {
  for (const entry of ["icicle-group.js", "icicle-workflow.js"]) {
    const output = await readFile(
      new URL(`../dist/visualizations/${entry}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
    assert.doesNotMatch(output, /canvas\/canvas|graph\/graph|loader\/loader/);
  }
});
