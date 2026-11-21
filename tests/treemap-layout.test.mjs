import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  averageAspectRatio,
  worstAspectRatio,
} from "../dist/layouts/treemap/area.js";
import { SliceAndDiceTreemapLayout } from "../dist/layouts/treemap/slice-and-dice.js";
import { SquarifiedTreemapLayout } from "../dist/layouts/treemap/squarified.js";
import { StripTreemapLayout } from "../dist/layouts/treemap/strip.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const size = { width: 317, height: 191 };
const nodeConfig = {
  overridable: true,
  area: 1,
  width: 1,
  height: 1,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};

const nodes = [
  { id: "root", name: "Root", data: { $area: 16 } },
  { id: "zeta", name: "Zeta", data: { $area: 6 } },
  { id: "alpha", name: "Alpha", data: { $area: 6 } },
  { id: "middle", name: "Middle", data: { $area: 3 } },
  { id: "tiny", name: "Tiny", data: { $area: 1 } },
  { id: "zeta-a", name: "Zeta A", data: { $area: 5 } },
  { id: "zeta-b", name: "Zeta B", data: { $area: 2 } },
  { id: "zeta-c", name: "Zeta C", data: { $area: 3 } },
  { id: "alpha-a", name: "Alpha A", data: { $area: 1 } },
  { id: "alpha-b", name: "Alpha B", data: { $area: 4 } },
  { id: "middle-a", name: "Middle A", data: { $area: 1 } },
  { id: "middle-deep", name: "Middle deep", data: { $area: 2 } },
];

const edges = [
  ["root", "zeta"],
  ["root", "alpha"],
  ["root", "middle"],
  ["root", "tiny"],
  ["zeta", "zeta-a"],
  ["zeta", "zeta-b"],
  ["zeta", "zeta-c"],
  ["alpha", "alpha-a"],
  ["alpha", "alpha-b"],
  ["middle", "middle-a"],
  ["middle-a", "middle-deep"],
];

const modernConstructors = {
  SliceAndDice: SliceAndDiceTreemapLayout,
  Squarified: SquarifiedTreemapLayout,
  Strip: StripTreemapLayout,
};

function createGraph(GraphConstructor, inputNodes = nodes, inputEdges = edges) {
  const graph = new GraphConstructor(
    {},
    nodeConfig,
    edgeConfig,
    labelConfig,
  );
  const byId = Object.fromEntries(inputNodes.map((node) => [node.id, node]));
  for (const node of inputNodes) {
    graph.addNode(node);
  }
  for (const [from, to] of inputEdges) {
    graph.addAdjacence(byId[from], byId[to], {});
  }
  return graph;
}

function canonicalNumber(value) {
  if (value === undefined) {
    return "undefined";
  }
  if (Number.isNaN(value)) {
    return "NaN";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return "Infinity";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-Infinity";
  }
  if (Object.is(value, -0)) {
    return "-0";
  }
  return value;
}

function snapshot(graph, phase) {
  return Object.fromEntries(
    Object.keys(graph.nodes)
      .sort()
      .map((id) => {
        const node = graph.getNode(id);
        const position = node.getPos(phase);
        return [
          id,
          {
            position: {
              x: canonicalNumber(position.x),
              y: canonicalNumber(position.y),
            },
            width: canonicalNumber(node.getData("width", phase, true)),
            height: canonicalNumber(node.getData("height", phase, true)),
            area: canonicalNumber(node._area),
            depth: canonicalNumber(node._depth),
          },
        ];
      }),
  );
}

function makeController(calls) {
  return {
    onBeforeCompute(root) {
      calls.push(["before", root.id, canonicalNumber(root._depth)]);
    },
    onAfterCompute(root) {
      calls.push(["after", root.id, canonicalNumber(root._depth)]);
    },
  };
}

function createModernLayout(
  kind,
  graph,
  config,
  calls = [],
  clickedNode = null,
) {
  const Constructor = modernConstructors[kind];
  return new Constructor({
    graph,
    root: "root",
    getSize: () => size,
    config,
    controller: makeController(calls),
    clickedNode,
  });
}

function createLegacyLayout(
  kind,
  graph,
  config,
  calls = [],
  clickedNode = null,
) {
  const Constructor = legacy.Layouts.TM[kind];
  const layout = new Constructor();
  layout.graph = graph;
  layout.root = "root";
  layout.canvas = { getSize: () => size };
  layout.config = config;
  layout.controller = makeController(calls);
  layout.clickedNode = clickedNode;
  layout.layout = {
    orientation: config.orientation,
    horizontal() {
      return this.orientation == "h";
    },
    vertical() {
      return this.orientation == "v";
    },
    change() {
      this.orientation = this.vertical() ? "h" : "v";
    },
  };
  return layout;
}

test("treemap entry points remain independent ESM modules", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(typeof SliceAndDiceTreemapLayout, "function");
  assert.equal(typeof SquarifiedTreemapLayout, "function");
  assert.equal(typeof StripTreemapLayout, "function");

  const [area, sliceAndDice, squarified, strip] = await Promise.all([
    readFile(new URL("../dist/layouts/treemap/area.js", import.meta.url), "utf8"),
    readFile(
      new URL("../dist/layouts/treemap/slice-and-dice.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../dist/layouts/treemap/squarified.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../dist/layouts/treemap/strip.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(area, /^\s*import\s/m);
  assert.doesNotMatch(sliceAndDice, /^\s*import\s/m);
  assert.match(squarified, /from "\.\/area\.js"/);
  assert.match(strip, /from "\.\/area\.js"/);
  for (const output of [area, sliceAndDice, squarified, strip]) {
    assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b/);
    assert.doesNotMatch(output, /\$jit/);
  }
  assert.doesNotMatch(squarified, /(?:strip|slice-and-dice)\.js/);
  assert.doesNotMatch(strip, /(?:squarified|slice-and-dice)\.js/);
});

test("shared aspect-ratio scores match Layouts.TM.Area", () => {
  const children = [
    { _area: 63.5 },
    { _area: 17.25 },
    { _area: 9.75 },
  ];
  const oldSquarified = new legacy.Layouts.TM.Squarified();
  const oldStrip = new legacy.Layouts.TM.Strip();

  assert.equal(
    worstAspectRatio(children, 41),
    oldSquarified.worstAspectRatio(children, 41),
  );
  assert.equal(
    averageAspectRatio(children, 41),
    oldStrip.avgAspectRatio(children, 41),
  );
  assert.equal(worstAspectRatio([], 41), Number.MAX_VALUE);
  assert.equal(averageAspectRatio([], 41), Number.MAX_VALUE);
});

test("all algorithms, orientations, and phases match JIT 2.0.1", () => {
  for (const kind of Object.keys(modernConstructors)) {
    for (const orientation of ["h", "v"]) {
      for (const phase of ["current", "end"]) {
        const config = { orientation, titleHeight: 13, offset: 2 };
        const modernGraph = createGraph(Graph);
        const legacyGraph = createGraph(legacy.Graph);
        const modernCalls = [];
        const legacyCalls = [];
        const modernLayout = createModernLayout(
          kind,
          modernGraph,
          config,
          modernCalls,
        );
        const legacyLayout = createLegacyLayout(
          kind,
          legacyGraph,
          config,
          legacyCalls,
        );

        modernLayout.compute(phase);
        legacyLayout.compute(phase);

        assert.deepEqual(
          snapshot(modernGraph, phase),
          snapshot(legacyGraph, phase),
          `${kind}/${orientation}/${phase}`,
        );
        assert.deepEqual(
          modernCalls,
          legacyCalls,
          `${kind}/${orientation}/${phase}/callbacks`,
        );
        assert.equal(
          modernLayout.orientation,
          legacyLayout.layout.orientation,
          `${kind}/${orientation}/${phase}/orientation`,
        );
      }
    }
  }
});

test("a clicked node computes only its subtree with canonical-root depths", () => {
  for (const kind of Object.keys(modernConstructors)) {
    const config = { orientation: "h", titleHeight: 9, offset: 3 };
    const modernGraph = createGraph(Graph);
    const legacyGraph = createGraph(legacy.Graph);
    const modernCalls = [];
    const legacyCalls = [];
    const modernClicked = modernGraph.getNode("zeta");
    const legacyClicked = legacyGraph.getNode("zeta");

    createModernLayout(
      kind,
      modernGraph,
      config,
      modernCalls,
      modernClicked,
    ).compute("start");
    createLegacyLayout(
      kind,
      legacyGraph,
      config,
      legacyCalls,
      legacyClicked,
    ).compute("start");

    assert.deepEqual(
      snapshot(modernGraph, "start"),
      snapshot(legacyGraph, "start"),
      kind,
    );
    assert.deepEqual(modernCalls, legacyCalls, `${kind}/callbacks`);
    assert.deepEqual(modernCalls, [
      ["before", "zeta", "undefined"],
      ["after", "zeta", 1],
    ]);
    assert.equal(
      modernGraph.getNode("root").getData("width", "start", true),
      undefined,
    );
  }
});

test("Squarified and Strip retain their different string coercion", () => {
  const stringNodes = [
    { id: "root", name: "Root", data: { $area: 2 } },
    { id: "first", name: "First", data: { $area: "10px" } },
    { id: "second", name: "Second", data: { $area: "5" } },
  ];
  const stringEdges = [
    ["root", "first"],
    ["root", "second"],
  ];
  const config = { orientation: "h", titleHeight: 13, offset: 2 };

  for (const kind of ["Squarified", "Strip"]) {
    const modernGraph = createGraph(Graph, stringNodes, stringEdges);
    const legacyGraph = createGraph(legacy.Graph, stringNodes, stringEdges);
    createModernLayout(kind, modernGraph, config).compute();
    createLegacyLayout(kind, legacyGraph, config).compute();

    assert.deepEqual(
      snapshot(modernGraph, "current"),
      snapshot(legacyGraph, "current"),
      kind,
    );
    assert.equal(
      Number.isFinite(modernGraph.getNode("first")._area),
      kind === "Squarified",
    );
  }
});
