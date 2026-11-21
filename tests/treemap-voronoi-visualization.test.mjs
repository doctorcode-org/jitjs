import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { nodePropertyPlotInterpolator, linearPlotInterpolator } from "../dist/graph/plot-interpolators.js";
import {
  createVoronoiTreemapDefaults,
  VoronoiTreemapVisualization,
} from "../dist/visualizations/treemap-voronoi.js";

const tree = {
  id: "root",
  name: "Root",
  data: { $area: 100 },
  children: [
    { id: "left", name: "Left", data: { $area: 40 } },
    { id: "right", name: "Right", data: { $area: 60 } },
  ],
};

function configuration(events, overrides = {}) {
  return {
    offset: 0,
    centroidType: "centroid",
    titleHeight: 13,
    levelsToShow: 0,
    animate: false,
    cushion: false,
    clearCanvas: true,
    withLabels: true,
    Node: {
      type: "polygon",
      overridable: true,
      alpha: 1,
      color: "#444444",
      lineWidth: 1,
      width: 0,
      height: 0,
      CanvasStyles: {},
    },
    Edge: {
      type: "none",
      overridable: true,
      alpha: 1,
      color: "#000000",
      lineWidth: 1,
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
    onBeforeCompute(node) { events.push(["before", node.id]); },
    onAfterCompute(node) { events.push(["after", node.id]); },
    onBeforePlotLine() {},
    onAfterPlotLine() {},
    onBeforePlotNode(node) { events.push(["before-node", node.id]); },
    onAfterPlotNode(node) { events.push(["after-node", node.id]); },
    onComplete() {},
    ...overrides,
  };
}

function createVisualization(overrides = {}, animation) {
  const events = [];
  const context = {
    arc() {}, beginPath() {}, closePath() {}, fill() {}, fillRect() {}, lineTo() {},
    moveTo() {}, restore() {}, rotate() {}, save() {}, scale() {}, stroke() {},
    strokeRect() {}, translate() {}, createRadialGradient() { return { addColorStop() {} }; },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineJoin: "", lineWidth: 1,
  };
  const visualization = new VoronoiTreemapVisualization({
    canvas: {
      clear() { events.push(["clear"]); },
      getCtx() { return context; },
      getSize() { return { width: 200, height: 100 }; },
    },
    labels: {
      clearLabels() {}, hideLabels() {}, hideLabel() {},
      plotLabel(_canvas, node) { events.push(["label", node.id]); },
    },
    config: configuration(events, overrides),
    renderNode(_type, node) { events.push(["render", node.id]); },
    renderEdge() {},
    interpolate(mode, node, properties, delta) {
      if (mode === "linear") linearPlotInterpolator(node, properties, delta);
      else if (mode === "node-property") nodePropertyPlotInterpolator(node, properties, delta);
    },
    ...(animation ? { animation } : {}),
  });
  visualization.loadJSON(tree);
  visualization.graph.getNode("left").histoPos = [undefined, { x: -30, y: 0 }];
  visualization.graph.getNode("right").histoPos = [undefined, { x: 30, y: 0 }];
  return { visualization, events };
}

test("Voronoi treemap façade computes polygons and traverses rendering", () => {
  const { visualization, events } = createVisualization();
  assert.equal(visualization.refresh(), true);
  assert.equal(visualization.graph.getNode("root").getData("vertices").length, 4);
  assert.equal(visualization.graph.getNode("left").getData("vertices").length >= 3, true);
  assert.deepEqual(events.filter(([kind]) => kind === "render").map(([, id]) => id).sort(), ["left", "right", "root"]);
  assert.equal(visualization.toJSON().id, "root");
});

test("Voronoi defaults and animated refresh include polygon interpolation", () => {
  assert.deepEqual(createVoronoiTreemapDefaults(), {
    centroidType: "weightedCentroid",
    Node: { type: "polygon", props: "node-property:width:height:vertices" },
    Label: { textBaseline: "middle", type: "Native" },
  });
  const animation = {
    calls: [],
    setOptions(options) { this.calls.push(options); return this; },
    start() { return this; },
  };
  const { visualization } = createVisualization({ animate: true }, animation);
  assert.equal(visualization.refresh(), true);
  assert.deepEqual(animation.calls[0].modes, ["linear", "node-property:width:height:vertices"]);
});

test("Voronoi façade statically selects only its own layout and no browser stack", async () => {
  const source = await readFile(new URL("../dist/visualizations/treemap-voronoi.js", import.meta.url), "utf8");
  assert.match(source, /layouts\/treemap\/voronoi\.js/);
  assert.doesNotMatch(source, /slice-and-dice|squarified|treemap\/strip|canvas\/canvas|browser\/dom|globalThis|\$jit/);
});
