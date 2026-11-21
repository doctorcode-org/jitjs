import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEventInfo } from "../dist/extras/event-info.js";
import {
  loadLegacyBinding,
  normalizeRealm,
} from "./legacy-harness.mjs";

const LegacyMouseEventsManager = loadLegacyBinding("MouseEventsManager");

function createFixture() {
  const calls = [];
  const event = { pageX: 155, pageY: 107 };
  const targetWindow = {
    document: {
      documentElement: { scrollLeft: 0, scrollTop: 0 },
    },
  };
  const canvas = {
    translateOffsetX: 5,
    translateOffsetY: -3,
    scaleOffsetX: 2,
    scaleOffsetY: 4,
    getSize() {
      calls.push(["size"]);
      return { width: 200, height: 100 };
    },
    getPos() {
      calls.push(["canvas-position"]);
      return { x: 10, y: 20 };
    },
  };
  const nodes = {
    a: {
      id: "a",
      hit: false,
      getData() {
        return "test";
      },
    },
    b: {
      id: "b",
      hit: true,
      getData() {
        return "test";
      },
    },
  };
  const edgeAB = {
    id: "a-b",
    hit: false,
    getData() {
      return "test";
    },
  };
  const edgeAC = {
    id: "a-c",
    hit: false,
    getData() {
      return "test";
    },
  };
  const edgeBC = {
    id: "b-c",
    hit: true,
    getData() {
      return "test";
    },
  };
  const graph = {
    nodes,
    edges: {
      a: { a: edgeAB, b: edgeAB, c: edgeAC },
      b: { a: edgeAB, c: edgeBC },
      c: { a: edgeAC, b: edgeBC },
    },
  };

  function hitNode(node, point) {
    calls.push(["node", node.id, point.x, point.y]);
    return node.hit && `node:${node.id}`;
  }

  function hitEdge(edge, point) {
    calls.push(["edge", edge.id, point.x, point.y]);
    return edge.hit && `edge:${edge.id}`;
  }

  return {
    calls,
    canvas,
    event,
    graph,
    hitEdge,
    hitNode,
    targetWindow,
  };
}

function createModern(fixture) {
  return createEventInfo(
    {
      graph: fixture.graph,
      canvas: fixture.canvas,
      resolvePointer(event) {
        fixture.calls.push(["pointer"]);
        return { x: event.pageX, y: event.pageY };
      },
      hitTestNode: fixture.hitNode,
      hitTestEdge: fixture.hitEdge,
    },
    fixture.event,
    fixture.targetWindow,
  );
}

function createLegacy(fixture) {
  const manager = Object.create(LegacyMouseEventsManager.prototype);
  manager.viz = {
    graph: fixture.graph,
    canvas: fixture.canvas,
    fx: {
      nodeTypes: {
        test: {
          contains(node, point) {
            return fixture.hitNode(node, point);
          },
        },
      },
      edgeTypes: {
        test: {
          contains(edge, point) {
            return fixture.hitEdge(edge, point);
          },
        },
      },
    },
  };

  return manager.makeEventObject(fixture.event, fixture.targetWindow);
}

function exercise(info, fixture) {
  const initial = {
    pos: info.pos,
    node: info.node,
    edge: info.edge,
    contains: info.contains,
    getNodeCalled: info.getNodeCalled,
    getEdgeCalled: info.getEdgeCalled,
  };
  const firstNode = info.getNode();
  const secondNode = info.getNode();
  const containsAfterNode = info.getContains();
  const firstEdge = info.getEdge();
  const secondEdge = info.getEdge();
  const containsAfterEdge = info.getContains();
  const firstPosition = info.getPos();
  fixture.event.pageX += 20;
  const secondPosition = info.getPos();

  return {
    initial,
    firstNode: firstNode && firstNode.id,
    secondNode: secondNode && secondNode.id,
    containsAfterNode,
    firstEdge: firstEdge && firstEdge.id,
    secondEdge: secondEdge && secondEdge.id,
    containsAfterEdge,
    firstPosition,
    secondPosition,
    getNodeCalled: info.getNodeCalled,
    getEdgeCalled: info.getEdgeCalled,
  };
}

test("event info matches legacy lazy selection and coordinate semantics", () => {
  const modernFixture = createFixture();
  const legacyFixture = createFixture();
  const modernResult = exercise(createModern(modernFixture), modernFixture);
  const legacyResult = exercise(createLegacy(legacyFixture), legacyFixture);

  assert.deepEqual(modernResult, normalizeRealm(legacyResult));

  const modernHitCalls = modernFixture.calls.filter(
    ([kind]) => kind === "node" || kind === "edge",
  );
  const legacyHitCalls = legacyFixture.calls.filter(
    ([kind]) => kind === "node" || kind === "edge",
  );
  assert.deepEqual(modernHitCalls, normalizeRealm(legacyHitCalls));
});

test("node and edge lookups are cached independently", () => {
  const fixture = createFixture();
  const info = createModern(fixture);

  assert.equal(fixture.calls.length, 0);
  assert.equal(info.getEdge().id, "b-c");
  const callsAfterEdge = fixture.calls.length;
  assert.strictEqual(info.getEdge(), info.edge);
  assert.equal(fixture.calls.length, callsAfterEdge);
  assert.equal(info.getNode().id, "b");
  const callsAfterNode = fixture.calls.length;
  assert.strictEqual(info.getNode(), info.node);
  assert.equal(info.getContains(), "node:b");
  assert.equal(fixture.calls.length, callsAfterNode);
});

test("every undirected edge is hit-tested at most once", () => {
  const fixture = createFixture();
  fixture.graph.edges.b.c.hit = false;
  const info = createModern(fixture);

  assert.equal(info.getEdge(), false);
  assert.deepEqual(
    fixture.calls
      .filter(([kind]) => kind === "edge")
      .map(([, id]) => id),
    ["a-b", "a-c", "b-c"],
  );

  const callCount = fixture.calls.length;
  assert.equal(info.getEdge(), false);
  assert.equal(fixture.calls.length, callCount);
});

test("event info is an import-safe leaf with no DOM or shape registry", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  const output = await readFile(
    new URL("../dist/extras/event-info.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(
    output,
    /\b(?:window|document|globalThis|nodeTypes|edgeTypes)\b|\$jit/,
  );
});
