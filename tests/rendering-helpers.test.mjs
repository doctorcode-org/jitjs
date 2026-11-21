import assert from "node:assert/strict";
import test from "node:test";

import {
  circle,
  containsCircle,
  containsEllipse,
  containsNone,
  containsRectangle,
  containsSquare,
  containsStar,
  containsTriangle,
  ellipse,
  none,
  rectangle,
  renderCircle,
  renderEllipse,
  renderNone,
  renderRectangle,
  renderSquare,
  renderStar,
  renderTriangle,
  square,
  star,
  triangle,
} from "../dist/graph/rendering/node-shapes.js";
import {
  arrow,
  containsArrow,
  containsHyperline,
  containsLine,
  hyperline,
  line,
  renderArrow,
  renderHyperline,
  renderLine,
} from "../dist/graph/rendering/edge-shapes.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacyPlot = loadLegacyNamespace().Graph.Plot;
const legacyNodes = legacyPlot.nodeHelper;
const legacyEdges = legacyPlot.edgeHelper;

function createContext() {
  const calls = [];
  const record = (method, ...arguments_) => {
    calls.push([method, ...arguments_]);
  };
  return {
    calls,
    context: {
      arc(...arguments_) {
        record("arc", ...arguments_);
      },
      beginPath() {
        record("beginPath");
      },
      closePath() {
        record("closePath");
      },
      fill() {
        record("fill");
      },
      fillRect(...arguments_) {
        record("fillRect", ...arguments_);
      },
      lineTo(...arguments_) {
        record("lineTo", ...arguments_);
      },
      moveTo(...arguments_) {
        record("moveTo", ...arguments_);
      },
      restore() {
        record("restore");
      },
      rotate(...arguments_) {
        record("rotate", ...arguments_);
      },
      save() {
        record("save");
      },
      scale(...arguments_) {
        record("scale", ...arguments_);
      },
      stroke() {
        record("stroke");
      },
      strokeRect(...arguments_) {
        record("strokeRect", ...arguments_);
      },
      translate(...arguments_) {
        record("translate", ...arguments_);
      },
    },
  };
}

function createCanvas() {
  const result = createContext();
  return {
    calls: result.calls,
    canvas: {
      getCtx() {
        return result.context;
      },
    },
  };
}

function compareRendering(modernRender, legacyRender, arguments_) {
  const modern = createCanvas();
  const old = createCanvas();
  modernRender(...arguments_, modern.canvas);
  legacyRender(...arguments_, old.canvas);
  assert.deepEqual(modern.calls, old.calls);
}

function hyperbolicPoint(x, y) {
  return {
    x,
    y,
    squaredNorm() {
      return this.x * this.x + this.y * this.y;
    },
  };
}

test("node rendering primitives match JIT 2.0.1 call-for-call", () => {
  compareRendering(renderCircle, legacyNodes.circle.render, [
    "fill",
    { x: 7, y: -3 },
    11,
  ]);
  compareRendering(renderEllipse, legacyNodes.ellipse.render, [
    "stroke",
    { x: 7, y: -3 },
    18,
    10,
  ]);
  compareRendering(renderEllipse, legacyNodes.ellipse.render, [
    "fill",
    { x: -4, y: 9 },
    8,
    20,
  ]);
  compareRendering(renderSquare, legacyNodes.square.render, [
    "fill",
    { x: 7, y: -3 },
    6,
  ]);
  compareRendering(renderRectangle, legacyNodes.rectangle.render, [
    "stroke",
    { x: 7, y: -3 },
    18,
    10,
  ]);
  compareRendering(renderTriangle, legacyNodes.triangle.render, [
    "fill",
    { x: 7, y: -3 },
    6,
  ]);
  compareRendering(renderStar, legacyNodes.star.render, [
    "stroke",
    { x: 7, y: -3 },
    6,
  ]);

  const modern = createCanvas();
  const old = createCanvas();
  renderNone("fill", { x: 1, y: 2 }, 3, modern.canvas);
  legacyNodes.none.render("fill", { x: 1, y: 2 }, 3, old.canvas);
  assert.deepEqual(modern.calls, old.calls);
});

test("node hit testing retains the legacy boundary approximations", () => {
  const center = { x: 4, y: -2 };
  const points = [
    { x: 4, y: -2 },
    { x: 9, y: -2 },
    { x: 9.01, y: -2 },
    { x: 1, y: 1 },
  ];

  for (const point of points) {
    assert.equal(
      containsCircle(center, point, 5),
      legacyNodes.circle.contains(center, point, 5),
    );
    assert.equal(
      containsEllipse(center, point, 12, 6),
      legacyNodes.ellipse.contains(center, point, 12, 6),
    );
    assert.equal(
      containsSquare(center, point, 5),
      legacyNodes.square.contains(center, point, 5),
    );
    assert.equal(
      containsRectangle(center, point, 12, 6),
      legacyNodes.rectangle.contains(center, point, 12, 6),
    );
    assert.equal(
      containsTriangle(center, point, 5),
      legacyNodes.triangle.contains(center, point, 5),
    );
    assert.equal(
      containsStar(center, point, 5),
      legacyNodes.star.contains(center, point, 5),
    );
  }
  assert.equal(containsNone(center, center, 10), false);
});

test("edge line and arrow rendering match both legacy directions", () => {
  const from = { x: -5, y: 2 };
  const to = { x: 13, y: 17 };
  compareRendering(renderLine, legacyEdges.line.render, [from, to]);
  compareRendering(renderArrow, legacyEdges.arrow.render, [
    from,
    to,
    8,
    false,
  ]);
  compareRendering(renderArrow, legacyEdges.arrow.render, [
    from,
    to,
    8,
    true,
  ]);
});

test("edge hit testing keeps the legacy bounding-box and vertical shortcuts", () => {
  const cases = [
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 5 }, 0],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 6 }, 1],
    [{ x: 2, y: 0 }, { x: 2.5, y: 10 }, { x: 2.25, y: 8 }, 1],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 12, y: 12 }, 5],
  ];

  for (const [from, to, position, epsilon] of cases) {
    const expected = legacyEdges.line.contains(from, to, position, epsilon);
    assert.equal(containsLine(from, to, position, epsilon), expected);
    assert.equal(containsArrow(from, to, position, epsilon), expected);
  }
  assert.equal(containsHyperline({}, {}, {}, 100), false);
});

test("hyperline rendering matches straight-line and circular-arc branches", () => {
  compareRendering(renderHyperline, legacyEdges.hyperline.render, [
    hyperbolicPoint(0.1, 0.1),
    hyperbolicPoint(0.3, 0.3),
    100,
  ]);
  compareRendering(renderHyperline, legacyEdges.hyperline.render, [
    hyperbolicPoint(0.2, 0),
    hyperbolicPoint(0, 0.2),
    100,
  ]);
});

test("shape exports are independent pairs rather than a global registry", () => {
  assert.strictEqual(none.render, renderNone);
  assert.strictEqual(circle.render, renderCircle);
  assert.strictEqual(ellipse.render, renderEllipse);
  assert.strictEqual(square.render, renderSquare);
  assert.strictEqual(rectangle.render, renderRectangle);
  assert.strictEqual(triangle.render, renderTriangle);
  assert.strictEqual(star.render, renderStar);
  assert.strictEqual(line.render, renderLine);
  assert.strictEqual(arrow.render, renderArrow);
  assert.strictEqual(hyperline.render, renderHyperline);
  assert.equal(Object.hasOwn(globalThis, "NodeHelper"), false);
  assert.equal(Object.hasOwn(globalThis, "EdgeHelper"), false);
});
