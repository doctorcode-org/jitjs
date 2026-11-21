import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { merge } from "../dist/core/util.js";
import { Graph } from "../dist/graph/graph.js";
import { animatePlot } from "../dist/graph/plot-animation.js";
import {
  edgePropertyPlotInterpolator,
  edgeStylePlotInterpolator,
  labelPropertyPlotInterpolator,
  linearPlotInterpolator,
  moebiusPlotInterpolator,
  nodePropertyPlotInterpolator,
  nodeStylePlotInterpolator,
  polarPlotInterpolator,
} from "../dist/graph/plot-interpolators.js";
import { prepareGraphForAnimation } from "../dist/graph/plot-preparation.js";
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
const edgeConfig = {
  overridable: true,
  CanvasStyles: {},
};

function createGraph(GraphConstructor) {
  const graph = new GraphConstructor({}, nodeConfig, edgeConfig, {});
  graph.addNode({ id: "first", name: "First", data: {} });
  graph.addNode({ id: "second", name: "Second", data: {} });
  graph.getNode("first").pos.setc(10, -4);
  graph.getNode("second").pos.setc(-8, 12);
  return graph;
}

function createDriver(events, name) {
  return {
    options: undefined,
    setOptions(options) {
      this.options = options;
      events.push([name, "set", options.duration, options.nested]);
      return this;
    },
    start() {
      events.push([name, "start"]);
      return this;
    },
  };
}

function invokeDriver(driver) {
  driver.options.compute(0.25);
  driver.options.compute(0.75);
  driver.options.complete();
}

function runModern(type) {
  const events = [];
  const graph = createGraph(Graph);
  const animation = createDriver(events, "main");
  const nodeFxAnimation = createDriver(events, "nodefx");
  const versor = { marker: "versor" };
  const options = merge(
    {
      modes: ["unused"],
      duration: 120,
      hideLabels: true,
      nested: { fromDefaults: true, replaced: "default" },
    },
    {
      modes: ["custom:alpha:color"],
      duration: 80,
      type,
      nested: { replaced: "request", fromRequest: true },
      onComplete() {
        events.push(["complete"]);
      },
    },
  );
  const selectedDriver = type === "nodefx" ? nodeFxAnimation : animation;

  const selected = animatePlot(
    {
      animation: selectedDriver,
      prepare(modes) {
        return prepareGraphForAnimation(graph, modes);
      },
      eachNode(visit) {
        graph.eachNode(visit);
      },
      interpolate(mode, node, properties, delta, receivedVersor) {
        assert.equal(mode, "custom");
        events.push([
          "interpolate",
          node.id,
          [...properties],
          delta,
          receivedVersor === versor,
        ]);
      },
      setLabelsHidden(hidden) {
        events.push(["labels", hidden]);
      },
      plot(options, animating, delta) {
        events.push([
          "plot",
          animating ?? null,
          delta ?? null,
          options.duration,
          options.nested,
        ]);
      },
    },
    options,
    versor,
  );

  invokeDriver(selected);
  return { events, graph, animation, nodeFxAnimation, selected };
}

function runLegacy(type) {
  const events = [];
  const graph = createGraph(legacy.Graph);
  const animation = createDriver(events, "main");
  const nodeFxAnimation = createDriver(events, "nodefx");
  const versor = { marker: "versor" };
  const context = {
    viz: {
      graph,
      config: {
        modes: ["unused"],
        duration: 120,
        hideLabels: true,
        nested: { fromDefaults: true, replaced: "default" },
      },
    },
    animation,
    nodeFxAnimation,
    labels: {
      hideLabels(hidden) {
        events.push(["labels", hidden]);
      },
    },
    Interpolator: {
      custom(node, properties, delta, receivedVersor) {
        events.push([
          "interpolate",
          node.id,
          [...properties],
          delta,
          receivedVersor === versor,
        ]);
      },
    },
    prepare: legacy.Graph.Plot.prepare,
    plot(options, animating, delta) {
      events.push([
        "plot",
        animating ?? null,
        delta ?? null,
        options.duration,
        options.nested,
      ]);
    },
  };

  legacy.Graph.Plot.animate.call(
    context,
    {
      modes: ["custom:alpha:color"],
      duration: 80,
      type,
      nested: { replaced: "request", fromRequest: true },
      onComplete() {
        events.push(["complete"]);
      },
    },
    versor,
  );

  const selected = type === "nodefx" ? nodeFxAnimation : animation;
  invokeDriver(selected);
  return { events, graph, animation, nodeFxAnimation, selected };
}

test("plot animation orchestration matches legacy callback ordering", () => {
  const modern = runModern(undefined);
  const old = runLegacy(undefined);

  assert.deepEqual(modern.events, normalizeRealm(old.events));
  assert.strictEqual(modern.selected, modern.animation);
  assert.deepEqual(
    normalizeRealm(modern.graph.getNode("first").startPos.getc(true)),
    normalizeRealm(old.graph.getNode("first").startPos.getc(true)),
  );
});

test("nodefx animations use their dedicated driver like legacy", () => {
  const modern = runModern("nodefx");
  const old = runLegacy("nodefx");

  assert.deepEqual(modern.events, normalizeRealm(old.events));
  assert.strictEqual(modern.selected, modern.nodeFxAnimation);
  assert.equal(modern.animation.options, undefined);
});

test("plot animation stays separate from built-in interpolation code", async () => {
  const output = await readFile(
    new URL("../dist/graph/plot-animation.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\.\/interpolation\.js/);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});

test("built-in modes are explicit opt-in exports", () => {
  for (const interpolate of [
    linearPlotInterpolator,
    polarPlotInterpolator,
    moebiusPlotInterpolator,
    nodePropertyPlotInterpolator,
    edgePropertyPlotInterpolator,
    labelPropertyPlotInterpolator,
    nodeStylePlotInterpolator,
    edgeStylePlotInterpolator,
  ]) {
    assert.equal(typeof interpolate, "function");
  }
});
