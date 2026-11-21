import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { Graph } from "../dist/graph/graph.js";
import { ForceDirectedLayout } from "../dist/layouts/force-directed.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const canvasSize = { width: 240, height: 160 };
const nodeConfig = {
  overridable: true,
  dim: 5,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};
const inputs = [
  { id: "root", name: "Root", data: {} },
  { id: "left", name: "Left", data: {} },
  { id: "right", name: "Right", data: {} },
  { id: "leaf", name: "Leaf", data: {} },
];
const edges = [
  [inputs[0], inputs[1]],
  [inputs[0], inputs[2]],
  [inputs[1], inputs[3]],
];
const initialPositions = {
  root: { current: [12, -8], end: [5, 11] },
  left: { current: [-42, 17], end: [-28, 29] },
  right: { current: [53, 35], end: [46, -31] },
  leaf: { current: [-17, -49], end: [-9, -44] },
};

function createModernGraph() {
  const graph = new Graph(
    { klass: Complex, Node: { exist: true, drawn: true } },
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  populateGraph(graph);
  return graph;
}

function createLegacyGraph() {
  const graph = new legacy.Graph(
    { klass: legacy.Complex, Node: { exist: true, drawn: true } },
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  populateGraph(graph);
  return graph;
}

function populateGraph(graph) {
  for (const input of inputs) {
    graph.addNode(input);
  }
  for (const [from, to] of edges) {
    graph.addAdjacence(from, to);
  }
}

function setInitialPositions(graph, properties = ["current", "end"]) {
  for (const [id, phases] of Object.entries(initialPositions)) {
    const node = graph.getNode(id);
    for (const property of properties) {
      const [x, y] = phases[property];
      node.getPos(property).setc(x, y);
    }
  }
}

function initializeLegacyDisplacements(graph, properties) {
  graph.eachNode((node) => {
    node.disp = {};
    for (const property of properties) {
      node.disp[property] = new legacy.Complex(0, 0);
    }
  });
}

function snapshot(graph, properties) {
  return Object.fromEntries(Object.keys(graph.nodes).sort().map((id) => {
    const node = graph.getNode(id);
    return [id, {
      visited: Boolean(node.visited),
      positions: Object.fromEntries(properties.map((property) => {
        const position = node.getPos(property);
        return [property, { x: position.x, y: position.y }];
      })),
    }];
  }));
}

function createModernLayout(graph, overrides = {}) {
  return new ForceDirectedLayout({
    graph,
    root: "root",
    getSize: () => canvasSize,
    config: { iterations: 5, levelDistance: 35 },
    ...overrides,
  });
}

test("force-directed layout entry point installs no global registry", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("getOptions derives the same force constants as the legacy layout", () => {
  const graph = createModernGraph();
  const layout = createModernLayout(graph, {
    getSize: () => ({ width: 300, height: 120 }),
    config: { iterations: 7, levelDistance: 20 },
  });
  const options = layout.getOptions();
  const expectedK2 = (300 * 120) / inputs.length;
  const expectedK = Math.sqrt(expectedK2);

  assert.deepEqual(
    { width: options.width, height: options.height, tstart: options.tstart },
    { width: 300, height: 120, tstart: 30 },
  );
  assert.equal(options.nodef(0), expectedK2);
  assert.equal(options.nodef(4), expectedK2 / 4);
  assert.equal(options.edgef(50), expectedK * 30);

  const oldGraph = createLegacyGraph();
  const oldLayout = new legacy.Layouts.ForceDirected();
  oldLayout.graph = oldGraph;
  oldLayout.canvas = { getSize: () => ({ width: 300, height: 120 }) };
  oldLayout.config = { iterations: 7, levelDistance: 20 };
  const oldOptions = oldLayout.getOptions();
  assert.equal(options.nodef(9), oldOptions.nodef(9));
  assert.equal(options.edgef(71), oldOptions.edgef(71));
});

test("compute uses injected dimensions and randomness before simulation", () => {
  const graph = createModernGraph();
  const randomValues = [0.75, 0.25, 0.6, 0.8, 0.1, 0.9, 0.4, 0.2];
  const dimensionCalls = [];
  let randomIndex = 0;
  const layout = createModernLayout(graph, {
    getSize: () => ({ width: 100, height: 50 }),
    config: { iterations: 0, levelDistance: 17 },
    random: () => randomValues[randomIndex++],
    computeNodeDimensions: (_graph, properties, config) => {
      dimensionCalls.push({
        properties: properties.slice(),
        levelDistance: config.levelDistance,
      });
    },
  });

  layout.compute("current");

  assert.deepEqual(dimensionCalls, [
    { properties: ["current"], levelDistance: 17 },
  ]);
  assert.deepEqual(
    snapshot(graph, ["current"]),
    {
      leaf: {
        visited: false,
        positions: { current: { x: -1.9999999999999996, y: -3 } },
      },
      left: {
        visited: false,
        positions: {
          current: { x: 1.9999999999999996, y: 3.0000000000000004 },
        },
      },
      right: {
        visited: false,
        positions: { current: { x: -8, y: 4 } },
      },
      root: {
        visited: false,
        positions: { current: { x: 5, y: -2.5 } },
      },
    },
  );
  assert.equal(randomIndex, 8);
  assert.equal(graph.getNode("root")._depth, 0);
  assert.equal(graph.getNode("leaf")._depth, 2);
  assert.equal(graph.getNode("root").disp.current.equals(Complex.KER), true);
});

test("synchronous positions and individual force steps match legacy", () => {
  const properties = ["current", "end"];
  const graph = createModernGraph();
  const oldGraph = createLegacyGraph();
  setInitialPositions(graph, properties);
  setInitialPositions(oldGraph, properties);
  initializeLegacyDisplacements(oldGraph, properties);

  const layout = createModernLayout(graph, {
    config: { iterations: 6, levelDistance: 35 },
  });
  const oldLayout = new legacy.Layouts.ForceDirected();
  oldLayout.graph = oldGraph;
  oldLayout.root = "root";
  oldLayout.canvas = { getSize: () => canvasSize };
  oldLayout.config = { iterations: 6, levelDistance: 35 };

  const options = layout.getOptions();
  const oldOptions = oldLayout.getOptions();
  options.t = oldOptions.t = 19;
  layout.computePositionStep(properties, options);
  oldLayout.computePositionStep(properties, oldOptions);
  assert.deepEqual(snapshot(graph, properties), snapshot(oldGraph, properties));

  layout.computePositions(properties, options);
  oldLayout.computePositions(properties, oldOptions);
  assert.deepEqual(snapshot(graph, properties), snapshot(oldGraph, properties));
  for (const node of Object.values(graph.nodes)) {
    for (const property of properties) {
      const position = node.getPos(property);
      assert.ok(position.x >= -canvasSize.width / 2);
      assert.ok(position.x <= canvasSize.width / 2);
      assert.ok(position.y >= -canvasSize.height / 2);
      assert.ok(position.y <= canvasSize.height / 2);
    }
  }
});

test("incremental computation yields through the injected timer", () => {
  const syncGraph = createModernGraph();
  const incrementalGraph = createModernGraph();
  setInitialPositions(syncGraph, ["current"]);
  setInitialPositions(incrementalGraph, ["current"]);

  const syncLayout = createModernLayout(syncGraph);
  syncLayout.computePositions(["current"], syncLayout.getOptions());

  const queue = [];
  const delays = [];
  const events = [];
  const incrementalLayout = createModernLayout(incrementalGraph, {
    timer: (callback, delay) => {
      queue.push(callback);
      delays.push(delay);
    },
  });
  incrementalLayout.computePositions(
    ["current"],
    incrementalLayout.getOptions(),
    {
      iter: 2,
      onStep: (percentage) => events.push(["step", percentage]),
      onComplete: () => events.push(["complete"]),
    },
  );

  assert.deepEqual(events, [["step", 50]]);
  while (queue.length > 0) {
    queue.shift()();
  }

  assert.deepEqual(events, [
    ["step", 50],
    ["step", 100],
    ["complete"],
  ]);
  assert.deepEqual(delays, [1, 1]);
  assert.deepEqual(
    snapshot(incrementalGraph, ["current"]),
    snapshot(syncGraph, ["current"]),
  );
});
