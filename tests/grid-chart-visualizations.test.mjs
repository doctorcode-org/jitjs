import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { HeatMapVisualization, createHeatMapDefaults } from "../dist/visualizations/heat-map.js";
import { TimeGraphVisualization, createTimeGraphDefaults } from "../dist/visualizations/time-graph.js";
import { renderGridChartLineEdge, renderGridChartRectangleNode } from "../dist/visualizations/grid-chart-renderers.js";

const json = [
  {
    id: "a",
    name: "A",
    data: { $legendX: "x1", $legendY: "y1" },
    adjacencies: [{ nodeTo: "b", data: {} }],
  },
  {
    id: "b",
    name: "B",
    data: { $legendX: "x2", $legendY: "y1" },
    adjacencies: [],
  },
];

function createVisualization(Visualization) {
  const events = [];
  const context = {
    save: () => events.push(["save"]),
    restore: () => events.push(["restore"]),
    fillRect: (...args) => events.push(["fillRect", ...args]),
    beginPath: () => events.push(["beginPath"]),
    moveTo: (...args) => events.push(["moveTo", ...args]),
    lineTo: (...args) => events.push(["lineTo", ...args]),
    stroke: () => events.push(["stroke"]),
    lineWidth: 0,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
  };
  const canvas = {
    getCtx: () => context,
    clear: () => events.push(["clear"]),
    getSize: () => ({ width: 200, height: 100 }),
  };
  const config = {
    ...createTimeGraphDefaults(),
    Margin: { top: 0, right: 0, bottom: 0, left: 0 },
    clearCanvas: true,
    withLabels: true,
    Node: {
      overridable: true,
      type: "rectangle",
      width: 1,
      height: 1,
      lineWidth: 1,
      color: "#123456",
      alpha: 1,
      CanvasStyles: {},
    },
    Edge: {
      overridable: true,
      type: "line",
      lineWidth: 1,
      color: "#654321",
      alpha: 1,
      CanvasStyles: {},
    },
    Label: {},
    onBeforeCompute: () => events.push(["before-compute"]),
    onAfterCompute: () => events.push(["after-compute"]),
    onBeforePlotLine: () => events.push(["before-edge"]),
    onAfterPlotLine: () => events.push(["after-edge"]),
    onBeforePlotNode: (node) => events.push(["before-node", node.id]),
    onAfterPlotNode: (node) => events.push(["after-node", node.id]),
  };
  const labels = {
    clearLabels: (force) => events.push(["labels-clear", force]),
    plotLabel: (_canvas, node) => events.push(["label", node.id]),
    hideLabel: (node, show) => events.push(["label-hide", node.id, show]),
  };
  const visualization = new Visualization({
    canvas,
    config,
    labels,
    renderNode(type, node, target, options) {
      assert.equal(type, "rectangle");
      renderGridChartRectangleNode(node, target, options);
    },
    renderEdge(type, edge, target) {
      assert.equal(type, "line");
      renderGridChartLineEdge(edge, target);
    },
  });
  return { visualization, events };
}

test("grid defaults retain HeatMap and TimeGraph source values", () => {
  const heat = createHeatMapDefaults();
  const time = createTimeGraphDefaults();
  assert.equal(heat.showNodeNames, false);
  assert.deepEqual(heat.colors, ["#416D9C", "#70A35E", "#EBB056", "#C74243", "#83548B", "#909291", "#557EAA"]);
  assert.deepEqual(time.Node, { overridable: true, color: "rgba(0, 0, 0, 0)", type: "rectangle" });
  assert.deepEqual(time.Label, { textAlign: "center", textBaseline: "middle" });
});

for (const [name, Visualization] of [["HeatMap", HeatMapVisualization], ["TimeGraph", TimeGraphVisualization]]) {
  test(`${name} façade loads, computes, and plots grid cells`, () => {
    const { visualization, events } = createVisualization(Visualization);
    assert.throws(() => visualization.refresh(), /No graph data has been loaded/);
    visualization.loadJSON(json);
    visualization.refresh();
    assert.deepEqual(
      { x: visualization.graph.getNode("a").pos.x, y: visualization.graph.getNode("a").pos.y },
      { x: -100, y: -50 },
    );
    assert.equal(visualization.graph.getNode("a").getData("width"), 100);
    assert.equal(visualization.graph.getNode("a").getData("height"), 100);
    assert.equal(events.filter(([kind]) => kind === "fillRect").length, 2);
    assert.ok(events.some(([kind]) => kind === "before-edge"));
    assert.equal(events.filter(([kind]) => kind === "label").length, 2);
  });
}

test("HeatMap exposes end-position recomputation while TimeGraph retains its smaller façade", () => {
  const heat = createVisualization(HeatMapVisualization).visualization;
  heat.loadJSON(json);
  heat.reposition();
  assert.deepEqual({ x: heat.graph.getNode("b").endPos.x, y: heat.graph.getNode("b").endPos.y }, { x: 0, y: -50 });
  const time = createVisualization(TimeGraphVisualization).visualization;
  assert.equal(typeof time.reposition, "undefined");
});

test("grid visualization entries do not pull DOM labels, browser Canvas, or extras", async () => {
  for (const entry of ["heat-map", "time-graph"]) {
    const output = await readFile(new URL(`../dist/visualizations/${entry}.js`, import.meta.url), "utf8");
    assert.doesNotMatch(output, /browser\/dom|canvas\/canvas|grid-chart-(?:html|svg)-labels|extras\//);
    assert.doesNotMatch(output, /\b(?:window|document)\b|\$jit/);
  }
});
