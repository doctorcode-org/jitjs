import assert from "node:assert/strict";
import test from "node:test";

import {
  Canvas,
  CanvasBase,
  CanvasLayer,
} from "../dist/canvas/canvas.js";

function createContext() {
  const calls = [];
  const context = {
    calls,
    beginPath() {
      calls.push(["beginPath"]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    clearRect(...args) {
      calls.push(["clearRect", ...args]);
    },
    fill() {
      calls.push(["fill"]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    scale(...args) {
      calls.push(["scale", ...args]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    translate(...args) {
      calls.push(["translate", ...args]);
    },
  };
  return context;
}

class FakeElement {
  constructor(tagName, ownerDocument, namespaceURI = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.namespaceURI = namespaceURI;
    this.id = "";
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.offsetParent = null;
    this.offsetLeft = 0;
    this.offsetTop = 0;
    this.offsetWidth = 0;
    this.offsetHeight = 0;
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
  }
}

class FakeCanvasElement extends FakeElement {
  constructor(ownerDocument) {
    super("canvas", ownerDocument);
    this.width = 0;
    this.height = 0;
    this.context = createContext();
  }

  getContext(type) {
    assert.equal(type, "2d");
    return this.context;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.canvases = [];
  }

  addHost(id, width, height) {
    const host = new FakeElement("div", this);
    host.id = id;
    host.offsetWidth = width;
    host.offsetHeight = height;
    this.elements.set(id, host);
    return host;
  }

  createElement(tagName) {
    if (tagName.toLowerCase() === "canvas") {
      const canvas = new FakeCanvasElement(this);
      this.canvases.push(canvas);
      return canvas;
    }
    return new FakeElement(tagName, this);
  }

  createElementNS(namespaceURI, qualifiedName) {
    return new FakeElement(qualifiedName, this, namespaceURI);
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }
}

class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.timers = new Map();
    this.nextTimer = 1;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  setTimeout(handler) {
    const id = this.nextTimer;
    this.nextTimer += 1;
    this.timers.set(id, handler);
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  dispatch(type) {
    this.listeners.get(type)?.({ type });
  }

  flushTimers() {
    const pending = [...this.timers.values()];
    this.timers.clear();
    for (const handler of pending) handler();
  }
}

function createVisualization() {
  const calls = { plot: 0, refresh: 0 };
  return {
    calls,
    viz: {
      fx: {
        plot() {
          calls.plot += 1;
        },
      },
      refresh() {
        calls.refresh += 1;
      },
    },
  };
}

test("the canvas module is import-safe and exposes direct constructors", () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.strictEqual(Canvas.Base, CanvasLayer);
  assert.strictEqual(Canvas.Layer, CanvasLayer);
  assert.strictEqual(CanvasBase, CanvasLayer);

  assert.throws(
    () =>
      new CanvasLayer({
        injectInto: "missing",
        width: 10,
        height: 10,
      }),
    /requires an injected document/,
  );
});

test("Canvas builds centered primary and background layers in legacy z-order", () => {
  const document = new FakeDocument();
  const host = document.addHost("infovis", 320, 180);
  const { viz } = createVisualization();
  let backgroundPlots = 0;

  const canvas = new Canvas(
    viz,
    {
      injectInto: "infovis",
      type: "2D",
      Label: { type: "HTML" },
      layers: [
        {
          idSuffix: "-background",
          plot() {
            backgroundPlots += 1;
          },
        },
      ],
    },
    { document },
  );

  assert.equal(canvas.id, "infovis");
  assert.deepEqual(canvas.getSize(), { width: 320, height: 180 });
  assert.strictEqual(canvas.getElement(), host.children[0]);
  assert.equal(canvas.getElement().id, "infovis-canvaswidget");
  assert.equal(canvas.getElement().style.width, "320px");
  assert.equal(canvas.labelContainer.id, "infovis-label");
  assert.strictEqual(canvas.getLabelRoot(), canvas.labelContainer);
  assert.equal(backgroundPlots, 1);

  assert.deepEqual(
    canvas.getElement().children.map((element) => element.id),
    ["infovis-background", "infovis-canvas", "infovis-label"],
  );
  assert.deepEqual(document.canvases[0].context.calls[0], [
    "translate",
    160,
    90,
  ]);
  assert.deepEqual(document.canvases[1].context.calls[0], [
    "translate",
    160,
    90,
  ]);
  assert.strictEqual(canvas.getCtx(), document.canvases[0].context);
  assert.throws(() => canvas.getCtx(4), RangeError);
});

test("translation, scaling, clearing, and paths retain JIT transform semantics", () => {
  const document = new FakeDocument();
  document.addHost("scene", 200, 100);
  const { calls, viz } = createVisualization();
  const canvas = new Canvas(viz, { injectInto: "scene" }, { document });
  const context = document.canvases[0].context;
  context.calls.length = 0;

  canvas.translate(10, -5, true);
  assert.deepEqual(context.calls, [["translate", 10, -5]]);
  assert.equal(calls.plot, 0);

  canvas.scale(2, 4, true);
  assert.equal(canvas.translateOffsetX, 20);
  assert.equal(canvas.translateOffsetY, -20);
  assert.equal(canvas.scaleOffsetX, 2);
  assert.equal(canvas.scaleOffsetY, 4);
  assert.deepEqual(context.calls.slice(1), [
    ["scale", 2, 4],
    ["translate", 5, -3.75],
    ["clearRect", -60, -7.5, 100, 25],
  ]);
  assert.equal(calls.plot, 1);

  context.calls.length = 0;
  canvas.clear();
  assert.deepEqual(context.calls, [
    ["clearRect", -60, -7.5, 100, 25],
  ]);

  context.calls.length = 0;
  canvas.path("stroke", (ctx) => ctx.moveTo(1, 2));
  assert.deepEqual(context.calls, [
    ["beginPath"],
    ["moveTo", 1, 2],
    ["stroke"],
    ["closePath"],
  ]);
});

test("resize invalidates size caches and resets widget and layer transforms", () => {
  const document = new FakeDocument();
  document.addHost("resize", 100, 80);
  const { calls, viz } = createVisualization();
  let positionReads = 0;
  const canvas = new Canvas(viz, { injectInto: "resize" }, {
    document,
    getPosition() {
      positionReads += 1;
      return { x: positionReads, y: positionReads + 1 };
    },
  });

  assert.deepEqual(canvas.getPos(), { x: 1, y: 2 });
  assert.deepEqual(canvas.getPos(), { x: 1, y: 2 });
  canvas.translate(4, 5, true);
  document.canvases[0].context.calls.length = 0;
  canvas.resize(300, 150);

  assert.equal(positionReads, 2);
  assert.deepEqual(canvas.getSize(), { width: 300, height: 150 });
  assert.equal(canvas.getElement().style.width, "300px");
  assert.equal(canvas.getElement().style.height, "150px");
  assert.equal(canvas.labelContainer.style.width, "300px");
  assert.equal(canvas.translateOffsetX, 0);
  assert.equal(canvas.translateOffsetY, 0);
  assert.equal(canvas.scaleOffsetX, 1);
  assert.equal(canvas.scaleOffsetY, 1);
  assert.deepEqual(document.canvases[0].context.calls, [
    ["translate", 150, 75],
    ["clearRect", -150, -75, 300, 150],
  ]);
  assert.equal(calls.refresh, 1);
});

test("SVG labels are created without relying on ambient SVG constructors", () => {
  const document = new FakeDocument();
  document.addHost("svg-scene", 240, 120);
  const { viz } = createVisualization();
  const canvas = new Canvas(
    viz,
    { injectInto: "svg-scene", Label: { type: "SVG" } },
    { document },
  );

  assert.equal(canvas.labelContainer.tagName, "SVG");
  assert.equal(
    canvas.labelContainer.namespaceURI,
    "http://www.w3.org/2000/svg",
  );
  assert.equal(canvas.labelContainer.children[0].id, "svg-scene-label");
  assert.strictEqual(canvas.getLabelRoot(), canvas.labelContainer.children[0]);
  canvas.resize(400, 220);
  assert.equal(canvas.labelContainer.attributes.get("width"), "400");
  assert.equal(canvas.labelContainer.attributes.get("height"), "220");
});

test("the injected scroll observer refreshes position and can be disposed", () => {
  const document = new FakeDocument();
  document.addHost("scrolling", 80, 60);
  const window = new FakeWindow();
  const { viz } = createVisualization();
  let position = 1;
  const canvas = new Canvas(viz, { injectInto: "scrolling" }, {
    document,
    window,
    getPosition() {
      return { x: position, y: position };
    },
  });

  assert.deepEqual(canvas.getPos(), { x: 1, y: 1 });
  position = 7;
  window.dispatch("scroll");
  window.flushTimers();
  assert.deepEqual(canvas.getPos(), { x: 7, y: 7 });

  canvas.dispose();
  assert.equal(window.listeners.has("scroll"), false);
  assert.equal(window.timers.size, 0);
});

test("a directly constructed layer delegates plot and resize callbacks", () => {
  const document = new FakeDocument();
  const events = [];
  const layer = new CanvasLayer(
    { injectInto: "standalone", idSuffix: "-layer", width: 90, height: 60 },
    {
      plot(current) {
        events.push(["plot", current.canvas.id]);
      },
      resize(width, height, current) {
        events.push(["resize", width, height, current.canvas.id]);
      },
    },
    document,
  );

  layer.plot();
  layer.resize(120, 70);
  assert.deepEqual(events, [
    ["plot", "standalone-layer"],
    ["resize", 120, 70, "standalone-layer"],
  ]);
  assert.deepEqual(layer.getSize(), { width: 120, height: 70 });
});
