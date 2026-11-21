import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsRGraphCircleNode,
  containsRGraphEllipseNode,
  containsRGraphNoneNode,
  containsRGraphRectangleNode,
  containsRGraphSquareNode,
  containsRGraphStarNode,
  containsRGraphTriangleNode,
  renderRGraphCircleNode,
  renderRGraphEllipseNode,
  renderRGraphNoneNode,
  renderRGraphRectangleNode,
  renderRGraphSquareNode,
  renderRGraphStarNode,
  renderRGraphTriangleNode,
} from "../dist/visualizations/rgraph-node-renderers.js";
import {
  containsRGraphArrowEdge,
  containsRGraphLineEdge,
  containsRGraphNoneEdge,
  renderRGraphArrowEdge,
  renderRGraphLineEdge,
  renderRGraphNoneEdge,
} from "../dist/visualizations/rgraph-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.RGraph.Plot.NodeTypes();
const legacyEdges = new legacy.RGraph.Plot.EdgeTypes();
const legacyPlot = {
  nodeHelper: legacy.Graph.Plot.nodeHelper,
  edgeHelper: legacy.Graph.Plot.edgeHelper,
  edge: { epsilon: 2.5 },
};

const nodeAdapters = {
  circle: {
    render: renderRGraphCircleNode,
    contains: containsRGraphCircleNode,
  },
  ellipse: {
    render: renderRGraphEllipseNode,
    contains: containsRGraphEllipseNode,
  },
  none: {
    render: renderRGraphNoneNode,
    contains: containsRGraphNoneNode,
  },
  rectangle: {
    render: renderRGraphRectangleNode,
    contains: containsRGraphRectangleNode,
  },
  square: {
    render: renderRGraphSquareNode,
    contains: containsRGraphSquareNode,
  },
  star: {
    render: renderRGraphStarNode,
    contains: containsRGraphStarNode,
  },
  triangle: {
    render: renderRGraphTriangleNode,
    contains: containsRGraphTriangleNode,
  },
};

function createContext() {
  const calls = [];
  const record = (method, ...arguments_) => calls.push([method, ...arguments_]);
  return {
    calls,
    context: {
      arc(...arguments_) { record("arc", ...arguments_); },
      beginPath() { record("beginPath"); },
      closePath() { record("closePath"); },
      fill() { record("fill"); },
      fillRect(...arguments_) { record("fillRect", ...arguments_); },
      lineTo(...arguments_) { record("lineTo", ...arguments_); },
      moveTo(...arguments_) { record("moveTo", ...arguments_); },
      restore() { record("restore"); },
      rotate(...arguments_) { record("rotate", ...arguments_); },
      save() { record("save"); },
      scale(...arguments_) { record("scale", ...arguments_); },
      stroke() { record("stroke"); },
      strokeRect(...arguments_) { record("strokeRect", ...arguments_); },
      translate(...arguments_) { record("translate", ...arguments_); },
    },
  };
}

function createCanvas() {
  const result = createContext();
  return {
    calls: result.calls,
    canvas: { getCtx: () => result.context },
  };
}

function createNode(id, values, position = { x: 7, y: -3 }) {
  const reads = [];
  return {
    reads,
    node: {
      id,
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { ...position };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return values[property];
      },
    },
  };
}

function createEdge(direction) {
  const from = createNode("from", {}, { x: -5, y: 2 });
  const to = createNode("to", {}, { x: 13, y: 17 });
  const reads = [];
  const data = {};
  if (direction !== undefined) data.$direction = direction;
  return {
    reads,
    endpointReads: { from: from.reads, to: to.reads },
    edge: {
      nodeFrom: from.node,
      nodeTo: to.node,
      data,
      getData(property) {
        reads.push(["data", property]);
        return property === "dim" ? 8 : undefined;
      },
    },
  };
}

test("named RGraph node render adapters match JIT 2.0.1", () => {
  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    const modern = createNode("node", { dim: 6, height: 10, width: 18 });
    const old = createNode("node", { dim: 6, height: 10, width: 18 });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();

    adapter.render(name, modern.node, modernCanvas.canvas, true);
    legacyNodes[name].render.call(legacyPlot, old.node, oldCanvas.canvas, true);

    assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
  }
});

test("named RGraph node hit tests match every legacy boundary", () => {
  const positions = [
    { x: 7, y: -3 },
    { x: 13, y: -3 },
    { x: 13.01, y: -3 },
    { x: 16, y: 2 },
    { x: -20, y: 30 },
  ];

  for (const [name, adapter] of Object.entries(nodeAdapters)) {
    for (const position of positions) {
      const modern = createNode("node", { dim: 6, height: 10, width: 18 });
      const old = createNode("node", { dim: 6, height: 10, width: 18 });
      const actual = adapter.contains(modern.node, position);
      const expected = legacyNodes[name].contains.call(
        legacyPlot,
        old.node,
        position,
      );

      assert.equal(actual, expected, `${name}: ${JSON.stringify(position)}`);
      assert.deepEqual(modern.reads, old.reads, `${name} reads`);
    }
  }
});

test("RGraph line and arrow rendering and hit testing match legacy", () => {
  const cases = [
    ["line", renderRGraphLineEdge, containsRGraphLineEdge],
    ["arrow", renderRGraphArrowEdge, containsRGraphArrowEdge],
  ];
  const positions = [
    { x: 4, y: 9.5 },
    { x: 4, y: 12.1 },
    { x: 20, y: 20 },
  ];

  for (const [name, render, contains] of cases) {
    const modern = createEdge(["from", "to"]);
    const old = createEdge(["from", "to"]);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();

    render(name, modern.edge, modernCanvas.canvas, true);
    legacyEdges[name].render.call(legacyPlot, old.edge, oldCanvas.canvas, true);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${name} canvas`);
    assert.deepEqual(modern.reads, old.reads, `${name} data reads`);
    assert.deepEqual(modern.endpointReads, old.endpointReads, `${name} endpoints`);

    for (const position of positions) {
      const modernHit = createEdge(["from", "to"]);
      const oldHit = createEdge(["from", "to"]);
      assert.equal(
        contains(modernHit.edge, position, 2.5),
        legacyEdges[name].contains.call(legacyPlot, oldHit.edge, position),
        `${name}: ${JSON.stringify(position)}`,
      );
      assert.deepEqual(
        modernHit.endpointReads,
        oldHit.endpointReads,
        `${name} hit reads`,
      );
    }
  }
});

test("RGraph arrows preserve legacy direction and loose-id coercion", () => {
  const directions = [
    undefined,
    ["from", "to"],
    ["to", "from"],
    ["to"],
    [1, "from"],
    "to",
  ];

  for (const direction of directions) {
    const modern = createEdge(direction);
    const old = createEdge(direction);
    if (Array.isArray(direction) && direction[0] === 1) {
      modern.edge.nodeFrom.id = "1";
      old.edge.nodeFrom.id = "1";
    }
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();

    renderRGraphArrowEdge("arrow", modern.edge, modernCanvas.canvas);
    legacyEdges.arrow.render.call(legacyPlot, old.edge, oldCanvas.canvas);
    assert.deepEqual(
      modernCanvas.calls,
      oldCanvas.calls,
      JSON.stringify(direction),
    );
  }
});

test("RGraph none adapters stay inert", () => {
  const node = createNode("node", { dim: 6 });
  const edge = createEdge(undefined);
  const canvas = createCanvas();

  renderRGraphNoneNode("none", node.node, canvas.canvas, true);
  renderRGraphNoneEdge("none", edge.edge, canvas.canvas, true);
  assert.equal(containsRGraphNoneNode(node.node, { x: 0, y: 0 }), false);
  assert.equal(
    containsRGraphNoneEdge(edge.edge, { x: 0, y: 0 }, 100),
    false,
  );
  assert.deepEqual(canvas.calls, []);
  assert.deepEqual(node.reads, []);
  assert.deepEqual(edge.reads, []);
  assert.deepEqual(edge.endpointReads, { from: [], to: [] });
});

test("RGraph renderer entries remain split, registry-free, and import-safe", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/rgraph-renderer-contracts.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/rgraph-node-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/rgraph-edge-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|rgraph\.js|canvas\/|browser\//);
  assert.match(edges, /graph\/rendering\/edge-shapes\.js/);
  assert.doesNotMatch(edges, /node-shapes|rgraph\.js|canvas\/|browser\//);
  assert.doesNotMatch(
    `${contracts}${nodes}${edges}`,
    /\$jit|globalThis|document|window/,
  );
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});
