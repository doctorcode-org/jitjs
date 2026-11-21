import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { plotTree } from "../dist/graph/plot-tree.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

function createTree() {
  const edge = (from, to) => ({ id: `${from}->${to}` });
  const node = (id, alpha, drawn = true, exist = true) => ({
    id,
    alpha,
    drawn,
    exist,
    children: [],
    adjacencies: {},
    getData(property) {
      return property === "alpha" ? this.alpha : undefined;
    },
    getAdjacency(childId) {
      return this.adjacencies[childId];
    },
    eachSubnode(visit) {
      for (const child of this.children) visit(child);
    },
  });

  const root = node("root", 1);
  const first = node("first", 0.5);
  const grandchild = node("grandchild", 1);
  const hidden = node("hidden", 1, false);
  const absent = node("absent", 1, true, false);
  const excluded = node("excluded", 1);
  root.children.push(first, hidden, absent, excluded);
  first.children.push(grandchild);
  for (const [parent, child] of [
    [root, first],
    [root, hidden],
    [root, absent],
    [root, excluded],
    [first, grandchild],
  ]) {
    parent.adjacencies[child.id] = edge(parent.id, child.id);
  }
  return root;
}

function options(events, overrides = {}) {
  return {
    withLabels: true,
    hideLabels: false,
    plotSubtree(_parent, child) {
      return child.id !== "excluded";
    },
    onBeforePlotLine(edge) {
      events.push(["before-edge", edge.id]);
    },
    onAfterPlotLine(edge) {
      events.push(["after-edge", edge.id]);
    },
    onBeforePlotNode(node) {
      events.push(["before-node", node.id]);
    },
    onAfterPlotNode(node) {
      events.push(["after-node", node.id]);
    },
    ...overrides,
  };
}

function runModern(optionOverrides = {}, animating) {
  const events = [];
  const canvas = {
    getCtx() {
      events.push(["context"]);
      return {};
    },
  };
  const opts = options(events, optionOverrides);
  const labels = {
    plotLabel(_canvas, node) {
      events.push(["label", node.id]);
    },
    hideLabel(node, show) {
      events.push(["hide-label", node.id, show]);
    },
  };
  plotTree(
    {
      canvas,
      labels,
      renderNode(node, _canvas, active) {
        events.push(["node", node.id, active]);
      },
      renderEdge(edge, _canvas, active) {
        events.push(["edge", edge.id, active]);
      },
    },
    createTree(),
    opts,
    animating,
  );
  return events;
}

function runLegacy(optionOverrides = {}, animating) {
  const events = [];
  const canvas = {
    getCtx() {
      events.push(["context"]);
      return {};
    },
  };
  const opts = options(events, optionOverrides);
  const context = {
    viz: { canvas },
    config: {},
    labels: {
      plotLabel(_canvas, node) {
        events.push(["label", node.id]);
      },
      hideLabel(node, show) {
        events.push(["hide-label", node.id, show]);
      },
    },
    plotNode(node, _canvas, active) {
      events.push(["node", node.id, active]);
    },
    plotLine(edge, _canvas, active) {
      events.push(["edge", edge.id, active]);
    },
    plotTree: legacy.Graph.Plot.plotTree,
  };
  legacy.Graph.Plot.plotTree.call(
    context,
    createTree(),
    opts,
    animating,
  );
  return events;
}

test("subtree traversal and label decisions match Graph.Plot.plotTree", () => {
  assert.deepEqual(runModern(), runLegacy());
});

test("animation suppresses hooks but preserves rendering and labels", () => {
  assert.deepEqual(runModern({}, true), runLegacy({}, true));
});

test("label flags and an undrawn root preserve legacy hiding semantics", () => {
  assert.deepEqual(
    runModern({ hideLabels: true, withLabels: false }),
    runLegacy({ hideLabels: true, withLabels: false }),
  );

  const modernRoot = createTree();
  const legacyRoot = createTree();
  modernRoot.drawn = false;
  legacyRoot.drawn = false;
  const modernEvents = [];
  const legacyEvents = [];
  const modernOptions = options(modernEvents);
  const legacyOptions = options(legacyEvents);
  const modernCanvas = { getCtx: () => modernEvents.push(["context"]) };
  const legacyCanvas = { getCtx: () => legacyEvents.push(["context"]) };
  const makeLabels = (events) => ({
    plotLabel(_canvas, node) {
      events.push(["label", node.id]);
    },
    hideLabel(node, show) {
      events.push(["hide-label", node.id, show]);
    },
  });
  plotTree(
    {
      canvas: modernCanvas,
      labels: makeLabels(modernEvents),
      renderNode: (node) => modernEvents.push(["node", node.id]),
      renderEdge: (edge) => modernEvents.push(["edge", edge.id]),
    },
    modernRoot,
    modernOptions,
  );
  legacy.Graph.Plot.plotTree.call(
    {
      viz: { canvas: legacyCanvas },
      config: {},
      labels: makeLabels(legacyEvents),
      plotNode: (node) => legacyEvents.push(["node", node.id]),
      plotLine: (edge) => legacyEvents.push(["edge", edge.id]),
      plotTree: legacy.Graph.Plot.plotTree,
    },
    legacyRoot,
    legacyOptions,
  );
  assert.deepEqual(modernEvents, legacyEvents);
});

test("plotTree is an import-safe leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/plot-tree.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
