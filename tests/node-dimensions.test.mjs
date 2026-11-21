import assert from "node:assert/strict";
import test from "node:test";

import { Graph } from "../dist/graph/graph.js";
import {
  NodeDimensionMeasurer,
  createNodeDimensionComputer,
} from "../dist/layouts/node-dimensions.js";
import {
  loadLegacyBinding,
  loadLegacyNamespace,
  normalizeRealm,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyNodeDimensions = loadLegacyBinding("NodeDim");
const nodeConfig = {
  overridable: true,
  type: "rectangle",
  width: 90,
  height: 20,
  dim: 3,
  autoWidth: false,
  autoHeight: false,
  CanvasStyles: {},
};
const edgeConfig = { overridable: true, CanvasStyles: {} };
const labelConfig = {};
const inputs = [
  {
    id: "rectangle",
    name: "Wide",
    data: { $autoWidth: true, $width: 999, $height: 999, $dim: 999 },
  },
  {
    id: "circle",
    name: "Rounder",
    data: { $autoWidth: true, $autoHeight: true, $type: "circle" },
  },
  {
    id: "fixed",
    name: "Fixed",
    data: { $width: 33, $height: 44 },
  },
];

class MeasurementLabel {
  constructor() {
    this.style = {};
    this.className = "";
    this.innerHTML = "";
    this.parentNode = null;
  }

  get offsetWidth() {
    return this.style.width === "auto"
      ? this.innerHTML.length * 7
      : Number.parseFloat(this.style.width);
  }

  get offsetHeight() {
    return this.style.height === "auto"
      ? 14
      : Number.parseFloat(this.style.height);
  }
}

class MeasurementDocument {
  constructor() {
    this.children = [];
    this.body = {
      appendChild: (child) => {
        child.parentNode = this.body;
        this.children.push(child);
        return child;
      },
      removeChild: (child) => {
        const index = this.children.indexOf(child);
        if (index !== -1) this.children.splice(index, 1);
        child.parentNode = null;
        return child;
      },
    };
  }

  createElement(tagName) {
    assert.equal(tagName, "div");
    return new MeasurementLabel();
  }
}

function createGraphs() {
  const modern = new Graph({}, nodeConfig, edgeConfig, labelConfig);
  const old = new legacy.Graph({}, nodeConfig, edgeConfig, labelConfig);
  for (const input of inputs) {
    modern.addNode(input);
    old.addNode(input);
  }
  return { modern, old };
}

function snapshot(graph) {
  return Object.fromEntries(Object.keys(graph.nodes).sort().map((id) => {
    const node = graph.nodes[id];
    return [id, normalizeRealm(node.data)];
  }));
}

test("node dimension module imports without requiring a document", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(globalThis.document, undefined);
  const measurer = new NodeDimensionMeasurer();
  const { modern } = createGraphs();
  assert.throws(
    () => measurer.compute(modern),
    /requires an injected document/,
  );
});

test("DOM measurement and shape normalization match JIT 2.0.1", () => {
  const { modern, old } = createGraphs();
  const modernDocument = new MeasurementDocument();
  const legacyDocument = new MeasurementDocument();
  setLegacyDocument(legacyDocument);
  legacyNodeDimensions.label = null;

  const measurer = new NodeDimensionMeasurer(modernDocument);
  measurer.compute(modern, ["current", "end"], {});
  legacyNodeDimensions.compute(old, ["current", "end"], {});

  assert.deepEqual(snapshot(modern), snapshot(old));
  assert.equal(modern.getNode("rectangle").data.$width, 28);
  assert.equal(modern.getNode("rectangle").data.$height, 20);
  assert.equal(modern.getNode("circle").data.$width, 49);
  assert.equal(modern.getNode("circle").data.$height, 49);
  assert.equal(modern.getNode("circle").data.$dim, 49);
  assert.equal(modern.getNode("fixed").data.$width, 33);
  assert.equal(modernDocument.children.length, 1);
  assert.equal(legacyDocument.children.length, 1);
  assert.equal(measurer.getLabel().className, "jit-autoadjust-label");
  assert.equal(measurer.getLabel().style.visibility, "hidden");
});

test("measurement labels are reused, disposable, and exposed as layout callbacks", () => {
  const { modern } = createGraphs();
  const document = new MeasurementDocument();
  const dimensions = createNodeDimensionComputer(document);

  dimensions.compute(modern, ["current"], {});
  const firstLabel = dimensions.measurer.getLabel();
  dimensions.compute(modern, ["end"], {});
  assert.strictEqual(dimensions.measurer.getLabel(), firstLabel);
  assert.equal(document.children.length, 1);

  dimensions.measurer.dispose();
  assert.equal(dimensions.measurer.getLabel(), undefined);
  assert.equal(document.children.length, 0);
});
