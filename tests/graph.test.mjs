import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { Graph, GraphAdjacency, GraphNode, GraphUtil } from "../dist/graph/graph.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

const nodeConfig = {
  overridable: true,
  color: "#111111",
  dim: 7,
  CanvasStyles: { fillStyle: "#222222", lineWidth: 1 },
};
const edgeConfig = {
  overridable: true,
  color: "#333333",
  lineWidth: 2,
  CanvasStyles: { strokeStyle: "#444444", lineWidth: 2 },
};
const labelConfig = { color: "#555555", size: 12 };

function createPair() {
  return {
    modern: new Graph({}, nodeConfig, edgeConfig, labelConfig),
    legacy: new legacy.Graph({}, nodeConfig, edgeConfig, labelConfig),
  };
}

function populate(graph) {
  const inputs = [
    { id: "root", name: "Root", data: { $color: "#f00", value: 1 } },
    { id: "left", name: "Left", data: { value: 2 } },
    { id: "right", name: "Right", data: { value: 3 } },
    { id: "leaf", name: "Leaf", data: { value: 4 } },
  ];

  for (const input of inputs) graph.addNode(input);
  graph.addAdjacence(inputs[0], inputs[1], { weight: 10 });
  graph.addAdjacence(inputs[0], inputs[2], { weight: 20 });
  graph.addAdjacence(inputs[1], inputs[3], { weight: 30 });
  return graph;
}

function snapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    nodes[id] = {
      id: node.id,
      name: node.name,
      data: normalizeRealm(node.data),
      startData: normalizeRealm(node.startData),
      endData: normalizeRealm(node.endData),
      depth: node._depth,
      flag: node._flag,
      adjacent: Object.keys(node.adjacencies).sort(),
      pos: { x: node.pos.x, y: node.pos.y },
    };
  }
  return { nodes, edgeIds: Object.keys(graph.edges).sort() };
}

test("graph module imports without installing a global", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Graph.Node, GraphNode);
  assert.equal(Graph.Adjacence, GraphAdjacency);
  assert.equal(Graph.Util, GraphUtil);
});

test("node and undirected adjacency lifecycle matches JIT 2.0.1", () => {
  const pair = createPair();
  populate(pair.modern);
  populate(pair.legacy);

  assert.deepEqual(snapshot(pair.modern), snapshot(pair.legacy));
  assert.strictEqual(pair.modern.get("root"), pair.modern.getNode("root"));
  assert.equal(pair.modern.getByName("Left")?.id, pair.legacy.getByName("Left")?.id);
  assert.equal(pair.modern.getByName("missing"), pair.legacy.getByName("missing"));

  const modernEdge = pair.modern.getAdjacence("root", "left");
  const legacyEdge = pair.legacy.getAdjacence("root", "left");
  assert.equal(modernEdge.data.weight, legacyEdge.data.weight);
  assert.strictEqual(pair.modern.getAdjacence("left", "root"), modernEdge);

  pair.modern.removeAdjacence("root", "right");
  pair.legacy.removeAdjacence("root", "right");
  pair.modern.removeNode("leaf");
  pair.legacy.removeNode("leaf");
  assert.deepEqual(snapshot(pair.modern), snapshot(pair.legacy));
});

test("node and edge data accessors preserve phase and override semantics", () => {
  const pair = createPair();
  populate(pair.modern);
  populate(pair.legacy);
  const modernNode = pair.modern.getNode("root");
  const legacyNode = pair.legacy.getNode("root");

  for (const [property, type, force] of [
    ["color", undefined, undefined],
    ["dim", undefined, undefined],
    ["missing", undefined, undefined],
    ["color", undefined, true],
  ]) {
    assert.equal(
      modernNode.getData(property, type, force),
      legacyNode.getData(property, type, force),
    );
  }

  modernNode.setDataset(["start", "end"], {
    color: ["#0f0", "#00f"],
    dim: [3, 9],
  });
  legacyNode.setDataset(["start", "end"], {
    color: ["#0f0", "#00f"],
    dim: [3, 9],
  });
  modernNode.setCanvasStyle("lineWidth", 8, "end");
  legacyNode.setCanvasStyle("lineWidth", 8, "end");
  modernNode.setLabelData("size", 20, "start");
  legacyNode.setLabelData("size", 20, "start");

  assert.deepEqual(snapshot(pair.modern), snapshot(pair.legacy));
  assert.equal(modernNode.getData("color", "start", true), "#0f0");
  assert.equal(modernNode.getCanvasStyle("lineWidth", "end", true), 8);
  assert.equal(modernNode.getLabelData("size", "start", true), 20);

  modernNode.removeData("color", "dim");
  legacyNode.removeData("color", "dim");
  assert.deepEqual(snapshot(pair.modern), snapshot(pair.legacy));
});

test("level computation and graph traversals match legacy order", () => {
  const pair = createPair();
  populate(pair.modern);
  populate(pair.legacy);
  pair.modern.computeLevels("root");
  pair.legacy.computeLevels("root");

  const modernBfs = [];
  const legacyBfs = [];
  pair.modern.eachBFS("root", (node, depth) => modernBfs.push([node.id, depth]));
  pair.legacy.eachBFS("root", (node, depth) => legacyBfs.push([node.id, depth]));
  assert.deepEqual(modernBfs, legacyBfs);

  const modernLevels = [];
  const legacyLevels = [];
  pair.modern.getNode("root").eachLevel(0, false, (node, depth) => {
    modernLevels.push([node.id, depth]);
  });
  pair.legacy.getNode("root").eachLevel(0, false, (node, depth) => {
    legacyLevels.push([node.id, depth]);
  });
  assert.deepEqual(modernLevels, legacyLevels);
  assert.deepEqual(
    pair.modern.getNode("left").getParents().map((node) => node.id),
    normalizeRealm(pair.legacy.getNode("left").getParents().map((node) => node.id)),
  );
  assert.equal(
    pair.modern.getNode("leaf").isDescendantOf("root"),
    pair.legacy.getNode("leaf").isDescendantOf("root"),
  );
});

test("position and closest-node queries remain behaviorally equivalent", () => {
  const pair = createPair();
  populate(pair.modern);
  populate(pair.legacy);
  const positions = {
    root: [10, 10],
    left: [-2, 1],
    right: [5, -3],
    leaf: [0.25, 0.5],
  };

  for (const [id, [x, y]] of Object.entries(positions)) {
    pair.modern.getNode(id).pos.setc(x, y);
    pair.legacy.getNode(id).pos.setc(x, y);
  }

  assert.equal(
    pair.modern.getClosestNodeToOrigin()?.id,
    pair.legacy.getClosestNodeToOrigin()?.id,
  );
  assert.equal(
    pair.modern.getClosestNodeToPos(new Complex(4, -2))?.id,
    pair.legacy.getClosestNodeToPos(new legacy.Complex(4, -2))?.id,
  );
});

test("nodeList broadcasts mutating accessors to every node", () => {
  const pair = createPair();
  populate(pair.modern);
  populate(pair.legacy);

  pair.modern.nodeList.setData("alpha", 0.5);
  pair.legacy.nodeList.setData("alpha", 0.5);
  pair.modern.nodeList.setCanvasStyle("lineWidth", 6);
  pair.legacy.nodeList.setCanvasStyle("lineWidth", 6);
  pair.modern.nodeList.setLabelData("size", 18);
  pair.legacy.nodeList.setLabelData("size", 18);

  assert.deepEqual(snapshot(pair.modern), snapshot(pair.legacy));
});
