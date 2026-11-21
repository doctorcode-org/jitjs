import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canvas3DFragmentShader,
  canvas3DVertexShader,
  WebGLCanvasLayer,
} from "../dist/canvas/canvas3d.js";

function createEnvironment({ compile = true, link = true } = {}) {
  const calls = [];
  let shaderIndex = 0;
  const context = {
    FRAGMENT_SHADER: 1,
    VERTEX_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    DEPTH_TEST: 5,
    LEQUAL: 6,
    BLEND: 7,
    SRC_ALPHA: 8,
    ONE_MINUS_SRC_ALPHA: 9,
    COLOR_BUFFER_BIT: 16,
    DEPTH_BUFFER_BIT: 32,
    createShader(type) {
      const shader = { id: ++shaderIndex, type };
      calls.push(["createShader", type]);
      return shader;
    },
    shaderSource(shader, source) { calls.push(["shaderSource", shader.id, source]); },
    compileShader(shader) { calls.push(["compileShader", shader.id]); },
    getShaderParameter(shader, property) {
      calls.push(["getShaderParameter", shader.id, property]);
      return compile;
    },
    getShaderInfoLog(shader) {
      calls.push(["getShaderInfoLog", shader.id]);
      return "compile details";
    },
    createProgram() {
      calls.push(["createProgram"]);
      return { id: "program" };
    },
    attachShader(program, shader) { calls.push(["attachShader", program.id, shader.id]); },
    linkProgram(program) { calls.push(["linkProgram", program.id]); },
    getProgramParameter(program, property) {
      calls.push(["getProgramParameter", program.id, property]);
      return link;
    },
    useProgram(program) { calls.push(["useProgram", program.id]); },
    getUniformLocation(program, name) {
      calls.push(["getUniformLocation", program.id, name]);
      return `uniform:${name}`;
    },
    getAttribLocation(program, name) {
      calls.push(["getAttribLocation", program.id, name]);
      return name === "position" ? 11 : 12;
    },
    enableVertexAttribArray(index) { calls.push(["enableVertexAttribArray", index]); },
    clearColor(...values) { calls.push(["clearColor", ...values]); },
    clearDepth(value) { calls.push(["clearDepth", value]); },
    enable(value) { calls.push(["enable", value]); },
    depthFunc(value) { calls.push(["depthFunc", value]); },
    blendFunc(...values) { calls.push(["blendFunc", ...values]); },
    viewport(...values) { calls.push(["viewport", ...values]); },
    clear(mask) { calls.push(["clear", mask]); },
  };
  const canvas = {
    id: "",
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      calls.push(["getContext", type]);
      return context;
    },
  };
  const document = {
    createElement(tagName) {
      calls.push(["createElement", tagName]);
      return canvas;
    },
  };
  return { calls, canvas, context, document };
}

test("Canvas3D is import-safe and keeps its shader sources isolated", async () => {
  assert.equal(Object.hasOwn(globalThis, "document"), false);
  assert.match(canvas3DFragmentShader, /gl_FragColor/);
  assert.match(canvas3DVertexShader, /projectionMatrix \* viewMatrix/);
  const source = await readFile(
    new URL("../dist/canvas/canvas3d.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\$jit|window\.|Canvas\.Base/);
  assert.match(source, /geometry\/camera\.js/);
});

test("WebGL initialization follows Canvas3D shader and state ordering", () => {
  const environment = createEnvironment();
  const layer = new WebGLCanvasLayer(
    { injectInto: "scene", idSuffix: "-webgl", width: 320, height: 180 },
    {},
    environment.document,
  );

  assert.equal(environment.canvas.id, "scene-webgl");
  assert.deepEqual(environment.canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "320px",
    height: "180px",
  });
  assert.deepEqual(layer.getSize(), { width: 320, height: 180 });
  assert.equal(layer.camera.position.z, 500);
  assert.equal(layer.program.viewMatrix, "uniform:viewMatrix");
  assert.equal(layer.program.projectionMatrix, "uniform:projectionMatrix");
  assert.equal(layer.program.position, 11);
  assert.equal(layer.program.normal, 12);

  assert.deepEqual(
    environment.calls.filter(([name]) => [
      "createShader",
      "attachShader",
      "enableVertexAttribArray",
      "clearColor",
      "clearDepth",
      "enable",
      "depthFunc",
      "blendFunc",
      "viewport",
    ].includes(name)),
    [
      ["createShader", 1],
      ["createShader", 2],
      ["attachShader", "program", 2],
      ["attachShader", "program", 1],
      ["enableVertexAttribArray", 11],
      ["enableVertexAttribArray", 12],
      ["clearColor", 0, 0, 0, 0],
      ["clearDepth", 1],
      ["enable", 5],
      ["depthFunc", 6],
      ["enable", 7],
      ["blendFunc", 8, 9],
      ["viewport", 0, 0, 320, 180],
    ],
  );
});

test("translation, clearing, plotting, and resizing retain WebGL semantics", () => {
  const environment = createEnvironment();
  const events = [];
  const layer = new WebGLCanvasLayer(
    { injectInto: "scene", width: 200, height: 100 },
    {
      plot: (target) => events.push(["plot", target === layer]),
      resize: (width, height, target) =>
        events.push(["resize", width, height, target === layer]),
    },
    environment.document,
  );
  environment.calls.length = 0;

  layer.translate(4, -3, 8, true);
  assert.deepEqual({
    x: layer.camera.position.x,
    y: layer.camera.position.y,
    z: layer.camera.position.z,
  }, {
    x: 4,
    y: -3,
    z: 508,
  });
  assert.equal(layer.translateOffsetX, 4);
  assert.equal(layer.translateOffsetY, -3);
  assert.deepEqual(events, []);

  layer.translate(1, 2, -5);
  assert.deepEqual(events, [["plot", true]]);
  assert.deepEqual(environment.calls, [["clear", 48]]);
  assert.notEqual(layer.camera.matrix.n34, 0);

  environment.calls.length = 0;
  layer.resize(640, 360);
  assert.deepEqual(layer.getSize(), { width: 640, height: 360 });
  assert.equal(layer.translateOffsetX, 0);
  assert.equal(layer.translateOffsetY, 0);
  assert.deepEqual(environment.calls, [
    ["viewport", 0, 0, 640, 360],
    ["clear", 48],
  ]);
  assert.deepEqual(events.at(-1), ["resize", 640, 360, true]);

  const before = environment.calls.length;
  layer.scale(2, 3);
  layer.translateToCenter();
  assert.equal(environment.calls.length, before);
});

test("shader and program failures preserve the legacy failure points", () => {
  const compileFailure = createEnvironment({ compile: false });
  assert.throws(
    () => new WebGLCanvasLayer(
      { injectInto: "scene", width: 1, height: 1 },
      {},
      compileFailure.document,
    ),
    (error) => error === "Could not compile shader src: compile details",
  );

  const linkFailure = createEnvironment({ link: false });
  assert.throws(
    () => new WebGLCanvasLayer(
      { injectInto: "scene", width: 1, height: 1 },
      {},
      linkFailure.document,
    ),
    (error) => error === "Could not link shaders",
  );
});
