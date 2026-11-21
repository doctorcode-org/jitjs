import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsTreemapRectangleNode,
  renderTreemapNoneNode,
  renderTreemapRectangleNode,
} from "../dist/visualizations/treemap-node-renderers.js";
import {
  containsTreemapNoneEdge,
  renderTreemapNoneEdge,
} from "../dist/visualizations/treemap-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.TM.Plot.NodeTypes();
const config = { offset: 2, titleHeight: 13, cushion: true };

function createCanvas() {
  const calls = [];
  const context = {
    createRadialGradient(...arguments_) {
      calls.push(["createRadialGradient", ...arguments_]);
      return {
        marker: "gradient",
        addColorStop(...stop) { calls.push(["addColorStop", ...stop]); },
      };
    },
    fillRect(...arguments_) { calls.push(["fillRect", ...arguments_]); },
    restore() { calls.push(["restore"]); },
    save() { calls.push(["save"]); },
    strokeRect(...arguments_) { calls.push(["strokeRect", ...arguments_]); },
  };
  Object.defineProperty(context, "fillStyle", {
    set(value) { calls.push(["fillStyle", value?.marker ?? value]); },
    get() { return undefined; },
  });
  Object.defineProperty(context, "strokeStyle", {
    set(value) { calls.push(["strokeStyle", value]); },
    get() { return undefined; },
  });
  return { calls, canvas: { getCtx: () => context } };
}

function createNode({ leaf = true, ignore = false, descendant = true } = {}) {
  const reads = [];
  const values = {
    width: 120,
    height: 80,
    border: "#abcdef",
    color: "#336699",
  };
  return {
    reads,
    leaf,
    node: {
      id: "node",
      ignore,
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
        return descendant;
      },
    },
  };
}

function createPlot(nodeResult, clickedNode = null) {
  return {
    config,
    nodeHelper: legacy.Graph.Plot.nodeHelper,
    viz: {
      clickedNode,
      leaf(node) {
        nodeResult.reads.push(["leaf"]);
        return nodeResult.leaf;
      },
    },
  };
}

function modernLeaf(nodeResult) {
  return () => {
    nodeResult.reads.push(["leaf"]);
    return nodeResult.leaf;
  };
}

test("Treemap rectangle rendering matches leaf, cushion, title, and border behavior", () => {
  for (const leaf of [true, false]) {
    const modern = createNode({ leaf });
    const old = createNode({ leaf });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    renderTreemapRectangleNode(
      "rectangle",
      modern.node,
      modernCanvas.canvas,
      true,
      config,
      modernLeaf(modern),
      null,
    );
    legacyNodes.rectangle.render.call(
      createPlot(old),
      old.node,
      oldCanvas.canvas,
      true,
    );
    assert.deepEqual(modern.reads, old.reads, `leaf=${leaf} reads`);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `leaf=${leaf} canvas`);
  }
});

test("Treemap rectangle hit testing preserves selected-root and ignore guards", () => {
  const cases = [
    { leaf: true, ignore: false, descendant: true, clicked: true },
    { leaf: false, ignore: false, descendant: true, clicked: false },
    { leaf: true, ignore: false, descendant: false, clicked: true },
    { leaf: true, ignore: true, descendant: true, clicked: false },
  ];
  for (const options of cases) {
    const modern = createNode(options);
    const old = createNode(options);
    const clicked = options.clicked ? { id: "selected" } : null;
    const position = { x: 0, y: 40 };
    const actual = containsTreemapRectangleNode(
      modern.node,
      position,
      config,
      modernLeaf(modern),
      clicked,
    );
    const expected = legacyNodes.rectangle.contains.call(
      createPlot(old, clicked),
      old.node,
      position,
    );
    assert.equal(actual, expected, JSON.stringify(options));
    assert.deepEqual(modern.reads, old.reads, `${JSON.stringify(options)} reads`);
  }
});

test("Treemap none adapters remain inert", () => {
  const node = createNode();
  const canvas = createCanvas();
  renderTreemapNoneNode("none", node.node, canvas.canvas, true, config);
  renderTreemapNoneEdge("none", {}, canvas.canvas, true);
  assert.equal(containsTreemapNoneEdge({}, { x: 0, y: 0 }, 1), false);
  assert.deepEqual(node.reads, []);
  assert.deepEqual(canvas.calls, []);
});

test("Treemap renderer entries stay split and import-safe", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(new URL("../dist/visualizations/treemap-renderer-contracts.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-node-renderers.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-edge-renderers.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|treemap\.js|canvas\/|browser\//);
  assert.doesNotMatch(edges, /^\s*import\s/m);
  assert.doesNotMatch(`${contracts}${nodes}${edges}`, /\$jit|globalThis|document|window/);
});
