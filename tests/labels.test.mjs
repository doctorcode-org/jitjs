import assert from "node:assert/strict";
import test from "node:test";

import { DOMLabels } from "../dist/graph/labels/dom.js";
import { HTMLLabels } from "../dist/graph/labels/html.js";
import { NativeLabels } from "../dist/graph/labels/native.js";
import { projectToCanvas } from "../dist/graph/labels/placement.js";
import { SVGLabels } from "../dist/graph/labels/svg.js";
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
    const tagName = namespaceURI ? "g" : "div";
    const container = new FakeElement(tagName, this, namespaceURI);
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

function createNode(id = "alpha") {
  const labelData = {
    style: "bold",
    size: 14,
    family: "sans-serif",
    textAlign: "center",
    color: "#123456",
    textBaseline: "middle",
  };
  return {
    id,
    name: "Alpha",
    pos: {
      getc(simple) {
        assert.equal(simple, true);
        return { x: 12, y: 8 };
      },
    },
    getData(property) {
      assert.equal(property, "height");
      return 10;
    },
    getLabelData(property) {
      return labelData[property];
    },
  };
}

function createNativeCanvas() {
  const calls = [];
  const context = {
    font: "",
    textAlign: "start",
    fillStyle: "",
    strokeStyle: "",
    textBaseline: "alphabetic",
    fillText(...arguments_) {
      calls.push(arguments_);
    },
  };
  return {
    calls,
    context,
    canvas: {
      getCtx() {
        return context;
      },
      getSize() {
        return { width: 100, height: 50 };
      },
    },
  };
}

test("label implementations import without a document or legacy registry", () => {
  assert.equal(globalThis.document, undefined);
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(typeof NativeLabels, "function");
  assert.equal(typeof DOMLabels, "function");
  assert.equal(typeof HTMLLabels, "function");
  assert.equal(typeof SVGLabels, "function");

  assert.throws(
    () =>
      new HTMLLabels({
        container: "labels",
        hasNode: () => false,
        placeLabel() {},
      }),
    /require an injected document/,
  );
});

test("native canvas labels retain the JIT 2.0.1 styling and position", () => {
  const node = createNode();
  const modern = createNativeCanvas();
  const old = createNativeCanvas();
  const controller = { onCreateLabel() {}, onPlaceLabel() {} };

  new NativeLabels().plotLabel(modern.canvas, node, controller);
  new legacy.Graph.Label.Native({}).plotLabel(old.canvas, node, controller);

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
  assert.deepEqual(modern.calls, [["Alpha", 12, 13]]);
});

function exerciseHTMLLabels(labels, node, events) {
  const canvas = {
    getCtx() {
      throw new Error("not used");
    },
    getSize() {
      return { width: 100, height: 50 };
    },
  };
  const controller = {
    onCreateLabel(tag) {
      events.push(["create", tag.id]);
    },
    onPlaceLabel(tag) {
      events.push(["place", tag.id]);
    },
  };

  labels.plotLabel(canvas, node, controller);
  labels.plotLabel(canvas, node, controller);
  labels.hideLabel(node, false);
  const hidden = labels.getLabel(node.id).style.display;
  labels.hideLabel([node], true);
  labels.hideLabels(true);
  const containerHidden = labels.getLabelContainer().style.display;
  labels.hideLabels(false);

  return {
    events,
    hidden,
    shown: labels.getLabel(node.id).style.display,
    containerHidden,
    containerShown: labels.getLabelContainer().style.display,
    fits: [
      labels.fitsInCanvas({ x: 99, y: 49 }, canvas),
      labels.fitsInCanvas({ x: 100, y: 49 }, canvas),
      labels.fitsInCanvas({ x: 0, y: -1 }, canvas),
    ],
  };
}

test("HTML label creation, caching, visibility, and placement match legacy", () => {
  const node = createNode();
  const modernDocument = new FakeDocument();
  const legacyDocument = new FakeDocument();
  const modernContainer = modernDocument.addContainer("labels");
  const legacyContainer = legacyDocument.addContainer("labels");
  const modernEvents = [];
  const legacyEvents = [];
  let nodeExists = true;

  const modern = new HTMLLabels({
    container: "labels",
    document: modernDocument,
    hasNode: () => nodeExists,
    placeLabel(tag, currentNode, _canvas, controller) {
      tag.style.left = `${currentNode.pos.getc(true).x}px`;
      controller.onPlaceLabel(tag, currentNode);
    },
  });

  setLegacyDocument(legacyDocument);
  const old = new legacy.Graph.Label.HTML();
  old.labels = {};
  old.labelContainer = false;
  old.labelsHidden = false;
  old.viz = {
    config: { labelContainer: "labels" },
    graph: { hasNode: () => nodeExists },
  };
  old.placeLabel = function placeLabel(tag, currentNode, controller) {
    tag.style.left = `${currentNode.pos.getc(true).x}px`;
    controller.onPlaceLabel(tag, currentNode);
  };

  assert.deepEqual(
    exerciseHTMLLabels(modern, node, modernEvents),
    exerciseHTMLLabels(old, node, legacyEvents),
  );
  assert.equal(modernContainer.children.length, 1);
  assert.equal(legacyContainer.children.length, 1);
  assert.equal(modernContainer.children[0].className, "node");
  assert.equal(modernContainer.children[0].style.position, "absolute");

  modern.clearLabels();
  old.clearLabels();
  assert.equal(modernContainer.children.length, 1);
  assert.equal(legacyContainer.children.length, 1);

  nodeExists = false;
  modern.clearLabels();
  old.clearLabels();
  assert.equal(modernContainer.children.length, 0);
  assert.equal(legacyContainer.children.length, 0);
  assert.deepEqual(Object.keys(modern.labels), []);
  assert.deepEqual(Object.keys(old.labels), []);
});

test("SVG labels create text and tspan nodes and preserve callback order", () => {
  const namespace = "http://www.w3.org/2000/svg";
  const document = new FakeDocument();
  const container = document.addContainer("svg-labels", namespace);
  const events = [];
  const node = createNode("svg-node");
  const labels = new SVGLabels({
    container,
    document,
    hasNode: () => true,
    placeLabel(tag, currentNode, _canvas, controller) {
      events.push(["place-hook", tag.parentNode === container]);
      controller.onPlaceLabel(tag, currentNode);
    },
  });
  const controller = {
    onCreateLabel(tag) {
      events.push(["create", tag.parentNode === container]);
    },
    onPlaceLabel() {
      events.push(["place"]);
    },
  };
  const canvas = {
    getCtx() {
      throw new Error("not used");
    },
    getSize() {
      return { width: 10, height: 10 };
    },
  };

  labels.plotLabel(canvas, node, controller);

  const label = container.children[0];
  assert.equal(label.namespaceURI, namespace);
  assert.equal(label.tagName, "SVG:TEXT");
  assert.equal(label.children[0].tagName, "SVG:TSPAN");
  assert.equal(label.attributes.get("id"), "svg-node");
  assert.equal(label.attributes.get("class"), "node");
  assert.deepEqual(events, [
    ["create", true],
    ["place-hook", true],
    ["place"],
  ]);
});

test("shared canvas projection retains the visualization label transform", () => {
  assert.deepEqual(
    projectToCanvas(
      { x: 10.25, y: -5.5 },
      {
        translateOffsetX: 7,
        translateOffsetY: -4,
        scaleOffsetX: 2,
        scaleOffsetY: 3,
        getSize() {
          return { width: 101, height: 81 };
        },
        getCtx() {
          throw new Error("not used");
        },
      },
    ),
    { x: 78, y: 20 },
  );
});

test("label caches safely accept object-prototype node ids", () => {
  const document = new FakeDocument();
  const container = document.addContainer("prototype-safe");
  const labels = new HTMLLabels({
    container,
    document,
    hasNode: () => true,
    placeLabel() {},
  });
  const node = createNode("__proto__");
  labels.plotLabel(
    {
      getCtx() {
        throw new Error("not used");
      },
      getSize() {
        return { width: 1, height: 1 };
      },
    },
    node,
    {},
  );

  assert.strictEqual(labels.getLabel("__proto__"), container.children[0]);
  assert.equal(Object.getPrototypeOf(labels.labels), null);
});
