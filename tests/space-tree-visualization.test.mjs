import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SpaceTreeVisualization } from "../dist/visualizations/space-tree.js";
import { SpaceTreeGeometry } from "../dist/visualizations/space-tree-geometry.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
setLegacyDocument({
  body: { appendChild() {} },
  createElement() {
    return {
      className: "",
      innerHTML: "",
      offsetHeight: 0,
      offsetWidth: 0,
      style: {},
    };
  },
});

const tree = {
  id: "root",
  name: "Root",
  data: { $width: 50, $height: 24 },
  children: [
    {
      id: "alpha",
      name: "Alpha",
      data: { $width: 34, $height: 18 },
      children: [
        {
          id: "alpha-one",
          name: "Alpha one",
          data: { $width: 28, $height: 16 },
        },
        {
          id: "alpha-two",
          name: "Alpha two",
          data: { $width: 42, $height: 20 },
        },
      ],
    },
    {
      id: "beta",
      name: "Beta",
      data: { $width: 60, $height: 30 },
    },
  ],
};

function configuration(events) {
  return {
    orientation: "top",
    subtreeOffset: 8,
    siblingOffset: 5,
    indent: 0,
    multitree: false,
    align: "center",
    levelDistance: 30,
    levelsToShow: 2,
    constrained: true,
    offsetX: 7,
    offsetY: -3,
    clearCanvas: true,
    withLabels: false,
    Node: {
      type: "rectangle",
      overridable: true,
      alpha: 1,
      color: "#123456",
      lineWidth: 1,
      width: 40,
      height: 20,
      align: "center",
      CanvasStyles: {},
    },
    Edge: {
      type: "line",
      overridable: true,
      alpha: 1,
      color: "#654321",
      lineWidth: 1,
      epsilon: 2,
      CanvasStyles: {},
    },
    Label: {
      type: "Native",
      size: 10,
      style: "",
      family: "sans-serif",
      textAlign: "center",
      textBaseline: "middle",
      color: "#000000",
    },
    onBeforeCompute(node) {
      events.push(["before-compute", node.id]);
    },
    onAfterCompute(node) {
      events.push(["after-compute", node.id]);
    },
    onBeforePlotLine(edge) {
      events.push(["before-edge", edge.nodeFrom.id, edge.nodeTo.id]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edge.nodeFrom.id, edge.nodeTo.id]);
    },
    onBeforePlotNode(node) {
      events.push(["before-node", node.id]);
    },
    onAfterPlotNode(node) {
      events.push(["after-node", node.id]);
    },
    onComplete() {},
  };
}

function context() {
  return {
    arc() {},
    beginPath() {},
    closePath() {},
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    measureText() {
      return { width: 0 };
    },
    moveTo() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    stroke() {},
    strokeRect() {},
    translate() {},
    fillStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
  };
}

function createModern(driver) {
  const events = [];
  const drawingContext = context();
  const canvas = {
    clear() {
      events.push(["clear"]);
    },
    getCtx() {
      return drawingContext;
    },
    getSize() {
      return { width: 420, height: 300 };
    },
  };
  const labels = {
    clearLabels(force) {
      events.push(["labels-clear", force]);
    },
    hideLabels(hidden) {
      events.push(["labels-hidden", hidden]);
    },
    hideLabel(node, show) {
      events.push(["hide-label", node.id, show]);
    },
    plotLabel(_canvas, node) {
      events.push(["label", node.id]);
    },
  };
  const visualization = new SpaceTreeVisualization({
    canvas,
    labels,
    config: configuration(events),
    ...(driver === undefined ? {} : { animation: driver }),
    getNodeDimensions(node, phase) {
      return {
        width: node.getData("width", phase),
        height: node.getData("height", phase),
      };
    },
    renderNode() {},
    renderEdge() {},
    interpolate() {},
  });
  return { visualization, events, drawingContext };
}

function createLegacy() {
  const events = [];
  const element = { addEventListener() {}, attachEvent() {} };
  const drawingContext = context();
  drawingContext.canvas = element;
  const canvas = {
    id: "legacy-st-canvas",
    clear() {
      events.push(["clear"]);
    },
    getCtx() {
      return drawingContext;
    },
    getElement() {
      return element;
    },
    getSize() {
      return { width: 420, height: 300 };
    },
  };
  const visualization = new legacy.ST({
    ...configuration(events),
    useCanvas: canvas,
    Events: { enable: false },
    Navigation: { enable: false },
    NodeStyles: { enable: false },
    Tips: { enable: false },
  });
  return { visualization, events, drawingContext };
}

function prepareLegacy(visualization) {
  visualization.graph.eachNode((node) => {
    node.exist = true;
    node.drawn = true;
    node.selected = false;
  });
}

function positions(graph, phase) {
  return normalizeRealm(Object.fromEntries(
    Object.keys(graph.nodes).sort().map((id) => {
      const position = graph.getNode(id).getPos(phase);
      return [id, { x: position.x, y: position.y }];
    }),
  ));
}

function plotTrace(events) {
  return events.filter(([kind]) =>
    [
      "clear",
      "before-edge",
      "after-edge",
      "before-node",
      "after-node",
    ].includes(kind),
  );
}

function selectionSnapshot(graph) {
  return normalizeRealm(Object.fromEntries(
    Object.keys(graph.nodes).sort().map((id) => {
      const node = graph.getNode(id);
      return [id, {
        selected: node.selected,
        exist: node.exist,
        drawn: node.drawn,
      }];
    }),
  ));
}

test("SpaceTree layout and graph plotting match ST 2.0.1", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  prepareLegacy(old.visualization);

  modern.visualization.compute("end", true);
  old.visualization.compute("end", true);
  assert.deepEqual(
    positions(modern.visualization.graph, "end"),
    positions(old.visualization.graph, "end"),
  );

  modern.events.length = 0;
  old.events.length = 0;
  modern.visualization.plot();
  old.visualization.plot();
  assert.deepEqual(plotTrace(modern.events), normalizeRealm(plotTrace(old.events)));
  assert.equal(modern.visualization.toJSON().id, "root");
});

test("SpaceTree path selection matches legacy sibling and ancestor visibility", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  prepareLegacy(old.visualization);
  for (const graph of [modern.visualization.graph, old.visualization.graph]) {
    graph.computeLevels("root");
    graph.eachNode((node) => {
      node.selected = true;
      node.exist = false;
      node.drawn = false;
    });
  }

  modern.visualization.selectPath(
    modern.visualization.graph.getNode("alpha-one"),
  );
  old.visualization.selectPath(old.visualization.graph.getNode("alpha-one"));
  assert.deepEqual(
    selectionSnapshot(modern.visualization.graph),
    selectionSnapshot(old.visualization.graph),
  );
});

test("synchronous SpaceTree selection centers all phases and runs callbacks", () => {
  const modern = createModern();
  modern.visualization.loadJSON(tree);
  modern.events.length = 0;
  let completed = false;
  modern.visualization.select("alpha", {
    offsetX: 9,
    offsetY: 4,
    onComplete() {
      completed = true;
    },
  });

  const selected = modern.visualization.graph.getNode("alpha");
  assert.strictEqual(modern.visualization.clickedNode, selected);
  assert.deepEqual(normalizeRealm(selected.pos.getc(true)), { x: -9, y: -4 });
  assert.deepEqual(normalizeRealm(selected.startPos.getc(true)), { x: -9, y: -4 });
  assert.deepEqual(normalizeRealm(selected.endPos.getc(true)), { x: -9, y: -4 });
  assert.equal(completed, true);
  assert.deepEqual(
    modern.events.filter(([kind]) => kind.endsWith("compute")),
    [["before-compute", "alpha"], ["after-compute", "alpha"]],
  );
});

test("orientation, alignment, and injected animation stay façade-owned", () => {
  const driver = {
    options: undefined,
    starts: 0,
    setOptions(options) {
      this.options = options;
      return this;
    },
    start() {
      this.starts += 1;
      return this;
    },
  };
  const modern = createModern(driver);
  modern.visualization.loadJSON(tree);
  modern.visualization.compute("current", true);
  modern.visualization.switchOrientation("left");
  assert.equal(modern.visualization.config.orientation, "left");
  modern.visualization.switchAlignment("right");
  assert.equal(modern.visualization.config.align, "right");
  modern.visualization.animate({ modes: ["linear"], hideLabels: true });
  assert.equal(driver.starts, 1);
  assert.deepEqual(driver.options.modes, ["linear"]);
});

test("scaled SpaceTree subtree transforms and root visibility match legacy", () => {
  const modern = createModern();
  const old = createLegacy();
  modern.visualization.loadJSON(tree);
  old.visualization.loadJSON(tree);
  prepareLegacy(old.visualization);
  modern.visualization.compute("current", true);
  old.visualization.compute("current", true);

  const modernTransforms = [];
  const oldTransforms = [];
  modern.drawingContext.translate = (x, y) => modernTransforms.push(["translate", x, y]);
  modern.drawingContext.scale = (x, y) => modernTransforms.push(["scale", x, y]);
  old.drawingContext.translate = (x, y) => oldTransforms.push(["translate", x, y]);
  old.drawingContext.scale = (x, y) => oldTransforms.push(["scale", x, y]);

  const modernGeometry = new SpaceTreeGeometry({
    graph: modern.visualization.graph,
    config: modern.visualization.config,
    labels: modern.visualization.labels,
  });
  const modernNode = modern.visualization.graph.getNode("alpha");
  const oldNode = old.visualization.graph.getNode("alpha");
  modern.visualization.plotSubtree(
    modernNode,
    modern.visualization.config,
    false,
    0.4,
    (node, scale) => modernGeometry.getScaledTreePosition(node, scale),
  );
  old.visualization.fx.plotSubtree(oldNode, old.visualization.controller, 0.4, false);

  assert.deepEqual(modernTransforms, normalizeRealm(oldTransforms));
  assert.equal(modernNode.drawn, oldNode.drawn);
});

test("SpaceTree entry excludes browser, labels, extras, and shape registries", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/space-tree.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    output,
    /canvas\/canvas|browser\/dom|graph\/labels\/(?:dom|html|native|svg)|node-shapes|edge-shapes|extras\//,
  );
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
