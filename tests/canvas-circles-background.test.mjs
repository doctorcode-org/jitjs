import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CirclesBackground } from "../dist/canvas/circles-background.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const LegacyCirclesBackground =
  loadLegacyNamespace().Canvas.Background.Circles;

function createTraceLayer() {
  const trace = [];
  const target = {
    beginPath() {
      trace.push(["beginPath"]);
    },
    arc(...args) {
      trace.push(["arc", ...args]);
    },
    stroke() {
      trace.push(["stroke"]);
    },
    closePath() {
      trace.push(["closePath"]);
    },
  };
  const context = new Proxy(target, {
    set(current, property, value) {
      trace.push(["set", String(property), value]);
      current[property] = value;
      return true;
    },
  });
  const layer = {
    get canvas() {
      trace.push(["canvas"]);
      return { id: "background" };
    },
    getCtx() {
      trace.push(["getCtx"]);
      return context;
    },
  };
  return { context, layer, trace };
}

function createPair(options) {
  const visualization = { id: "viz" };
  return {
    legacy: new LegacyCirclesBackground(visualization, options),
    modern: new CirclesBackground(visualization, options),
    visualization,
  };
}

function runPlot(background) {
  const fixture = createTraceLayer();
  const result = background.plot(fixture.layer);
  return { ...fixture, result };
}

function runResize(background, width = 640, height = 360) {
  const fixture = createTraceLayer();
  const result = background.resize(width, height, fixture.layer);
  return { ...fixture, result };
}

test("the module is import-safe and keeps the legacy defaults", () => {
  assert.equal(typeof globalThis.document, "undefined");

  const { legacy, modern, visualization } = createPair(undefined);
  assert.strictEqual(modern.viz, visualization);
  assert.deepEqual(
    normalizeRealm(modern.config),
    normalizeRealm(legacy.config),
  );
  assert.equal(modern.idSuffix, legacy.config.idSuffix);
});

test("configuration merging and cloning match the frozen implementation", () => {
  const options = {
    idSuffix: "-rings",
    levelDistance: 12.5,
    numberOfCircles: 3,
    CanvasStyles: {
      strokeStyle: "#4a90e2",
      lineWidth: 2,
      nested: { enabled: true },
    },
    offset: 9,
  };
  const { legacy, modern } = createPair(options);

  assert.deepEqual(
    normalizeRealm(modern.config),
    normalizeRealm(legacy.config),
  );
  assert.notStrictEqual(modern.config.CanvasStyles, options.CanvasStyles);
  assert.notStrictEqual(
    modern.config.CanvasStyles.nested,
    options.CanvasStyles.nested,
  );

  options.CanvasStyles.strokeStyle = "changed";
  options.CanvasStyles.nested.enabled = false;
  assert.equal(modern.config.CanvasStyles.strokeStyle, "#4a90e2");
  assert.equal(modern.config.CanvasStyles.nested.enabled, true);
  assert.equal(legacy.config.CanvasStyles.strokeStyle, "#4a90e2");
  assert.equal(legacy.config.CanvasStyles.nested.enabled, true);
});

test("plot applies styles and draws every ring in legacy order", () => {
  const { legacy, modern } = createPair({
    levelDistance: 37,
    numberOfCircles: 4,
    CanvasStyles: {
      strokeStyle: "rgba(1, 2, 3, .5)",
      lineWidth: 3,
      globalAlpha: 0.75,
    },
  });
  const oldRun = runPlot(legacy);
  const newRun = runPlot(modern);

  assert.strictEqual(oldRun.result, undefined);
  assert.strictEqual(newRun.result, undefined);
  assert.deepEqual(newRun.trace, oldRun.trace);
  assert.deepEqual(newRun.trace.slice(0, 5), [
    ["canvas"],
    ["getCtx"],
    ["set", "strokeStyle", "rgba(1, 2, 3, .5)"],
    ["set", "lineWidth", 3],
    ["set", "globalAlpha", 0.75],
  ]);
  assert.equal(
    newRun.trace.filter(([operation]) => operation === "arc").length,
    4,
  );
});

test("fractional, zero, and negative circle counts retain loop semantics", () => {
  for (const numberOfCircles of [2.75, 0, -3]) {
    const { legacy, modern } = createPair({
      numberOfCircles,
      levelDistance: -8,
    });
    assert.deepEqual(
      runPlot(modern).trace,
      runPlot(legacy).trace,
      `numberOfCircles=${numberOfCircles}`,
    );
  }
});

test("resize redraws through the same path and ignores dimensions", () => {
  const { legacy, modern } = createPair({
    numberOfCircles: 2,
    levelDistance: 15,
    CanvasStyles: { lineCap: "round" },
  });
  const oldRun = runResize(legacy, 901, 407);
  const newRun = runResize(modern, 901, 407);

  assert.strictEqual(oldRun.result, undefined);
  assert.strictEqual(newRun.result, undefined);
  assert.deepEqual(newRun.trace, oldRun.trace);
});

test("the emitted module has no registry, DOM, or ambient-global setup", () => {
  const source = readFileSync(
    new URL("../dist/canvas/circles-background.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Canvas\.Background|globalThis|window|document/);
  assert.match(source, /export class CirclesBackground/);
});
