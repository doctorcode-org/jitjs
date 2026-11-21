import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsForceDirectedCircleNode,
  containsForceDirectedEllipseNode,
  containsForceDirectedNoneNode,
  containsForceDirectedRectangleNode,
  containsForceDirectedSquareNode,
  containsForceDirectedStarNode,
  containsForceDirectedTriangleNode,
  renderForceDirectedCircleNode,
  renderForceDirectedEllipseNode,
  renderForceDirectedNoneNode,
  renderForceDirectedRectangleNode,
  renderForceDirectedSquareNode,
  renderForceDirectedStarNode,
  renderForceDirectedTriangleNode,
} from "../dist/visualizations/force-directed-node-renderers.js";
import {
  containsForceDirectedArrowEdge,
  containsForceDirectedLineEdge,
  containsForceDirectedNoneEdge,
  renderForceDirectedArrowEdge,
  renderForceDirectedLineEdge,
  renderForceDirectedNoneEdge,
} from "../dist/visualizations/force-directed-edge-renderers.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodes = new legacy.ForceDirected.Plot.NodeTypes();
const legacyEdges = new legacy.ForceDirected.Plot.EdgeTypes();
const legacyPlot = {
  nodeHelper: legacy.Graph.Plot.nodeHelper,
  edgeHelper: legacy.Graph.Plot.edgeHelper,
  edge: { epsilon: 2.5 },
};

const nodeAdapters = {
  circle: {
    render: renderForceDirectedCircleNode,
    contains: containsForceDirectedCircleNode,
  },
  ellipse: {
    render: renderForceDirectedEllipseNode,
    contains: containsForceDirectedEllipseNode,
  },
  none: {
    render: renderForceDirectedNoneNode,
    contains: containsForceDirectedNoneNode,
  },
  rectangle: {
    render: renderForceDirectedRectangleNode,
    contains: containsForceDirectedRectangleNode,
  },
  square: {
    render: renderForceDirectedSquareNode,
    contains: containsForceDirectedSquareNode,
  },
  star: {
    render: renderForceDirectedStarNode,
    contains: containsForceDirectedStarNode,
  },
  triangle: {
    render: renderForceDirectedTriangleNode,
    contains: containsForceDirectedTriangleNode,
  },
};

function createContext() {
  const calls = [];
  const record = (method, ...arguments_) => {
    calls.push([method, ...arguments_]);
  };
  return {
    calls,
    context: {
      arc(...arguments_) {
        record("arc", ...arguments_);
      },
      beginPath() {
        record("beginPath");
      },
      closePath() {
        record("closePath");
      },
      fill() {
        record("fill");
      },
      fillRect(...arguments_) {
        record("fillRect", ...arguments_);
      },
      lineTo(...arguments_) {
        record("lineTo", ...arguments_);
      },
      moveTo(...arguments_) {
        record("moveTo", ...arguments_);
      },
      restore() {
        record("restore");
      },
      rotate(...arguments_) {
        record("rotate", ...arguments_);
      },
      save() {
        record("save");
      },
      scale(...arguments_) {
        record("scale", ...arguments_);
      },
      stroke() {
        record("stroke");
      },
      strokeRect(...arguments_) {
        record("strokeRect", ...arguments_);
      },
      translate(...arguments_) {
        record("translate", ...arguments_);
      },
    },
  };
}

function createCanvas() {
  const result = createContext();
  return {
    calls: result.calls,
    canvas: {
      getCtx() {
        return result.context;
      },
    },
  };
}

function createNode(id, values, position) {
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
  if (direction !== undefined) {
    data.$direction = direction;
  }
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

function compareNodeRender(name) {
  const modernNode = createNode(
    "node",
    { dim: 6, height: 10, width: 18 },
    { x: 7, y: -3 },
  );
  const legacyNode = createNode(
    "node",
    { dim: 6, height: 10, width: 18 },
    { x: 7, y: -3 },
  );
  const modernCanvas = createCanvas();
  const legacyCanvas = createCanvas();

  nodeAdapters[name].render(name, modernNode.node, modernCanvas.canvas, true);
  legacyNodes[name].render.call(
    legacyPlot,
    legacyNode.node,
    legacyCanvas.canvas,
    true,
  );

  assert.deepEqual(modernNode.reads, legacyNode.reads, `${name} reads`);
  assert.deepEqual(modernCanvas.calls, legacyCanvas.calls, `${name} canvas`);
}

test("named ForceDirected node render adapters match JIT 2.0.1", () => {
  for (const name of Object.keys(nodeAdapters)) {
    compareNodeRender(name);
  }
});

test("named ForceDirected node contains adapters match JIT 2.0.1", () => {
  const positions = [
    { x: 7, y: -3 },
    { x: 12, y: -3 },
    { x: 12.01, y: -3 },
    { x: 4, y: 1 },
  ];

  for (const name of Object.keys(nodeAdapters)) {
    for (const position of positions) {
      const modernNode = createNode(
        "node",
        { dim: 6, height: 10, width: 18 },
        { x: 7, y: -3 },
      );
      const legacyNode = createNode(
        "node",
        { dim: 6, height: 10, width: 18 },
        { x: 7, y: -3 },
      );
      const actual = nodeAdapters[name].contains(modernNode.node, position);
      const expected = legacyNodes[name].contains.call(
        legacyPlot,
        legacyNode.node,
        position,
      );

      assert.equal(actual, expected, `${name}: ${JSON.stringify(position)}`);
      assert.deepEqual(modernNode.reads, legacyNode.reads, `${name} reads`);
    }
  }
});

test("line and arrow adapters match legacy rendering and hit testing", () => {
  const cases = [
    ["line", renderForceDirectedLineEdge, containsForceDirectedLineEdge],
    ["arrow", renderForceDirectedArrowEdge, containsForceDirectedArrowEdge],
  ];
  const positions = [
    { x: 4, y: 9.5 },
    { x: 4, y: 12.1 },
    { x: 20, y: 20 },
  ];

  for (const [name, render, contains] of cases) {
    const modernEdge = createEdge(["from", "to"]);
    const legacyEdge = createEdge(["from", "to"]);
    const modernCanvas = createCanvas();
    const legacyCanvas = createCanvas();

    render(name, modernEdge.edge, modernCanvas.canvas, true);
    legacyEdges[name].render.call(
      legacyPlot,
      legacyEdge.edge,
      legacyCanvas.canvas,
      true,
    );
    assert.deepEqual(modernCanvas.calls, legacyCanvas.calls, `${name} canvas`);
    assert.deepEqual(modernEdge.reads, legacyEdge.reads, `${name} reads`);
    assert.deepEqual(
      modernEdge.endpointReads,
      legacyEdge.endpointReads,
      `${name} endpoint reads`,
    );

    for (const position of positions) {
      const modernHitEdge = createEdge(["from", "to"]);
      const legacyHitEdge = createEdge(["from", "to"]);
      const actual = contains(modernHitEdge.edge, position, 2.5);
      const expected = legacyEdges[name].contains.call(
        legacyPlot,
        legacyHitEdge.edge,
        position,
      );
      assert.equal(actual, expected, `${name}: ${JSON.stringify(position)}`);
      assert.deepEqual(
        modernHitEdge.endpointReads,
        legacyHitEdge.endpointReads,
        `${name} hit reads`,
      );
    }
  }
});

test("arrow adapter preserves legacy direction and coercion semantics", () => {
  const directions = [
    undefined,
    ["from", "to"],
    ["to", "from"],
    ["to"],
    [1, "from"],
  ];

  for (const direction of directions) {
    const modernEdge = createEdge(direction);
    const legacyEdge = createEdge(direction);
    if (direction?.[0] === 1) {
      modernEdge.edge.nodeFrom.id = "1";
      legacyEdge.edge.nodeFrom.id = "1";
    }
    const modernCanvas = createCanvas();
    const legacyCanvas = createCanvas();

    renderForceDirectedArrowEdge(
      "arrow",
      modernEdge.edge,
      modernCanvas.canvas,
    );
    legacyEdges.arrow.render.call(
      legacyPlot,
      legacyEdge.edge,
      legacyCanvas.canvas,
    );

    assert.deepEqual(
      modernCanvas.calls,
      legacyCanvas.calls,
      JSON.stringify(direction),
    );
  }
});

test("none edge adapters stay inert", () => {
  const edge = createEdge(undefined);
  const canvas = createCanvas();

  renderForceDirectedNoneEdge("none", edge.edge, canvas.canvas, true);
  assert.equal(
    containsForceDirectedNoneEdge(edge.edge, { x: 0, y: 0 }, 100),
    false,
  );
  assert.deepEqual(canvas.calls, []);
  assert.deepEqual(edge.reads, []);
  assert.deepEqual(edge.endpointReads, { from: [], to: [] });
});

test("renderer modules are split, import-safe, and registry-free", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/force-directed-renderer-contracts.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/force-directed-node-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/force-directed-edge-renderers.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|force-directed\.js|canvas\/|browser\//);
  assert.match(edges, /graph\/rendering\/edge-shapes\.js/);
  assert.doesNotMatch(edges, /node-shapes|force-directed\.js|canvas\/|browser\//);
  assert.doesNotMatch(`${contracts}${nodes}${edges}`, /\$jit|globalThis|document|window/);
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

