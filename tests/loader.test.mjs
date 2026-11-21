import assert from "node:assert/strict";
import test from "node:test";

import {
  GraphLoader,
  constructGraph,
  graphToGraphJson,
  graphToTreeJson,
} from "../dist/loader/loader.js";
import {
  loadLegacyBinding,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacyLoader = loadLegacyBinding("Loader");

const nodeConfig = { overridable: true, CanvasStyles: {} };
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};
const construction = {
  graph: {},
  node: nodeConfig,
  edge: edgeConfig,
  label: labelConfig,
};

function constructLegacy(json) {
  return legacyLoader.construct.call({
    graphOptions: {},
    config: {
      Node: nodeConfig,
      Edge: edgeConfig,
      Label: labelConfig,
    },
  }, json);
}

function graphSnapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    nodes[id] = {
      id: node.id,
      name: node.name,
      data: normalizeRealm(node.data),
      adjacent: Object.keys(node.adjacencies).sort(),
    };
  }
  const edges = [];
  for (const from of Object.keys(graph.edges).sort()) {
    for (const to of Object.keys(graph.edges[from]).sort()) {
      if (from < to) {
        edges.push([from, to, normalizeRealm(graph.edges[from][to].data)]);
      }
    }
  }
  return { nodes, edges };
}

const treeJson = {
  id: "root",
  name: "Root",
  data: { rank: 0 },
  children: [
    {
      id: "left",
      name: "Left",
      data: { rank: 1 },
      children: [{ id: "leaf", name: "Leaf", data: { rank: 2 }, children: [] }],
    },
    { id: "right", name: "Right", data: { rank: 1 }, children: [] },
  ],
};

const graphJson = [
  {
    id: "a",
    name: "A",
    data: { rank: 1 },
    adjacencies: [
      "b",
      { nodeTo: "c", data: { weight: 4, nested: { active: true } } },
      "missing",
    ],
  },
  { id: "b", name: "B", data: { rank: 2 }, adjacencies: ["c"] },
  { id: "c", name: "C", data: { rank: 3 }, adjacencies: [] },
];

test("loader entry point has no global installation side effect", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("tree construction matches the legacy Loader", () => {
  const modern = constructGraph(treeJson, construction);
  const legacy = constructLegacy(treeJson);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(legacy));
});

test("simple, extended, and undefined graph adjacencies match legacy", () => {
  const modern = constructGraph(graphJson, construction);
  const legacy = constructLegacy(graphJson);
  assert.deepEqual(graphSnapshot(modern), graphSnapshot(legacy));
  assert.equal(modern.getNode("missing").name, "missing");
  assert.notStrictEqual(modern.getAdjacence("a", "c").data, graphJson[0].adjacencies[1].data);
});

test("GraphLoader clears labels, selects the legacy root index, and owns state", () => {
  const labelCalls = [];
  const modern = new GraphLoader({
    ...construction,
    labels: { clearLabels: (force) => labelCalls.push(force) },
  });
  modern.loadJSON(graphJson, 1);

  const oldLabelCalls = [];
  const legacy = {
    graphOptions: {},
    config: { Node: nodeConfig, Edge: edgeConfig, Label: labelConfig },
    labels: { clearLabels: (force) => oldLabelCalls.push(force) },
    construct: legacyLoader.construct,
  };
  legacyLoader.loadJSON.call(legacy, graphJson, 1);

  assert.equal(modern.root, legacy.root);
  assert.deepEqual(labelCalls, oldLabelCalls);
  assert.deepEqual(graphSnapshot(modern.graph), graphSnapshot(legacy.graph));
  assert.strictEqual(modern.json, graphJson);
});

test("tree serialization preserves depth-directed child order", () => {
  const modern = constructGraph(treeJson, construction);
  const legacy = constructLegacy(treeJson);
  modern.computeLevels("root");
  legacy.computeLevels("root");

  assert.deepEqual(
    graphToTreeJson(modern, "root"),
    normalizeRealm(legacyLoader.toJSON.call({ graph: legacy, root: "root" }, "tree")),
  );
});

test("graph serialization emits each undirected edge once like legacy", () => {
  const modern = constructGraph(graphJson, construction);
  const legacy = constructLegacy(graphJson);

  assert.deepEqual(
    graphToGraphJson(modern, "a"),
    normalizeRealm(legacyLoader.toJSON.call({ graph: legacy, root: "a" }, "graph")),
  );
  assert.equal(Boolean(modern.getNode("a").visited), true);
});

test("GraphLoader serialization reports unloaded and unknown roots clearly", () => {
  const loader = new GraphLoader(construction);
  assert.throws(() => loader.toJSON(), /No JSON data has been loaded/);
  const graph = constructGraph(treeJson, construction);
  assert.throws(() => graphToTreeJson(graph, "unknown"), /Unknown graph root/);
  assert.throws(() => graphToGraphJson(graph, "unknown"), /Unknown graph root/);
});
