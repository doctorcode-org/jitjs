import assert from "node:assert/strict";
import test from "node:test";

import {
  barChartGroupedNodeType,
  barChartStackedNodeType,
  containsBarChartGroupedNode,
  containsBarChartStackedNode,
  renderBarChartGroupedNode,
  renderBarChartStackedNode,
} from "../dist/charts/bar-chart-renderers.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacyNodeTypes = new (loadLegacyNamespace().ST.Plot.NodeTypes)();

function contextFixture() {
  const events = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textBaseline: "",
    textAlign: "",
    createLinearGradient(...coordinates) {
      events.push(["gradient", ...coordinates]);
      return {
        addColorStop(offset, color) {
          events.push(["stop", offset, color]);
        },
      };
    },
    fillRect(...values) {
      events.push(["fillRect", ...values]);
    },
    strokeRect(...values) {
      events.push(["strokeRect", ...values]);
    },
    fillText(...values) {
      events.push(["fillText", ...values]);
    },
    save() {
      events.push(["save"]);
    },
    restore() {
      events.push(["restore"]);
    },
    translate(...values) {
      events.push(["translate", ...values]);
    },
    rotate(...values) {
      events.push(["rotate", ...values]);
    },
  };
  return { context, events, canvas: { getCtx: () => context } };
}

function nodeFixture(orientation, overrides = {}) {
  const data = {
    width: 44,
    height: 24,
    dimArray: [24, 12, 8],
    valueArray: [6, 3, 2],
    colorArray: ["#416D9C", "#70A35E", "#EBB056"],
    stringArray: ["first", "second", "third"],
    border: { name: "second", color: "#abcdef" },
    gradient: true,
    config: {
      orientation,
      labelOffset: 3,
      showAggregates(_name, value) {
        return `total:${value}`;
      },
      showLabels() {
        return true;
      },
      Label: {
        type: "Native",
        color: "#fefefe",
        style: "bold",
        size: 10,
        family: "sans-serif",
      },
    },
    ...overrides,
  };
  return {
    name: "row-a",
    pos: { getc: () => ({ x: 10, y: 20 }) },
    getData(name) {
      return data[name];
    },
  };
}

const rendererHost = {
  getAlignedPos(position, width, height) {
    return { x: position.x - width / 4, y: position.y - height / 4 };
  },
};

function renderTrace(renderer, node) {
  const fixture = contextFixture();
  renderer.call(rendererHost, node, fixture.canvas);
  return {
    events: fixture.events,
    state: {
      fillStyle:
        typeof fixture.context.fillStyle === "string"
          ? fixture.context.fillStyle
          : "[gradient]",
      strokeStyle: fixture.context.strokeStyle,
      lineWidth: fixture.context.lineWidth,
      font: fixture.context.font,
      textBaseline: fixture.context.textBaseline,
      textAlign: fixture.context.textAlign,
    },
  };
}

for (const orientation of ["horizontal", "vertical"]) {
  test(`stacked ${orientation} rendering matches BarChart 2.0.1`, () => {
    const node = nodeFixture(orientation);
    const modern = renderTrace(renderBarChartStackedNode, node);
    const old = renderTrace(
      legacyNodeTypes["barchart-stacked"].render,
      node,
    );
    assert.deepEqual(modern, normalizeRealm(old));
  });

  test(`grouped ${orientation} rendering matches BarChart 2.0.1`, () => {
    const node = nodeFixture(orientation);
    const modern = renderTrace(renderBarChartGroupedNode, node);
    const old = renderTrace(
      legacyNodeTypes["barchart-grouped"].render,
      node,
    );
    assert.deepEqual(modern, normalizeRealm(old));
  });
}

function hitTrace(contains, node) {
  const points = [];
  for (let x = -10; x <= 60; x += 7) {
    for (let y = -20; y <= 50; y += 7) {
      points.push(contains.call(rendererHost, node, { x, y }));
    }
  }
  return points;
}

for (const orientation of ["horizontal", "vertical"]) {
  test(`stacked ${orientation} hit testing matches BarChart 2.0.1`, () => {
    const node = nodeFixture(orientation, { gradient: false, border: false });
    assert.deepEqual(
      hitTrace(containsBarChartStackedNode, node),
      normalizeRealm(
        hitTrace(legacyNodeTypes["barchart-stacked"].contains, node),
      ),
    );
  });

  test(`grouped ${orientation} hit testing matches BarChart 2.0.1`, () => {
    const node = nodeFixture(orientation, { gradient: false, border: false });
    assert.deepEqual(
      hitTrace(containsBarChartGroupedNode, node),
      normalizeRealm(
        hitTrace(legacyNodeTypes["barchart-grouped"].contains, node),
      ),
    );
  });
}

test("direct node-type objects expose the legacy render and contains pair", () => {
  assert.equal(barChartStackedNodeType.render, renderBarChartStackedNode);
  assert.equal(barChartStackedNodeType.contains, containsBarChartStackedNode);
  assert.equal(barChartGroupedNodeType.render, renderBarChartGroupedNode);
  assert.equal(barChartGroupedNodeType.contains, containsBarChartGroupedNode);
});
