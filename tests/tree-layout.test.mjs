import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  TreeLayout,
  design,
  fitExtentList,
  fitExtents,
  getBoundaries,
  mergeExtentList,
  mergeExtents,
  moveExtent,
} from "../dist/layouts/tree.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};

const treeNodes = [
  { id: "root", name: "Root", data: { $width: 54, $height: 24 } },
  { id: "alpha", name: "Alpha", data: { $width: 30, $height: 18 } },
  { id: "beta", name: "Beta", data: { $width: 72, $height: 26 } },
  { id: "gamma", name: "Gamma", data: { $width: 22, $height: 32 } },
  {
    id: "alpha-one",
    name: "Alpha one",
    data: { $width: 45, $height: 14 },
  },
  {
    id: "alpha-two",
    name: "Alpha two",
    data: { $width: 20, $height: 40 },
  },
  {
    id: "alpha-deep",
    name: "Alpha deep",
    data: { $width: 60, $height: 16 },
  },
  {
    id: "beta-one",
    name: "Beta one",
    data: { $width: 33, $height: 28 },
  },
];

const treeEdges = [
  ["root", "alpha"],
  ["root", "beta"],
  ["root", "gamma"],
  ["alpha", "alpha-one"],
  ["alpha", "alpha-two"],
  ["alpha-two", "alpha-deep"],
  ["beta", "beta-one"],
];

function makeConfig(overrides = {}) {
  return {
    Node: {
      overridable: true,
      width: 40,
      height: 20,
      CanvasStyles: {},
    },
    orientation: "left",
    subtreeOffset: 8,
    siblingOffset: 5,
    indent: 7,
    multitree: false,
    align: "center",
    levelDistance: 30,
    ...overrides,
  };
}

function populateGraph(GraphConstructor, nodes, edges, config, compute = true) {
  const graph = new GraphConstructor(
    {},
    config.Node,
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
  if (compute) {
    graph.computeLevels("root", 0, "ignore");
  }
  graph.eachNode((node) => {
    node.exist = true;
    node.drawn = true;
  });
  return graph;
}

function dimensions(node, phase) {
  return {
    width: node.getData("width", phase),
    height: node.getData("height", phase),
  };
}

function positions(graph, phase) {
  return Object.fromEntries(
    Object.keys(graph.nodes)
      .sort()
      .map((id) => {
        const node = graph.nodes[id];
        const position = node.getPos(phase);
        return [id, { x: position.x, y: position.y }];
      }),
  );
}

function createLegacyLayout(graph, config) {
  const layout = new legacy.Layouts.Tree();
  layout.graph = graph;
  layout.root = "root";
  layout.config = config;
  return layout;
}

test("tree layout is an isolated ESM module", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(typeof TreeLayout, "function");
  assert.equal(typeof getBoundaries, "function");
  assert.equal(typeof design, "function");

  const output = await readFile(
    new URL("../dist/layouts/tree.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b/);
  assert.doesNotMatch(output, /\$jit/);
});

test("extent primitives retain the legacy tree-fitting calculations", () => {
  const first = [
    [-5, 4],
    [-2, 6],
  ];
  const second = [
    [1, 8],
    [-1, 7],
    [0, 2],
  ];

  assert.deepEqual(moveExtent(first, 3), [
    [-2, 7],
    [1, 9],
  ]);
  assert.deepEqual(mergeExtents(first, second), [
    [-5, 8],
    [-2, 7],
    [0, 2],
  ]);
  assert.deepEqual(mergeExtentList([first, second]), [
    [-5, 8],
    [-2, 7],
    [0, 2],
  ]);
  assert.equal(fitExtents(first, second, 8, 5), 20);

  const centered = fitExtentList([first, second], 8, 5, "center");
  const left = fitExtentList([first, second], 8, 5, "left");
  const right = fitExtentList([first, second], 8, 5, "right");
  assert.deepEqual(left, [0, 20]);
  assert.deepEqual(right, [-20, -0]);
  assert.deepEqual(centered, [-10, 10]);
});

test("getBoundaries honors overrides, level filtering, and defaults", () => {
  const config = makeConfig();
  const graph = populateGraph(Graph, treeNodes, treeEdges, config);

  assert.deepEqual(
    getBoundaries(graph, config, 1, "left", "current", dimensions),
    { width: 72, height: 32 },
  );

  let calls = 0;
  const fixedConfig = makeConfig({
    Node: {
      overridable: false,
      width: 91,
      height: 37,
      CanvasStyles: {},
    },
  });
  assert.deepEqual(
    getBoundaries(
      graph,
      fixedConfig,
      99,
      "left",
      "current",
      () => {
        calls += 1;
        return { width: 1, height: 1 };
      },
    ),
    { width: 91, height: 37 },
  );
  assert.equal(calls, 0);
});

test("design returns the root extent while mutating only the requested phase", () => {
  const config = makeConfig({ orientation: "top" });
  const graph = populateGraph(Graph, treeNodes, treeEdges, config);
  graph.eachNode((node) => node.pos.setc(101, -203));
  const root = graph.getNode("root");

  const result = design(
    graph,
    root,
    "end",
    config,
    "top",
    dimensions,
  );

  assert.strictEqual(result.tree, root);
  assert.deepEqual(result.extent[0], [-27, 27]);
  assert.ok(result.extent.length > 1);
  assert.deepEqual(
    { x: root.pos.x, y: root.pos.y },
    { x: 101, y: -203 },
  );
  assert.deepEqual(
    { x: root.endPos.x, y: root.endPos.y },
    { x: 0, y: 0 },
  );
});

test("all orientations and alignments match Layouts.Tree 2.0.1", () => {
  const orientations = ["top", "right", "bottom", "left"];
  const alignments = ["left", "center", "right"];

  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = makeConfig({ orientation, align });
      const modernGraph = populateGraph(
        Graph,
        treeNodes,
        treeEdges,
        config,
      );
      const legacyGraph = populateGraph(
        legacy.Graph,
        treeNodes,
        treeEdges,
        config,
      );
      const modernLayout = new TreeLayout({
        graph: modernGraph,
        root: "root",
        config,
        getNodeDimensions: dimensions,
      });
      const legacyLayout = createLegacyLayout(legacyGraph, config);

      modernLayout.computePositions(modernGraph.getNode("root"), "end");
      legacyLayout.computePositions(legacyGraph.getNode("root"), "end");

      assert.deepEqual(
        normalizeRealm(positions(modernGraph, "end")),
        normalizeRealm(positions(legacyGraph, "end")),
        `${orientation}/${align}`,
      );
    }
  }
});

test("multitree lays out each tagged orientation independently", () => {
  const orientations = ["top", "right", "bottom", "left"];
  const nodes = [
    { id: "root", name: "Root", data: { $width: 50, $height: 30 } },
    { id: "untagged", name: "Untagged", data: { $width: 18, $height: 18 } },
  ];
  const edges = [["root", "untagged"]];
  for (const orientation of orientations) {
    nodes.push(
      {
        id: `${orientation}-a`,
        name: `${orientation} A`,
        data: { $orn: orientation, $width: 25, $height: 15 },
      },
      {
        id: `${orientation}-b`,
        name: `${orientation} B`,
        data: { $orn: orientation, $width: 35, $height: 21 },
      },
      {
        id: `${orientation}-leaf`,
        name: `${orientation} leaf`,
        data: { $orn: orientation, $width: 17, $height: 13 },
      },
    );
    edges.push(
      ["root", `${orientation}-a`],
      ["root", `${orientation}-b`],
      [`${orientation}-a`, `${orientation}-leaf`],
    );
  }

  const config = makeConfig({ multitree: true, align: "center" });
  const modernGraph = populateGraph(Graph, nodes, edges, config);
  const legacyGraph = populateGraph(legacy.Graph, nodes, edges, config);
  modernGraph.eachNode((node) => node.endPos.setc(123, -456));
  legacyGraph.eachNode((node) => node.endPos.setc(123, -456));

  new TreeLayout({
    graph: modernGraph,
    root: "root",
    config,
    getNodeDimensions: dimensions,
  }).computePositions(modernGraph.getNode("root"), "end");
  createLegacyLayout(legacyGraph, config).computePositions(
    legacyGraph.getNode("root"),
    "end",
  );

  assert.deepEqual(
    normalizeRealm(positions(modernGraph, "end")),
    normalizeRealm(positions(legacyGraph, "end")),
  );
  const untaggedPosition = modernGraph.getNode("untagged").endPos;
  assert.deepEqual(
    { x: untaggedPosition.x, y: untaggedPosition.y },
    { x: 123, y: -456 },
  );
  assert.ok(modernGraph.getNode("top-a").endPos.y > 0);
  assert.ok(modernGraph.getNode("bottom-a").endPos.y < 0);
  assert.ok(modernGraph.getNode("left-a").endPos.x > 0);
  assert.ok(modernGraph.getNode("right-a").endPos.x < 0);
});

test("compute owns root state, depth calculation, and dimension injection", () => {
  const config = makeConfig({ orientation: "left", align: "center" });
  const modernGraph = populateGraph(
    Graph,
    treeNodes,
    treeEdges,
    config,
    false,
  );
  const legacyGraph = populateGraph(
    legacy.Graph,
    treeNodes,
    treeEdges,
    config,
    false,
  );
  modernGraph.getNode("gamma").ignore = true;
  legacyGraph.getNode("gamma").ignore = true;
  modernGraph.getNode("gamma").startPos.setc(77, 88);
  legacyGraph.getNode("gamma").startPos.setc(77, 88);

  let dimensionCalls = 0;
  const layout = new TreeLayout({
    graph: modernGraph,
    root: "root",
    config,
    getNodeDimensions(node, phase) {
      dimensionCalls += 1;
      return dimensions(node, phase);
    },
  });
  layout.compute(undefined, true);

  const legacyRoot = legacyGraph.getNode("root");
  legacyRoot.drawn = true;
  legacyRoot.exist = true;
  legacyRoot.selected = true;
  legacyGraph.computeLevels("root", 0, "ignore");
  createLegacyLayout(legacyGraph, config).computePositions(legacyRoot, "start");

  const modernRoot = modernGraph.getNode("root");
  assert.equal(modernRoot.drawn, true);
  assert.equal(modernRoot.exist, true);
  assert.equal(modernRoot.selected, true);
  assert.ok(dimensionCalls > 0);
  assert.equal(modernGraph.getNode("alpha")._depth, 1);
  assert.equal("_depth" in modernGraph.getNode("gamma"), false);
  assert.deepEqual(
    normalizeRealm(positions(modernGraph, "start")),
    normalizeRealm(positions(legacyGraph, "start")),
  );
});
