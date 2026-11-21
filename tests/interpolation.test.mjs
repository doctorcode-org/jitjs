import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import {
  interpolateColor,
  interpolateEdgeProperties,
  interpolateEdgeStyles,
  interpolateLabelProperties,
  interpolateLinearPosition,
  interpolateMoebiusPosition,
  interpolateNodeProperties,
  interpolateNodeStyles,
  interpolateNumber,
  interpolateNumberArray,
  interpolatePolarPosition,
  interpolatePolygon,
} from "../dist/graph/interpolation.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyInterpolator = legacy.Graph.Plot.Interpolator;

function legacyPropertyKernel(name, from, to, delta) {
  let current;
  const element = {
    read(_property, phase) {
      return phase === "start" ? from : to;
    },
    write(_property, value) {
      current = value;
    },
  };

  legacyInterpolator[name].call(
    legacyInterpolator,
    element,
    "value",
    delta,
    "read",
    "write",
  );
  return normalizeRealm(current);
}

function assertPointClose(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-12, `${message} (x)`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-12, `${message} (y)`);
}

function createPropertyElement(stores) {
  const state = structuredClone(stores);
  const read = (channel, property, phase = "current") =>
    state[channel][phase][property];
  const write = (channel, property, value, phase = "current") => {
    state[channel][phase][property] = value;
  };

  return {
    state,
    adjacencies: {},
    getData(property, phase) {
      return read("data", property, phase);
    },
    setData(property, value, phase) {
      write("data", property, value, phase);
    },
    getCanvasStyle(property, phase) {
      return read("canvas", property, phase);
    },
    setCanvasStyle(property, value, phase) {
      write("canvas", property, value, phase);
    },
    getLabelData(property, phase) {
      return read("label", property, phase);
    },
    setLabelData(property, value, phase) {
      write("label", property, value, phase);
    },
  };
}

function createStores(offset = 0) {
  return {
    data: {
      current: {},
      start: {
        border: "#102030",
        color: "#204060",
        width: 10 + offset,
        height: 20 + offset,
        dim: 5 + offset,
        alpha: 0.1 + offset,
        lineWidth: 1 + offset,
        angularWidth: 0.25 + offset,
        span: 2 + offset,
        valueArray: [1 + offset, [2 + offset, 4 + offset], -3 + offset],
        dimArray: [[1 + offset, 3 + offset], [5 + offset, 7 + offset]],
      },
      end: {
        border: "#90a0b0",
        color: "#e0c080",
        width: 30 + offset,
        height: 50 + offset,
        dim: 15 + offset,
        alpha: 0.9 + offset,
        lineWidth: 7 + offset,
        angularWidth: 1.25 + offset,
        span: 8 + offset,
        valueArray: [9 + offset, [6 + offset, 12 + offset], 5 + offset],
        dimArray: [[9 + offset, 11 + offset], [13 + offset, 15 + offset]],
      },
    },
    canvas: {
      current: {},
      start: {
        globalAlpha: 0.2 + offset,
        fillStyle: "#112233",
        strokeStyle: "#223344",
        lineWidth: 1 + offset,
        shadowBlur: 2 + offset,
        shadowColor: "#334455",
        shadowOffsetX: -4 + offset,
        shadowOffsetY: 5 + offset,
        miterLimit: 6 + offset,
      },
      end: {
        globalAlpha: 0.8 + offset,
        fillStyle: "#99aabb",
        strokeStyle: "#aabbcc",
        lineWidth: 9 + offset,
        shadowBlur: 10 + offset,
        shadowColor: "#bbccdd",
        shadowOffsetX: 12 + offset,
        shadowOffsetY: 13 + offset,
        miterLimit: 14 + offset,
      },
    },
    label: {
      current: {},
      start: { size: 10 + offset, color: "#123456" },
      end: { size: 22 + offset, color: "#abcdef" },
    },
  };
}

test("interpolation module imports without installing the legacy global", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("number, color, and chart-array kernels match JIT 2.0.1", () => {
  const arrayFrom = [1, [2, 4], -3];
  const arrayTo = [9, [6, 12], 5];

  for (const delta of [0, 0.125, 0.5, 1, 1.25]) {
    assert.equal(
      interpolateNumber(-7.5, 13.25, delta),
      legacyInterpolator.compute(-7.5, 13.25, delta),
    );
    assert.equal(
      interpolateColor("#102030", "#f0a050", delta),
      legacyPropertyKernel("color", "#102030", "#f0a050", delta),
    );
    assert.deepEqual(
      interpolateNumberArray(arrayFrom, arrayTo, delta),
      legacyPropertyKernel("array-number", arrayFrom, arrayTo, delta),
    );
  }
});

test("polygon interpolation matches Voronoi's alignment and padding semantics", () => {
  const rotated = [{ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 }];
  const rotatedTarget = [{ x: 0, y: 12 }, { x: -12, y: 0 }, { x: 12, y: 0 }];
  assert.deepEqual(interpolatePolygon(rotated, rotatedTarget, 0.25), [
    { x: 0, y: 10.5 }, { x: -10.5, y: 0 }, { x: 10.5, y: 0 },
  ]);
  assert.equal(rotated.offset, 1);

  const padded = [{ x: 1, y: 2 }];
  assert.deepEqual(interpolatePolygon(padded, [
    { x: 5, y: 6 }, { x: 7, y: 8 }, { x: 9, y: 10 },
  ], 0.25), [
    { x: 2, y: 3 }, { x: 2.5, y: 3.5 }, { x: 3, y: 4 },
  ]);
  assert.equal(padded.length, 3);
  assert.deepEqual(interpolatePolygon(0, [{ x: 4, y: 8 }, { x: -4, y: -8 }], 0.25), [
    { x: 1, y: 2 }, { x: -1, y: -2 },
  ]);
});

test("linear and polar position modes match legacy geometry", () => {
  for (const delta of [0, 0.2, 0.5, 1, 1.4]) {
    const modernLinear = {
      startPos: new Complex(-8, 3),
      endPos: new Complex(14, -5),
      pos: new Complex(90, 90),
    };
    const legacyLinear = {
      startPos: new legacy.Complex(-8, 3),
      endPos: new legacy.Complex(14, -5),
      pos: new legacy.Complex(90, 90),
    };
    interpolateLinearPosition(modernLinear, delta);
    legacyInterpolator.linear.call(legacyInterpolator, legacyLinear, [], delta);
    assertPointClose(modernLinear.pos, legacyLinear.pos, `linear delta ${delta}`);

    const modernPolar = {
      startPos: new Complex(),
      endPos: new Complex(),
      pos: new Complex(),
    };
    const legacyPolar = {
      startPos: new legacy.Complex(),
      endPos: new legacy.Complex(),
      pos: new legacy.Complex(),
    };
    modernPolar.startPos.setp(5.8, 3);
    modernPolar.endPos.setp(0.2, 11);
    legacyPolar.startPos.setp(5.8, 3);
    legacyPolar.endPos.setp(0.2, 11);
    interpolatePolarPosition(modernPolar, delta);
    legacyInterpolator.polar.call(legacyInterpolator, legacyPolar, [], delta);
    assertPointClose(modernPolar.pos, legacyPolar.pos, `polar delta ${delta}`);
  }
});

test("moebius position mode matches legacy and leaves its vector untouched", () => {
  for (const [vector, delta] of [
    [[0.25, -0.4], 0],
    [[0.25, -0.4], 0.35],
    [[0.25, -0.4], 1],
    [[0.8, 0.7], 1],
  ]) {
    const modern = {
      startPos: new Complex(0.2, -0.3),
      endPos: new Complex(),
      pos: new Complex(7, -9),
    };
    const legacyElement = {
      startPos: new legacy.Complex(0.2, -0.3),
      endPos: new legacy.Complex(),
      pos: new legacy.Complex(7, -9),
    };
    const modernVector = { x: vector[0], y: vector[1] };
    const legacyVector = new legacy.Complex(vector[0], vector[1]);
    const originalVector = { ...modernVector };

    interpolateMoebiusPosition(modern, delta, modernVector);
    legacyInterpolator.moebius.call(
      legacyInterpolator,
      legacyElement,
      [],
      delta,
      legacyVector,
    );

    assertPointClose(modern.pos, legacyElement.pos, `moebius delta ${delta}`);
    assert.deepEqual(modernVector, originalVector);
  }
});

test("node data, label, and Canvas-style property modes match legacy", () => {
  const delta = 0.375;
  const modern = createPropertyElement(createStores());
  const old = createPropertyElement(createStores());

  interpolateNodeProperties(modern, undefined, delta);
  legacyInterpolator["node-property"].call(
    legacyInterpolator,
    old,
    undefined,
    delta,
  );
  assert.deepEqual(modern.state.data.current, normalizeRealm(old.state.data.current));

  interpolateLabelProperties(modern, undefined, delta);
  legacyInterpolator["label-property"].call(
    legacyInterpolator,
    old,
    undefined,
    delta,
  );
  assert.deepEqual(
    modern.state.label.current,
    normalizeRealm(old.state.label.current),
  );

  interpolateNodeStyles(modern, undefined, delta);
  legacyInterpolator["node-style"].call(
    legacyInterpolator,
    old,
    undefined,
    delta,
  );
  assert.deepEqual(
    modern.state.canvas.current,
    normalizeRealm(old.state.canvas.current),
  );
});

test("edge data and Canvas-style modes visit every adjacency like legacy", () => {
  const delta = 0.6;
  const modernSource = { adjacencies: {} };
  const legacySource = { adjacencies: {} };

  for (const [id, offset] of [["left", 0], ["right", 2]]) {
    modernSource.adjacencies[id] = createPropertyElement(createStores(offset));
    legacySource.adjacencies[id] = createPropertyElement(createStores(offset));
  }

  interpolateEdgeProperties(modernSource, ["alpha", "color", "dimArray"], delta);
  legacyInterpolator["edge-property"].call(
    legacyInterpolator,
    legacySource,
    ["alpha", "color", "dimArray"],
    delta,
  );
  interpolateEdgeStyles(
    modernSource,
    ["lineWidth", "strokeStyle", "shadowColor"],
    delta,
  );
  legacyInterpolator["edge-style"].call(
    legacyInterpolator,
    legacySource,
    ["lineWidth", "strokeStyle", "shadowColor"],
    delta,
  );

  for (const id of Object.keys(modernSource.adjacencies)) {
    const modernState = modernSource.adjacencies[id].state;
    const legacyState = legacySource.adjacencies[id].state;
    assert.deepEqual(
      modernState.data.current,
      normalizeRealm(legacyState.data.current),
    );
    assert.deepEqual(
      modernState.canvas.current,
      normalizeRealm(legacyState.canvas.current),
    );
  }
});
