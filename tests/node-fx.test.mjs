import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  prepareNodeFx,
  resolveNodeFxOptions,
  runNodeFx,
} from "../dist/graph/node-fx.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  width: 1,
  height: 1,
  color: "#000000",
  CanvasStyles: {},
};

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, {}, {});
  graph.addNode({ id: "first", name: "First", data: { $width: 10 } });
  graph.addNode({ id: "second", name: "Second", data: { $width: 20 } });
  return graph;
}

function snapshot(graph) {
  return Object.fromEntries(
    Object.keys(graph.nodes).map((id) => [id, { ...graph.getNode(id).endData }]),
  );
}

function runLegacy(options) {
  const graph = createGraph(legacy.Graph);
  const events = [];
  let animationOptions;
  legacy.Graph.Plot.nodeFx.call(
    {
      viz: {
        graph,
        config: {},
        compute(phase) {
          events.push(`compute:${phase}`);
        },
      },
      nodeFxAnimation: {
        stopTimer() {
          events.push("stop");
        },
      },
      animate(value) {
        events.push("animate");
        animationOptions = value;
      },
    },
    options,
  );
  return {
    events,
    graph,
    modes: normalizeRealm(animationOptions.modes),
    type: animationOptions.type,
  };
}

function runModern(options) {
  const graph = createGraph(Graph);
  const events = [];
  let animationOptions;
  const result = runNodeFx(
    {
      graph,
      stop() {
        events.push("stop");
      },
      computeEnd() {
        events.push("compute:end");
      },
      animate(value) {
        events.push("animate");
        animationOptions = value;
        return "driver";
      },
    },
    options,
  );
  return { events, graph, animationOptions, result };
}

test("nodeFx orchestration matches legacy targeting, modes, and ordering", () => {
  const cases = [
    {
      elements: { id: false, properties: { width: 40, color: "#abcdef" } },
    },
    {
      elements: { id: "first", properties: { width: 35 } },
      reposition: true,
    },
    {
      elements: {
        id: ["missing", "second"],
        properties: { height: 15 },
      },
    },
  ];

  for (const options of cases) {
    const modern = runModern(options);
    const old = runLegacy(options);
    assert.deepEqual(modern.events, old.events);
    assert.deepEqual(snapshot(modern.graph), normalizeRealm(snapshot(old.graph)));
    assert.deepEqual(modern.animationOptions.modes, old.modes);
    assert.equal(modern.animationOptions.type, old.type);
    assert.equal(modern.result, "driver");
  }
});

test("empty and inherited property names retain legacy for-in behavior", () => {
  const inherited = { alpha: 0.25 };
  const properties = Object.create(inherited);
  properties.width = 50;
  const graph = createGraph(Graph);
  const resolved = resolveNodeFxOptions({
    elements: { id: "first", properties },
  });

  assert.deepEqual(
    prepareNodeFx(graph, resolved.elements),
    ["node-property:width:alpha"],
  );
  assert.deepEqual(graph.getNode("first").endData, {
    $width: 50,
    $alpha: 0.25,
  });
  assert.deepEqual(
    prepareNodeFx(graph, resolveNodeFxOptions().elements),
    ["node-property:"],
  );
});

test("nodeFx is an import-safe leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/node-fx.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
