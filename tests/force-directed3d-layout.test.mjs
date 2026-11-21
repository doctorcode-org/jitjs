import assert from "node:assert/strict";
import test from "node:test";

import { Vector3 } from "../dist/geometry/vector3.js";
import { Graph } from "../dist/graph/graph.js";
import { ForceDirected3DLayout } from "../dist/layouts/force-directed3d.js";

const nodeConfig = { overridable: true, dim: 5, CanvasStyles: {} };
const edgeConfig = { overridable: true, CanvasStyles: {} };

function createGraph() {
  const graph = new Graph(
    { klass: Vector3, Node: { exist: true, drawn: true } },
    nodeConfig,
    edgeConfig,
    {},
  );
  graph.addNode({ id: "root", name: "Root", data: {} });
  graph.addNode({ id: "leaf", name: "Leaf", data: {} });
  graph.addAdjacence({ id: "root", name: "Root", data: {} }, { id: "leaf", name: "Leaf", data: {} });
  return graph;
}

function snapshot(graph) {
  return Object.fromEntries(Object.keys(graph.nodes).sort().map((id) => {
    const node = graph.getNode(id);
    const position = node.getPos("current");
    return [id, { x: position.x, y: position.y, z: position.z, visited: Boolean(node.visited) }];
  }));
}

test("3D force layout entry point installs no global registry", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Object.hasOwn(globalThis, "ForceDirected3D"), false);
});

test("3D force options preserve the original 2D-area force constants", () => {
  const layout = new ForceDirected3DLayout({
    graph: createGraph(),
    root: "root",
    getSize: () => ({ width: 300, height: 120 }),
    config: { iterations: 7, levelDistance: 20 },
  });
  const options = layout.getOptions();
  assert.equal(options.tstart, 30);
  assert.equal(options.nodef(0), 18_000);
  assert.equal(options.nodef(4), 4_500);
  assert.equal(options.edgef(50), Math.sqrt(18_000) * 30);
});

test("compute initializes three axes, levels, dimensions, and displacements deterministically", () => {
  const graph = createGraph();
  const values = [0.75, 0.25, 0.6, 0.8, 0.1, 0.9];
  const dimensionCalls = [];
  const layout = new ForceDirected3DLayout({
    graph,
    root: "root",
    getSize: () => ({ width: 100, height: 50 }),
    config: { iterations: 0, levelDistance: 17 },
    random: () => values.shift(),
    computeNodeDimensions: (_graph, properties, config) => {
      dimensionCalls.push([properties.slice(), config.levelDistance]);
    },
  });
  layout.compute("current");
  assert.deepEqual(dimensionCalls, [[ ["current"], 17 ]]);
  assert.deepEqual(snapshot(graph), {
    leaf: { x: 6.000000000000001, y: -4, z: 80, visited: false },
    root: { x: 5, y: -2.5, z: 19.999999999999996, visited: false },
  });
  assert.equal(graph.getNode("root")._depth, 0);
  assert.equal(graph.getNode("leaf")._depth, 1);
  assert.deepEqual(graph.getNode("root").disp.current, new Vector3());
});

test("one 3D force step preserves component-wise cooling and z bounds", () => {
  const graph = createGraph();
  graph.getNode("root").getPos("current").setc(-10, 0, 5);
  graph.getNode("leaf").getPos("current").setc(10, 0, -5);
  const layout = new ForceDirected3DLayout({
    graph,
    root: "root",
    getSize: () => ({ width: 100, height: 40 }),
    config: { iterations: 1, levelDistance: 0 },
  });
  layout.computePositionStep(["current"], {
    width: 100,
    height: 40,
    tstart: 100,
    t: 100,
    nodef: () => 0,
    edgef: () => 10,
  });
  const result = snapshot(graph);
  assert.equal(result.leaf.visited, true);
  assert.equal(result.root.visited, true);
  assert.ok(Math.abs(result.leaf.x - 2) < 1e-12);
  assert.ok(Math.abs(result.leaf.z + 3) < 1e-12);
  assert.ok(Math.abs(result.root.x + 2) < 1e-12);
  assert.ok(Math.abs(result.root.z - 3) < 1e-12);
  assert.equal(result.leaf.y, 0);
  assert.equal(result.root.y, 0);
});

test("incremental 3D simulation yields and converges to synchronous output", () => {
  const syncGraph = createGraph();
  const incrementalGraph = createGraph();
  for (const graph of [syncGraph, incrementalGraph]) {
    graph.getNode("root").getPos("current").setc(-25, 4, 9);
    graph.getNode("leaf").getPos("current").setc(31, -7, -8);
  }
  const common = {
    root: "root",
    getSize: () => ({ width: 200, height: 120 }),
    config: { iterations: 5, levelDistance: 30 },
  };
  const sync = new ForceDirected3DLayout({ ...common, graph: syncGraph });
  sync.computePositions(["current"], sync.getOptions());

  const queue = [];
  const events = [];
  const incremental = new ForceDirected3DLayout({
    ...common,
    graph: incrementalGraph,
    timer: (callback, delay) => queue.push([callback, delay]),
  });
  incremental.computePositions(["current"], incremental.getOptions(), {
    iter: 2,
    onStep: (percentage) => events.push(["step", percentage]),
    onComplete: () => events.push(["complete"]),
  });
  while (queue.length > 0) {
    const [callback, delay] = queue.shift();
    assert.equal(delay, 1);
    callback();
  }
  assert.deepEqual(events, [["step", 50], ["step", 100], ["complete"]]);
  assert.deepEqual(snapshot(incrementalGraph), snapshot(syncGraph));
});
