import assert from "node:assert/strict";
import test from "node:test";

import { placeGridChartHTMLLabel, placeGridChartSVGLabel } from "../dist/visualizations/grid-chart-dom-labels.js";
import { renderHeatMapNativeLabel } from "../dist/visualizations/heat-map-native-labels.js";
import { renderTimeGraphNativeLabel } from "../dist/visualizations/time-graph-native-labels.js";

function createNode() {
  return {
    id: "cell",
    name: "Cell",
    pos: { getc: () => ({ x: 10, y: -5 }) },
    getData(property) { return property === "width" ? 40 : 20; },
  };
}

test("grid HTML and SVG labels share top-left projection and HTML dimensions", () => {
  const node = createNode();
  const canvas = {
    translateOffsetX: 3,
    translateOffsetY: -2,
    scaleOffsetX: 1.5,
    scaleOffsetY: 2,
    getSize: () => ({ width: 200, height: 100 }),
  };
  const placed = [];
  const controller = { onPlaceLabel: (_element, value) => placed.push(value.id) };
  const html = { style: {} };
  placeGridChartHTMLLabel(html, node, canvas, controller);
  assert.deepEqual(html.style, { left: "118px", top: "38px", width: "60px", height: "40px" });

  const attributes = {};
  const svg = { setAttribute(name, value) { attributes[name] = value; } };
  placeGridChartSVGLabel(svg, node, canvas, controller);
  assert.deepEqual(attributes, { x: "118", y: "38" });
  assert.deepEqual(placed, ["cell", "cell"]);
});

test("HeatMap native names are optional while TimeGraph names are unconditional", () => {
  const calls = [];
  const canvas = { getCtx: () => ({ fillText: (...args) => calls.push(args) }) };
  const node = createNode();
  renderHeatMapNativeLabel(canvas, node, { showNodeNames: false });
  assert.deepEqual(calls, []);
  renderHeatMapNativeLabel(canvas, node, { showNodeNames: true });
  renderTimeGraphNativeLabel(canvas, node);
  assert.deepEqual(calls, [["Cell", 30, 5], ["Cell", 30, 5]]);
});
