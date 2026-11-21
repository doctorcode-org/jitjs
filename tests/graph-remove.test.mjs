import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  runEdgeRemoval,
  runNodeRemoval,
} from "../dist/graph/operations/remove.js";
import {
  loadLegacyNamespace,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = { overridable: true, alpha: 1, CanvasStyles: {} };
const edgeConfig = { overridable: true, alpha: 1, CanvasStyles: {} };

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, edgeConfig, {});
  for (const id of ["a", "b", "c", "d"]) {
    graph.addNode({ id, name: id.toUpperCase(), data: {} });
  }
  graph.addAdjacence(graph.getNode("a"), graph.getNode("b"), {});
  graph.addAdjacence(graph.getNode("b"), graph.getNode("c"), {});
  graph.addAdjacence(graph.getNode("c"), graph.getNode("d"), {});
  return graph;
}

function snapshot(graph) {
  const nodes = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.getNode(id);
    nodes[id] = {
      endAlpha: node.endData.$alpha,
      ignore: node.ignore,
    };
  }
  const edges = [];
  for (const from of Object.keys(graph.edges).sort()) {
    for (const to of Object.keys(graph.edges[from]).sort()) {
      if (from < to) {
        const edge = graph.getAdjacence(from, to);
        edges.push([from, to, edge.endData.$alpha, edge.ignore]);
      }
    }
  }
  return normalizeRealm({ nodes, edges });
}

function createModernHarness() {
  const graph = createGraph(Graph);
  const events = [];
  const animations = [];
  let sequence;
  return {
    graph,
    events,
    animations,
    dependencies: {
      graph,
      clearLabels() {
        events.push("labels");
      },
      refresh(value) {
        events.push(`refresh:${value}`);
      },
      reposition() {
        events.push("reposition");
      },
      animate(options) {
        events.push(`animate:${options.modes.join("+")}`);
        animations.push(options);
      },
      sequence(options) {
        events.push(`sequence:${options.duration}`);
        sequence = options;
      },
    },
    getSequence: () => sequence,
  };
}

function createLegacyHarness() {
  const graph = createGraph(legacy.Graph);
  const events = [];
  const animations = [];
  let sequence;
  const context = {
    options: legacy.Graph.Op.options,
    removeNode: legacy.Graph.Op.removeNode,
    removeEdge: legacy.Graph.Op.removeEdge,
    viz: {
      graph,
      controller: {},
      labels: {
        clearLabels() {
          events.push("labels");
        },
      },
      refresh(value) {
        events.push(`refresh:${value}`);
      },
      reposition() {
        events.push("reposition");
      },
      fx: {
        animate(options) {
          events.push(`animate:${normalizeRealm(options.modes).join("+")}`);
          animations.push(options);
        },
        sequence(options) {
          events.push(`sequence:${options.duration}`);
          sequence = options;
        },
      },
    },
  };
  return {
    graph,
    events,
    animations,
    context,
    getSequence: () => sequence,
  };
}

function finishFirstAnimation(harness) {
  harness.animations[0].onComplete();
}

function finishSequence(harness) {
  const sequence = harness.getSequence();
  while (sequence.condition()) {
    sequence.step();
  }
  sequence.onComplete();
}

test("node removal policies match Graph.Op ordering and mutations", () => {
  for (const type of ["nothing", "replot", "fade:seq", "fade:con"]) {
    const modern = createModernHarness();
    const old = createLegacyHarness();
    const complete = () => modern.events.push("complete");
    const oldComplete = () => old.events.push("complete");

    runNodeRemoval(modern.dependencies, ["b", "d"], {
      type,
      duration: 120,
      onComplete: complete,
    });
    legacy.Graph.Op.removeNode.call(old.context, ["b", "d"], {
      type,
      duration: 120,
      onComplete: oldComplete,
    });

    if (type.startsWith("fade")) {
      assert.deepEqual(snapshot(modern.graph), snapshot(old.graph));
      finishFirstAnimation(modern);
      finishFirstAnimation(old);
    }
    assert.deepEqual(snapshot(modern.graph), snapshot(old.graph));
    assert.deepEqual(modern.events, old.events);
  }
});

test("edge removal policies match Graph.Op and skip missing fade targets", () => {
  for (const type of ["nothing", "replot", "fade", "fade:con"]) {
    const modern = createModernHarness();
    const old = createLegacyHarness();
    const targets = type.startsWith("fade")
      ? [["a", "b"], ["a", "c"], ["c", "d"]]
      : [["a", "b"], ["c", "d"]];

    runEdgeRemoval(modern.dependencies, structuredClone(targets), {
      type,
      duration: 120,
      onComplete: () => modern.events.push("complete"),
    });
    legacy.Graph.Op.removeEdge.call(old.context, structuredClone(targets), {
      type,
      duration: 120,
      onComplete: () => old.events.push("complete"),
    });

    if (type.startsWith("fade")) {
      assert.deepEqual(snapshot(modern.graph), snapshot(old.graph));
      finishFirstAnimation(modern);
      finishFirstAnimation(old);
    }
    assert.deepEqual(snapshot(modern.graph), snapshot(old.graph));
    assert.deepEqual(modern.events, old.events);
  }
});

test("iter removal consumes caller arrays and retains legacy timing", () => {
  const modernNodes = createModernHarness();
  const oldNodes = createLegacyHarness();
  const modernNodeIds = ["a", "c"];
  const oldNodeIds = ["a", "c"];
  runNodeRemoval(modernNodes.dependencies, modernNodeIds, {
    type: "iter",
    duration: 101,
    onComplete: () => modernNodes.events.push("complete"),
  });
  legacy.Graph.Op.removeNode.call(oldNodes.context, oldNodeIds, {
    type: "iter",
    duration: 101,
    onComplete: () => oldNodes.events.push("complete"),
  });
  finishSequence(modernNodes);
  finishSequence(oldNodes);
  assert.deepEqual(modernNodeIds, oldNodeIds);
  assert.deepEqual(modernNodes.events, oldNodes.events);
  assert.deepEqual(snapshot(modernNodes.graph), snapshot(oldNodes.graph));

  const modernEdges = createModernHarness();
  const oldEdges = createLegacyHarness();
  const modernTargets = [["a", "b"], ["c", "d"]];
  const oldTargets = [["a", "b"], ["c", "d"]];
  runEdgeRemoval(modernEdges.dependencies, modernTargets, {
    type: "iter",
    duration: 101,
    onComplete: () => modernEdges.events.push("complete"),
  });
  legacy.Graph.Op.removeEdge.call(oldEdges.context, oldTargets, {
    type: "iter",
    duration: 101,
    onComplete: () => oldEdges.events.push("complete"),
  });
  finishSequence(modernEdges);
  finishSequence(oldEdges);
  assert.deepEqual(modernTargets, oldTargets);
  assert.deepEqual(modernEdges.events, oldEdges.events);
  assert.deepEqual(snapshot(modernEdges.graph), snapshot(oldEdges.graph));
});

test("graph removal orchestration is an import-safe leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/operations/remove.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
