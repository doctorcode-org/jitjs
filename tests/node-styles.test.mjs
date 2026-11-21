import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NodeStyleController } from "../dist/extras/node-styles.js";
import {
  loadLegacyBinding,
  normalizeRealm,
} from "./legacy-harness.mjs";

const legacyExtras = loadLegacyBinding("Extras");
const LegacyNodeStyles = legacyExtras.Classes.NodeStyles;
const config = {
  enable: true,
  type: "Native",
  stylesHover: { color: "#ff0000", dim: 20 },
  stylesClick: { color: "#00ff00", dim: 30 },
  duration: 125,
};

function createNode(id, color, dim) {
  return {
    id,
    data: {
      $type: "circle",
      $color: color,
      $dim: dim,
      nested: { retained: true },
    },
    endData: {},
    getData(property, phase) {
      const store = phase === "end" ? this.endData : this.data;
      return store[`$${property}`] ?? this.data[`$${property}`];
    },
    setData(property, value, phase) {
      const store = phase === "end" ? this.endData : this.data;
      store[`$${property}`] = value;
    },
  };
}

function createNodes() {
  return [
    createNode("first", "#112233", 8),
    createNode("second", "#445566", 12),
  ];
}

function effectSnapshot(options) {
  return {
    elements: normalizeRealm(options.elements),
    duration: options.duration,
    fps: options.fps,
    enable: options.enable,
    type: options.type,
    stylesHover: normalizeRealm(options.stylesHover),
    stylesClick: normalizeRealm(options.stylesClick),
    transitionAtQuarter: options.transition(0.25),
  };
}

function nodeSnapshot(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    data: normalizeRealm(node.data),
    endData: normalizeRealm(node.endData),
    styles: normalizeRealm(node.styles),
    selected: Boolean(node.selected),
    hovered: Boolean(node.hovered),
  }));
}

function createModern(nodes, effects, stops) {
  return new NodeStyleController(config, {
    graph: {
      eachNode(visit) {
        nodes.forEach(visit);
      },
    },
    nodeFx(options) {
      effects.push(effectSnapshot(options));
    },
    stopNodeFx() {
      stops.push("stop");
    },
  });
}

function createLegacy(nodes, effects, stops) {
  const graph = {
    eachNode(visit) {
      nodes.forEach(visit);
    },
  };
  const fx = {
    nodeFx(options) {
      effects.push(effectSnapshot(options));
    },
    nodeFxAnimation: {
      stopTimer() {
        stops.push("stop");
      },
    },
  };
  const controller = Object.create(LegacyNodeStyles.prototype);
  Object.assign(controller, {
    config,
    nStyles: config,
    nodeStylesOnHover: config.stylesHover,
    nodeStylesOnClick: config.stylesClick,
    hoveredNode: false,
    dom: false,
    types: {
      circle: {
        contains() {
          return false;
        },
      },
    },
    fx,
    viz: { graph, fx },
  });
  return controller;
}

test("click selection and restoration match legacy NodeStyles", () => {
  const modernNodes = createNodes();
  const legacyNodes = createNodes();
  const modernEffects = [];
  const legacyEffects = [];
  const modern = createModern(modernNodes, modernEffects, []);
  const old = createLegacy(legacyNodes, legacyEffects, []);

  modern.click(modernNodes[0]);
  LegacyNodeStyles.prototype.onClick.call(old, legacyNodes[0]);
  modern.click(modernNodes[1]);
  LegacyNodeStyles.prototype.onClick.call(old, legacyNodes[1]);
  modern.click(modernNodes[1]);
  LegacyNodeStyles.prototype.onClick.call(old, legacyNodes[1]);

  assert.deepEqual(nodeSnapshot(modernNodes), nodeSnapshot(legacyNodes));
  assert.deepEqual(modernEffects, normalizeRealm(legacyEffects));
  assert.notStrictEqual(modernNodes[0].styles.nested, modernNodes[0].data.nested);
});

test("native hover entry and exit match legacy state transitions", () => {
  const modernNodes = createNodes();
  const legacyNodes = createNodes();
  const modernEffects = [];
  const legacyEffects = [];
  const modernStops = [];
  const legacyStops = [];
  const modern = createModern(modernNodes, modernEffects, modernStops);
  const old = createLegacy(legacyNodes, legacyEffects, legacyStops);

  modern.hover(modernNodes[0]);
  LegacyNodeStyles.prototype.onMouseMove.call(old, null, null, {
    getNode: () => legacyNodes[0],
    getPos: () => ({ x: 0, y: 0 }),
  });
  modern.hover(false);
  LegacyNodeStyles.prototype.onMouseMove.call(old, null, null, {
    getNode: () => false,
    getPos: () => ({ x: 100, y: 100 }),
  });

  assert.deepEqual(nodeSnapshot(modernNodes), nodeSnapshot(legacyNodes));
  assert.deepEqual(modernEffects, normalizeRealm(legacyEffects));
  assert.deepEqual(modernStops, legacyStops);
  assert.equal(modern.hoveredNode, false);
});

test("node styles do not import graph, Canvas, DOM, or a registry", async () => {
  const output = await readFile(
    new URL("../dist/extras/node-styles.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /graph\/graph|canvas\/canvas|browser\/dom/);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
