import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import { plotGraph } from "../dist/graph/plotting.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  alpha: 1,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, edgeConfig, {});
  for (const [id, alpha, drawn] of [
    ["a", 0.95, true],
    ["b", 0.949, true],
    ["c", 1, false],
  ]) {
    graph.addNode({ id, name: id.toUpperCase(), data: { $alpha: alpha } });
    graph.getNode(id).drawn = drawn;
  }
  graph.addAdjacence(graph.getNode("a"), graph.getNode("b"), {});
  graph.addAdjacence(graph.getNode("a"), graph.getNode("c"), {});
  return graph;
}

function edgeName(edge) {
  return `${edge.nodeFrom.id}->${edge.nodeTo.id}`;
}

function options(events) {
  return {
    clearCanvas: true,
    withLabels: true,
    onBeforePlotLine(edge) {
      events.push(["before-edge", edgeName(edge)]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edgeName(edge)]);
    },
    onBeforePlotNode(node) {
      events.push(["before-node", node.id]);
    },
    onAfterPlotNode(node) {
      events.push(["after-node", node.id]);
    },
  };
}

function canvas(events) {
  return {
    getCtx() {
      events.push(["context"]);
      return {};
    },
    clear() {
      events.push(["clear"]);
    },
  };
}

function labels(events) {
  return {
    plotLabel(_canvas, node) {
      events.push(["label", node.id]);
    },
    hideLabel(node, show) {
      events.push(["hide-label", node.id, show]);
    },
  };
}

function runModern({ animating, rootId = "a", times = 1, labelsHidden = false } = {}) {
  const events = [];
  const graph = createGraph(Graph);
  const plotOptions = options(events);
  const plotCanvas = canvas(events);
  const plotLabels = labels(events);

  for (let index = 0; index < times; index += 1) {
    plotGraph(
      {
        graph,
        rootId,
        canvas: plotCanvas,
        labels: plotLabels,
        labelsHidden,
        renderEdge(edge, _canvas, active) {
          events.push(["edge", edgeName(edge), active ?? null]);
        },
        renderNode(node, _canvas, active) {
          events.push(["node", node.id, active ?? null]);
        },
      },
      plotOptions,
      animating,
    );
  }
  return { events, graph };
}

function runLegacy({ animating, rootId = "a", times = 1, labelsHidden = false } = {}) {
  const events = [];
  const graph = createGraph(legacy.Graph);
  const plotOptions = options(events);
  const plotCanvas = canvas(events);
  const plotLabels = labels(events);
  const context = {
    viz: {
      graph,
      root: rootId,
      canvas: plotCanvas,
      controller: plotOptions,
    },
    labels: plotLabels,
    labelsHidden,
    plotLine(edge, _canvas, active) {
      events.push(["edge", edgeName(edge), active ?? null]);
    },
    plotNode(node, _canvas, active) {
      events.push(["node", node.id, active ?? null]);
    },
  };

  for (let index = 0; index < times; index += 1) {
    legacy.Graph.Plot.plot.call(context, plotOptions, animating);
  }
  return { events, graph };
}

test("plot traversal, callbacks, and label threshold match legacy", () => {
  const modern = runModern();
  const old = runLegacy();
  assert.deepEqual(modern.events, old.events);
  assert.equal(modern.events.filter(([kind]) => kind === "edge").length, 1);
  assert.ok(modern.events.some((event) => event[0] === "label" && event[1] === "a"));
  assert.ok(
    modern.events.some(
      (event) => event[0] === "hide-label" && event[1] === "b",
    ),
  );
});

test("animating skips hooks while repeated plots still draw each edge once", () => {
  const modern = runModern({ animating: true, times: 2 });
  const old = runLegacy({ animating: true, times: 2 });
  assert.deepEqual(modern.events, old.events);
  assert.equal(modern.events.filter(([kind]) => kind === "edge").length, 2);
  assert.equal(
    modern.events.some(([kind]) => kind.startsWith("before-")),
    false,
  );
});

test("missing roots are checked after context lookup and clearing", () => {
  const modern = runModern({ rootId: "missing" });
  const old = runLegacy({ rootId: "missing" });
  assert.deepEqual(modern.events, old.events);
  assert.deepEqual(modern.events, [["context"], ["clear"]]);
});

test("hidden labels do not perform label work", () => {
  const modern = runModern({ labelsHidden: true });
  const old = runLegacy({ labelsHidden: true });
  assert.deepEqual(modern.events, old.events);
  assert.equal(
    modern.events.some(([kind]) => kind === "label" || kind === "hide-label"),
    false,
  );
});

test("plotting is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/plotting.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
