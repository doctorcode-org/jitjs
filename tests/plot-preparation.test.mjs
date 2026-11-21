import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  normalizePlotModes,
  prepareGraphForAnimation,
} from "../dist/graph/plot-preparation.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  width: 1,
  height: 1,
  color: "#000000",
  CanvasStyles: { lineWidth: 1 },
};
const edgeConfig = {
  overridable: true,
  alpha: 1,
  CanvasStyles: { strokeStyle: "#000000" },
};

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, edgeConfig, {});
  const first = {
    id: "first",
    name: "First",
    data: {
      $width: 15,
      $height: 25,
      $color: "#123456",
      "$canvas-lineWidth": 3,
    },
  };
  const second = {
    id: "second",
    name: "Second",
    data: {
      $width: 35,
      $height: 45,
      $color: "#abcdef",
      "$canvas-lineWidth": 7,
    },
  };
  graph.addNode(first);
  graph.addNode(second);
  graph.addAdjacence(first, second, {
    $alpha: 0.4,
    "$canvas-strokeStyle": "#fedcba",
  });
  graph.getNode("first").pos.setc(12, -4);
  graph.getNode("second").pos.setc(-8, 21);
  return graph;
}

function snapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.getNode(id);
    nodes[id] = {
      startPos: { x: node.startPos.x, y: node.startPos.y },
      startData: { ...node.startData },
    };
  }
  const adjacency = graph.getAdjacence("first", "second");
  return {
    nodes,
    adjacencyStartData: { ...adjacency.startData },
  };
}

test("plot preparation is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/plot-preparation.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});

test("array mode syntax matches Graph.Plot.prepare", () => {
  const modes = [
    "linear",
    "node-property:width:color",
    "node-style:lineWidth",
    "edge-property:alpha",
    "edge-style:strokeStyle",
  ];
  const modernGraph = createGraph(Graph);
  const legacyGraph = createGraph(legacy.Graph);

  const modernModes = prepareGraphForAnimation(modernGraph, modes);
  const legacyModes = legacy.Graph.Plot.prepare.call(
    { viz: { graph: legacyGraph } },
    modes,
  );

  assert.deepEqual(modernModes, normalizeRealm(legacyModes));
  assert.deepEqual(snapshot(modernGraph), normalizeRealm(snapshot(legacyGraph)));
});

test("object syntax, custom modes, and scalar properties retain legacy parsing", () => {
  const nodeProperties = ["height"];
  const modes = {
    position: "polar",
    "node-property": nodeProperties,
    "node-style": "lineWidth",
    custom: "value",
  };
  const modernGraph = createGraph(Graph);
  const legacyGraph = createGraph(legacy.Graph);

  const modernModes = prepareGraphForAnimation(modernGraph, modes);
  const legacyModes = legacy.Graph.Plot.prepare.call(
    { viz: { graph: legacyGraph } },
    modes,
  );

  assert.deepEqual(modernModes, normalizeRealm(legacyModes));
  assert.strictEqual(modernModes["node-property"], nodeProperties);
  assert.deepEqual(snapshot(modernGraph), normalizeRealm(snapshot(legacyGraph)));
});

test("normalization can be used independently of a graph", () => {
  assert.deepEqual(
    normalizePlotModes(["moebius", "label-property:size:color"]),
    {
      moebius: [],
      "label-property": ["size", "color"],
    },
  );
});
