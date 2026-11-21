import assert from "node:assert/strict";
import test from "node:test";

import { Polar } from "../dist/core/geometry.js";
import { Graph } from "../dist/graph/graph.js";
import { RadialLayout } from "../dist/layouts/radial.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  dim: 5,
  angularWidth: 1,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};
const inputs = [
  { id: "root", name: "Root", data: { $dim: 8, $angularWidth: 4 } },
  { id: "a", name: "A", data: { $dim: 4, $angularWidth: 2 } },
  { id: "b", name: "B", data: { $dim: 6, $angularWidth: 3 } },
  { id: "c", name: "C", data: { $dim: 2, $angularWidth: 1 } },
];

function createGraphs() {
  const modern = new Graph(
    { klass: Polar, Node: { exist: true, drawn: true } },
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  const old = new legacy.Graph(
    { klass: legacy.Polar, Node: { exist: true, drawn: true } },
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  for (const input of inputs) {
    modern.addNode(input);
    old.addNode(input);
  }
  modern.addAdjacence(inputs[0], inputs[1]);
  modern.addAdjacence(inputs[0], inputs[2]);
  modern.addAdjacence(inputs[1], inputs[3]);
  old.addAdjacence(inputs[0], inputs[1]);
  old.addAdjacence(inputs[0], inputs[2]);
  old.addAdjacence(inputs[1], inputs[3]);
  modern.computeLevels("root", 0, "ignore");
  old.computeLevels("root", 0, "ignore");
  return { modern, old };
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : String(value);
}

function snapshot(graph, properties) {
  const result = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    result[id] = {
      depth: node._depth,
      angularWidth: safeNumber(node._angularWidth),
      treeAngularWidth: safeNumber(node._treeAngularWidth),
      angleSpan: { begin: node.angleSpan.begin, end: node.angleSpan.end },
      positions: Object.fromEntries(properties.map((property) => {
        const position = node.getPos(property);
        return [property, { theta: position.theta, rho: position.rho }];
      })),
      spans: Object.fromEntries(properties.map((property) => [
        property,
        safeNumber(node.getData("span", property, true)),
      ])),
      quotients: Object.fromEntries(properties.map((property) => [
        property,
        safeNumber(node.getData("dim-quotient", property, true)),
      ])),
    };
  }
  return result;
}

test("radial layout entry point installs no global", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("angular widths and polar positions match the legacy radial layout", () => {
  const { modern, old } = createGraphs();
  const properties = ["current", "end"];
  const modernLayout = new RadialLayout({
    graph: modern,
    root: "root",
    createLevelDistance: () => (node) => (node._depth + 1) * 50,
  });
  const oldLayout = new legacy.Layouts.Radial();
  oldLayout.graph = old;
  oldLayout.root = "root";
  oldLayout.parent = null;
  oldLayout.config = {};

  modernLayout.computeAngularWidths(properties);
  oldLayout.computeAngularWidths(properties);
  modernLayout.computePositions(properties, (node) => (node._depth + 1) * 50);
  oldLayout.computePositions(properties, (node) => (node._depth + 1) * 50);

  assert.deepEqual(snapshot(modern, properties), snapshot(old, properties));
});

test("compute runs injected dimension measurement before layout", () => {
  const { modern } = createGraphs();
  const calls = [];
  const layout = new RadialLayout({
    graph: modern,
    root: "root",
    config: { levelDistance: 30 },
    computeNodeDimensions: (_graph, properties, config) => {
      calls.push([properties.slice(), config.levelDistance]);
    },
    createLevelDistance: () => (node) => (node._depth + 1) * 30,
  });

  layout.compute("start");

  assert.deepEqual(calls, [[ ["start"], 30 ]]);
  assert.equal(modern.getNode("root").startPos.rho, 0);
  assert.equal(modern.getNode("a").startPos.rho, 30);
});

test("unknown roots fail with a useful error", () => {
  const { modern } = createGraphs();
  const layout = new RadialLayout({
    graph: modern,
    root: "missing",
    createLevelDistance: () => () => 1,
  });
  assert.throws(
    () => layout.computePositions(["current"], () => 1),
    /Unknown graph root/,
  );
});
