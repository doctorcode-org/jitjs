import assert from "node:assert/strict";
import test from "node:test";

import { SpaceTreeGroup } from "../dist/visualizations/space-tree-group.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

function createTree() {
  function node(id, depth, data = {}) {
    return {
      id,
      data: { ...data },
      _depth: depth,
      drawn: true,
      exist: true,
      parent: null,
      children: [],
      eachLevel(begin, end, visit) {
        const walk = (candidate, level) => {
          if (level >= begin && (end === false || level <= end)) visit(candidate);
          if (end === false || level < end) {
            for (const child of candidate.children) walk(child, level + 1);
          }
        };
        walk(this, 0);
      },
      eachSubgraph(visit) {
        this.eachLevel(0, false, visit);
      },
      eachSubnode(visit) {
        for (const child of this.children) visit(child);
      },
      anySubnode(condition) {
        if (typeof condition === "string") {
          return this.children.some((child) => child[condition]);
        }
        if (typeof condition === "function") {
          return this.children.some(condition);
        }
        return this.children.length > 0;
      },
      getParents() {
        return this.parent ? [this.parent] : [];
      },
      isDescendantOf(ancestorId) {
        let candidate = this.parent;
        while (candidate) {
          if (candidate.id === ancestorId) return true;
          candidate = candidate.parent;
        }
        return false;
      },
    };
  }
  const root = node("root", 0);
  const a = node("a", 1);
  const b = node("b", 1);
  const a1 = node("a1", 2);
  const a2 = node("a2", 2);
  root.children.push(a, b);
  a.children.push(a1, a2);
  for (const child of [a, b]) child.parent = root;
  for (const child of [a1, a2]) child.parent = a;
  return { root, a, b, a1, a2, nodes: [root, a, b, a1, a2] };
}

function immediateAnimation() {
  return {
    options: null,
    setOptions(options) {
      this.options = options;
      return this;
    },
    start() {
      this.options.compute(0.25);
      this.options.compute(1);
      this.options.complete();
      return this;
    },
  };
}

function createPair(config = { levelsToShow: 2, multitree: false }) {
  const modernTree = createTree();
  const legacyTree = createTree();
  const modernEvents = [];
  const legacyEvents = [];

  function canvas(events) {
    return {
      getCtx() {
        return {
          save() { events.push(["save"]); },
          restore() { events.push(["restore"]); },
        };
      },
    };
  }

  const modernGraph = {
    computeLevels(root, depth) {
      modernEvents.push(["levels", root, depth]);
    },
  };
  const oldGraph = {
    computeLevels(root, depth) {
      legacyEvents.push(["levels", root, depth]);
    },
  };
  const modernCanvas = canvas(modernEvents);
  const oldCanvas = canvas(legacyEvents);
  const modern = new SpaceTreeGroup({
    root: () => "root",
    canvas: modernCanvas,
    graph: modernGraph,
    config: { ...config },
    animation: immediateAnimation(),
    plot() { modernEvents.push(["plot"]); },
    plotScaledSubtree(node, _controller, scale, animating) {
      modernEvents.push(["subtree", node.id, scale, animating]);
    },
    mergeSubtree(nodeId, data) {
      modernEvents.push(["sum", nodeId, normalizeRealm(data)]);
    },
  });

  const oldViz = {
    root: "root",
    canvas: oldCanvas,
    graph: oldGraph,
    config: { ...config },
    op: {
      sum(data) {
        legacyEvents.push(["sum", data.id, normalizeRealm(data)]);
      },
    },
    fx: {
      plot() { legacyEvents.push(["plot"]); },
      plotSubtree(node, _controller, scale, animating) {
        legacyEvents.push(["subtree", node.id, scale, animating]);
      },
    },
    labels: { clearLabels() {} },
  };
  const old = new legacy.ST.Group(oldViz);
  old.animation = immediateAnimation();
  return {
    modern,
    old,
    modernTree,
    legacyTree,
    modernEvents,
    legacyEvents,
  };
}

function state(tree) {
  return Object.fromEntries(tree.nodes.map((node) => [
    node.id,
    { drawn: node.drawn, exist: node.exist, data: node.data },
  ]));
}

function controller(events) {
  return {
    duration: 10,
    fps: 60,
    onComplete() { events.push(["complete"]); },
  };
}

test("SpaceTree group filtering and sibling discovery match legacy", () => {
  const pair = createPair();
  const modernFiltered = pair.modern
    .getNodesWithChildren([pair.modernTree.a, pair.modernTree.root])
    .map(({ id }) => id);
  const legacyFiltered = pair.old
    .getNodesWithChildren([pair.legacyTree.a, pair.legacyTree.root])
    .map(({ id }) => id);
  assert.deepEqual(modernFiltered, normalizeRealm(legacyFiltered));
  assert.deepEqual(
    Object.fromEntries(Object.entries(pair.modern.getSiblings([pair.modernTree.a1]))
      .map(([id, nodes]) => [id, nodes.map((node) => node.id)])),
    normalizeRealm(Object.fromEntries(Object.entries(pair.old.getSiblings([pair.legacyTree.a1]))
      .map(([id, nodes]) => [id, nodes.map((node) => node.id)]))),
  );
});

test("SpaceTree group contraction animation and final hiding match legacy", () => {
  const pair = createPair();
  pair.modern.contract([pair.modernTree.a], controller(pair.modernEvents));
  pair.old.contract([pair.legacyTree.a], controller(pair.legacyEvents));
  assert.deepEqual(
    normalizeRealm(pair.modernEvents),
    normalizeRealm(pair.legacyEvents),
  );
  assert.deepEqual(state(pair.modernTree), normalizeRealm(state(pair.legacyTree)));
});

test("SpaceTree group expansion, visibility, and plot steps match legacy", () => {
  const pair = createPair();
  for (const node of [pair.modernTree.a1, pair.modernTree.a2]) node.drawn = false;
  for (const node of [pair.legacyTree.a1, pair.legacyTree.a2]) node.drawn = false;
  pair.modern.expand([pair.modernTree.a], controller(pair.modernEvents));
  pair.old.expand([pair.legacyTree.a], controller(pair.legacyEvents));
  assert.deepEqual(
    normalizeRealm(pair.modernEvents),
    normalizeRealm(pair.legacyEvents),
  );
  assert.deepEqual(state(pair.modernTree), normalizeRealm(state(pair.legacyTree)));
});

test("SpaceTree multitree orientation tagging matches legacy", () => {
  const pair = createPair({ levelsToShow: 2, multitree: true });
  pair.modernTree.a.data.$orn = "left";
  pair.modernTree.b.data.$orn = "right";
  pair.legacyTree.a.data.$orn = "left";
  pair.legacyTree.b.data.$orn = "right";
  pair.modernTree.a.drawn = pair.modernTree.b.drawn = false;
  pair.legacyTree.a.drawn = pair.legacyTree.b.drawn = false;
  pair.modern.show([pair.modernTree.root]);
  pair.old.show([pair.legacyTree.root]);
  assert.deepEqual(state(pair.modernTree), normalizeRealm(state(pair.legacyTree)));
});

test("SpaceTree asynchronous node requests and merges match legacy", () => {
  const pair = createPair();
  pair.modernTree.a._level = 2;
  pair.legacyTree.a._level = 2;
  const modernController = {
    onComplete() { pair.modernEvents.push(["complete"]); },
    request(id, level, callbacks) {
      pair.modernEvents.push(["request", id, level]);
      callbacks.onComplete(id, { children: [{ id: `${id}-new` }] });
    },
  };
  const legacyController = {
    onComplete() { pair.legacyEvents.push(["complete"]); },
    request(id, level, callbacks) {
      pair.legacyEvents.push(["request", id, level]);
      callbacks.onComplete(id, { children: [{ id: `${id}-new` }] });
    },
  };
  pair.modern.requestNodes([pair.modernTree.a], modernController);
  pair.old.requestNodes([pair.legacyTree.a], legacyController);
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.legacyEvents));
});
