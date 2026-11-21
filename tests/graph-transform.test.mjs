import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  preprocessGraphSum,
  runGraphMorph,
  runGraphSum,
} from "../dist/graph/operations/transform.js";
import { constructGraph } from "../dist/loader/loader.js";
import {
  loadLegacyBinding,
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyLoader = loadLegacyBinding("Loader");
const nodeConfig = {
  overridable: true,
  alpha: 1,
  width: 10,
  color: "#000000",
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, alpha: 1, CanvasStyles: {} };
const labelConfig = { alpha: 1 };
const construction = {
  graph: {},
  node: nodeConfig,
  edge: edgeConfig,
  label: labelConfig,
};

const baseJson = [
  {
    id: "a",
    name: "A",
    data: { $width: 10, stable: "old" },
    adjacencies: [
      { nodeTo: "b", data: { kind: "kept" } },
      { nodeTo: "gone", data: { kind: "removed" } },
    ],
  },
  { id: "b", name: "B", data: { $width: 12 }, adjacencies: [] },
  { id: "gone", name: "Gone", data: { $width: 8 }, adjacencies: [] },
];

const incomingJson = [
  {
    id: "a",
    name: "A incoming",
    data: { $width: 30, stable: "new" },
    adjacencies: [{ nodeTo: "b", data: { kind: "updated" } }],
  },
  {
    id: "b",
    name: "B incoming",
    data: { $width: 24 },
    adjacencies: [{ nodeTo: "c", data: { kind: "added" } }],
  },
  { id: "c", name: "C", data: { $width: 16 }, adjacencies: [] },
];

const sumJson = [
  {
    id: "b",
    name: "B incoming",
    data: { ignoredUpdate: true },
    adjacencies: [{ nodeTo: "c", data: { kind: "new" } }],
  },
  { id: "c", name: "C", data: { rank: 3 }, adjacencies: [] },
];

function constructLegacy(json) {
  return legacyLoader.construct.call(
    {
      graphOptions: {},
      config: { Node: nodeConfig, Edge: edgeConfig, Label: labelConfig },
    },
    json,
  );
}

function snapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.getNode(id);
    nodes[id] = {
      data: normalizeRealm(node.data),
      startData: normalizeRealm(node.startData),
      endData: normalizeRealm(node.endData),
      ignore: node.ignore,
      pos: normalizeRealm(node.pos.getc(true)),
      startPos: normalizeRealm(node.startPos.getc(true)),
      endPos: normalizeRealm(node.endPos.getc(true)),
      adjacencies: Object.keys(node.adjacencies).sort(),
    };
  }
  const edges = [];
  for (const from of Object.keys(graph.edges).sort()) {
    for (const to of Object.keys(graph.edges[from]).sort()) {
      if (from < to) {
        const edge = graph.getAdjacence(from, to);
        edges.push({
          ids: [from, to],
          data: normalizeRealm(edge.data),
          startData: normalizeRealm(edge.startData),
          endData: normalizeRealm(edge.endData),
          ignore: edge.ignore,
        });
      }
    }
  }
  return normalizeRealm({ nodes, edges });
}

function createPair(json = baseJson) {
  const modernGraph = constructGraph(json, construction);
  const oldGraph = constructLegacy(json);
  const modernEvents = [];
  const oldEvents = [];
  const modernAnimations = [];
  const oldAnimations = [];

  function reposition(graph, events) {
    events.push(["reposition"]);
    let index = 1;
    graph.eachNode((node) => {
      node.endPos.setc(index * 11, index * -7);
      index += 1;
    });
  }

  const modern = {
    graph: modernGraph,
    root: "a",
    controller: { onComplete() { modernEvents.push(["complete"]); } },
    construct: (value) => constructGraph(value, construction),
    refresh(value) { modernEvents.push(["refresh", value]); },
    reposition() { reposition(modernGraph, modernEvents); },
    compute(phase) { modernEvents.push(["compute", phase]); },
    clearLabels(force) { modernEvents.push(["labels", force]); },
    animate(options) {
      modernEvents.push(["animate", [...options.modes]]);
      modernAnimations.push(options);
    },
  };
  const oldViz = {
    graph: oldGraph,
    root: "a",
    controller: { onComplete() { oldEvents.push(["complete"]); } },
    construct: constructLegacy,
    refresh(value) { oldEvents.push(["refresh", value]); },
    reposition() { reposition(oldGraph, oldEvents); },
    compute(phase) { oldEvents.push(["compute", phase]); },
    labels: { clearLabels(force) { oldEvents.push(["labels", force]); } },
    fx: {
      animate(options) {
        oldEvents.push(["animate", normalizeRealm(options.modes)]);
        oldAnimations.push(options);
      },
    },
  };
  const old = {
    options: legacy.Graph.Op.options,
    viz: oldViz,
    preprocessSum: legacy.Graph.Op.preprocessSum,
    sum: legacy.Graph.Op.sum,
    morph: legacy.Graph.Op.morph,
  };
  return {
    modern,
    old,
    oldViz,
    modernEvents,
    oldEvents,
    modernAnimations,
    oldAnimations,
  };
}

test("animated sum preprocessing matches new-node and new-edge alpha phases", () => {
  const pair = createPair();
  const modernIncoming = pair.modern.construct(sumJson);
  const oldIncoming = pair.oldViz.construct(sumJson);
  const modernFadeEdges = preprocessGraphSum(pair.modern.graph, modernIncoming);
  const oldFadeEdges = legacy.Graph.Op.preprocessSum.call(pair.old, oldIncoming);
  assert.equal(modernFadeEdges, oldFadeEdges);
  assert.deepEqual(snapshot(pair.modern.graph), snapshot(pair.oldViz.graph));
});

test("sum replot and sequential fade ordering match Graph.Op", () => {
  const replot = createPair();
  runGraphSum(replot.modern, sumJson, { type: "replot", id: "b" });
  legacy.Graph.Op.sum.call(replot.old, sumJson, { type: "replot", id: "b" });
  assert.deepEqual(replot.modernEvents, normalizeRealm(replot.oldEvents));
  assert.deepEqual(snapshot(replot.modern.graph), snapshot(replot.oldViz.graph));
  assert.equal(replot.modern.root, replot.oldViz.root);

  const fade = createPair();
  runGraphSum(fade.modern, sumJson, {
    type: "fade:seq",
    duration: 120,
    onComplete: () => fade.modernEvents.push(["requested-complete"]),
  });
  legacy.Graph.Op.sum.call(fade.old, sumJson, {
    type: "fade:seq",
    duration: 120,
    onComplete: () => fade.oldEvents.push(["requested-complete"]),
  });
  assert.deepEqual(fade.modernEvents, normalizeRealm(fade.oldEvents));
  assert.deepEqual(snapshot(fade.modern.graph), snapshot(fade.oldViz.graph));
  fade.modernAnimations[0].onComplete();
  fade.oldAnimations[0].onComplete();
  assert.deepEqual(fade.modernEvents, normalizeRealm(fade.oldEvents));
  fade.modernAnimations[1].onComplete();
  fade.oldAnimations[1].onComplete();
  assert.deepEqual(fade.modernEvents, normalizeRealm(fade.oldEvents));
});

test("concurrent sum combines position and alpha modes like legacy", () => {
  const pair = createPair();
  runGraphSum(pair.modern, sumJson, { type: "fade:con", id: "b" });
  legacy.Graph.Op.sum.call(pair.old, sumJson, { type: "fade:con", id: "b" });
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.oldEvents));
  assert.deepEqual(snapshot(pair.modern.graph), snapshot(pair.oldViz.graph));
  assert.equal(pair.modern.root, pair.oldViz.root);
});

test("morph replot performs label clearing, reconciliation, and double refresh", () => {
  const pair = createPair();
  runGraphMorph(pair.modern, incomingJson, { type: "replot" });
  legacy.Graph.Op.morph.call(pair.old, incomingJson, { type: "replot" });
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.oldEvents));
  assert.deepEqual(snapshot(pair.modern.graph), snapshot(pair.oldViz.graph));
});

test("animated morph preprocessing, extra modes, and cleanup match legacy", () => {
  const pair = createPair();
  const extraModes = {
    "node-property": ["width", "color"],
    "edge-property": "lineWidth",
    "label-property": ["size", "color"],
    position: "linear",
  };
  runGraphMorph(
    pair.modern,
    incomingJson,
    {
      type: "fade",
      duration: 150,
      onComplete: () => pair.modernEvents.push(["requested-complete"]),
    },
    extraModes,
  );
  legacy.Graph.Op.morph.call(
    pair.old,
    incomingJson,
    {
      type: "fade",
      duration: 150,
      onComplete: () => pair.oldEvents.push(["requested-complete"]),
    },
    extraModes,
  );
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.oldEvents));
  assert.deepEqual(snapshot(pair.modern.graph), snapshot(pair.oldViz.graph));
  pair.modernAnimations[0].onComplete();
  pair.oldAnimations[0].onComplete();
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.oldEvents));
  assert.deepEqual(snapshot(pair.modern.graph), snapshot(pair.oldViz.graph));
});

test("graph transform orchestration stays in an explicit ESM subpath", async () => {
  const output = await readFile(
    new URL("../dist/graph/operations/transform.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
  assert.doesNotMatch(output, /graph\/graph|loader\/loader|canvas\/canvas/);
});

