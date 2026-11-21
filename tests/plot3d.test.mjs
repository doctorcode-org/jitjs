import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Matrix4 } from "../dist/geometry/matrix4.js";
import { Vector3 } from "../dist/geometry/vector3.js";
import {
  interpolate3DLinear,
  plot3DEdge,
  plot3DElement,
  plot3DNode,
} from "../dist/graph/plot3d.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyGlobal,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
setLegacyGlobal("Matrix4", Matrix4);
setLegacyGlobal("Vector3", Vector3);

function createPosition(x, y, z) {
  return {
    x,
    y,
    z,
    getc() { return { x: this.x, y: this.y, z: this.z }; },
    setc(nextX, nextY, nextZ) {
      this.x = nextX;
      this.y = nextY;
      this.z = nextZ;
    },
  };
}

test("Plot3D linear interpolation matches the legacy three-axis interpolator", () => {
  const modern = {
    startPos: createPosition(2, -5, 8),
    endPos: createPosition(10, 7, -4),
    pos: createPosition(0, 0, 0),
  };
  const old = {
    startPos: createPosition(2, -5, 8),
    endPos: createPosition(10, 7, -4),
    pos: createPosition(0, 0, 0),
  };
  const compute = (from, to, delta) => from + (to - from) * delta;
  interpolate3DLinear(modern, [], 0.35, compute);
  legacy.Graph.Plot3D.Interpolator.linear.call(
    { compute },
    old,
    [],
    0.35,
  );
  assert.deepEqual(modern.pos.getc(true), normalizeRealm(old.pos.getc(true)));
});

function createGeometry() {
  const geometry = {
    updates: 0,
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    faces: [
      { a: 0, b: 1, c: 4, normal: { x: 0, y: -1, z: 0 } },
      { a: 0, b: 1, c: 2, d: 3, normal: { x: 0, y: 0, z: 1 } },
    ],
    matrix: Matrix4.translationMatrix(2, -3, 4),
    update() { this.updates += 1; },
  };
  return geometry;
}

function createElement(overrides = {}) {
  const data = {
    type: "cube",
    color: "#336699",
    alpha: 0.6,
    ...overrides,
  };
  return {
    geometry: createGeometry(),
    getData(property) { return data[property]; },
  };
}

function createCanvas() {
  const events = [];
  let nextBuffer = 0;
  const context = {
    ARRAY_BUFFER: "ARRAY_BUFFER",
    ELEMENT_ARRAY_BUFFER: "ELEMENT_ARRAY_BUFFER",
    STATIC_DRAW: "STATIC_DRAW",
    FLOAT: "FLOAT",
    TRIANGLES: "TRIANGLES",
    UNSIGNED_SHORT: "UNSIGNED_SHORT",
    createBuffer() {
      const buffer = { id: ++nextBuffer };
      events.push(["createBuffer", buffer.id]);
      return buffer;
    },
    bindBuffer(target, buffer) {
      events.push(["bindBuffer", target, buffer?.id]);
    },
    bufferData(target, data, usage) {
      events.push(["bufferData", target, data.constructor.name, [...data], usage]);
    },
    uniformMatrix4fv(location, transpose, value) {
      events.push(["uniformMatrix4fv", location, transpose, [...value]]);
    },
    uniform4f(...values) { events.push(["uniform4f", ...values]); },
    uniform1i(...values) { events.push(["uniform1i", ...values]); },
    uniform3f(...values) { events.push(["uniform3f", ...values]); },
    vertexAttribPointer(...values) {
      events.push(["vertexAttribPointer", ...values]);
    },
    drawElements(...values) { events.push(["drawElements", ...values]); },
  };
  const program = {
    viewMatrix: "view",
    projectionMatrix: "projection",
    normalMatrix: "normal-matrix",
    color: "color",
    enableLighting: "enable-lighting",
    ambientColor: "ambient",
    lightingDirection: "lighting-direction",
    directionalColor: "directional-color",
    position: 2,
    normal: 3,
  };
  const camera = {
    matrix: Matrix4.rotationYMatrix(0.2),
    projectionMatrix: Matrix4.makePerspective(45, 1.5, 0.1, 100),
  };
  return {
    events,
    canvas: {
      getCtx: () => context,
      config: {
        Scene: {
          Lighting: {
            enable: true,
            ambient: [0.1, 0.2, 0.3],
            directional: {
              color: [0.7, 0.8, 0.9],
              direction: { x: 2, y: -3, z: 4 },
            },
          },
        },
      },
      canvases: [{ program, camera }],
    },
  };
}

const dependencies = {
  createGeometry() {
    throw new Error("preinstalled geometry should be reused");
  },
};

test("Plot3D WebGL buffer creation, uniforms, lighting, and draw match legacy", () => {
  const modern = createElement();
  const old = createElement();
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  plot3DElement(modern, modernCanvas.canvas, dependencies, () => 0.6);
  legacy.Graph.Plot3D.plotElement.call(
    legacy.Graph.Plot3D,
    old,
    oldCanvas.canvas,
    { getAlpha: () => 0.6 },
  );
  assert.deepEqual(modernCanvas.events, normalizeRealm(oldCanvas.events));
  assert.equal(modern.webGLFaceCount, old.webGLFaceCount);
  assert.equal(modern.geometry.updates, old.geometry.updates);

  const modernEventCount = modernCanvas.events.length;
  const oldEventCount = oldCanvas.events.length;
  plot3DElement(modern, modernCanvas.canvas, dependencies, () => 0.6);
  legacy.Graph.Plot3D.plotElement.call(
    legacy.Graph.Plot3D,
    old,
    oldCanvas.canvas,
    { getAlpha: () => 0.6 },
  );
  assert.deepEqual(
    modernCanvas.events.slice(modernEventCount),
    normalizeRealm(oldCanvas.events.slice(oldEventCount)),
  );
  assert.equal(
    modernCanvas.events.filter(([name]) => name === "bufferData").length,
    3,
  );
});

test("Plot3D node and edge alpha rules match legacy", () => {
  const modernNode = createElement({ alpha: 0.8 });
  const oldNode = createElement({ alpha: 0.8 });
  const modernNodeCanvas = createCanvas();
  const oldNodeCanvas = createCanvas();
  plot3DNode(modernNode, modernNodeCanvas.canvas, dependencies);
  legacy.Graph.Plot3D.plotNode.call(
    legacy.Graph.Plot3D,
    oldNode,
    oldNodeCanvas.canvas,
  );
  assert.deepEqual(modernNodeCanvas.events, normalizeRealm(oldNodeCanvas.events));

  const modernEdge = createElement({ alpha: 0.7 });
  modernEdge.nodeFrom = { getData: () => 0.4 };
  modernEdge.nodeTo = { getData: () => 0.9 };
  const oldEdge = createElement({ alpha: 0.7 });
  oldEdge.nodeFrom = { getData: () => 0.4 };
  oldEdge.nodeTo = { getData: () => 0.9 };
  const modernEdgeCanvas = createCanvas();
  const oldEdgeCanvas = createCanvas();
  plot3DEdge(modernEdge, modernEdgeCanvas.canvas, dependencies);
  legacy.Graph.Plot3D.plotLine.call(
    legacy.Graph.Plot3D,
    oldEdge,
    oldEdgeCanvas.canvas,
  );
  assert.deepEqual(modernEdgeCanvas.events, normalizeRealm(oldEdgeCanvas.events));
});

test("Plot3D entry stays free of graph models, browser code, and O3D registries", async () => {
  const output = await readFile(
    new URL("../dist/graph/plot3d.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /graph\/graph|canvas\/canvas|browser\/dom|\bO3D\b/);
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
