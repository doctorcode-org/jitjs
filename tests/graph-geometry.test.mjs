import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { Graph } from "../dist/graph/graph.js";
import {
  createGraphGeometry,
  getRightLevelToShow,
  setRightLevelToShow,
  translate,
} from "../dist/graph/geometry.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const nodeConfig = { overridable: true };
const edgeConfig = { overridable: true };
const labelConfig = {};

const nodeInputs = [
  { id: "root", name: "Root", data: {} },
  { id: "one", name: "One", data: {} },
  { id: "two", name: "Two", data: {} },
  { id: "three", name: "Three", data: {} },
  { id: "four", name: "Four", data: {} },
];

function populateChain(graph) {
  for (const node of nodeInputs) {
    graph.addNode(node);
  }
  for (let index = 1; index < nodeInputs.length; index += 1) {
    graph.addAdjacence(nodeInputs[index - 1], nodeInputs[index], {});
  }
  graph.computeLevels("root");

  for (const node of Object.values(graph.nodes)) {
    node.drawn = true;
    node.exist = true;
  }
  return graph;
}

function createModernGraph() {
  return populateChain(new Graph({}, nodeConfig, edgeConfig, labelConfig));
}

function createLegacyGraph() {
  return populateChain(
    new legacy.Graph({}, nodeConfig, edgeConfig, labelConfig),
  );
}

function setPositions(graph) {
  let index = 0;
  for (const node of Object.values(graph.nodes)) {
    node.pos.setc(index, index + 1);
    node.startPos.setc(index + 10, index + 11);
    node.endPos.setc(index + 20, index + 21);
    index += 1;
  }
}

function positionSnapshot(graph) {
  return Object.fromEntries(
    Object.keys(graph.nodes)
      .sort()
      .map((id) => {
        const node = graph.nodes[id];
        return [
          id,
          {
            current: { x: node.pos.x, y: node.pos.y },
            start: { x: node.startPos.x, y: node.startPos.y },
            end: { x: node.endPos.x, y: node.endPos.y },
          },
        ];
      }),
  );
}

function visibilitySnapshot(graph) {
  return Object.fromEntries(
    Object.keys(graph.nodes)
      .sort()
      .map((id) => {
        const node = graph.nodes[id];
        return [
          id,
          {
            depth: node._depth,
            drawn: node.drawn,
            exist: node.exist,
          },
        ];
      }),
  );
}

test("graph geometry is an isolated ESM module with granular exports", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(typeof translate, "function");
  assert.equal(typeof getRightLevelToShow, "function");
  assert.equal(typeof setRightLevelToShow, "function");
  assert.equal(typeof createGraphGeometry, "function");

  const output = await readFile(
    new URL("../dist/graph/geometry.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b/);
  assert.doesNotMatch(output, /\$jit/);
});

test("translate matches Graph.Geom for one or many position phases", () => {
  const modernGraph = createModernGraph();
  const legacyGraph = createLegacyGraph();
  setPositions(modernGraph);
  setPositions(legacyGraph);

  const dependencies = {
    graph: modernGraph,
    config: { levelsToShow: 4, constrained: false },
    labels: { hideLabel() {} },
    treeFitsInCanvas: () => true,
  };
  const modernGeometry = createGraphGeometry(dependencies);
  const legacyGeometry = new legacy.Graph.Geom({
    graph: legacyGraph,
    config: dependencies.config,
    labels: dependencies.labels,
  });

  modernGeometry.translate(new Complex(3, -2), ["current", "end"]);
  legacyGeometry.translate(new legacy.Complex(3, -2), ["current", "end"]);
  translate(modernGraph, new Complex(-1, 5), "start");
  legacyGeometry.translate(new legacy.Complex(-1, 5), "start");

  assert.deepEqual(
    positionSnapshot(modernGraph),
    normalizeRealm(positionSnapshot(legacyGraph)),
  );
});

test("fit calculation is injected and matches constrained legacy behavior", () => {
  const modernGraph = createModernGraph();
  const legacyGraph = createLegacyGraph();
  const modernRoot = modernGraph.getNode("root");
  const legacyRoot = legacyGraph.getNode("root");
  const canvas = { width: 640, height: 480 };
  const config = { levelsToShow: 4, constrained: true };
  const modernCalls = [];
  const legacyCalls = [];
  const modernFit = (_node, receivedCanvas, level) => {
    assert.strictEqual(receivedCanvas, canvas);
    modernCalls.push(level);
    return level <= 2;
  };
  const legacyFit = (_node, receivedCanvas, level) => {
    assert.strictEqual(receivedCanvas, canvas);
    legacyCalls.push(level);
    return level <= 2;
  };

  const legacyGeometry = new legacy.Graph.Geom({
    graph: legacyGraph,
    config,
    labels: { hideLabel() {} },
  });
  legacyGeometry.treeFitsInCanvas = legacyFit;

  assert.equal(
    getRightLevelToShow(config, modernRoot, canvas, modernFit),
    legacyGeometry.getRightLevelToShow(legacyRoot, canvas),
  );
  assert.deepEqual(modernCalls, legacyCalls);
  assert.deepEqual(modernCalls, [4, 3, 2]);

  let unconstrainedCalls = 0;
  assert.equal(
    getRightLevelToShow(
      { levelsToShow: 7, constrained: false },
      modernRoot,
      canvas,
      () => {
        unconstrainedCalls += 1;
        return false;
      },
    ),
    7,
  );
  assert.equal(unconstrainedCalls, 0);
});

test("setRightLevelToShow matches callbacks, flags, and label hiding", () => {
  const modernGraph = createModernGraph();
  const legacyGraph = createLegacyGraph();
  const config = { levelsToShow: 4, constrained: true };
  const canvas = { id: "canvas" };
  const modernEvents = [];
  const legacyEvents = [];
  const modernHiddenLabels = [];
  const legacyHiddenLabels = [];

  const dependencies = {
    graph: modernGraph,
    config,
    labels: {
      hideLabel(node, force) {
        modernHiddenLabels.push([node.id, force]);
      },
    },
    treeFitsInCanvas: (_node, _canvas, level) => level <= 2,
  };
  const modernGeometry = createGraphGeometry(dependencies);
  const legacyGeometry = new legacy.Graph.Geom({
    graph: legacyGraph,
    config,
    labels: {
      hideLabel(node, force) {
        legacyHiddenLabels.push([node.id, force]);
      },
    },
  });
  legacyGeometry.treeFitsInCanvas = (_node, _canvas, level) => level <= 2;

  modernGeometry.setRightLevelToShow(
    modernGraph.getNode("root"),
    canvas,
    {
      onHide: (node) => modernEvents.push(["hide", node.id]),
      onShow: (node) => modernEvents.push(["show", node.id]),
    },
  );
  legacyGeometry.setRightLevelToShow(
    legacyGraph.getNode("root"),
    canvas,
    {
      onHide: (node) => legacyEvents.push(["hide", node.id]),
      onShow: (node) => legacyEvents.push(["show", node.id]),
    },
  );

  assert.deepEqual(
    visibilitySnapshot(modernGraph),
    normalizeRealm(visibilitySnapshot(legacyGraph)),
  );
  assert.deepEqual(modernEvents, legacyEvents);
  assert.deepEqual(modernEvents, [
    ["show", "root"],
    ["show", "one"],
    ["show", "two"],
    ["hide", "three"],
    ["hide", "four"],
  ]);
  assert.deepEqual(modernHiddenLabels, legacyHiddenLabels);
  assert.deepEqual(modernHiddenLabels, [
    ["three", false],
    ["four", false],
  ]);
});

test("execution flags suppress mutations but still run visibility callbacks", () => {
  const graph = createModernGraph();
  const events = [];
  const hiddenLabels = [];
  const root = graph.getNode("root");
  root.drawn = false;

  setRightLevelToShow(
    {
      config: { levelsToShow: 4, constrained: true },
      labels: {
        hideLabel(node) {
          hiddenLabels.push(node.id);
        },
      },
      treeFitsInCanvas: (_node, _canvas, level) => level <= 1,
    },
    root,
    {},
    {
      execShow: false,
      execHide: false,
      onShow: (node) => events.push(["show", node.id]),
      onHide: (node) => events.push(["hide", node.id]),
    },
  );

  assert.deepEqual(events, [
    ["show", "root"],
    ["show", "one"],
    ["hide", "two"],
    ["hide", "three"],
    ["hide", "four"],
  ]);
  assert.deepEqual(hiddenLabels, []);
  assert.equal(root.drawn, true);
  assert.equal(graph.getNode("four").exist, true);
});
