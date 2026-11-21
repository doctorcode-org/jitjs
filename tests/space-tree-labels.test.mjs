import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { placeSpaceTreeDOMLabel } from "../dist/visualizations/space-tree-dom-labels.js";
import { SpaceTreeHTMLLabels } from "../dist/visualizations/space-tree-html-labels.js";
import {
  renderSpaceTreeNativeLabel,
  SpaceTreeNativeLabels,
} from "../dist/visualizations/space-tree-native-labels.js";
import { SpaceTreeSVGLabels } from "../dist/visualizations/space-tree-svg-labels.js";
import {
  loadLegacyNamespace,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const orientations = ["top", "right", "bottom", "left"];
const alignments = ["left", "center", "right"];

class FakeElement {
  constructor(tagName, ownerDocument, namespaceURI = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.namespaceURI = namespaceURI;
    this.id = "";
    this.className = "";
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) this.ownerDocument.elements.set(child.id, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    if (child.id) this.ownerDocument.elements.delete(child.id);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  addContainer(id, namespaceURI = null) {
    const container = new FakeElement(namespaceURI ? "g" : "div", this, namespaceURI);
    container.id = id;
    this.elements.set(id, container);
    return container;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(namespaceURI, qualifiedName) {
    return new FakeElement(qualifiedName, this, namespaceURI);
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }
}

function createConfig(orientation, align) {
  return { orientation, Node: { align } };
}

function createNode(id = "node") {
  const reads = [];
  const labelData = {
    style: "italic",
    size: 13,
    family: "serif",
    textAlign: "center",
    color: "#234567",
    textBaseline: "middle",
  };
  return {
    reads,
    node: {
      id,
      name: "A node",
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { x: 11.4, y: -7.6 };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return property === "width" ? 30 : property === "height" ? 14 : undefined;
      },
      getLabelData(property) {
        reads.push(["label", property]);
        return labelData[property];
      },
    },
  };
}

function createCanvas(overrides = {}) {
  const calls = [];
  const context = {
    fillText(...arguments_) { calls.push(["fillText", ...arguments_]); },
  };
  for (const property of [
    "font",
    "textAlign",
    "fillStyle",
    "strokeStyle",
    "textBaseline",
  ]) {
    let value = "";
    Object.defineProperty(context, property, {
      configurable: true,
      get() { return value; },
      set(next) {
        value = next;
        calls.push([property, next]);
      },
    });
  }
  const canvas = {
    translateOffsetX: 7.25,
    translateOffsetY: -3.5,
    scaleOffsetX: 1.75,
    scaleOffsetY: 0.8,
    getCtx() {
      calls.push(["getCtx"]);
      return context;
    },
    getSize() {
      calls.push(["getSize"]);
      return { width: 121, height: 81 };
    },
    ...overrides,
  };
  return { calls, context, canvas };
}

function createLegacyPlot(config) {
  const viz = {
    config: { ...config, Edge: {}, multitree: false },
    labels: {},
  };
  return new legacy.ST.Plot(viz, legacy.ST);
}

function createController(events) {
  return {
    onCreateLabel(element, node) {
      events.push(["create", element.id, node.id, Boolean(element.parentNode)]);
    },
    onPlaceLabel(element, node) {
      events.push([
        "place",
        element.id,
        node.id,
        element.style.left,
        element.style.top,
        element.style.display,
      ]);
    },
  };
}

function styleSnapshot(element) {
  return {
    display: element.style.display,
    left: element.style.left,
    position: element.style.position,
    top: element.style.top,
  };
}

function elementSnapshot(element) {
  return {
    attributes: Object.fromEntries(element.attributes),
    children: element.children.map((child) => child.tagName),
    className: element.className,
    id: element.id,
    namespaceURI: element.namespaceURI,
    style: styleSnapshot(element),
    tagName: element.tagName,
  };
}

test("SpaceTree DOM placement matches JIT 2.0.1 for every orientation and alignment", () => {
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig(orientation, align);
      const modernNode = createNode();
      const oldNode = createNode();
      const modernCanvas = createCanvas();
      const oldCanvas = createCanvas();
      const modernElement = { style: {} };
      const oldElement = { style: {} };
      const modernEvents = [];
      const oldEvents = [];
      const modernController = {
        onPlaceLabel(element, node) {
          modernEvents.push([element.style.left, element.style.top, element.style.display, node.id]);
        },
      };
      const oldController = {
        onPlaceLabel(element, node) {
          oldEvents.push([element.style.left, element.style.top, element.style.display, node.id]);
        },
      };

      placeSpaceTreeDOMLabel(
        modernElement,
        modernNode.node,
        modernCanvas.canvas,
        modernController,
        config,
      );
      const old = new legacy.ST.Label.DOM();
      old.viz = {
        canvas: oldCanvas.canvas,
        config,
      };
      old.placeLabel(oldElement, oldNode.node, oldController);

      assert.deepEqual(modernElement.style, oldElement.style, `${orientation}/${align}`);
      assert.deepEqual(modernEvents, oldEvents);
      assert.deepEqual(modernNode.reads, oldNode.reads);
      assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
    }
  }
});

test("SpaceTree DOM placement keeps legacy canvas-boundary behavior", () => {
  for (const position of [
    { x: -60, y: 0 },
    { x: 60, y: 0 },
    { x: 0, y: -40 },
    { x: 0, y: 40 },
  ]) {
    const config = createConfig("top", "center");
    const element = { style: {} };
    const node = createNode().node;
    node.pos.getc = () => position;
    placeSpaceTreeDOMLabel(
      element,
      node,
      createCanvas({
        translateOffsetX: 0,
        translateOffsetY: 0,
        scaleOffsetX: 1,
        scaleOffsetY: 1,
        getSize: () => ({ width: 100, height: 60 }),
      }).canvas,
      { onPlaceLabel() {} },
      config,
    );
    const projectedLeft = Math.round(position.x - 15 + 50);
    const projectedTop = Math.round(position.y - 7 + 30);
    assert.equal(
      element.style.display,
      projectedLeft >= 0 && projectedLeft < 100 && projectedTop >= 0 && projectedTop < 60
        ? ""
        : "none",
    );
  }
});

test("SpaceTree native label rendering and style reads match legacy", () => {
  for (const orientation of orientations) {
    for (const align of alignments) {
      const config = createConfig(orientation, align);
      const modernNode = createNode();
      const oldNode = createNode();
      const modernCanvas = createCanvas();
      const oldCanvas = createCanvas();
      const modern = new SpaceTreeNativeLabels(config);
      const old = new legacy.ST.Label.Native({
        fx: createLegacyPlot(config),
      });

      modern.plotLabel(modernCanvas.canvas, modernNode.node, {});
      old.plotLabel(oldCanvas.canvas, oldNode.node, {});
      assert.deepEqual(modernCanvas.calls, oldCanvas.calls, `${orientation}/${align}`);
      assert.deepEqual(modernNode.reads, oldNode.reads, `${orientation}/${align} reads`);
    }
  }
});

test("SpaceTree standalone native renderer has the same aligned output", () => {
  const config = createConfig("right", "left");
  const modernNode = createNode();
  const oldNode = createNode();
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  renderSpaceTreeNativeLabel(
    modernCanvas.canvas,
    modernNode.node,
    {},
    config,
  );
  new legacy.ST.Label.Native({ fx: createLegacyPlot(config) }).renderLabel(
    oldCanvas.canvas,
    oldNode.node,
    {},
  );
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  assert.deepEqual(modernNode.reads, oldNode.reads);
});

function exerciseHTMLPair(orientation, align) {
  const config = createConfig(orientation, align);
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels");
  const oldContainer = oldDocument.addContainer("labels");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode("html-node");
  const oldNode = createNode("html-node");
  const modernEvents = [];
  const oldEvents = [];

  const modern = new SpaceTreeHTMLLabels({
    container: "labels",
    document: modernDocument,
    hasNode: () => true,
    config,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.ST.Label.HTML({
    canvas: oldCanvas.canvas,
    config: { ...config, labelContainer: "labels" },
    graph: { hasNode: () => true },
  });
  old.labels = {};
  old.labelContainer = false;
  old.labelsHidden = false;

  modern.plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    createController(modernEvents),
  );
  old.plotLabel(oldCanvas.canvas, oldNode.node, createController(oldEvents));
  modern.plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    createController(modernEvents),
  );
  old.plotLabel(oldCanvas.canvas, oldNode.node, createController(oldEvents));

  return {
    modern,
    old,
    modernContainer,
    oldContainer,
    modernNode,
    oldNode,
    modernCanvas,
    oldCanvas,
    modernEvents,
    oldEvents,
  };
}

test("SpaceTree HTML label lifecycle and placement match legacy", () => {
  for (const orientation of orientations) {
    for (const align of alignments) {
      const pair = exerciseHTMLPair(orientation, align);
      assert.equal(pair.modernContainer.children.length, 1);
      assert.equal(pair.oldContainer.children.length, 1);
      assert.deepEqual(
        elementSnapshot(pair.modernContainer.children[0]),
        elementSnapshot(pair.oldContainer.children[0]),
        `${orientation}/${align}`,
      );
      assert.deepEqual(pair.modernEvents, pair.oldEvents);
      assert.deepEqual(pair.modernNode.reads, pair.oldNode.reads);
      assert.deepEqual(pair.modernCanvas.calls, pair.oldCanvas.calls);

      pair.modern.hideLabel(pair.modernNode.node, false);
      pair.old.hideLabel(pair.oldNode.node, false);
      assert.equal(
        pair.modernContainer.children[0].style.display,
        pair.oldContainer.children[0].style.display,
      );
    }
  }
});

test("SpaceTree SVG label lifecycle and placement match legacy", () => {
  const namespace = "http://www.w3.org/2000/svg";
  for (const orientation of orientations) {
    const config = createConfig(orientation, "right");
    const modernDocument = new FakeDocument();
    const oldDocument = new FakeDocument();
    const modernContainer = modernDocument.addContainer("labels", namespace);
    const oldContainer = oldDocument.addContainer("labels", namespace);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernNode = createNode("svg-node");
    const oldNode = createNode("svg-node");
    const modernEvents = [];
    const oldEvents = [];
    const modern = new SpaceTreeSVGLabels({
      container: modernContainer,
      document: modernDocument,
      hasNode: () => true,
      config,
    });

    setLegacyDocument(oldDocument);
    const old = new legacy.ST.Label.SVG({
      canvas: oldCanvas.canvas,
      config: { ...config, labelContainer: "labels" },
      graph: { hasNode: () => true },
    });
    old.labels = {};
    old.labelContainer = false;
    old.labelsHidden = false;

    modern.plotLabel(
      modernCanvas.canvas,
      modernNode.node,
      createController(modernEvents),
    );
    old.plotLabel(oldCanvas.canvas, oldNode.node, createController(oldEvents));

    assert.deepEqual(
      elementSnapshot(modernContainer.children[0]),
      elementSnapshot(oldContainer.children[0]),
      orientation,
    );
    assert.deepEqual(modernEvents, oldEvents);
    assert.deepEqual(modernNode.reads, oldNode.reads);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  }
});

test("SpaceTree label entries stay split, registry-free, and SSR-safe", async () => {
  assert.equal(globalThis.document, undefined);
  const sources = await Promise.all(
    [
      "space-tree-label-contracts",
      "space-tree-dom-labels",
      "space-tree-native-labels",
      "space-tree-html-labels",
      "space-tree-svg-labels",
    ].map((name) =>
      readFile(
        new URL(`../dist/visualizations/${name}.js`, import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.doesNotMatch(sources.join("\n"), /\$jit|window/);
  assert.doesNotMatch(sources[0], /^\s*import\s/m);
  assert.doesNotMatch(sources[1], /graph\/labels\/(?:html|svg|native)\.js/);
  assert.match(sources[2], /graph\/labels\/native\.js/);
  assert.match(sources[3], /graph\/labels\/html\.js/);
  assert.match(sources[4], /graph\/labels\/svg\.js/);
});
