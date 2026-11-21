import assert from "node:assert/strict";
import test from "node:test";

import { createAreaChartOptions } from "../dist/options/area-chart.js";
import { createBarChartOptions } from "../dist/options/bar-chart.js";
import { createCanvasOptions } from "../dist/options/canvas.js";
import { createControllerOptions } from "../dist/options/controller.js";
import { createEdgeOptions } from "../dist/options/edge.js";
import { createEventsOptions } from "../dist/options/events.js";
import { createFxOptions } from "../dist/options/fx.js";
import { createLabelOptions } from "../dist/options/label.js";
import { createMarginOptions } from "../dist/options/margin.js";
import { createNavigationOptions } from "../dist/options/navigation.js";
import { createNodeStylesOptions } from "../dist/options/node-styles.js";
import { createNodeOptions } from "../dist/options/node.js";
import { createPieChartOptions } from "../dist/options/pie-chart.js";
import { createTipsOptions } from "../dist/options/tips.js";
import { createTreeOptions } from "../dist/options/tree.js";
import { loadLegacyBinding } from "./legacy-harness.mjs";

const legacyOptions = loadLegacyBinding("Options");

function comparable(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (key === "$extend") return undefined;
    return typeof item === "function" ? "[function]" : item;
  }));
}

const factories = [
  ["AreaChart", createAreaChartOptions],
  ["BarChart", createBarChartOptions],
  ["Canvas", createCanvasOptions],
  ["Controller", createControllerOptions],
  ["Edge", createEdgeOptions],
  ["Events", createEventsOptions],
  ["Fx", createFxOptions],
  ["Label", createLabelOptions],
  ["Margin", createMarginOptions],
  ["Navigation", createNavigationOptions],
  ["NodeStyles", createNodeStylesOptions],
  ["Node", createNodeOptions],
  ["PieChart", createPieChartOptions],
  ["Tips", createTipsOptions],
  ["Tree", createTreeOptions],
];

test("option factories import without recreating the legacy registry", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  for (const [, factory] of factories) {
    assert.equal("$extend" in factory(), false);
  }
});

test("all migrated option defaults match JIT 2.0.1 values", () => {
  for (const [name, factory] of factories) {
    assert.deepEqual(comparable(factory()), comparable(legacyOptions[name]), name);
  }
});

test("factory calls do not share mutable nested defaults", () => {
  const firstNode = createNodeOptions();
  const secondNode = createNodeOptions();
  firstNode.CanvasStyles.shadowBlur = 10;
  assert.deepEqual(secondNode.CanvasStyles, {});

  const firstCanvas = createCanvasOptions();
  const secondCanvas = createCanvasOptions();
  firstCanvas.Scene.Lighting.ambient[0] = 0;
  firstCanvas.Scene.Lighting.directional.direction.x = 0;
  assert.deepEqual(secondCanvas.Scene.Lighting.ambient, [1, 1, 1]);
  assert.equal(secondCanvas.Scene.Lighting.directional.direction.x, -100);

  const firstChart = createAreaChartOptions();
  const secondChart = createAreaChartOptions();
  firstChart.Tips.enable = true;
  assert.equal(secondChart.Tips.enable, false);
});

test("Fx uses the characterized Quart easing default", () => {
  const modern = createFxOptions();
  const old = legacyOptions.Fx;
  assert.equal(modern.fps, old.fps);
  assert.equal(modern.duration, old.duration);
  assert.equal(modern.clearCanvas, old.clearCanvas);
  for (const position of [0, 0.1, 0.5, 0.9, 1]) {
    assert.equal(modern.transition(position), old.transition(position));
  }
});
