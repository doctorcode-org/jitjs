import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { morphIntoGraph } from "../dist/graph/operations/morph.js";
import { constructGraph } from "../dist/loader/loader.js";
import {
  loadLegacyBinding,
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
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

const targetJson = [
  {
    id: "a",
    name: "Original A",
    data: { retained: true, updated: "old" },
    adjacencies: [
      {
        nodeTo: "b",
        data: { retainedEdge: true, updatedEdge: "old" },
      },
      { nodeTo: "gone", data: { removed: true } },
    ],
  },
  { id: "b", name: "Original B", data: { rank: 2 }, adjacencies: [] },
  { id: "gone", name: "Gone", data: { rank: -1 }, adjacencies: [] },
  {
    id: "persist",
    name: "Persist",
    data: { retained: true, updated: "old" },
    adjacencies: [],
  },
];

const incomingJson = [
  {
    id: "a",
    name: "Incoming A",
    data: { updated: "new", added: true },
    adjacencies: [
      {
        nodeTo: "b",
        data: { updatedEdge: "new", addedEdge: true },
      },
    ],
  },
  {
    id: "b",
    name: "Incoming B",
    data: { rank: 20 },
    adjacencies: [{ nodeTo: "c", data: { weight: 3 } }],
  },
  { id: "c", name: "Added C", data: { rank: 3 }, adjacencies: [] },
  {
    id: "persist",
    name: "Incoming Persist",
    data: { updated: "new" },
    adjacencies: [],
  },
  {
    id: "new-isolated",
    name: "New isolated",
    data: { rank: 4 },
    adjacencies: [],
  },
];

function constructLegacy(json) {
  return legacyLoader.construct.call(
    {
      graphOptions: {},
      config: {
        Node: nodeConfig,
        Edge: edgeConfig,
        Label: labelConfig,
      },
    },
    json,
  );
}

function snapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    nodes[id] = {
      name: node.name,
      data: normalizeRealm(node.data),
      adjacencies: Object.keys(node.adjacencies).sort(),
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

test("synchronous graph morph matches Graph.Op.morph", () => {
  const modernTarget = constructGraph(targetJson, construction);
  const modernIncoming = constructGraph(incomingJson, construction);
  const oldTarget = constructLegacy(targetJson);

  morphIntoGraph(modernTarget, modernIncoming);
  legacy.Graph.Op.morph.call(
    {
      options: legacy.Graph.Op.options,
      viz: {
        graph: oldTarget,
        root: "a",
        controller: {},
        construct: constructLegacy,
      },
    },
    incomingJson,
    { type: "nothing" },
  );

  assert.deepEqual(snapshot(modernTarget), snapshot(oldTarget));
  assert.equal(modernTarget.hasNode("gone"), false);
  assert.equal(modernTarget.hasNode("new-isolated"), false);
  assert.equal(modernTarget.getNode("a").name, "Original A");
  assert.deepEqual(modernTarget.getNode("a").data, {
    retained: true,
    updated: "new",
    added: true,
  });
  assert.deepEqual(modernTarget.getAdjacence("a", "b").data, {
    retainedEdge: true,
    updatedEdge: "new",
    addedEdge: true,
  });
});

test("morph preserves existing identities and legacy sharing boundaries", () => {
  const target = constructGraph(targetJson, construction);
  const incoming = constructGraph(incomingJson, construction);
  const existingNode = target.getNode("a");
  const existingNodeData = existingNode.data;
  const existingEdge = target.getAdjacence("a", "b");
  const existingEdgeData = existingEdge.data;
  const incomingNodeValue = { source: true };
  const incomingEdgeValue = { source: true };
  incoming.getNode("a").data.shared = incomingNodeValue;
  incoming.getAdjacence("a", "b").data.shared = incomingEdgeValue;

  morphIntoGraph(target, incoming);

  assert.strictEqual(target.getNode("a"), existingNode);
  assert.strictEqual(target.getNode("a").data, existingNodeData);
  assert.strictEqual(target.getNode("a").data.shared, incomingNodeValue);
  assert.strictEqual(target.getAdjacence("a", "b"), existingEdge);
  assert.strictEqual(target.getAdjacence("a", "b").data, existingEdgeData);
  assert.strictEqual(target.getAdjacence("a", "b").data.shared, incomingEdgeValue);
  assert.notStrictEqual(target.getNode("c").data, incoming.getNode("c").data);
  assert.strictEqual(
    target.getAdjacence("b", "c").data,
    incoming.getAdjacence("b", "c").data,
  );

  morphIntoGraph(target, incoming);
  assert.strictEqual(target.getNode("a"), existingNode);
  assert.strictEqual(target.getAdjacence("a", "b"), existingEdge);
});

test("new node copy boundaries retain legacy traversal-order behavior", () => {
  const target = constructGraph([], construction);
  const incoming = constructGraph(
    [
      {
        id: "left",
        name: "Left",
        data: { nested: { side: "left" } },
        adjacencies: [{ nodeTo: "right", data: { weight: 1 } }],
      },
      {
        id: "right",
        name: "Right",
        data: { nested: { side: "right" } },
        adjacencies: [],
      },
    ],
    construction,
  );
  const leftNested = incoming.getNode("left").data.nested;
  const rightNested = incoming.getNode("right").data.nested;
  const incomingEdgeData = incoming.getAdjacence("left", "right").data;

  morphIntoGraph(target, incoming);

  assert.notStrictEqual(target.getNode("left").data.nested, leftNested);
  assert.strictEqual(target.getNode("right").data.nested, rightNested);
  assert.strictEqual(target.getAdjacence("left", "right").data, incomingEdgeData);
  assert.notStrictEqual(target.getNode("left"), incoming.getNode("left"));
  assert.notStrictEqual(target.getNode("right"), incoming.getNode("right"));
});

test("existing elements copy inherited enumerable data like legacy for-in loops", () => {
  const target = constructGraph(targetJson, construction);
  const incoming = constructGraph(incomingJson, construction);
  const inheritedNodeValue = { inherited: "node" };
  const inheritedEdgeValue = { inherited: "edge" };
  Object.setPrototypeOf(incoming.getNode("a").data, {
    inheritedNode: inheritedNodeValue,
  });
  Object.setPrototypeOf(incoming.getAdjacence("a", "b").data, {
    inheritedEdge: inheritedEdgeValue,
  });

  morphIntoGraph(target, incoming);

  assert.strictEqual(target.getNode("a").data.inheritedNode, inheritedNodeValue);
  assert.strictEqual(
    target.getAdjacence("a", "b").data.inheritedEdge,
    inheritedEdgeValue,
  );
});

test("graph morph is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/operations/morph.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
