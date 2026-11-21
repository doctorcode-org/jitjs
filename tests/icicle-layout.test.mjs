import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import { IcicleLayout } from "../dist/layouts/icicle.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  dim: 1,
  width: 1,
  height: 1,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};
const size = { width: 320, height: 180 };

const nodes = [
  { id: "root", name: "Root", data: { $dim: 8 } },
  { id: "alpha", name: "Alpha", data: { $dim: 3 } },
  { id: "beta", name: "Beta", data: { $dim: 1 } },
  { id: "alpha-one", name: "Alpha one", data: { $dim: 2 } },
  { id: "alpha-two", name: "Alpha two", data: { $dim: 1 } },
  { id: "alpha-deep", name: "Alpha deep", data: { $dim: 5 } },
  { id: "beta-one", name: "Beta one", data: { $dim: 1 } },
];

const edges = [
  ["root", "alpha"],
  ["root", "beta"],
  ["alpha", "alpha-one"],
  ["alpha", "alpha-two"],
  ["alpha-two", "alpha-deep"],
  ["beta", "beta-one"],
];

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor(
    {},
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    graph.addNode(node);
  }
  for (const [from, to] of edges) {
    graph.addAdjacence(byId[from], byId[to], {});
  }
  return graph;
}

function snapshot(graph, phase, ids = Object.keys(graph.nodes)) {
  return Object.fromEntries(
    [...ids].sort().map((id) => {
      const node = graph.getNode(id);
      const position = node.getPos(phase);
      return [
        id,
        {
          position: { x: position.x, y: position.y },
          width: node.getData("width", phase, true),
          height: node.getData("height", phase, true),
          depth: node._depth,
        },
      ];
    }),
  );
}

function createLegacyLayout(graph, config, calls = [], clickedNode = null) {
  const layout = new legacy.Layouts.Icicle();
  layout.graph = graph;
  layout.root = "root";
  layout.config = config;
  layout.canvas = { getSize: () => size };
  layout.controller = {
    onBeforeCompute: (root) => calls.push(["before", root.id, root._depth]),
  };
  layout.clickedNode = clickedNode;
  layout.layout = {
    orientation: config.orientation,
    horizontal() {
      return this.orientation == "h";
    },
    vertical() {
      return this.orientation == "v";
    },
  };
  return layout;
}

function createModernLayout(graph, config, calls = [], clickedNode = null) {
  return new IcicleLayout({
    graph,
    root: "root",
    getSize: () => size,
    config,
    controller: {
      onBeforeCompute: (root) =>
        calls.push(["before", root.id, root._depth]),
    },
    clickedNode,
  });
}

test("icicle layout is an isolated leaf ESM module", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(typeof IcicleLayout, "function");

  const output = await readFile(
    new URL("../dist/layouts/icicle.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b/);
  assert.doesNotMatch(output, /\$jit/);
});

test("orientation state is local to each layout instance", () => {
  const horizontal = createModernLayout(createGraph(Graph), {});
  const vertical = createModernLayout(createGraph(Graph), {
    orientation: "v",
  });

  assert.equal(horizontal.horizontal(), true);
  assert.equal(horizontal.vertical(), false);
  assert.equal(vertical.horizontal(), false);
  assert.equal(vertical.vertical(), true);

  horizontal.changeOrientation();
  assert.equal(horizontal.vertical(), true);
  assert.equal(vertical.vertical(), true);
  assert.equal(horizontal.config.orientation, "h");
});

test("horizontal and vertical geometry match Layouts.Icicle 2.0.1", () => {
  for (const orientation of ["h", "v"]) {
    const config = {
      orientation,
      offset: 2,
      levelsToShow: 3,
      constrained: true,
    };
    const modernGraph = createGraph(Graph);
    const legacyGraph = createGraph(legacy.Graph);
    const modernCalls = [];
    const legacyCalls = [];

    createModernLayout(modernGraph, config, modernCalls).compute("end");
    createLegacyLayout(legacyGraph, config, legacyCalls).compute("end");

    assert.deepEqual(
      normalizeRealm(snapshot(modernGraph, "end")),
      normalizeRealm(snapshot(legacyGraph, "end")),
      orientation,
    );
    assert.deepEqual(modernCalls, [["before", "root", undefined]]);
    assert.deepEqual(
      normalizeRealm(modernCalls),
      normalizeRealm(legacyCalls),
    );

    for (const node of Object.values(modernGraph.nodes)) {
      assert.deepEqual(
        { x: node.pos.x, y: node.pos.y },
        { x: 0, y: 0 },
      );
    }
  }
});

test("a clicked node lays out its subtree with legacy global-depth sizing", () => {
  const config = {
    orientation: "h",
    offset: 2,
    levelsToShow: Number.MAX_VALUE,
    constrained: false,
  };
  const modernGraph = createGraph(Graph);
  const legacyGraph = createGraph(legacy.Graph);
  const modernClicked = modernGraph.getNode("alpha");
  const legacyClicked = legacyGraph.getNode("alpha");

  createModernLayout(
    modernGraph,
    config,
    [],
    modernClicked,
  ).compute("current");
  createLegacyLayout(
    legacyGraph,
    config,
    [],
    legacyClicked,
  ).compute("current");

  const subtreeIds = ["alpha", "alpha-one", "alpha-two", "alpha-deep"];
  assert.deepEqual(
    normalizeRealm(snapshot(modernGraph, "current", subtreeIds)),
    normalizeRealm(snapshot(legacyGraph, "current", subtreeIds)),
  );
  assert.equal(modernClicked.getData("width", "current", true), 80);
  assert.equal(
    modernGraph.getNode("root").getData("width", "current", true),
    undefined,
  );
});

test("ignored branches are excluded from depth and area calculations", () => {
  const config = {
    orientation: "v",
    constrained: false,
    levelsToShow: Number.MAX_VALUE,
  };
  const modernGraph = createGraph(Graph);
  const legacyGraph = createGraph(legacy.Graph);
  modernGraph.getNode("beta").ignore = true;
  legacyGraph.getNode("beta").ignore = true;

  createModernLayout(modernGraph, config).compute();
  createLegacyLayout(legacyGraph, config).compute();

  assert.deepEqual(
    normalizeRealm(snapshot(modernGraph, "current")),
    normalizeRealm(snapshot(legacyGraph, "current")),
  );
  assert.equal(modernGraph.getNode("beta")._depth, undefined);
  assert.equal(
    modernGraph.getNode("beta").getData("width", "current", true),
    undefined,
  );
});
