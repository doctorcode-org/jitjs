import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsPieChartStackedNode,
  pieChartStackedNodeRenderer,
  pieChartStackedNodeType,
  renderPieChartStackedNode,
} from "../dist/charts/pie-chart-renderers.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodeTypes = new legacy.Sunburst.Plot.NodeTypes();

function createContext() {
  const calls = [];
  const state = {};
  const context = {
    createRadialGradient(...coordinates) {
      calls.push(["createRadialGradient", ...coordinates]);
      return {
        marker: "gradient",
        addColorStop(...arguments_) {
          calls.push(["addColorStop", ...arguments_]);
        },
      };
    },
    beginPath() { calls.push(["beginPath"]); },
    arc(...arguments_) { calls.push(["arc", ...arguments_]); },
    closePath() { calls.push(["closePath"]); },
    fill() { calls.push(["fill"]); },
    stroke() { calls.push(["stroke"]); },
    fillText(...arguments_) { calls.push(["fillText", ...arguments_]); },
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
  };
  for (const property of [
    "fillStyle",
    "strokeStyle",
    "globalCompositeOperation",
    "lineWidth",
    "font",
    "textBaseline",
    "textAlign",
  ]) {
    Object.defineProperty(context, property, {
      configurable: true,
      get() { return state[property]; },
      set(value) {
        state[property] = value;
        calls.push([property, value?.marker ?? value]);
      },
    });
  }
  return { calls, state, canvas: { getCtx: () => context } };
}

function createNode(overrides = {}) {
  const reads = [];
  const values = {
    dimArray: [12, 0, 18, -3, 9],
    valueArray: [6, 2, 8, 4, 5],
    colorArray: ["#336699", "#99cc33", "#cc6633"],
    stringArray: ["first", "second", "third", "fourth", "fifth"],
    span: 1.2,
    gradient: true,
    border: { name: "third", color: "#abcdef" },
    normalizedDim: 0.55,
    config: {
      sliceOffset: 4,
      labelOffset: 3,
      showLabels: true,
      resizeLabels: 7,
      Label: {
        type: "Native",
        color: "#fefefe",
        style: "bold",
        size: 14,
        family: "sans-serif",
      },
    },
    ...overrides,
  };
  const position = {
    theta: 0.6,
    rho: 0,
    getp(simple) {
      reads.push(["getp", simple]);
      return { theta: this.theta, rho: this.rho };
    },
  };
  return {
    reads,
    node: {
      name: "row-a",
      pos: position,
      _depth: 2,
      getData(property) {
        reads.push(["data", property]);
        return values[property];
      },
    },
  };
}

const legacyHost = {
  nodeTypes: legacyNodeTypes,
  config: { levelDistance: 45 },
};
const modernHost = {
  ...legacyHost,
  angleContains(node, position) {
    return legacyNodeTypes.none.anglecontains.call(this, node, position);
  },
};

function renderTrace(renderer, host, overrides) {
  const fixture = createContext();
  const node = createNode(overrides);
  renderer.call(host, node.node, fixture.canvas);
  return { calls: fixture.calls, reads: node.reads };
}

test("PieChart stacked rendering matches JIT 2.0.1 with gradients, border, and labels", () => {
  const modern = renderTrace(renderPieChartStackedNode, modernHost);
  const old = renderTrace(
    legacyNodeTypes["piechart-stacked"].render,
    legacyHost,
  );
  assert.deepEqual(modern, normalizeRealm(old));
});

test("PieChart stacked rendering matches without optional visual branches", () => {
  const cases = [
    {
      gradient: false,
      border: false,
      config: {
        sliceOffset: 0,
        labelOffset: 8,
        showLabels: false,
        resizeLabels: false,
        Label: { type: "Native", color: "#000", style: "", size: 10, family: "serif" },
      },
    },
    {
      gradient: false,
      border: false,
      config: {
        sliceOffset: 5,
        labelOffset: 2,
        showLabels: true,
        resizeLabels: false,
        Label: { type: "HTML", color: "#000", style: "italic", size: 11, family: "serif" },
      },
    },
  ];
  for (const overrides of cases) {
    assert.deepEqual(
      renderTrace(renderPieChartStackedNode, modernHost, overrides),
      normalizeRealm(renderTrace(
        legacyNodeTypes["piechart-stacked"].render,
        legacyHost,
        overrides,
      )),
    );
  }
});

test("PieChart stacked hit testing matches angular and radial boundaries", () => {
  const positions = [];
  for (const radius of [0, 3.999, 4, 10, 16, 20, 34, 42.999, 43, 94, 95]) {
    for (const theta of [0, 0.001, 0.6, 1.199, 1.2, 2.5]) {
      positions.push({ x: Math.cos(theta) * radius, y: Math.sin(theta) * radius });
    }
  }
  for (const position of positions) {
    const modern = createNode();
    const old = createNode();
    const modernResult = containsPieChartStackedNode.call(
      modernHost,
      modern.node,
      position,
    );
    const oldResult = legacyNodeTypes["piechart-stacked"].contains.call(
      legacyHost,
      old.node,
      position,
    );
    assert.deepEqual(modernResult, normalizeRealm(oldResult));
    assert.deepEqual(modern.reads, old.reads);
  }
});

test("PieChart direct node renderer exports retain the render/contains pair", () => {
  assert.equal(pieChartStackedNodeType.render, renderPieChartStackedNode);
  assert.equal(pieChartStackedNodeType.contains, containsPieChartStackedNode);
  assert.equal(pieChartStackedNodeRenderer, pieChartStackedNodeType);
});

test("PieChart renderer output has no registry mutation", async () => {
  const source = await readFile(
    new URL("../dist/charts/pie-chart-renderers.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\$jit|globalThis|window\.|\.implement\(/);
  assert.doesNotMatch(source, /charts\/pie-chart\.js/);
});
