import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import { sumIntoGraph } from "../dist/graph/operations/sum.js";
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
    data: { rank: 1, nested: { retained: true } },
    adjacencies: [{ nodeTo: "b", data: { weight: 2, retained: true } }],
  },
  { id: "b", name: "Original B", data: { rank: 2 }, adjacencies: [] },
];

const incomingJson = [
  {
    id: "a",
    name: "Incoming A",
    data: { rank: 100, replacement: true },
    adjacencies: [
      { nodeTo: "b", data: { weight: 200, replacement: true } },
      { nodeTo: "c", data: { weight: 3, added: true } },
    ],
  },
  { id: "b", name: "Incoming B", data: { rank: 200 }, adjacencies: [] },
  {
    id: "c",
    name: "Added C",
    data: { rank: 3, nested: { copied: true } },
    adjacencies: [],
  },
  { id: "isolated", name: "Isolated", data: { rank: 4 }, adjacencies: [] },
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

test("synchronous graph sum matches Graph.Op.sum", () => {
  const modernTarget = constructGraph(targetJson, construction);
  const modernIncoming = constructGraph(incomingJson, construction);
  const oldTarget = constructLegacy(targetJson);

  sumIntoGraph(modernTarget, modernIncoming);
  legacy.Graph.Op.sum.call(
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
  assert.equal(modernTarget.hasNode("isolated"), false);
  assert.equal(modernTarget.getNode("a").name, "Original A");
  assert.deepEqual(modernTarget.getNode("a").data, {
    rank: 1,
    nested: { retained: true },
  });
  assert.deepEqual(modernTarget.getAdjacence("a", "b").data, {
    weight: 2,
    retained: true,
  });
});

test("sum retains the legacy copy and identity boundaries", () => {
  const target = new Graph(
    { Node: { targetDefault: "applied" } },
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  const incoming = new Graph({}, nodeConfig, edgeConfig, labelConfig);
  const sourceData = { nested: { value: 1 } };
  const edgeData = { weight: 7 };

  incoming.addNode({ id: "left", name: "Left", data: sourceData });
  incoming.addNode({ id: "right", name: "Right", data: { rank: 2 } });
  incoming.addNode({ id: "isolated", name: "Isolated", data: {} });
  incoming.addAdjacence(
    incoming.getNode("left"),
    incoming.getNode("right"),
    edgeData,
  );
  incoming.getNode("left").pos.setc(40, -20);

  sumIntoGraph(target, incoming);
  const firstEdge = target.getAdjacence("left", "right");

  assert.equal(target.hasNode("isolated"), false);
  assert.equal(target.getNode("left").targetDefault, "applied");
  assert.deepEqual(normalizeRealm(target.getNode("left").pos.getc(true)), {
    x: 0,
    y: 0,
  });
  assert.notStrictEqual(target.getNode("left").data, sourceData);
  assert.notStrictEqual(target.getNode("left").data.nested, sourceData.nested);
  assert.strictEqual(firstEdge.data, edgeData);
  assert.strictEqual(target.edges.left.right, target.edges.right.left);

  sumIntoGraph(target, incoming);
  assert.strictEqual(target.getAdjacence("left", "right"), firstEdge);
});

test("graph sum is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/operations/sum.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
