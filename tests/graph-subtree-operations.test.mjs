import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  contractSubtree,
  expandSubtree,
} from "../dist/graph/operations/subtree.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = {
  overridable: true,
  alpha: 1,
  span: 1,
  CanvasStyles: {},
};

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, { CanvasStyles: {} }, {});
  for (const id of ["root", "branch", "leaf", "sibling"]) {
    graph.addNode({ id, name: id, data: {} });
  }
  graph.addAdjacence(graph.getNode("root"), graph.getNode("branch"), {});
  graph.addAdjacence(graph.getNode("branch"), graph.getNode("leaf"), {});
  graph.addAdjacence(graph.getNode("root"), graph.getNode("sibling"), {});
  graph.computeLevels("root");
  graph.getNode("branch").endPos.setc(20, 30);
  graph.getNode("leaf").endPos.setc(40, 50);
  return graph;
}

function snapshot(graph) {
  const result = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.getNode(id);
    result[id] = {
      collapsed: "collapsed" in node ? node.collapsed : "absent",
      ignore: "ignore" in node ? node.ignore : "absent",
      currentAlpha: node.data.$alpha,
      endAlpha: node.endData.$alpha,
      endPosition: normalizeRealm(node.endPos.getc(true)),
    };
  }
  return normalizeRealm(result);
}

function modernHarness() {
  const graph = createGraph(Graph);
  const events = [];
  let animation;
  const dependencies = {
    config: { duration: 700, hideLabels: false, custom: "config" },
    rotated: graph.getNode("root"),
    computeEnd() {
      events.push("compute:end");
      graph.getNode("branch").endPos.setc(11, 12);
      graph.getNode("leaf").endPos.setc(21, 22);
    },
    rotate(node, method, options) {
      events.push(`rotate:${node.id}:${method}:${options.property}`);
    },
    animate(options) {
      events.push(`animate:${options.modes.join("+")}`);
      animation = options;
    },
    refresh() {
      events.push("refresh");
    },
  };
  return { graph, events, dependencies, getAnimation: () => animation };
}

function legacyHarness() {
  const graph = createGraph(legacy.Graph);
  const events = [];
  let animation;
  const viz = {
    graph,
    config: { duration: 700, hideLabels: false, custom: "config" },
    rotated: graph.getNode("root"),
    compute(phase) {
      events.push(`compute:${phase}`);
      graph.getNode("branch").endPos.setc(11, 12);
      graph.getNode("leaf").endPos.setc(21, 22);
    },
    rotate(node, method, options) {
      events.push(`rotate:${node.id}:${method}:${options.property}`);
    },
    fx: {
      animate(options) {
        events.push(`animate:${normalizeRealm(options.modes).join("+")}`);
        animation = options;
      },
    },
    refresh() {
      events.push("refresh");
    },
  };
  return {
    graph,
    events,
    context: { viz, options: legacy.Graph.Op.options },
    getAnimation: () => animation,
  };
}

function comparableOptions(options) {
  return {
    type: options.type,
    duration: options.duration,
    hideLabels: options.hideLabels,
    fps: options.fps,
    custom: options.custom,
    requested: options.requested,
    modes: normalizeRealm(options.modes),
  };
}

test("animated contract matches descendant phases, rotation, and collapse positions", () => {
  const modern = modernHarness();
  const old = legacyHarness();
  const request = { type: "animate", duration: 250, requested: true };

  assert.equal(
    contractSubtree(
      modern.graph.getNode("branch"),
      modern.dependencies,
      request,
    ),
    true,
  );
  legacy.Graph.Op.contract.call(
    old.context,
    old.graph.getNode("branch"),
    request,
  );

  assert.deepEqual(modern.events, old.events);
  assert.deepEqual(snapshot(modern.graph), normalizeRealm(snapshot(old.graph)));
  assert.deepEqual(
    comparableOptions(modern.getAnimation()),
    comparableOptions(old.getAnimation()),
  );
});

test("animated expand restores descendants and matches option composition", () => {
  const modern = modernHarness();
  const old = legacyHarness();
  const modernBranch = modern.graph.getNode("branch");
  const oldBranch = old.graph.getNode("branch");

  contractSubtree(modernBranch, modern.dependencies, { type: "nothing" });
  legacy.Graph.Op.contract.call(old.context, oldBranch, { type: "nothing" });
  modern.events.length = 0;
  old.events.length = 0;

  assert.equal(
    expandSubtree(modernBranch, modern.dependencies, {
      type: "animate",
      requested: true,
    }),
    true,
  );
  legacy.Graph.Op.expand.call(old.context, oldBranch, {
    type: "animate",
    requested: true,
  });

  assert.deepEqual(modern.events, old.events);
  assert.deepEqual(snapshot(modern.graph), normalizeRealm(snapshot(old.graph)));
  assert.deepEqual(
    comparableOptions(modern.getAnimation()),
    comparableOptions(old.getAnimation()),
  );
});

test("replot and guard behavior match legacy contract and expand", () => {
  const modern = modernHarness();
  const old = legacyHarness();
  const modernBranch = modern.graph.getNode("branch");
  const oldBranch = old.graph.getNode("branch");

  assert.equal(
    contractSubtree(modernBranch, modern.dependencies, { type: "replot" }),
    true,
  );
  legacy.Graph.Op.contract.call(old.context, oldBranch, { type: "replot" });
  assert.equal(
    contractSubtree(modernBranch, modern.dependencies, { type: "replot" }),
    false,
  );
  legacy.Graph.Op.contract.call(old.context, oldBranch, { type: "replot" });
  assert.deepEqual(modern.events, old.events);
  assert.deepEqual(snapshot(modern.graph), normalizeRealm(snapshot(old.graph)));

  assert.equal(
    expandSubtree(modernBranch, modern.dependencies, { type: "replot" }),
    true,
  );
  legacy.Graph.Op.expand.call(old.context, oldBranch, { type: "replot" });
  assert.equal(
    expandSubtree(modernBranch, modern.dependencies, { type: "replot" }),
    false,
  );
  legacy.Graph.Op.expand.call(old.context, oldBranch, { type: "replot" });
  assert.deepEqual(modern.events, old.events);
  assert.deepEqual(snapshot(modern.graph), normalizeRealm(snapshot(old.graph)));

  assert.equal(
    contractSubtree(
      modern.graph.getNode("leaf"),
      modern.dependencies,
      { type: "replot" },
    ),
    false,
  );
});

test("subtree operations emit as an import-safe leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/operations/subtree.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
