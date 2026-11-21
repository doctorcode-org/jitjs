import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { Graph } from "../dist/graph/graph.js";
import { transformGraphMoebius } from "../dist/graph/moebius.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

test("Complex moebius transformation retains legacy values and vector mutation", () => {
  const cases = [
    [[0.2, -0.3], [0.1, 0.2]],
    [[-0.75, 0.1], [0.25, -0.4]],
    [[0, 0], [0.5, 0]],
  ];
  for (const [[x, y], [vx, vy]] of cases) {
    const modernVector = new Complex(vx, vy);
    const legacyVector = new legacy.Complex(vx, vy);
    const modern = new Complex(x, y).moebiusTransformation(modernVector);
    const old = new legacy.Complex(x, y).moebiusTransformation(legacyVector);
    assert.deepEqual(normalizeRealm(modern), normalizeRealm(old));
    assert.deepEqual(normalizeRealm(modernVector), normalizeRealm(legacyVector));
  }
});

function graph(GraphConstructor, Position) {
  const value = new GraphConstructor(
    { klass: Position, Node: { exist: true } },
    { overridable: true, CanvasStyles: {} },
    { overridable: true, CanvasStyles: {} },
    {},
  );
  value.addNode({ id: "a", name: "A", data: {} });
  value.addNode({ id: "b", name: "B", data: {} });
  value.getNode("a").startPos.setc(0.2, 0.1);
  value.getNode("b").startPos.setc(-0.3, 0.25);
  value.getNode("a").endPos.setc(0.4, -0.2);
  value.getNode("b").endPos.setc(-0.1, -0.35);
  return value;
}

function snapshot(value) {
  return normalizeRealm(Object.fromEntries(Object.keys(value.nodes).sort().map((id) => {
    const node = value.getNode(id);
    return [id, {
      start: node.startPos.getc(true),
      end: node.endPos.getc(true),
    }];
  })));
}

test("graph moebius transformation matches Graph.Util across phases", () => {
  const modern = graph(Graph, Complex);
  const old = graph(legacy.Graph, legacy.Complex);
  transformGraphMoebius(
    modern,
    [new Complex(0.15, -0.12), new Complex(-0.2, 0.05)],
    ["start", "end"],
    "start",
    "ignore",
  );
  legacy.Graph.Util.moebiusTransformation(
    old,
    [new legacy.Complex(0.15, -0.12), new legacy.Complex(-0.2, 0.05)],
    ["start", "end"],
    "start",
    "ignore",
  );
  assert.deepEqual(snapshot(modern), snapshot(old));
});

test("graph moebius helper is an import-safe leaf", async () => {
  const output = await readFile(
    new URL("../dist/graph/moebius.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
