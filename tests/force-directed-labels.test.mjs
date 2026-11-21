import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getForceDirectedLabelPosition,
  placeForceDirectedHTMLLabel,
  placeForceDirectedSVGLabel,
} from "../dist/visualizations/force-directed-dom-labels.js";
import { ForceDirectedHTMLLabels } from "../dist/visualizations/force-directed-html-labels.js";
import {
  ForceDirectedNativeLabels,
  renderForceDirectedNativeLabel,
} from "../dist/visualizations/force-directed-native-labels.js";
import { ForceDirectedSVGLabels } from "../dist/visualizations/force-directed-svg-labels.js";
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

function createNode(id = "node", position = { x: 10.25, y: -5.5 }) {
  const calls = [];
  const labelData = {
    style: "italic",
    size: 13,
    family: "serif",
    textAlign: "center",
    color: "#234567",
    textBaseline: "middle",
  };
  return {
    calls,
    node: {
      id,
      name: "Force node",
      pos: {
        getc(simple) {
          calls.push(["position", simple]);
          return { ...position };
        },
      },
      getData(property) {
        calls.push(["data", property]);
        return property === "height" ? 14 : undefined;
      },
      getLabelData(property) {
        calls.push(["label", property]);
        return labelData[property];
      },
    },
  };
}

function createCanvas(overrides = {}) {
  const calls = [];
  const context = {
    fillText(...arguments_) {
      calls.push(["fillText", ...arguments_]);
    },
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
      get() {
        return value;
      },
      set(next) {
        value = next;
        calls.push([property, next]);
      },
    });
  }
  const canvas = {
    translateOffsetX: 7,
    translateOffsetY: -4,
    scaleOffsetX: 2,
    scaleOffsetY: 3,
    getCtx() {
      calls.push(["getCtx"]);
      return context;
    },
    getSize() {
      calls.push(["getSize"]);
      return { width: 101, height: 81 };
    },
    ...overrides,
  };
  return { calls, context, canvas };
}

function createController(events) {
  return {
    onCreateLabel(element, node) {
      events.push([
        "create",
        element.id,
        node.id,
        Boolean(element.parentNode),
      ]);
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

function elementSnapshot(element) {
  return {
    attributes: Object.fromEntries(element.attributes),
    children: element.children.map((child) => child.tagName),
    className: element.className,
    id: element.id,
    namespaceURI: element.namespaceURI,
    style: { ...element.style },
    tagName: element.tagName,
  };
}

test("ForceDirected native label class matches legacy calls, reads, and output", () => {
  const modernNode = createNode("native");
  const oldNode = createNode("native");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();

  new ForceDirectedNativeLabels().plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    {},
  );
  new legacy.ForceDirected.Label.Native({}).plotLabel(
    oldCanvas.canvas,
    oldNode.node,
    {},
  );

  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  assert.deepEqual(modernNode.calls, oldNode.calls);
  assert.deepEqual(
    modernCanvas.calls.at(-1),
    ["fillText", "Force node", 10.25, 1.5],
  );
});

test("ForceDirected standalone native renderer matches inherited renderLabel", () => {
  const modernNode = createNode("native-render");
  const oldNode = createNode("native-render");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();

  renderForceDirectedNativeLabel(modernCanvas.canvas, modernNode.node, {});
  new legacy.ForceDirected.Label.Native({}).renderLabel(
    oldCanvas.canvas,
    oldNode.node,
    {},
  );

  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  assert.deepEqual(modernNode.calls, oldNode.calls);
});

test("ForceDirected projection preserves legacy scale, translation, and rounding", () => {
  for (const position of [
    { x: 10.25, y: -5.5 },
    { x: -12.75, y: 8.6 },
    { x: 0.24, y: -0.5 },
  ]) {
    const modernNode = createNode("projection", position);
    const oldNode = createNode("projection", position);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const oldElement = new FakeElement("svg:text", new FakeDocument());
    const oldLabels = new legacy.ForceDirected.Label.SVG({
      canvas: oldCanvas.canvas,
    });

    const modernPosition = getForceDirectedLabelPosition(
      modernNode.node,
      modernCanvas.canvas,
    );
    oldLabels.placeLabel(oldElement, oldNode.node, { onPlaceLabel() {} });

    assert.deepEqual(modernPosition, {
      x: Number(oldElement.attributes.get("x")),
      y: Number(oldElement.attributes.get("y")),
    });
    assert.deepEqual(modernNode.calls, oldNode.calls);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  }
});

test("ForceDirected HTML placement matches legacy at every canvas boundary", () => {
  const cases = [
    { position: { x: 10.25, y: -5.5 }, display: "" },
    { position: { x: 21, y: 0 }, display: "" },
    { position: { x: 21.5, y: 0 }, display: "none" },
    { position: { x: -29, y: 0 }, display: "" },
    { position: { x: -29.5, y: 0 }, display: "none" },
    { position: { x: 0, y: -12 }, display: "" },
    { position: { x: 0, y: -12.5 }, display: "none" },
    { position: { x: 0, y: 14.5 }, display: "" },
    { position: { x: 0, y: 14.75 }, display: "none" },
  ];

  for (const { position, display } of cases) {
    const modernElement = new FakeElement("div", new FakeDocument());
    const oldElement = new FakeElement("div", new FakeDocument());
    modernElement.id = oldElement.id = "html";
    const modernNode = createNode("html", position);
    const oldNode = createNode("html", position);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernEvents = [];
    const oldEvents = [];

    placeForceDirectedHTMLLabel(
      modernElement,
      modernNode.node,
      modernCanvas.canvas,
      createController(modernEvents),
    );
    new legacy.ForceDirected.Label.HTML({
      canvas: oldCanvas.canvas,
    }).placeLabel(
      oldElement,
      oldNode.node,
      createController(oldEvents),
    );

    assert.deepEqual(modernElement.style, oldElement.style);
    assert.equal(modernElement.style.display, display);
    assert.deepEqual(modernEvents, oldEvents);
    assert.deepEqual(modernNode.calls, oldNode.calls);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  }
});

test("ForceDirected SVG placement matches legacy attributes and callback order", () => {
  const modernElement = new FakeElement("svg:text", new FakeDocument());
  const oldElement = new FakeElement("svg:text", new FakeDocument());
  modernElement.id = oldElement.id = "svg";
  const modernNode = createNode("svg");
  const oldNode = createNode("svg");
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernEvents = [];
  const oldEvents = [];

  placeForceDirectedSVGLabel(
    modernElement,
    modernNode.node,
    modernCanvas.canvas,
    createController(modernEvents),
  );
  new legacy.ForceDirected.Label.SVG({
    canvas: oldCanvas.canvas,
  }).placeLabel(
    oldElement,
    oldNode.node,
    createController(oldEvents),
  );

  assert.deepEqual(
    Object.fromEntries(modernElement.attributes),
    Object.fromEntries(oldElement.attributes),
  );
  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(modernNode.calls, oldNode.calls);
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
});

test("ForceDirected HTML label lifecycle matches legacy", () => {
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

  const modern = new ForceDirectedHTMLLabels({
    container: "html-labels",
    document: modernDocument,
    hasNode: () => hasNode,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.ForceDirected.Label.HTML({
    canvas: oldCanvas.canvas,
    config: { labelContainer: "html-labels" },
    graph: { hasNode: () => hasNode },
  });
  old.labels = {};
  old.labelContainer = false;
  old.labelsHidden = false;

  const modernController = createController(modernEvents);
  const oldController = createController(oldEvents);
  modern.plotLabel(modernCanvas.canvas, modernNode.node, modernController);
  modern.plotLabel(modernCanvas.canvas, modernNode.node, modernController);
  old.plotLabel(oldCanvas.canvas, oldNode.node, oldController);
  old.plotLabel(oldCanvas.canvas, oldNode.node, oldController);

  assert.equal(modernContainer.children.length, 1);
  assert.equal(oldContainer.children.length, 1);
  assert.deepEqual(
    elementSnapshot(modernContainer.children[0]),
    elementSnapshot(oldContainer.children[0]),
  );
  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(modernNode.calls, oldNode.calls);
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);

  modern.hideLabel(modernNode.node, false);
  old.hideLabel(oldNode.node, false);
  assert.equal(
    modernContainer.children[0].style.display,
    oldContainer.children[0].style.display,
  );
  modern.hideLabel(modernNode.node, true);
  old.hideLabel(oldNode.node, true);
  modern.hideLabels(true);
  old.hideLabels(true);
  assert.equal(modern.labelsHidden, old.labelsHidden);
  assert.equal(modernContainer.style.display, oldContainer.style.display);
  modern.hideLabels(false);
  old.hideLabels(false);

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

test("ForceDirected SVG label lifecycle and structure match legacy", () => {
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

  const modern = new ForceDirectedSVGLabels({
    container: modernContainer,
    document: modernDocument,
    hasNode: () => true,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.ForceDirected.Label.SVG({
    canvas: oldCanvas.canvas,
    config: { labelContainer: "svg-labels" },
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
  old.plotLabel(
    oldCanvas.canvas,
    oldNode.node,
    createController(oldEvents),
  );

  assert.deepEqual(
    elementSnapshot(modernContainer.children[0]),
    elementSnapshot(oldContainer.children[0]),
  );
  assert.deepEqual(modernEvents, oldEvents);
  assert.deepEqual(modernNode.calls, oldNode.calls);
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);

  modern.clearLabels(true);
  old.clearLabels(true);
  assert.equal(modernContainer.children.length, 0);
  assert.equal(oldContainer.children.length, 0);
});

test("ForceDirected label entries stay backend-split, registry-free, and SSR-safe", async () => {
  assert.equal(Object.hasOwn(globalThis, "document"), false);
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  const [contracts, dom, native, html, svg] = await Promise.all(
    [
      "force-directed-label-contracts",
      "force-directed-dom-labels",
      "force-directed-native-labels",
      "force-directed-html-labels",
      "force-directed-svg-labels",
    ].map((name) =>
      readFile(
        new URL(`../dist/visualizations/${name}.js`, import.meta.url),
        "utf8",
      ),
    ),
  );

  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.match(dom, /graph\/labels\/placement\.js/);
  assert.doesNotMatch(dom, /graph\/labels\/(?:html|svg|native)\.js/);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.doesNotMatch(native, /graph\/labels\/(?:html|svg|dom)\.js/);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.doesNotMatch(html, /graph\/labels\/(?:svg|native)\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/(?:html|native)\.js/);
  assert.doesNotMatch(
    `${contracts}${dom}${native}${html}${svg}`,
    /\$jit|globalThis|\bdocument\s*\.|\bwindow\b|force-directed\.js/,
  );
});
