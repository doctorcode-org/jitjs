import assert from "node:assert/strict";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { SpaceTreeGeometry } from "../dist/visualizations/space-tree-geometry.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

function makeTree() {
  function node(id, depth, width, height, x, y) {
    const phases = {
      current: new Complex(x, y),
      start: new Complex(x + 1, y + 2),
      end: new Complex(x + 3, y + 4),
    };
    return {
      id,
      data: { $width: width, $height: height },
      _depth: depth,
      drawn: true,
      exist: true,
      pos: phases.current,
      children: [],
      getData(property) {
        return this.data[`$${property}`];
      },
      getPos(phase = "current") {
        return phases[phase];
      },
      eachSubnode(visit) {
        for (const child of this.children) visit(child);
      },
      anySubnode() {
        return this.children.length > 0;
      },
      eachLevel(begin, end, visit) {
        const walk = (candidate, relative) => {
          if (relative >= begin && (end === false || relative <= end)) {
            visit(candidate);
          }
          if (end === false || relative < end) {
            for (const child of candidate.children) walk(child, relative + 1);
          }
        };
        walk(this, 0);
      },
    };
  }
  const root = node("root", 0, 50, 24, 5, -6);
  const a = node("a", 1, 34, 18, 15, 12);
  const b = node("b", 1, 60, 30, -20, 7);
  const a1 = node("a1", 2, 28, 16, 25, 22);
  root.children.push(a, b);
  a.children.push(a1);
  return { root, a, b, a1, nodes: [root, a, b, a1] };
}

function createPair(overrides = {}) {
  const modernTree = makeTree();
  const legacyTree = makeTree();
  const modernEvents = [];
  const legacyEvents = [];
  const config = {
    orientation: "top",
    siblingOffset: 5,
    subtreeOffset: 8,
    multitree: false,
    levelsToShow: 3,
    constrained: true,
    Node: { align: "center" },
    Edge: {},
    ...overrides,
  };
  const modernGraph = { eachNode(visit) { modernTree.nodes.forEach(visit); } };
  const oldGraph = { eachNode(visit) { legacyTree.nodes.forEach(visit); } };
  const modernLabels = {
    hideLabel(node, show) { modernEvents.push(["hide", node.id, show]); },
  };
  const oldLabels = {
    hideLabel(node, show) { legacyEvents.push(["hide", node.id, show]); },
  };
  const modern = new SpaceTreeGeometry({
    graph: modernGraph,
    config: structuredClone(config),
    labels: modernLabels,
  });
  const oldViz = {
    graph: oldGraph,
    config: structuredClone(config),
    labels: oldLabels,
  };
  const old = new legacy.ST.Geom(oldViz);
  return {
    modern,
    old,
    modernTree,
    legacyTree,
    modernEvents,
    legacyEvents,
  };
}

function point(value) {
  return normalizeRealm({ x: value.x, y: value.y });
}

function phaseSnapshot(tree) {
  return Object.fromEntries(tree.nodes.map((node) => [node.id, {
    current: point(node.getPos("current")),
    start: point(node.getPos("start")),
    end: point(node.getPos("end")),
  }]));
}

function visibility(tree) {
  return Object.fromEntries(tree.nodes.map((node) => [node.id, {
    drawn: node.drawn,
    exist: node.exist,
  }]));
}

test("SpaceTree geometry dispatch and sizes match every orientation", () => {
  for (const orientation of ["top", "right", "bottom", "left"]) {
    const pair = createPair({ orientation });
    assert.equal(
      pair.modern.dispatch(orientation, 10, 20),
      pair.old.dispatch(orientation, 10, 20),
    );
    assert.equal(
      pair.modern.dispatch(orientation, 1, 2, 3, 4),
      pair.old.dispatch(orientation, 1, 2, 3, 4),
    );
    assert.equal(
      pair.modern.getSize(pair.modernTree.root),
      pair.old.getSize(pair.legacyTree.root),
    );
    assert.equal(
      pair.modern.getSize(pair.modernTree.root, true),
      pair.old.getSize(pair.legacyTree.root, true),
    );
  }
});

test("SpaceTree edges and scaled subtree anchors match all alignments", () => {
  for (const align of ["left", "center", "right"]) {
    for (const orientation of ["top", "right", "bottom", "left"]) {
      const pair = createPair({ orientation, Node: { align } });
      for (const type of ["begin", "end"]) {
        assert.deepEqual(
          point(pair.modern.getEdge(pair.modernTree.root, type, orientation)),
          point(pair.old.getEdge(pair.legacyTree.root, type, orientation)),
        );
      }
      assert.deepEqual(
        point(pair.modern.getScaledTreePosition(pair.modernTree.root, 0.35)),
        point(pair.old.getScaledTreePosition(pair.legacyTree.root, 0.35)),
      );
    }
  }
});

test("SpaceTree base sizing, canvas fit, and right-level search match legacy", () => {
  const pair = createPair();
  const canvas = { getSize: () => ({ width: 120, height: 90 }) };
  const leaf = (level, node) => level === 0 || !node.anySubnode();
  assert.equal(
    pair.modern.getTreeBaseSize(pair.modernTree.root, 3, leaf),
    pair.old.getTreeBaseSize(pair.legacyTree.root, 3, leaf),
  );
  for (const level of [1, 2, 3]) {
    assert.equal(
      pair.modern.treeFitsInCanvas(pair.modernTree.root, canvas, level),
      pair.old.treeFitsInCanvas(pair.legacyTree.root, canvas, level),
    );
  }
  assert.equal(
    pair.modern.getRightLevelToShow(pair.modernTree.root, canvas),
    pair.old.getRightLevelToShow(pair.legacyTree.root, canvas),
  );
});

test("SpaceTree translation updates the same position phases as legacy", () => {
  const pair = createPair();
  pair.modern.translate(new Complex(7, -9), ["start", "current", "end"]);
  pair.old.translate(new Complex(7, -9), ["start", "current", "end"]);
  assert.deepEqual(
    phaseSnapshot(pair.modernTree),
    normalizeRealm(phaseSnapshot(pair.legacyTree)),
  );
});

test("SpaceTree level visibility callbacks and mutations match legacy", () => {
  const pair = createPair();
  const canvas = { getSize: () => ({ width: 70, height: 60 }) };
  pair.modern.setRightLevelToShow(pair.modernTree.root, canvas, {
    onHide(node) { pair.modernEvents.push(["on-hide", node.id]); },
    onShow(node) { pair.modernEvents.push(["on-show", node.id]); },
  });
  pair.old.setRightLevelToShow(pair.legacyTree.root, canvas, {
    onHide(node) { pair.legacyEvents.push(["on-hide", node.id]); },
    onShow(node) { pair.legacyEvents.push(["on-show", node.id]); },
  });
  assert.deepEqual(pair.modernEvents, normalizeRealm(pair.legacyEvents));
  assert.deepEqual(
    visibility(pair.modernTree),
    normalizeRealm(visibility(pair.legacyTree)),
  );
});

