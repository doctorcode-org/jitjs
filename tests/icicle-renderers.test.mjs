import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsIcicleNoneNode,
  containsIcicleRectangleNode,
  renderIcicleNoneNode,
  renderIcicleRectangleNode,
} from "../dist/visualizations/icicle-node-renderers.js";
import {
  containsIcicleNoneEdge,
  renderIcicleNoneEdge,
} from "../dist/visualizations/icicle-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.Icicle.Plot.NodeTypes();
const legacyEdges = new legacy.Icicle.Plot.EdgeTypes();

function createCanvas() {
  const calls = [];
  const context = {
    createRadialGradient(...arguments_) {
      calls.push(["createRadialGradient", ...arguments_]);
      return {
        marker: "gradient",
        addColorStop(...stop) {
          calls.push(["addColorStop", ...stop]);
        },
      };
    },
    fillRect(...arguments_) {
      calls.push(["fillRect", ...arguments_]);
    },
    strokeRect(...arguments_) {
      calls.push(["strokeRect", ...arguments_]);
    },
  };
  for (const property of ["fillStyle", "strokeStyle", "lineWidth"]) {
    Object.defineProperty(context, property, {
      configurable: true,
      set(value) {
        calls.push([property, value?.marker ?? value]);
      },
      get() {
        return undefined;
      },
    });
  }
  return { calls, canvas: { getCtx: () => context } };
}

function createNode({
  width = 120,
  height = 80,
  border = "#abcdef",
  color = "#336699",
  descendant = true,
} = {}) {
  const reads = [];
  const values = { width, height, border, color };
  const parent = {
    id: descendant ? "selected" : "other-root",
    _depth: 0,
    adjacencies: {},
  };
  const node = {
    id: "node",
    _depth: 1,
    adjacencies: {},
    pos: {
      getc(simple) {
        reads.push(["position", simple]);
        return { x: -40, y: 15 };
      },
    },
    getData(property) {
      reads.push(["data", property]);
      return values[property];
    },
    isDescendantOf(id) {
      reads.push(["descendant", id]);
      return this.id === id || parent.id === id;
    },
  };
  node.adjacencies[parent.id] = { nodeFrom: node, nodeTo: parent };
  return { node, reads };
}

function legacyPlot(config, clickedNode = null) {
  return {
    nodeHelper: legacy.Graph.Plot.nodeHelper,
    viz: { config, clickedNode },
  };
}

test("Icicle rectangle rendering matches cushion, border, and small-box behavior", () => {
  const cases = [
    {
      config: { offset: 2, cushion: true },
      node: { width: 120, height: 80, border: "#abcdef" },
    },
    {
      config: { offset: 5, cushion: false },
      node: { width: 30, height: 20, border: "" },
    },
    {
      config: { offset: 2, cushion: true },
      node: { width: 3, height: 20, border: "#abcdef" },
    },
  ];

  for (const options of cases) {
    const modern = createNode(options.node);
    const old = createNode(options.node);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();

    renderIcicleRectangleNode(
      "rectangle",
      modern.node,
      modernCanvas.canvas,
      true,
      options.config,
    );
    legacyNodes.rectangle.render.call(
      legacyPlot(options.config),
      old.node,
      oldCanvas.canvas,
      true,
    );

    assert.deepEqual(modern.reads, old.reads, JSON.stringify(options));
    assert.deepEqual(
      modernCanvas.calls,
      oldCanvas.calls,
      JSON.stringify(options),
    );
  }
});

test("Icicle rectangle hit testing preserves selected-root ancestry guards", () => {
  const config = { offset: 2, cushion: true };
  const positions = [
    { x: 0, y: 40 },
    { x: 81, y: 96 },
    { x: -41, y: 14 },
  ];
  const cases = [
    { clicked: false, descendant: true },
    { clicked: true, descendant: true },
    { clicked: true, descendant: false },
  ];

  for (const options of cases) {
    for (const position of positions) {
      const modern = createNode(options);
      const old = createNode(options);
      const clickedNode = options.clicked ? { id: "selected" } : null;
      const actual = containsIcicleRectangleNode(
        modern.node,
        position,
        config,
        clickedNode,
      );
      const expected = legacyNodes.rectangle.contains.call(
        legacyPlot(config, clickedNode),
        old.node,
        position,
      );
      assert.equal(
        actual,
        expected,
        `${JSON.stringify(options)} ${JSON.stringify(position)}`,
      );
      assert.deepEqual(
        modern.reads.filter(([kind]) => kind !== "descendant"),
        old.reads,
        `${JSON.stringify(options)} reads`,
      );
    }
  }
});

test("Icicle none node and edge adapters remain inert", () => {
  const node = createNode();
  const canvas = createCanvas();
  renderIcicleNoneNode("none", node.node, canvas.canvas, true, {});
  legacyNodes.none.render.call(legacyPlot({}), node.node, canvas.canvas, true);
  renderIcicleNoneEdge("none", {}, canvas.canvas, true);
  legacyEdges.none.call({}, {}, canvas.canvas, true);
  assert.equal(
    containsIcicleNoneNode(node.node, { x: 0, y: 0 }, {}),
    false,
  );
  assert.equal(containsIcicleNoneEdge({}, { x: 0, y: 0 }, 2), false);
  assert.deepEqual(node.reads, []);
  assert.deepEqual(canvas.calls, []);
});

test("Icicle renderer entries stay split, registry-free, and import-safe", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/icicle-renderer-contracts.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/icicle-node-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/icicle-edge-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|icicle\.js|canvas\/|browser\//);
  assert.doesNotMatch(edges, /^\s*import\s/m);
  assert.doesNotMatch(
    `${contracts}${nodes}${edges}`,
    /\$jit|globalThis|document|window/,
  );
});
