import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsArrow,
  containsCircle,
  containsEllipse,
  containsHyperline,
  containsLine,
  containsNone,
  containsRectangle,
  containsSquare,
  containsStar,
  containsTriangle,
} from "../dist/graph/hit-testing.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const plot = loadLegacyNamespace().Graph.Plot;

test("hit-testing is an isolated leaf module", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  const output = await readFile(
    new URL("../dist/graph/hit-testing.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});

test("node shape hit-testing matches JIT 2.0.1 edge cases", () => {
  const center = { x: 10, y: -4 };
  const cases = [
    ["none", containsNone, [center, center, 7]],
    ["circle", containsCircle, [center, { x: 13, y: 0 }, 5]],
    ["circle", containsCircle, [center, { x: 13.01, y: 0 }, 5]],
    ["circle", containsCircle, [center, { x: 7, y: -8 }, -5]],
    ["ellipse", containsEllipse, [center, { x: 15, y: -4 }, 10, 4]],
    ["ellipse", containsEllipse, [center, { x: 10, y: 2 }, 4, 12]],
    ["ellipse", containsEllipse, [center, { x: 15.1, y: -4 }, 10, 4]],
    ["square", containsSquare, [center, { x: 13, y: -7 }, 3]],
    ["square", containsSquare, [center, { x: 13.1, y: -7 }, 3]],
    ["rectangle", containsRectangle, [center, { x: 14, y: -2 }, 8, 4]],
    ["rectangle", containsRectangle, [center, { x: 14.1, y: -2 }, 8, 4]],
    ["triangle", containsTriangle, [center, { x: 13, y: 0 }, 5]],
    ["triangle", containsTriangle, [center, { x: 14, y: 0 }, 5]],
    ["star", containsStar, [center, { x: 13, y: 0 }, 5]],
    ["star", containsStar, [center, { x: 14, y: 0 }, 5]],
  ];

  for (const [legacyName, implementation, arguments_] of cases) {
    assert.equal(
      implementation(...arguments_),
      plot.nodeHelper[legacyName].contains(...arguments_),
      `${legacyName}: ${JSON.stringify(arguments_)}`,
    );
  }
});

test("line, arrow, and hyperline hit-testing retain legacy approximations", () => {
  const cases = [
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 5 }, 0],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 6 }, 1],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 11, y: 11 }, 100],
    [{ x: 3, y: -5 }, { x: 3, y: 9 }, { x: 3, y: 4 }, 0],
    [{ x: 3, y: -5 }, { x: 3, y: 9 }, { x: 3.1, y: 4 }, 2],
    [{ x: 10, y: 10 }, { x: 0, y: 0 }, { x: 2, y: 2.5 }, 0.5],
  ];

  for (const arguments_ of cases) {
    assert.equal(
      containsLine(...arguments_),
      plot.edgeHelper.line.contains(...arguments_),
    );
    assert.equal(
      containsArrow(...arguments_),
      plot.edgeHelper.arrow.contains(...arguments_),
    );
    assert.equal(
      containsHyperline(...arguments_),
      plot.edgeHelper.hyperline.contains(...arguments_),
    );
  }
});
