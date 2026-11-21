import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getIcicleDOMLabelPosition,
  placeIcicleHTMLLabel,
  placeIcicleSVGLabel,
} from "../dist/visualizations/icicle-dom-labels.js";
import { IcicleHTMLLabels } from "../dist/visualizations/icicle-html-labels.js";
import {
  IcicleNativeLabels,
  renderIcicleNativeLabel,
} from "../dist/visualizations/icicle-native-labels.js";
import { IcicleSVGLabels } from "../dist/visualizations/icicle-svg-labels.js";
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

function createNode({ width = 100, height = 40, textWidth = 35 } = {}) {
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
    textWidth,
    node: {
      id: "alpha",
      name: "Alpha",
      pos: {
        getc(simple) {
          reads.push(["position", simple]);
          return { x: 12.4, y: -8.6 };
        },
      },
      getData(property) {
        reads.push(["data", property]);
        return { width, height }[property];
      },
      getLabelData(property) {
        reads.push(["label", property]);
        return labelData[property];
      },
    },
  };
}

function createNativeCanvas(textWidth) {
  const calls = [];
  const context = {
    measureText(value) {
      calls.push(["measureText", value]);
      return { width: textWidth };
    },
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
      set(value) {
        calls.push([property, value]);
      },
      get() {
        return undefined;
      },
    });
  }
  return {
    calls,
    canvas: {
      getCtx: () => context,
      getSize: () => ({ width: 301, height: 201 }),
    },
  };
}

function createDOMCanvas() {
  return {
    getCtx() {
      throw new Error("not used");
    },
    getSize() {
      return { width: 301, height: 201 };
    },
  };
}

function nativeSnapshot(options) {
  const modernNode = createNode(options);
  const legacyNode = createNode(options);
  const modernCanvas = createNativeCanvas(modernNode.textWidth);
  const legacyCanvas = createNativeCanvas(legacyNode.textWidth);
  const controller = {};

  new IcicleNativeLabels().plotLabel(
    modernCanvas.canvas,
    modernNode.node,
    controller,
  );
  new legacy.Icicle.Label.Native({}).plotLabel(
    legacyCanvas.canvas,
    legacyNode.node,
    controller,
  );

  return { modernNode, legacyNode, modernCanvas, legacyCanvas };
}

test("Icicle native labels match styling, fit checks, and placement", () => {
  for (const options of [
    { width: 100, height: 40, textWidth: 35 },
    { width: 20, height: 40, textWidth: 35 },
    { width: 100, height: 20, textWidth: 35 },
  ]) {
    const result = nativeSnapshot(options);
    assert.deepEqual(
      result.modernNode.reads,
      result.legacyNode.reads,
      JSON.stringify(options),
    );
    assert.deepEqual(
      result.modernCanvas.calls,
      result.legacyCanvas.calls,
      JSON.stringify(options),
    );
  }
});

test("Icicle native renderer is independently callable", () => {
  const result = createNode({ width: 100, height: 40, textWidth: 35 });
  const canvas = createNativeCanvas(result.textWidth);
  renderIcicleNativeLabel(canvas.canvas, result.node, {});
  assert.deepEqual(canvas.calls, [
    ["measureText", "Alpha"],
    ["fillText", "Alpha", 62.4, 11.4],
  ]);
});

function createLegacyDOMLabels(kind, document, canvas, hasNode) {
  setLegacyDocument(document);
  const visualization = {
    canvas,
    config: { labelContainer: "labels" },
    graph: { hasNode },
  };
  const labels = new legacy.Icicle.Label[kind](visualization);
  labels.labels = {};
  labels.labelContainer = false;
  labels.labelsHidden = false;
  return labels;
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

function exerciseDOMLabels(kind) {
  const namespace = kind === "SVG" ? "http://www.w3.org/2000/svg" : null;
  const modernDocument = new FakeDocument();
  const legacyDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels", namespace);
  const legacyContainer = legacyDocument.addContainer("labels", namespace);
  const modernNode = createNode();
  const legacyNode = createNode();
  const canvas = createDOMCanvas();
  const modernEvents = [];
  const legacyEvents = [];
  let nodeExists = true;
  const ModernLabels = kind === "SVG" ? IcicleSVGLabels : IcicleHTMLLabels;
  const modern = new ModernLabels({
    container: "labels",
    document: modernDocument,
    hasNode: () => nodeExists,
  });
  const old = createLegacyDOMLabels(
    kind,
    legacyDocument,
    canvas,
    () => nodeExists,
  );
  const modernController = {
    onCreateLabel(element) {
      modernEvents.push(["create", element.id, element.parentNode !== null]);
    },
    onPlaceLabel(element) {
      modernEvents.push(["place", element.id]);
    },
  };
  const legacyController = {
    onCreateLabel(element) {
      legacyEvents.push(["create", element.id, element.parentNode !== null]);
    },
    onPlaceLabel(element) {
      legacyEvents.push(["place", element.id]);
    },
  };

  modern.plotLabel(canvas, modernNode.node, modernController);
  old.plotLabel(canvas, legacyNode.node, legacyController);
  modern.plotLabel(canvas, modernNode.node, modernController);
  old.plotLabel(canvas, legacyNode.node, legacyController);

  const result = {
    modernNode,
    legacyNode,
    modernEvents,
    legacyEvents,
    modernElement: snapshotElement(modernContainer.children[0]),
    legacyElement: snapshotElement(legacyContainer.children[0]),
    modernCount: modernContainer.children.length,
    legacyCount: legacyContainer.children.length,
  };

  modern.hideLabel(modernNode.node, false);
  old.hideLabel(legacyNode.node, false);
  result.hidden = [
    modernContainer.children[0].style.display,
    legacyContainer.children[0].style.display,
  ];
  modern.hideLabel(modernNode.node, true);
  old.hideLabel(legacyNode.node, true);
  nodeExists = false;
  modern.clearLabels();
  old.clearLabels();
  result.cleared = [modernContainer.children.length, legacyContainer.children.length];
  return result;
}

test("Icicle HTML label lifecycle and placement match JIT 2.0.1", () => {
  const result = exerciseDOMLabels("HTML");
  assert.deepEqual(result.modernNode.reads, result.legacyNode.reads);
  assert.deepEqual(result.modernEvents, result.legacyEvents);
  assert.deepEqual(result.modernElement, result.legacyElement);
  assert.equal(result.modernCount, result.legacyCount);
  assert.deepEqual(result.hidden, ["none", "none"]);
  assert.deepEqual(result.cleared, [0, 0]);
});

test("Icicle SVG label lifecycle and placement match JIT 2.0.1", () => {
  const result = exerciseDOMLabels("SVG");
  assert.deepEqual(result.modernNode.reads, result.legacyNode.reads);
  assert.deepEqual(result.modernEvents, result.legacyEvents);
  assert.deepEqual(result.modernElement, result.legacyElement);
  assert.equal(result.modernCount, result.legacyCount);
  assert.deepEqual(result.hidden, ["none", "none"]);
  assert.deepEqual(result.cleared, [0, 0]);
});

test("Icicle DOM placement helpers retain rounding and backend-specific writes", () => {
  const node = createNode();
  const canvas = createDOMCanvas();
  const document = new FakeDocument();
  const html = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg:text");
  const calls = [];
  const controller = {
    onPlaceLabel(element, currentNode) {
      calls.push([element.tagName, currentNode.id]);
    },
  };

  assert.deepEqual(getIcicleDOMLabelPosition(node.node, canvas), {
    x: 163,
    y: 92,
  });
  placeIcicleHTMLLabel(html, node.node, canvas, controller);
  placeIcicleSVGLabel(svg, node.node, canvas, controller);
  assert.deepEqual(html.style, { left: "163px", top: "92px", display: "" });
  assert.deepEqual(Object.fromEntries(svg.attributes), { x: "163", y: "92" });
  assert.deepEqual(calls, [
    ["DIV", "alpha"],
    ["SVG:TEXT", "alpha"],
  ]);
});

test("Icicle label entries keep Native and DOM backends independently importable", async () => {
  const [native, dom, html, svg] = await Promise.all([
    readFile(
      new URL(
        "../dist/visualizations/icicle-native-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/icicle-dom-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/icicle-html-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/visualizations/icicle-svg-labels.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.doesNotMatch(native, /labels\/(?:dom|html|svg)\.js|canvas\/|browser\//);
  assert.doesNotMatch(dom, /^\s*import\s/m);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.doesNotMatch(html, /graph\/labels\/svg\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/html\.js/);
  assert.doesNotMatch(
    `${native}${dom}${html}${svg}`,
    /\$jit|document\.|window\./,
  );
});
