import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bindSpaceTreeEdgeContains,
  bindSpaceTreeEdgeRenderer,
  bindSpaceTreeNodeContains,
  bindSpaceTreeNodeRenderer,
  getSpaceTreeAlignedPosition,
} from "../dist/visualizations/space-tree-renderer-contracts.js";
import {
  containsSpaceTreeCircleNode,
  containsSpaceTreeEllipseNode,
  containsSpaceTreeNoneNode,
  containsSpaceTreeRectangleNode,
  containsSpaceTreeSquareNode,
  renderSpaceTreeCircleNode,
  renderSpaceTreeEllipseNode,
  renderSpaceTreeNoneNode,
  renderSpaceTreeRectangleNode,
  renderSpaceTreeSquareNode,
} from "../dist/visualizations/space-tree-node-renderers.js";
import {
  containsSpaceTreeArrowEdge,
  containsSpaceTreeLineEdge,
  containsSpaceTreeNoneEdge,
  getSpaceTreeEdgeOrientation,
  getSpaceTreeEdgePosition,
  renderSpaceTreeArrowEdge,
  renderSpaceTreeBezierEdge,
  renderSpaceTreeLineEdge,
  renderSpaceTreeNoneEdge,
  renderSpaceTreeQuadraticBeginEdge,
  renderSpaceTreeQuadraticEndEdge,
} from "../dist/visualizations/space-tree-edge-renderers.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const orientations = ["top", "right", "bottom", "left"];
const alignments = ["left", "center", "right"];

const nodeAdapters = {
  none: {
    render: renderSpaceTreeNoneNode,
    contains: containsSpaceTreeNoneNode,
  },
  circle: {
    render: renderSpaceTreeCircleNode,
    contains: containsSpaceTreeCircleNode,
  },
  square: {
    render: renderSpaceTreeSquareNode,
    contains: containsSpaceTreeSquareNode,
  },
  ellipse: {
    render: renderSpaceTreeEllipseNode,
    contains: containsSpaceTreeEllipseNode,
  },
  rectangle: {
    render: renderSpaceTreeRectangleNode,
    contains: containsSpaceTreeRectangleNode,
  },
};

const edgeRenderers = {
  none: renderSpaceTreeNoneEdge,
  line: renderSpaceTreeLineEdge,
  arrow: renderSpaceTreeArrowEdge,
  "quadratic:begin": renderSpaceTreeQuadraticBeginEdge,
  "quadratic:end": renderSpaceTreeQuadraticEndEdge,
  bezier: renderSpaceTreeBezierEdge,
};

function createConfig(overrides = {}) {
  return {
    orientation: "top",
    multitree: false,
    Node: { align: "center" },
    Edge: { epsilon: 2.5 },
    ...overrides,
  };
}

function createLegacyPlot(config) {
  const viz = { config, labels: {} };
  viz.geom = new legacy.ST.Geom(viz);
  return new legacy.ST.Plot(viz, legacy.ST);
}

function createContext() {
  const calls = [];
  const record = (method, ...arguments_) => calls.push([method, ...arguments_]);
  return {
    calls,
    context: {
      arc(...arguments_) { record("arc", ...arguments_); },
      beginPath() { record("beginPath"); },
      bezierCurveTo(...arguments_) { record("bezierCurveTo", ...arguments_); },
      closePath() { record("closePath"); },
      fill() { record("fill"); },
      fillRect(...arguments_) { record("fillRect", ...arguments_); },
      lineTo(...arguments_) { record("lineTo", ...arguments_); },
      moveTo(...arguments_) { record("moveTo", ...arguments_); },
      quadraticCurveTo(...arguments_) { record("quadraticCurveTo", ...arguments_); },
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

function createNode(
  id,
  depth,
  values = { dim: 18, width: 30, height: 12 },
  position = { x: 17.5, y: -9.25 },
  data = {},
) {
  const reads = [];
  return {
    reads,
    node: {
      id,
      _depth: depth,
      data,
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { ...position };
        },
        add(offset) {
          reads.push(["add", offset.x, offset.y]);
          return {
            x: position.x + offset.x,
            y: position.y + offset.y,
          };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return values[property];
      },
    },
  };
}

function createEdge({
  direction = ["child", "parent"],
  fromDepth = 3,
  multitreeOrientation,
} = {}) {
  const fromData = {};
  if (multitreeOrientation !== undefined) {
    fromData.$orn = multitreeOrientation;
  }
  const from = createNode(
    "parent",
    fromDepth,
    { width: 32, height: 14 },
    { x: -23, y: 11 },
    fromData,
  );
  const to = createNode(
    "child",
    1,
    { width: 20, height: 10 },
    { x: 41, y: -17 },
  );
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
        return property === "dim" ? 13 : undefined;
      },
    },
  };
}

function plainPoint(value) {
  return normalizeRealm({ x: value.x, y: value.y });
}

test("SpaceTree alignment matches ST.Plot#getAlignedPos for every branch", () => {
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig({ orientation, Node: { align } });
      const old = createLegacyPlot(config);
      const position = { x: 21.25, y: -17.75 };
      assert.deepEqual(
        getSpaceTreeAlignedPosition(position, 31, 15, config),
        plainPoint(old.getAlignedPos(position, 31, 15)),
        `${orientation}/${align}`,
      );
    }
  }
});

test("SpaceTree node adapters render like JIT 2.0.1 for every alignment", () => {
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig({ orientation, Node: { align } });
      const oldPlot = createLegacyPlot(config);
      for (const [name, adapter] of Object.entries(nodeAdapters)) {
        const modern = createNode("node", 2);
        const old = createNode("node", 2);
        const modernCanvas = createCanvas();
        const oldCanvas = createCanvas();

        adapter.render(name, modern.node, modernCanvas.canvas, true, config);
        oldPlot.nodeTypes[name].render.call(
          oldPlot,
          old.node,
          oldCanvas.canvas,
          true,
        );
        assert.deepEqual(
          modernCanvas.calls,
          oldCanvas.calls,
          `${orientation}/${align}/${name} canvas`,
        );
        assert.deepEqual(
          modern.reads,
          old.reads,
          `${orientation}/${align}/${name} reads`,
        );
      }
    }
  }
});

test("SpaceTree node hit adapters preserve the legacy missing returns", () => {
  const positions = [
    { x: 17, y: -9 },
    { x: 50, y: 50 },
  ];
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig({ orientation, Node: { align } });
      const oldPlot = createLegacyPlot(config);
      for (const [name, adapter] of Object.entries(nodeAdapters)) {
        for (const position of positions) {
          const modern = createNode("node", 2);
          const old = createNode("node", 2);
          assert.equal(
            adapter.contains(modern.node, position, config),
            oldPlot.nodeTypes[name].contains.call(oldPlot, old.node, position),
            `${orientation}/${align}/${name}`,
          );
          assert.deepEqual(modern.reads, old.reads);
        }
      }
    }
  }
});

test("SpaceTree edge adapters match all legacy curves and orientations", () => {
  const configurations = [];
  for (const orientation of orientations) {
    for (const align of alignments) {
      configurations.push(createConfig({ orientation, Node: { align } }));
    }
  }
  configurations.push(
    createConfig({
      orientation: "top",
      multitree: true,
      Node: { align: "right" },
    }),
  );

  for (const config of configurations) {
    const oldPlot = createLegacyPlot(config);
    for (const [name, renderer] of Object.entries(edgeRenderers)) {
      const edgeOptions = config.multitree
        ? { multitreeOrientation: "left" }
        : undefined;
      const modern = createEdge(edgeOptions);
      const old = createEdge(edgeOptions);
      const modernCanvas = createCanvas();
      const oldCanvas = createCanvas();

      renderer(name, modern.edge, modernCanvas.canvas, true, config);
      const legacyType = oldPlot.edgeTypes[name];
      const legacyRender = typeof legacyType === "function"
        ? legacyType
        : legacyType.render;
      legacyRender.call(oldPlot, old.edge, oldCanvas.canvas, true);
      assert.deepEqual(
        modernCanvas.calls,
        oldCanvas.calls,
        `${config.orientation}/${config.Node.align}/${name}`,
      );
      assert.deepEqual(modern.reads, old.reads, `${name} edge reads`);
      assert.deepEqual(
        modern.endpointReads,
        old.endpointReads,
        `${name} endpoint reads`,
      );
    }
  }
});

test("SpaceTree edge hit tests and endpoint resolution match legacy", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 41, y: -17 },
    { x: 200, y: 100 },
  ];
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig({ orientation, Node: { align } });
      const oldPlot = createLegacyPlot(config);
      for (const [name, contains] of [
        ["line", containsSpaceTreeLineEdge],
        ["arrow", containsSpaceTreeArrowEdge],
      ]) {
        for (const position of points) {
          const modern = createEdge();
          const old = createEdge();
          assert.equal(
            contains(modern.edge, position, 2.5, config),
            oldPlot.edgeTypes[name].contains.call(oldPlot, old.edge, position),
            `${orientation}/${align}/${name}/${JSON.stringify(position)}`,
          );
          assert.deepEqual(modern.endpointReads, old.endpointReads);
        }
      }

      const modernNode = createNode("node", 0);
      const oldNode = createNode("node", 0);
      assert.deepEqual(
        getSpaceTreeEdgePosition(modernNode.node, "begin", orientation, config),
        plainPoint(oldPlot.viz.geom.getEdge(oldNode.node, "begin", orientation)),
      );
      assert.deepEqual(modernNode.reads, oldNode.reads);
    }
  }
});

test("SpaceTree multitree orientation and direction semantics match legacy", () => {
  for (const endpoint of ["from", "to", "neither"]) {
    const config = createConfig({ orientation: "bottom", multitree: true });
    const modern = createEdge();
    const old = createEdge();
    if (endpoint === "from") {
      modern.edge.nodeFrom.data.$orn = old.edge.nodeFrom.data.$orn = "left";
    } else if (endpoint === "to") {
      modern.edge.nodeTo.data.$orn = old.edge.nodeTo.data.$orn = "right";
    }
    const oldPlot = createLegacyPlot(config);
    assert.equal(
      getSpaceTreeEdgeOrientation(modern.edge, config),
      oldPlot.getOrientation(old.edge),
    );
  }

  for (const direction of [undefined, ["parent", "child"], ["child", "parent"]]) {
    const config = createConfig({ orientation: "right" });
    const oldPlot = createLegacyPlot(config);
    const modern = createEdge({ direction, fromDepth: 0 });
    const old = createEdge({ direction, fromDepth: 0 });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    renderSpaceTreeArrowEdge(
      "arrow",
      modern.edge,
      modernCanvas.canvas,
      false,
      config,
    );
    oldPlot.edgeTypes.arrow.render.call(
      oldPlot,
      old.edge,
      oldCanvas.canvas,
      false,
    );
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  }
});

test("SpaceTree explicit binders pass configuration without a registry", () => {
  const config = createConfig({ orientation: "left" });
  const node = createNode("node", 0);
  const edge = createEdge();
  const canvas = createCanvas();
  const calls = [];

  bindSpaceTreeNodeRenderer((...arguments_) => calls.push(["node", ...arguments_]), config)(
    "custom",
    node.node,
    canvas.canvas,
    true,
  );
  bindSpaceTreeEdgeRenderer((...arguments_) => calls.push(["edge", ...arguments_]), config)(
    "custom",
    edge.edge,
    canvas.canvas,
    false,
  );
  assert.equal(calls[0][5], config);
  assert.equal(calls[1][5], config);

  assert.equal(
    bindSpaceTreeNodeContains((_node, _point, received) => received === config, config)(
      node.node,
      { x: 0, y: 0 },
    ),
    true,
  );
  assert.equal(
    bindSpaceTreeEdgeContains(
      (_edge, _point, epsilon, received) => epsilon === 3 && received === config,
      config,
    )(edge.edge, { x: 0, y: 0 }, 3),
    true,
  );

  renderSpaceTreeNoneEdge("none", edge.edge, canvas.canvas, false, config);
  assert.equal(containsSpaceTreeNoneEdge(edge.edge, { x: 0, y: 0 }, 2, config), false);
});

test("SpaceTree renderer entries remain isolated and import-safe", async () => {
  const [contracts, nodes, edges] = await Promise.all([
    readFile(new URL("../dist/visualizations/space-tree-renderer-contracts.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/space-tree-node-renderers.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/space-tree-edge-renderers.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(contracts, /\$jit|globalThis|document|window/);
  assert.match(nodes, /graph\/rendering\/node-shapes\.js/);
  assert.doesNotMatch(nodes, /edge-shapes|space-tree\.js|canvas\/|browser\//);
  assert.match(edges, /graph\/rendering\/edge-shapes\.js/);
  assert.doesNotMatch(edges, /node-shapes|space-tree\.js|canvas\/|browser\//);
  assert.doesNotMatch(`${nodes}${edges}`, /\$jit|globalThis|document|window/);
});
