import assert from "node:assert/strict";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import { GridLayout } from "../dist/layouts/grid.js";
const nodeConfig = {
  overridable: true,
  width: 1,
  height: 1,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};

const nodes = [
  { id: "a", name: "A", data: { $legendX: "one", $legendY: "top" } },
  { id: "b", name: "B", data: { $legendX: "two", $legendY: "top" } },
  { id: "c", name: "C", data: { $legendX: "one", $legendY: "bottom" } },
];

function createGraph() {
  const graph = new Graph({}, nodeConfig, edgeConfig, labelConfig);
  for (const node of nodes) {
    graph.addNode(node);
  }
  return graph;
}

function snapshot(graph, phase) {
  const output = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    const position = node.getPos(phase);
    output[id] = {
      position: { x: position.x, y: position.y },
      width: node.getData("width", undefined, true),
      height: node.getData("height", undefined, true),
    };
  }
  return output;
}

test("grid layout module installs no global registry", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("derived legends retain first-seen legacy ordering", () => {
  const graph = createGraph();
  const canvas = { getSize: () => ({ width: 200, height: 100 }) };
  const config = {
    Margin: { top: 5, right: 10, bottom: 15, left: 20 },
  };
  const controller = { onBeforeCompute() {}, onAfterCompute() {} };
  const layout = new GridLayout(graph, canvas, config, controller);

  assert.deepEqual(layout.getLegendX(), ["one", "two"]);
  assert.deepEqual(layout.getLegendY(), ["top", "bottom"]);
});

test("grid cell positions, dimensions, phase, and callback order match legacy", () => {
  const graph = createGraph();
  const canvas = { getSize: () => ({ width: 200, height: 100 }) };
  const config = {
    Margin: { top: 5, right: 10, bottom: 15, left: 20 },
    legendX: ["two", "one"],
    legendY: ["bottom", "top"],
  };
  const modernCalls = [];
  const layout = new GridLayout(graph, canvas, config, {
    onBeforeCompute: () => modernCalls.push("before"),
    onAfterCompute: () => modernCalls.push("after"),
  });

  layout.compute("end");

  assert.deepEqual(modernCalls, ["before", "after"]);
  assert.deepEqual(snapshot(graph, "end"), {
    a: { position: { x: 5, y: -5 }, width: 85, height: 40 },
    b: { position: { x: -80, y: -5 }, width: 85, height: 40 },
    c: { position: { x: 5, y: -45 }, width: 85, height: 40 },
  });
});
