import assert from "node:assert/strict";
import test from "node:test";

import {
  areaChartStackedNodeRenderer,
  areaChartStackedNodeType,
  containsAreaChartStackedNode,
  renderAreaChartStackedNode,
} from "../dist/charts/area-chart-renderers.js";
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
    beginPath() {
      events.push(["beginPath"]);
    },
    moveTo(...values) {
      events.push(["moveTo", ...values]);
    },
    lineTo(...values) {
      events.push(["lineTo", ...values]);
    },
    fill() {
      events.push(["fill"]);
    },
    stroke() {
      events.push(["stroke"]);
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
  };
  return { context, events, canvas: { getCtx: () => context } };
}

function nodeFixture(overrides = {}) {
  const data = {
    width: 72,
    height: 47,
    dimArray: [
      [18, 12],
      [0, 8],
      [29, 17],
    ],
    valueArray: [
      [6, 4],
      [0, 3],
      [9, 7],
    ],
    colorArray: ["#416D9C", "#70A35E", "#EBB056"],
    stringArray: ["first", "second", "third"],
    border: { name: "third", index: 0 },
    gradient: true,
    prev: "previous-row",
    config: {
      labelOffset: 3,
      showAggregates(_name, left, right, _node, accumulated) {
        return `total:${left}:${right}:${accumulated}`;
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
    id: "row-a",
    name: "row-a",
    pos: { getc: () => ({ x: 10, y: 20 }) },
    getData(name) {
      return data[name];
    },
  };
}

const rendererHost = {
  getAlignedPos(position, width, height) {
    return { x: position.x - width / 4, y: position.y + height / 5 };
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

for (const scenario of [
  ["gradient, border, and native labels", {}],
  ["flat fill without border", { gradient: false, border: false }],
  ["HTML labels and no previous point", {
    prev: false,
    config: {
      labelOffset: 3,
      showAggregates: () => true,
      showLabels: () => true,
      Label: {
        type: "HTML",
        color: "#fefefe",
        style: "bold",
        size: 10,
        family: "sans-serif",
      },
    },
  }],
]) {
  test(`AreaChart renderer matches 2.0.1 for ${scenario[0]}`, () => {
    const node = nodeFixture(scenario[1]);
    const modern = renderTrace(renderAreaChartStackedNode, node);
    const old = renderTrace(
      legacyNodeTypes["areachart-stacked"].render,
      node,
    );
    assert.deepEqual(modern, normalizeRealm(old));
  });
}

function hitTrace(contains, node) {
  const points = [];
  for (let x = -20; x <= 100; x += 5) {
    for (let y = -50; y <= 80; y += 5) {
      points.push(contains.call(rendererHost, node, { x, y }));
    }
  }
  return points;
}

test("AreaChart stacked hit testing matches 2.0.1 over a dense point grid", () => {
  const node = nodeFixture({ gradient: false, border: false });
  assert.deepEqual(
    hitTrace(containsAreaChartStackedNode, node),
    normalizeRealm(
      hitTrace(legacyNodeTypes["areachart-stacked"].contains, node),
    ),
  );
});

test("AreaChart direct node-type exports expose the legacy method pair", () => {
  assert.equal(areaChartStackedNodeType.render, renderAreaChartStackedNode);
  assert.equal(areaChartStackedNodeType.contains, containsAreaChartStackedNode);
  assert.equal(areaChartStackedNodeRenderer, areaChartStackedNodeType);
});
