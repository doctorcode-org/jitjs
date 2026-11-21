import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getHypertreeLabelPosition,
  placeHypertreeHTMLLabel,
  placeHypertreeSVGLabel,
} from "../dist/visualizations/hypertree-dom-labels.js";
import { HypertreeHTMLLabels } from "../dist/visualizations/hypertree-html-labels.js";
import {
  HypertreeNativeLabels,
  renderHypertreeNativeLabel,
} from "../dist/visualizations/hypertree-native-labels.js";
import { HypertreeSVGLabels } from "../dist/visualizations/hypertree-svg-labels.js";
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
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "id") this.id = normalized;
    if (name === "class") this.className = normalized;
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

function createNode(id = "hyper", position = { x: 0.25, y: -0.3 }) {
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
      name: "Hyper node",
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { ...position };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return property === "height" ? 12 : undefined;
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
    Object.defineProperty(context, property, {
      configurable: true,
      get() {
        return undefined;
      },
      set(value) {
        calls.push([property, value]);
      },
    });
  }
  const size = overrides.size ?? { width: 101, height: 81 };
  const canvas = {
    get translateOffsetX() {
      calls.push(["translateOffsetX"]);
      return overrides.translateOffsetX ?? 7;
    },
    get translateOffsetY() {
      calls.push(["translateOffsetY"]);
      return overrides.translateOffsetY ?? -4;
    },
    get scaleOffsetX() {
      calls.push(["scaleOffsetX"]);
      return overrides.scaleOffsetX ?? 2;
    },
    get scaleOffsetY() {
      calls.push(["scaleOffsetY"]);
      return overrides.scaleOffsetY ?? 3;
    },
    getCtx() {
      calls.push(["context"]);
      return context;
    },
    getSize() {
      calls.push(["size"]);
      return { ...size };
    },
  };
  return { calls, canvas, context };
}

function createRadiusResolver(events, radius = 40) {
  return () => {
    events.push(["radius"]);
    return radius;
  };
}

function createController(events) {
  return {
    onCreateLabel(element, node) {
      events.push(["create", element.id, node.id, element.parentNode !== null]);
    },
    onPlaceLabel(element, node) {
      events.push(["place", element.id, node.id]);
    },
  };
}

test("Hypertree native labels match styling, access order, and scaled coordinates", () => {
  const modernNode = createNode("native", { x: 0.4, y: -0.125 });
  const oldNode = createNode("native", { x: 0.4, y: -0.125 });
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernRadiusEvents = [];
  const oldRadiusEvents = [];
  const controller = {};

  new HypertreeNativeLabels(
    createRadiusResolver(modernRadiusEvents, 80),
  ).plotLabel(modernCanvas.canvas, modernNode.node, controller);
  new legacy.Hypertree.Label.Native({
    getRadius: createRadiusResolver(oldRadiusEvents, 80),
  }).plotLabel(oldCanvas.canvas, oldNode.node, controller);

  assert.deepEqual(modernNode.reads, oldNode.reads);
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  assert.deepEqual(modernRadiusEvents, oldRadiusEvents);
  assert.deepEqual(
    modernCanvas.calls.at(-1),
    ["fillText", "Hyper node", 32, -10],
  );
});

test("Hypertree native renderer remains independently callable", () => {
  const node = createNode("standalone", { x: -0.2, y: 0.5 });
  const canvas = createCanvas();
  const radiusEvents = [];
  renderHypertreeNativeLabel(
    canvas.canvas,
    node.node,
    {},
    createRadiusResolver(radiusEvents, 60),
  );
  assert.deepEqual(canvas.calls, [
    ["context"],
    ["fillText", "Hyper node", -12, 30],
  ]);
  assert.deepEqual(node.reads, [["position", true]]);
  assert.deepEqual(radiusEvents, [["radius"]]);
});

test("Hypertree radial projection preserves legacy read order and rounding", () => {
  const node = createNode("projection");
  const canvas = createCanvas();
  const radiusEvents = [];

  assert.deepEqual(
    getHypertreeLabelPosition(
      node.node,
      canvas.canvas,
      createRadiusResolver(radiusEvents),
    ),
    { x: 78, y: 1 },
  );
  assert.deepEqual(node.reads, [["position", true]]);
  assert.deepEqual(canvas.calls, [
    ["translateOffsetX"],
    ["translateOffsetY"],
    ["scaleOffsetX"],
    ["scaleOffsetY"],
    ["size"],
  ]);
  assert.deepEqual(radiusEvents, [["radius"]]);
});

test("Hypertree HTML placement matches legacy for every canvas boundary", () => {
  const cases = [
    { position: { x: 0.25, y: -0.3 }, expected: "" },
    { position: { x: 0.55, y: 0 }, expected: "none" },
    { position: { x: -0.8, y: -0.5 }, expected: "none" },
    { position: { x: 0.5375, y: 0 }, expected: "none" },
  ];

  for (const { position, expected } of cases) {
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
    const modernRadiusEvents = [];
    const oldRadiusEvents = [];

    placeHypertreeHTMLLabel(
      modernElement,
      modernNode.node,
      modernCanvas.canvas,
      createController(modernEvents),
      createRadiusResolver(modernRadiusEvents),
    );
    new legacy.Hypertree.Label.HTML({
      canvas: oldCanvas.canvas,
      getRadius: createRadiusResolver(oldRadiusEvents),
    }).placeLabel(
      oldElement,
      oldNode.node,
      createController(oldEvents),
    );

    assert.deepEqual(modernElement.style, oldElement.style);
    assert.equal(modernElement.style.display, expected);
    assert.deepEqual(modernNode.reads, oldNode.reads);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
    assert.deepEqual(modernRadiusEvents, oldRadiusEvents);
    assert.deepEqual(modernEvents, oldEvents);
  }
});

test("Hypertree SVG placement matches legacy attributes and callback order", () => {
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
  const modernRadiusEvents = [];
  const oldRadiusEvents = [];

  placeHypertreeSVGLabel(
    modernElement,
    modernNode.node,
    modernCanvas.canvas,
    createController(modernEvents),
    createRadiusResolver(modernRadiusEvents),
  );
  new legacy.Hypertree.Label.SVG({
    canvas: oldCanvas.canvas,
    getRadius: createRadiusResolver(oldRadiusEvents),
  }).placeLabel(
    oldElement,
    oldNode.node,
    createController(oldEvents),
  );

  assert.deepEqual(
    Object.fromEntries(modernElement.attributes),
    Object.fromEntries(oldElement.attributes),
  );
  assert.deepEqual(modernNode.reads, oldNode.reads);
  assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  assert.deepEqual(modernRadiusEvents, oldRadiusEvents);
  assert.deepEqual(modernEvents, oldEvents);
});

function snapshotElement(element) {
  return {
    id: element.id,
    className: element.className,
    style: { ...element.style },
    attributes: Object.fromEntries(element.attributes),
    children: element.children.map((child) => child.tagName),
  };
}

function exerciseDOMLabels(kind) {
  const namespace = kind === "SVG" ? "http://www.w3.org/2000/svg" : null;
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels", namespace);
  const oldContainer = oldDocument.addContainer("labels", namespace);
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode(`${kind.toLowerCase()}-node`);
  const oldNode = createNode(`${kind.toLowerCase()}-node`);
  const modernEvents = [];
  const oldEvents = [];
  const modernRadiusEvents = [];
  const oldRadiusEvents = [];
  let hasNode = true;
  const ModernLabels = kind === "SVG" ? HypertreeSVGLabels : HypertreeHTMLLabels;
  const modern = new ModernLabels({
    container: "labels",
    document: modernDocument,
    hasNode: () => hasNode,
    getRadius: createRadiusResolver(modernRadiusEvents),
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.Hypertree.Label[kind]({
    canvas: oldCanvas.canvas,
    config: { labelContainer: "labels" },
    graph: { hasNode: () => hasNode },
    getRadius: createRadiusResolver(oldRadiusEvents),
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

  const result = {
    modernNode,
    oldNode,
    modernCanvas,
    oldCanvas,
    modernRadiusEvents,
    oldRadiusEvents,
    modernEvents,
    oldEvents,
    modernElement: snapshotElement(modernContainer.children[0]),
    oldElement: snapshotElement(oldContainer.children[0]),
    counts: [modernContainer.children.length, oldContainer.children.length],
  };

  modern.hideLabels(true);
  old.hideLabels(true);
  result.hiddenContainers = [
    modernContainer.style.display,
    oldContainer.style.display,
  ];
  modern.hideLabels(false);
  old.hideLabels(false);
  modern.hideLabel(modernNode.node, false);
  old.hideLabel(oldNode.node, false);
  result.hiddenLabels = [
    modernContainer.children[0].style.display,
    oldContainer.children[0].style.display,
  ];
  modern.hideLabel(modernNode.node, true);
  old.hideLabel(oldNode.node, true);
  hasNode = false;
  modern.clearLabels();
  old.clearLabels();
  result.cleared = [modernContainer.children.length, oldContainer.children.length];
  return result;
}

for (const kind of ["HTML", "SVG"]) {
  test(`Hypertree ${kind} class matches legacy lifecycle and placement`, () => {
    const result = exerciseDOMLabels(kind);
    assert.deepEqual(result.modernNode.reads, result.oldNode.reads);
    assert.deepEqual(result.modernCanvas.calls, result.oldCanvas.calls);
    assert.deepEqual(result.modernRadiusEvents, result.oldRadiusEvents);
    assert.deepEqual(result.modernEvents, result.oldEvents);
    assert.deepEqual(result.modernElement, result.oldElement);
    assert.deepEqual(result.counts, [1, 1]);
    assert.deepEqual(result.hiddenContainers, ["none", "none"]);
    assert.deepEqual(result.hiddenLabels, ["none", "none"]);
    assert.deepEqual(result.cleared, [0, 0]);
  });
}

test("Hypertree label entries remain backend-split and global-free", async () => {
  const [contracts, dom, native, html, svg] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/hypertree-label-contracts.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/hypertree-dom-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/hypertree-native-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/hypertree-html-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/hypertree-svg-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.doesNotMatch(dom, /^\s*import\s/m);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.doesNotMatch(native, /labels\/(?:dom|html|svg)\.js|canvas\/|browser\//);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.match(html, /hypertree-dom-labels\.js/);
  assert.doesNotMatch(html, /graph\/labels\/(?:native|svg)\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.match(svg, /hypertree-dom-labels\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/(?:html|native)\.js/);
  assert.doesNotMatch(
    `${contracts}${dom}${native}${html}${svg}`,
    /\$jit|globalThis|\bdocument\s*\.|\bwindow\b|hypertree\.js/,
  );
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});
