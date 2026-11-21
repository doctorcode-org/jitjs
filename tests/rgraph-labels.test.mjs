import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getRGraphLabelPosition,
  placeRGraphHTMLLabel,
  placeRGraphSVGLabel,
} from "../dist/visualizations/rgraph-dom-labels.js";
import { RGraphHTMLLabels } from "../dist/visualizations/rgraph-html-labels.js";
import { RGraphNativeLabels } from "../dist/visualizations/rgraph-native-labels.js";
import { RGraphSVGLabels } from "../dist/visualizations/rgraph-svg-labels.js";
import {
  loadLegacyNamespace,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

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
    const container = new FakeElement(
      namespaceURI ? "g" : "div",
      this,
      namespaceURI,
    );
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

function createNode(id, position = { x: 10.25, y: -5.5 }) {
  const reads = [];
  const labelData = {
    style: "bold",
    size: 14,
    family: "sans-serif",
    textAlign: "center",
    color: "#123456",
    textBaseline: "middle",
  };
  return {
    reads,
    node: {
      id,
      name: "Radial node",
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { ...position };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return property === "height" ? 10 : undefined;
      },
      getLabelData(property) {
        reads.push(["label", property]);
        return labelData[property];
      },
    },
  };
}

function createCanvas(overrides = {}) {
  const reads = [];
  const textCalls = [];
  const context = {
    font: "",
    textAlign: "start",
    fillStyle: "",
    strokeStyle: "",
    textBaseline: "alphabetic",
    fillText(...arguments_) {
      textCalls.push(arguments_);
    },
  };
  const size = overrides.size ?? { width: 101, height: 81 };
  const canvas = {
    translateOffsetX: overrides.translateOffsetX ?? 7,
    translateOffsetY: overrides.translateOffsetY ?? -4,
    scaleOffsetX: overrides.scaleOffsetX ?? 2,
    scaleOffsetY: overrides.scaleOffsetY ?? 3,
    getCtx() {
      reads.push(["context"]);
      return context;
    },
    getSize() {
      reads.push(["size"]);
      return { ...size };
    },
  };
  return { canvas, context, reads, textCalls };
}

function createController(events) {
  return {
    onCreateLabel(element, node) {
      events.push(["create", element.id, node.id]);
    },
    onPlaceLabel(element, node) {
      events.push(["place", element.id, node.id]);
    },
  };
}

test("RGraph native labels retain Graph.Label.Native rendering", () => {
  const modernNode = createNode("native");
  const oldNode = createNode("native");
  const modern = createCanvas();
  const old = createCanvas();
  const controller = createController([]);

  new RGraphNativeLabels().plotLabel(
    modern.canvas,
    modernNode.node,
    controller,
  );
  new legacy.RGraph.Label.Native({}).plotLabel(
    old.canvas,
    oldNode.node,
    controller,
  );

  assert.deepEqual(modern.textCalls, old.textCalls);
  assert.deepEqual(
    {
      font: modern.context.font,
      textAlign: modern.context.textAlign,
      fillStyle: modern.context.fillStyle,
      strokeStyle: modern.context.strokeStyle,
      textBaseline: modern.context.textBaseline,
    },
    {
      font: old.context.font,
      textAlign: old.context.textAlign,
      fillStyle: old.context.fillStyle,
      strokeStyle: old.context.strokeStyle,
      textBaseline: old.context.textBaseline,
    },
  );
  assert.deepEqual(modern.textCalls, [["Radial node", 10.25, -0.5]]);
});

test("RGraph label projection preserves rounding, scaling, and translation", () => {
  const { node } = createNode("projection");
  const canvas = createCanvas();
  assert.deepEqual(getRGraphLabelPosition(node, canvas.canvas), {
    x: 78,
    y: 20,
  });
});

test("RGraph HTML placement matches legacy inside and outside the canvas", () => {
  const cases = [
    { position: { x: 10.25, y: -5.5 }, expectedDisplay: "" },
    { position: { x: 60, y: 0 }, expectedDisplay: "none" },
    { position: { x: -40, y: -20 }, expectedDisplay: "none" },
  ];

  for (const { position, expectedDisplay } of cases) {
    const modernDocument = new FakeDocument();
    const oldDocument = new FakeDocument();
    const modernElement = new FakeElement("div", modernDocument);
    const oldElement = new FakeElement("div", oldDocument);
    modernElement.id = oldElement.id = "html";
    const modernNode = createNode("html", position);
    const oldNode = createNode("html", position);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernEvents = [];
    const oldEvents = [];

    placeRGraphHTMLLabel(
      modernElement,
      modernNode.node,
      modernCanvas.canvas,
      createController(modernEvents),
    );
    const oldLabels = new legacy.RGraph.Label.HTML({
      canvas: oldCanvas.canvas,
    });
    oldLabels.placeLabel(
      oldElement,
      oldNode.node,
      createController(oldEvents),
    );

    assert.deepEqual(modernElement.style, oldElement.style);
    assert.equal(modernElement.style.display, expectedDisplay);
    assert.deepEqual(modernEvents, oldEvents);
    assert.deepEqual(modernNode.reads, oldNode.reads);
    assert.deepEqual(modernCanvas.reads, oldCanvas.reads);
  }
});

test("RGraph SVG placement matches legacy attributes and callback order", () => {
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernElement = new FakeElement("svg:text", modernDocument);
  const oldElement = new FakeElement("svg:text", oldDocument);
  modernElement.id = oldElement.id = "svg";
  const modernNode = createNode("svg");
  const oldNode = createNode("svg");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernEvents = [];
  const oldEvents = [];

  placeRGraphSVGLabel(
    modernElement,
    modernNode.node,
    modernCanvas.canvas,
    createController(modernEvents),
  );
  const oldLabels = new legacy.RGraph.Label.SVG({ canvas: oldCanvas.canvas });
  oldLabels.placeLabel(
    oldElement,
    oldNode.node,
    createController(oldEvents),
  );

  assert.deepEqual(
    Object.fromEntries(modernElement.attributes),
    Object.fromEntries(oldElement.attributes),
  );
  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(modernNode.reads, oldNode.reads);
  assert.deepEqual(modernCanvas.reads, oldCanvas.reads);
});

test("RGraph HTML class preserves legacy creation, caching, and placement", () => {
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("html-labels");
  const oldContainer = oldDocument.addContainer("html-labels");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode("html-node");
  const oldNode = createNode("html-node");
  const modernEvents = [];
  const oldEvents = [];
  let hasNode = true;

  const modern = new RGraphHTMLLabels({
    container: "html-labels",
    document: modernDocument,
    hasNode: () => hasNode,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.RGraph.Label.HTML({
    canvas: oldCanvas.canvas,
    config: { labelContainer: "html-labels" },
    graph: { hasNode: () => hasNode },
  });
  old.labels = {};
  old.labelContainer = false;

  const modernController = createController(modernEvents);
  const oldController = createController(oldEvents);
  modern.plotLabel(modernCanvas.canvas, modernNode.node, modernController);
  modern.plotLabel(modernCanvas.canvas, modernNode.node, modernController);
  old.plotLabel(oldCanvas.canvas, oldNode.node, oldController);
  old.plotLabel(oldCanvas.canvas, oldNode.node, oldController);

  assert.equal(modernContainer.children.length, 1);
  assert.equal(oldContainer.children.length, 1);
  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(modernContainer.children[0].style, oldContainer.children[0].style);
  assert.equal(modernContainer.children[0].className, "node");
  assert.equal(modernContainer.children[0].style.position, "absolute");

  modern.clearLabels();
  old.clearLabels();
  assert.equal(modernContainer.children.length, 1);
  assert.equal(oldContainer.children.length, 1);
  hasNode = false;
  modern.clearLabels();
  old.clearLabels();
  assert.equal(modernContainer.children.length, 0);
  assert.equal(oldContainer.children.length, 0);
});

test("RGraph SVG class preserves legacy element structure and placement", () => {
  const namespace = "http://www.w3.org/2000/svg";
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("svg-labels", namespace);
  const oldContainer = oldDocument.addContainer("svg-labels", namespace);
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode("svg-node");
  const oldNode = createNode("svg-node");
  const modernEvents = [];
  const oldEvents = [];

  const modern = new RGraphSVGLabels({
    container: modernContainer,
    document: modernDocument,
    hasNode: () => true,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.RGraph.Label.SVG({
    canvas: oldCanvas.canvas,
    config: { labelContainer: "svg-labels" },
    graph: { hasNode: () => true },
  });
  old.labels = {};
  old.labelContainer = false;

  modern.plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    createController(modernEvents),
  );
  old.plotLabel(
    oldCanvas.canvas,
    oldNode.node,
    createController(oldEvents),
  );

  const modernLabel = modernContainer.children[0];
  const oldLabel = oldContainer.children[0];
  assert.equal(modernLabel.namespaceURI, namespace);
  assert.equal(modernLabel.tagName, oldLabel.tagName);
  assert.equal(modernLabel.children[0].tagName, oldLabel.children[0].tagName);
  assert.deepEqual(
    Object.fromEntries(modernLabel.attributes),
    Object.fromEntries(oldLabel.attributes),
  );
  assert.deepEqual(modernEvents, oldEvents);
});

test("RGraph label entries stay backend-split and ambient-DOM-free", async () => {
  const [dom, native, html, svg] = await Promise.all([
    readFile(
      new URL("../dist/visualizations/rgraph-dom-labels.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/rgraph-native-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../dist/visualizations/rgraph-html-labels.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../dist/visualizations/rgraph-svg-labels.js", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(dom, /graph\/labels\/placement\.js/);
  assert.doesNotMatch(dom, /graph\/labels\/(?:html|svg|native)\.js/);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.doesNotMatch(native, /graph\/labels\/(?:html|svg|dom)\.js/);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.doesNotMatch(html, /graph\/labels\/(?:svg|native)\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/(?:html|native)\.js/);
  assert.doesNotMatch(
    `${dom}${native}${html}${svg}`,
    /\$jit|globalThis|\bdocument\s*\.|\bwindow\b|rgraph\.js/,
  );
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});
