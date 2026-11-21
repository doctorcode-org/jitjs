import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSunburstHTMLLabelPosition,
  getSunburstSVGLabelPosition,
  placeSunburstHTMLLabel,
  placeSunburstSVGLabel,
} from "../dist/visualizations/sunburst-dom-labels.js";
import { SunburstHTMLLabels } from "../dist/visualizations/sunburst-html-labels.js";
import {
  renderSunburstNativeLabel,
  SunburstNativeLabels,
} from "../dist/visualizations/sunburst-native-labels.js";
import { SunburstSVGLabels } from "../dist/visualizations/sunburst-svg-labels.js";
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
    this.bounds = { width: 42, height: 12 };
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

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  getBBox() {
    return this.bounds;
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

function createPosition(theta, rho, reads) {
  const makePosition = (currentRho, scope) => ({
    theta,
    rho: currentRho,
    clone() {
      reads.push([scope, "clone"]);
      return makePosition(this.rho, "clone");
    },
    getp(simple) {
      reads.push([scope, "getp", simple, this.rho]);
      return { theta: this.theta, rho: this.rho };
    },
    getc(simple) {
      reads.push([scope, "getc", simple, this.rho]);
      return {
        x: Math.cos(this.theta) * this.rho,
        y: Math.sin(this.theta) * this.rho,
      };
    },
  });
  return makePosition(rho, "position");
}

function createNode({
  id = "node",
  name = "Radial label",
  theta = 0.4,
  rho = 30,
  depth = 1,
  span = Math.PI,
  height = 20,
} = {}) {
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
      name,
      _depth: depth,
      pos: createPosition(theta, rho, reads),
      getData(property) {
        reads.push(["data", property]);
        return { span, height }[property];
      },
      getLabelData(property) {
        reads.push(["label", property]);
        return labelData[property];
      },
    },
  };
}

function createCanvas({ width = 301, height = 201, textWidth = 64 } = {}) {
  const calls = [];
  const context = {
    measureText(value) {
      calls.push(["measureText", value]);
      return { width: textWidth };
    },
    save() {
      calls.push(["save"]);
    },
    translate(x, y) {
      calls.push(["translate", x, y]);
    },
    rotate(angle) {
      calls.push(["rotate", angle]);
    },
    fillText(...arguments_) {
      calls.push(["fillText", ...arguments_]);
    },
    restore() {
      calls.push(["restore"]);
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
  const canvas = {
    getCtx() {
      calls.push(["getCtx"]);
      return context;
    },
    getSize() {
      calls.push(["getSize"]);
      return { width, height };
    },
  };
  return { calls, canvas, context };
}

function createNativeController(levelDistance = 75) {
  const reads = [];
  const controller = {};
  Object.defineProperty(controller, "levelDistance", {
    get() {
      reads.push("levelDistance");
      return levelDistance;
    },
  });
  return { controller, reads };
}

function runNativeCase(options) {
  const modernNode = createNode(options);
  const oldNode = createNode(options);
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernController = createNativeController();
  const oldController = createNativeController();
  const state = {
    root: "root",
    config: { levelDistance: 60 },
  };

  new SunburstNativeLabels(state).plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    modernController.controller,
  );
  new legacy.Sunburst.Label.Native({
    root: state.root,
    config: { Label: {}, levelDistance: state.config.levelDistance },
  }).plotLabel(oldCanvas.canvas, oldNode.node, oldController.controller);

  return {
    modernNode,
    oldNode,
    modernCanvas,
    oldCanvas,
    modernController,
    oldController,
  };
}

test("Sunburst native labels match skip, root, and every angular branch", () => {
  const cases = [
    { id: "skip", theta: 0.2, span: 0.1, depth: 1 },
    { id: "root", theta: 2.4, span: Math.PI, depth: 0 },
    { id: "right", theta: 0.4, span: Math.PI, depth: 1 },
    { id: "left", theta: 2.2, span: Math.PI, depth: 2 },
    { id: "quarter", theta: Math.PI / 2, span: Math.PI / 2, depth: 1 },
    { id: "three-quarter", theta: (3 * Math.PI) / 2, span: Math.PI, depth: 1 },
  ];

  for (const options of cases) {
    const result = runNativeCase(options);
    assert.deepEqual(
      result.modernNode.reads,
      result.oldNode.reads,
      JSON.stringify(options),
    );
    assert.deepEqual(
      result.modernCanvas.calls,
      result.oldCanvas.calls,
      JSON.stringify(options),
    );
    assert.deepEqual(
      result.modernController.reads,
      result.oldController.reads,
      JSON.stringify(options),
    );
  }
});

test("Sunburst native left-facing labels reverse rotation and text flow", () => {
  const { modernCanvas } = runNativeCase({
    id: "left",
    theta: Math.PI,
    rho: 30,
    span: Math.PI,
    depth: 1,
  });
  assert.deepEqual(
    modernCanvas.calls.filter(([name]) =>
      ["translate", "rotate", "fillText"].includes(name),
    ),
    [
      ["translate", -99, 99 * Math.sin(Math.PI)],
      ["rotate", 2 * Math.PI],
      ["fillText", "Radial label", 0, 0],
    ],
  );
});

test("Sunburst native renderer remains independently callable", () => {
  const { node } = createNode({ id: "root", depth: 0 });
  const canvas = createCanvas({ textWidth: 40 });
  const state = { root: "root", config: { levelDistance: 60 } };
  renderSunburstNativeLabel(
    canvas.canvas,
    node,
    { levelDistance: 75 },
    state,
  );
  assert.deepEqual(canvas.calls, [
    ["getCtx"],
    ["measureText", "Radial label"],
    ["save"],
    ["translate", -20, 0],
    ["rotate", 0],
    ["fillText", "Radial label", 0, 0],
    ["restore"],
  ]);
});

function createDOMController(events) {
  return {
    onCreateLabel(element, node) {
      events.push(["create", element.id, node.id, element.parentNode !== null]);
    },
    onPlaceLabel(element, node) {
      events.push(["place", element.id, node.id]);
    },
  };
}

function snapshotElement(element) {
  return {
    id: element.id,
    className: element.className,
    style: { ...element.style },
    attributes: Object.fromEntries(element.attributes),
    children: element.children.map((child) => child.tagName),
  };
}

test("Sunburst HTML placement matches radial offsets and canvas clipping", () => {
  const cases = [
    { height: 20, depth: 1, theta: 0, rho: 30 },
    { height: 0, depth: 1, theta: Math.PI / 2, rho: 30 },
    { height: 0, depth: 0, theta: Math.PI, rho: 0 },
    { height: undefined, depth: 0, theta: 0, rho: 0 },
    { height: 20, depth: 1, theta: 0, rho: 500 },
  ];

  for (const options of cases) {
    const modernDocument = new FakeDocument();
    const oldDocument = new FakeDocument();
    const modernElement = new FakeElement("div", modernDocument);
    const oldElement = new FakeElement("div", oldDocument);
    modernElement.id = oldElement.id = "html";
    const modernNode = createNode(options);
    const oldNode = createNode(options);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernEvents = [];
    const oldEvents = [];
    const state = { root: "root", config: { levelDistance: 60 } };

    placeSunburstHTMLLabel(
      modernElement,
      modernNode.node,
      modernCanvas.canvas,
      createDOMController(modernEvents),
      state,
    );
    new legacy.Sunburst.Label.HTML({
      root: state.root,
      canvas: oldCanvas.canvas,
      config: state.config,
    }).placeLabel(
      oldElement,
      oldNode.node,
      createDOMController(oldEvents),
    );

    assert.deepEqual(modernElement.style, oldElement.style, JSON.stringify(options));
    assert.deepEqual(modernNode.reads, oldNode.reads, JSON.stringify(options));
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, JSON.stringify(options));
    assert.deepEqual(modernEvents, oldEvents, JSON.stringify(options));
  }
});

test("Sunburst DOM position helpers retain backend-specific geometry", () => {
  const { node } = createNode({ theta: 0, rho: 30, height: 20, depth: 1 });
  const canvas = createCanvas();
  const state = { root: "root", config: { levelDistance: 60 } };
  assert.deepEqual(getSunburstSVGLabelPosition(node, canvas.canvas), {
    x: 181,
    y: 101,
  });
  assert.deepEqual(getSunburstHTMLLabelPosition(node, canvas.canvas, state), {
    x: 191,
    y: 101,
  });
});

test("Sunburst SVG placement matches root centering and angular rotations", () => {
  const cases = [
    { id: "root", depth: 0, theta: 0 },
    { id: "right", depth: 1, theta: 0.4 },
    { id: "left", depth: 1, theta: Math.PI },
    { id: "quarter", depth: 1, theta: Math.PI / 2 },
    { id: "three-quarter", depth: 1, theta: (3 * Math.PI) / 2 },
  ];

  for (const options of cases) {
    const modernDocument = new FakeDocument();
    const oldDocument = new FakeDocument();
    const modernElement = new FakeElement("svg:text", modernDocument);
    const oldElement = new FakeElement("svg:text", oldDocument);
    modernElement.id = oldElement.id = "svg";
    const modernNode = createNode(options);
    const oldNode = createNode(options);
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernEvents = [];
    const oldEvents = [];
    const state = { root: "root", config: { levelDistance: 60 } };

    placeSunburstSVGLabel(
      modernElement,
      modernNode.node,
      modernCanvas.canvas,
      createDOMController(modernEvents),
      state,
    );
    new legacy.Sunburst.Label.SVG({
      root: state.root,
      canvas: oldCanvas.canvas,
      config: state.config,
    }).placeLabel(
      oldElement,
      oldNode.node,
      createDOMController(oldEvents),
    );

    assert.deepEqual(
      Object.fromEntries(modernElement.attributes),
      Object.fromEntries(oldElement.attributes),
      JSON.stringify(options),
    );
    assert.deepEqual(modernNode.reads, oldNode.reads, JSON.stringify(options));
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls, JSON.stringify(options));
    assert.deepEqual(modernEvents, oldEvents, JSON.stringify(options));
  }
});

test("Sunburst SVG placement preserves the no-bounds branch", () => {
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernElement = new FakeElement("svg:text", modernDocument);
  const oldElement = new FakeElement("svg:text", oldDocument);
  modernElement.bounds = null;
  oldElement.bounds = null;
  const modernNode = createNode({ theta: Math.PI, depth: 1 });
  const oldNode = createNode({ theta: Math.PI, depth: 1 });
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernEvents = [];
  const oldEvents = [];
  const state = { root: "root", config: { levelDistance: 60 } };

  placeSunburstSVGLabel(
    modernElement,
    modernNode.node,
    modernCanvas.canvas,
    createDOMController(modernEvents),
    state,
  );
  new legacy.Sunburst.Label.SVG({
    root: state.root,
    canvas: oldCanvas.canvas,
    config: state.config,
  }).placeLabel(oldElement, oldNode.node, createDOMController(oldEvents));

  assert.deepEqual(
    Object.fromEntries(modernElement.attributes),
    Object.fromEntries(oldElement.attributes),
  );
  assert.deepEqual(modernNode.reads, oldNode.reads);
  assert.deepEqual(modernEvents, oldEvents);
});

function createLegacyDOMLabels(kind, document, canvas, state, hasNode) {
  setLegacyDocument(document);
  const labels = new legacy.Sunburst.Label[kind]({
    root: state.root,
    canvas,
    config: {
      Label: {},
      labelContainer: "labels",
      levelDistance: state.config.levelDistance,
    },
    graph: { hasNode },
  });
  labels.labels = {};
  labels.labelContainer = false;
  labels.labelsHidden = false;
  return labels;
}

function exerciseDOMClass(kind, nodeOptions) {
  const namespace = kind === "SVG" ? "http://www.w3.org/2000/svg" : null;
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels", namespace);
  const oldContainer = oldDocument.addContainer("labels", namespace);
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode(nodeOptions);
  const oldNode = createNode(nodeOptions);
  const modernEvents = [];
  const oldEvents = [];
  const state = { root: "root", config: { levelDistance: 60 } };
  let nodeExists = true;
  const Labels = kind === "SVG" ? SunburstSVGLabels : SunburstHTMLLabels;
  const modern = new Labels({
    container: "labels",
    document: modernDocument,
    hasNode: () => nodeExists,
    state,
  });
  const old = createLegacyDOMLabels(
    kind,
    oldDocument,
    oldCanvas.canvas,
    state,
    () => nodeExists,
  );

  modern.plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    createDOMController(modernEvents),
  );
  modern.plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    createDOMController(modernEvents),
  );
  old.plotLabel(
    oldCanvas.canvas,
    oldNode.node,
    createDOMController(oldEvents),
  );
  old.plotLabel(
    oldCanvas.canvas,
    oldNode.node,
    createDOMController(oldEvents),
  );

  const result = {
    modern,
    old,
    modernNode,
    oldNode,
    modernCanvas,
    oldCanvas,
    modernContainer,
    oldContainer,
    modernEvents,
    oldEvents,
    modernElement: snapshotElement(modernContainer.children[0]),
    oldElement: snapshotElement(oldContainer.children[0]),
  };

  modern.hideLabel(modernNode.node, false);
  old.hideLabel(oldNode.node, false);
  result.hidden = [
    modernContainer.children[0].style.display,
    oldContainer.children[0].style.display,
  ];
  modern.hideLabel(modernNode.node, true);
  old.hideLabel(oldNode.node, true);
  nodeExists = false;
  modern.clearLabels();
  old.clearLabels();
  result.cleared = [modernContainer.children.length, oldContainer.children.length];
  return result;
}

test("Sunburst HTML class preserves creation, caching, placement, and cleanup", () => {
  const result = exerciseDOMClass("HTML", {
    id: "html-node",
    theta: 0.4,
    depth: 1,
  });
  assert.deepEqual(result.modernNode.reads, result.oldNode.reads);
  assert.deepEqual(result.modernCanvas.calls, result.oldCanvas.calls);
  assert.deepEqual(result.modernEvents, result.oldEvents);
  assert.deepEqual(result.modernElement, result.oldElement);
  assert.deepEqual(result.hidden, ["none", "none"]);
  assert.deepEqual(result.cleared, [0, 0]);
});

test("Sunburst SVG class preserves structure, rotation, caching, and cleanup", () => {
  const result = exerciseDOMClass("SVG", {
    id: "svg-node",
    theta: Math.PI,
    depth: 1,
  });
  assert.deepEqual(result.modernNode.reads, result.oldNode.reads);
  assert.deepEqual(result.modernCanvas.calls, result.oldCanvas.calls);
  assert.deepEqual(result.modernEvents, result.oldEvents);
  assert.deepEqual(result.modernElement, result.oldElement);
  assert.deepEqual(result.hidden, ["none", "none"]);
  assert.deepEqual(result.cleared, [0, 0]);
});

test("Sunburst label entries stay independently importable and registry-free", async () => {
  const [contracts, dom, native, html, svg] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/sunburst-label-contracts.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../dist/visualizations/sunburst-dom-labels.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/sunburst-native-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/sunburst-html-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../dist/visualizations/sunburst-svg-labels.js", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(contracts, /^\s*import\s/m);
  assert.doesNotMatch(dom, /graph\/labels\/(?:html|svg|native)\.js/);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.doesNotMatch(native, /graph\/labels\/(?:html|svg|dom)\.js/);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.doesNotMatch(html, /graph\/labels\/(?:svg|native)\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/(?:html|native)\.js/);
  assert.doesNotMatch(
    `${contracts}${dom}${native}${html}${svg}`,
    /\$jit|globalThis|\bdocument\s*\.|\bwindow\b|sunburst\.js/,
  );
});
