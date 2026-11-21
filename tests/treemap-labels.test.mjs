import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getTreemapLabelPosition,
  placeTreemapHTMLLabel,
  placeTreemapSVGLabel,
} from "../dist/visualizations/treemap-dom-labels.js";
import { TreemapHTMLLabels } from "../dist/visualizations/treemap-html-labels.js";
import {
  renderTreemapNativeLabel,
  TreemapNativeLabels,
} from "../dist/visualizations/treemap-native-labels.js";
import { TreemapSVGLabels } from "../dist/visualizations/treemap-svg-labels.js";
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
    if (index >= 0) this.children.splice(index, 1);
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
  constructor() { this.elements = new Map(); }
  addContainer(id, namespaceURI = null) {
    const element = new FakeElement(namespaceURI ? "g" : "div", this, namespaceURI);
    element.id = id;
    this.elements.set(id, element);
    return element;
  }
  createElement(name) { return new FakeElement(name, this); }
  createElementNS(namespace, name) { return new FakeElement(name, this, namespace); }
  getElementById(id) { return this.elements.get(id) ?? null; }
}

function createNode({ id = "leaf", depth = 2, width = 80, height = 45 } = {}) {
  const reads = [];
  const node = {
    id,
    name: "Treemap node",
    _depth: depth,
    pos: {
      getc(simple) {
        reads.push(["position", simple]);
        return { x: 12.25, y: -7.5 };
      },
    },
    getData(property) {
      reads.push(["data", property]);
      return { width, height }[property];
    },
    getLabelData(property) {
      reads.push(["label", property]);
      return {
        style: "bold",
        size: 13,
        family: "sans-serif",
        textAlign: "center",
        color: "#123456",
        textBaseline: "middle",
      }[property];
    },
  };
  return { node, reads };
}

function createCanvas() {
  const calls = [];
  const context = {
    fillText(...args) { calls.push(["fillText", ...args]); },
  };
  for (const property of ["font", "textAlign", "fillStyle", "strokeStyle", "textBaseline"]) {
    Object.defineProperty(context, property, {
      set(value) { calls.push([property, value]); },
      get() { return undefined; },
    });
  }
  return {
    calls,
    canvas: {
      translateOffsetX: 5,
      translateOffsetY: -3,
      scaleOffsetX: 1.5,
      scaleOffsetY: 2,
      getCtx: () => context,
      getSize: () => ({ width: 301, height: 201 }),
    },
  };
}

const leaf = (node) => node.id === "leaf";

test("Treemap native labels match leaf and title branches", () => {
  for (const options of [
    { id: "leaf", titleHeight: 0 },
    { id: "branch", titleHeight: 0 },
    { id: "branch", titleHeight: 20 },
  ]) {
    const modernNode = createNode({ id: options.id });
    const oldNode = createNode({ id: options.id });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const config = { titleHeight: options.titleHeight };
    new TreemapNativeLabels(leaf, config).plotLabel(
      modernCanvas.canvas,
      modernNode.node,
      {},
    );
    new legacy.TM.Label.Native({ config, leaf }).plotLabel(
      oldCanvas.canvas,
      oldNode.node,
      {},
    );
    assert.deepEqual(modernNode.reads, oldNode.reads);
    assert.deepEqual(modernCanvas.calls, oldCanvas.calls);
  }
});

test("Treemap native renderer remains independently callable", () => {
  const { node } = createNode();
  const canvas = createCanvas();
  renderTreemapNativeLabel(canvas.canvas, node, {}, leaf, { titleHeight: 0 });
  assert.deepEqual(canvas.calls, [["fillText", "Treemap node", 52.25, -7.5, 80]]);
});

test("Treemap HTML and SVG placement match scaling, depth, and visibility", () => {
  for (const id of ["leaf", "branch"]) {
    const config = { titleHeight: 0 };
    const modernNode = createNode({ id });
    const oldNode = createNode({ id });
    const modernCanvas = createCanvas();
    const oldCanvas = createCanvas();
    const modernDocument = new FakeDocument();
    const oldDocument = new FakeDocument();
    const modernHTML = new FakeElement("div", modernDocument);
    const oldHTML = new FakeElement("div", oldDocument);
    const modernSVG = new FakeElement("svg:text", modernDocument);
    const oldSVG = new FakeElement("svg:text", oldDocument);
    const modernEvents = [];
    const oldEvents = [];
    const modernController = { onPlaceLabel: (_element, node) => modernEvents.push(node.id) };
    const oldController = { onPlaceLabel: (_element, node) => oldEvents.push(node.id) };

    placeTreemapHTMLLabel(
      modernHTML,
      modernNode.node,
      modernCanvas.canvas,
      modernController,
      leaf,
      config,
    );
    new legacy.TM.Label.HTML({
      canvas: oldCanvas.canvas,
      config,
      leaf,
    }).placeLabel(oldHTML, oldNode.node, oldController);
    placeTreemapSVGLabel(
      modernSVG,
      modernNode.node,
      modernCanvas.canvas,
      modernController,
      leaf,
      config,
    );
    new legacy.TM.Label.SVG({
      canvas: oldCanvas.canvas,
      config,
      leaf,
    }).placeLabel(oldSVG, oldNode.node, oldController);

    assert.deepEqual(modernHTML.style, oldHTML.style);
    assert.deepEqual(
      Object.fromEntries(modernSVG.attributes),
      Object.fromEntries(oldSVG.attributes),
    );
    assert.deepEqual(modernSVG.style, oldSVG.style);
    assert.deepEqual(modernEvents, oldEvents);
    assert.deepEqual(modernNode.reads, oldNode.reads);
  }
});

function exerciseClass(kind) {
  const namespace = kind === "SVG" ? "http://www.w3.org/2000/svg" : null;
  const modernDocument = new FakeDocument();
  const oldDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels", namespace);
  const oldContainer = oldDocument.addContainer("labels", namespace);
  const modernCanvas = createCanvas();
  const oldCanvas = createCanvas();
  const modernNode = createNode();
  const oldNode = createNode();
  const config = { titleHeight: 0, labelContainer: "labels" };
  const Modern = kind === "SVG" ? TreemapSVGLabels : TreemapHTMLLabels;
  const modern = new Modern({
    container: "labels",
    document: modernDocument,
    hasNode: () => true,
    leaf,
    config,
  });
  setLegacyDocument(oldDocument);
  const old = new legacy.TM.Label[kind]({
    canvas: oldCanvas.canvas,
    config,
    graph: { hasNode: () => true },
    leaf,
  });
  old.labels = {};
  old.labelContainer = false;
  const modernEvents = [];
  const oldEvents = [];
  const modernController = {
    onCreateLabel: (element) => modernEvents.push(["create", element.id]),
    onPlaceLabel: (element) => modernEvents.push(["place", element.id]),
  };
  const oldController = {
    onCreateLabel: (element) => oldEvents.push(["create", element.id]),
    onPlaceLabel: (element) => oldEvents.push(["place", element.id]),
  };
  modern.plotLabel(modernCanvas.canvas, modernNode.node, modernController);
  old.plotLabel(oldCanvas.canvas, oldNode.node, oldController);
  return { modernContainer, oldContainer, modernEvents, oldEvents };
}

test("Treemap DOM label classes retain legacy lifecycle", () => {
  for (const kind of ["HTML", "SVG"]) {
    const result = exerciseClass(kind);
    assert.equal(result.modernContainer.children.length, 1);
    assert.equal(result.oldContainer.children.length, 1);
    assert.deepEqual(result.modernEvents, result.oldEvents);
    assert.deepEqual(
      result.modernContainer.children[0].style,
      result.oldContainer.children[0].style,
    );
  }
});

test("Treemap label entries stay backend-split and registry-free", async () => {
  const [dom, native, html, svg] = await Promise.all([
    readFile(new URL("../dist/visualizations/treemap-dom-labels.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-native-labels.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-html-labels.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/visualizations/treemap-svg-labels.js", import.meta.url), "utf8"),
  ]);
  assert.match(dom, /graph\/labels\/placement\.js/);
  assert.match(native, /graph\/labels\/native\.js/);
  assert.match(html, /graph\/labels\/html\.js/);
  assert.doesNotMatch(html, /graph\/labels\/svg\.js/);
  assert.match(svg, /graph\/labels\/svg\.js/);
  assert.doesNotMatch(svg, /graph\/labels\/html\.js/);
  assert.doesNotMatch(`${dom}${native}${html}${svg}`, /\$jit|window\.|document\./);
  assert.deepEqual(getTreemapLabelPosition(createNode().node, createCanvas().canvas), {
    x: 174,
    y: 83,
  });
});

