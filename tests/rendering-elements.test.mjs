import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  renderEdgeElement,
  renderNodeElement,
} from "../dist/graph/rendering/elements.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

function context(events) {
  const values = {};
  return new Proxy(
    {
      save() {
        events.push(["save"]);
      },
      restore() {
        events.push(["restore"]);
      },
    },
    {
      set(target, property, value) {
        values[property] = value;
        events.push(["set", property, value]);
        return Reflect.set(target, property, value);
      },
      get(target, property, receiver) {
        if (property === "values") return values;
        return Reflect.get(target, property, receiver);
      },
    },
  );
}

function canvas(events) {
  const ctx = context(events);
  return {
    ctx,
    getCtx() {
      events.push(["get-context"]);
      return ctx;
    },
  };
}

function element(data, canvasData = {}) {
  return {
    data,
    getData(property) {
      return this.data[property];
    },
    getCanvasStyle(property) {
      return canvasData[property];
    },
  };
}

function runModernNode(type = "circle") {
  const events = [];
  const node = element(
    { type, lineWidth: 3, color: "#123456", alpha: 0.6 },
    { shadowBlur: 8, fillStyle: "#abcdef" },
  );
  const drawingCanvas = canvas(events);
  renderNodeElement(
    node,
    drawingCanvas,
    { shadowBlur: 0, fillStyle: "" },
    (resolvedType, resolvedNode, resolvedCanvas, animating) => {
      events.push([
        "render-node",
        resolvedType,
        resolvedNode === node,
        resolvedCanvas === drawingCanvas,
        animating,
      ]);
    },
    true,
  );
  return events;
}

function runLegacyNode(type = "circle") {
  const events = [];
  const node = element(
    { type, lineWidth: 3, color: "#123456", alpha: 0.6 },
    { shadowBlur: 8, fillStyle: "#abcdef" },
  );
  const drawingCanvas = canvas(events);
  const receiver = {
    node: { CanvasStyles: { shadowBlur: 0, fillStyle: "" } },
    nodeTypes: {
      [type]: {
        render(resolvedNode, resolvedCanvas, animating) {
          events.push([
            "render-node",
            type,
            resolvedNode === node,
            resolvedCanvas === drawingCanvas,
            animating,
          ]);
        },
      },
    },
  };
  legacy.Graph.Plot.plotNode.call(receiver, node, drawingCanvas, true);
  return events;
}

function runModernEdge(type = "line") {
  const events = [];
  const edge = Object.assign(
    element(
      { type, lineWidth: 4, color: "#654321", alpha: 0.7 },
      { shadowColor: "#eeeeee", lineWidth: 9 },
    ),
    {
      nodeFrom: element({ alpha: 0.8 }),
      nodeTo: element({ alpha: 0.5 }),
    },
  );
  const drawingCanvas = canvas(events);
  renderEdgeElement(
    edge,
    drawingCanvas,
    { shadowColor: "", lineWidth: 0 },
    (resolvedType, resolvedEdge, resolvedCanvas, animating) => {
      events.push([
        "render-edge",
        resolvedType,
        resolvedEdge === edge,
        resolvedCanvas === drawingCanvas,
        animating,
      ]);
    },
    false,
  );
  return events;
}

function runLegacyEdge(type = "line") {
  const events = [];
  const edge = Object.assign(
    element(
      { type, lineWidth: 4, color: "#654321", alpha: 0.7 },
      { shadowColor: "#eeeeee", lineWidth: 9 },
    ),
    {
      nodeFrom: element({ alpha: 0.8 }),
      nodeTo: element({ alpha: 0.5 }),
    },
  );
  const drawingCanvas = canvas(events);
  const receiver = {
    edge: { CanvasStyles: { shadowColor: "", lineWidth: 0 } },
    edgeTypes: {
      [type]: {
        render(resolvedEdge, resolvedCanvas, animating) {
          events.push([
            "render-edge",
            type,
            resolvedEdge === edge,
            resolvedCanvas === drawingCanvas,
            animating,
          ]);
        },
      },
    },
  };
  legacy.Graph.Plot.plotLine.call(receiver, edge, drawingCanvas, false);
  return events;
}

test("node context setup and shape delegation match legacy", () => {
  assert.deepEqual(runModernNode(), runLegacyNode());
});

test("edge context setup and composed alpha match legacy", () => {
  assert.deepEqual(runModernEdge(), runLegacyEdge());
  const alphaAssignment = runModernEdge().find(
    ([kind, property]) => kind === "set" && property === "globalAlpha",
  );
  assert.equal(alphaAssignment[2], 0.5);
});

test("none elements skip context lookup and renderer resolution", () => {
  assert.deepEqual(runModernNode("none"), []);
  assert.deepEqual(runLegacyNode("none"), []);
  assert.deepEqual(runModernEdge("none"), []);
  assert.deepEqual(runLegacyEdge("none"), []);
});

test("element context rendering is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/rendering/elements.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
