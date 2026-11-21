import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Complex } from "../dist/core/geometry.js";
import { SpaceTreeWorkflow } from "../dist/visualizations/space-tree-workflow.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();
const legacyMethods = legacy.ST.prototype;

function createTree() {
  function makeNode(id, depth, x, y) {
    return {
      id,
      data: { $alpha: 1 },
      _depth: depth,
      drawn: true,
      exist: true,
      selected: false,
      visited: true,
      pos: new Complex(x, y),
      startPos: new Complex(x + 1, y + 1),
      endPos: new Complex(x + 2, y + 2),
      parent: null,
      children: [],
      getData(property) { return this.data[`$${property}`]; },
      setData(property, value, phase = "current") {
        if (phase === "end") {
          this.endData ??= {};
          this.endData[property] = value;
        } else {
          this.data[`$${property}`] = value;
        }
      },
      eachLevel(begin, end, visit) {
        const walk = (candidate, relative) => {
          if (relative >= begin && (end === false || relative <= end)) visit(candidate);
          if (end === false || relative < end) {
            for (const child of candidate.children) walk(child, relative + 1);
          }
        };
        walk(this, 0);
      },
      eachSubnode(visit) { this.children.forEach(visit); },
      anySubnode(condition) {
        if (typeof condition === "string") {
          return this.children.some((child) => child[condition]);
        }
        if (typeof condition === "function") return this.children.some(condition);
        return this.children.length > 0;
      },
      isDescendantOf(id) {
        let candidate = this.parent;
        while (candidate) {
          if (candidate.id === id) return true;
          candidate = candidate.parent;
        }
        return false;
      },
    };
  }
  const root = makeNode("root", 0, 0, 0);
  const a = makeNode("a", 1, 20, 5);
  const b = makeNode("b", 1, -15, 8);
  const a1 = makeNode("a1", 2, 35, 10);
  root.children.push(a, b);
  a.children.push(a1);
  for (const child of [a, b]) child.parent = root;
  a1.parent = a;
  const nodes = [root, a, b, a1];
  return { root, a, b, a1, nodes };
}

function snapshot(tree) {
  return Object.fromEntries(tree.nodes.map((node) => [node.id, {
    selected: node.selected,
    drawn: node.drawn,
    exist: node.exist,
    visited: node.visited,
    depth: node._depth,
    level: node._level,
    data: node.data,
    endData: node.endData,
    pos: { x: node.pos.x, y: node.pos.y },
    start: { x: node.startPos.x, y: node.startPos.y },
    end: { x: node.endPos.x, y: node.endPos.y },
  }]));
}

function createPair(overrides = {}) {
  const modernTree = createTree();
  const oldTree = createTree();
  const modernEvents = [];
  const oldEvents = [];

  function makeGraph(tree, events) {
    return {
      getNode(id) { return tree.nodes.find((node) => node.id === id); },
      eachNode(visit) { tree.nodes.forEach(visit); },
      computeLevels(root, start, flags) {
        events.push(["levels", root, start, flags]);
      },
    };
  }

  function makeConfig(events) {
    return {
      levelsToShow: 2,
      constrained: true,
      multitree: false,
      orientation: "top",
      align: "center",
      offsetX: 7,
      offsetY: -3,
      onBeforeCompute(node) { events.push(["before-compute", node.id]); },
      onAfterCompute(node) {
        events.push(["after-compute", typeof node === "string" ? node : node.id]);
      },
      onComplete() { events.push(["complete"]); },
      ...overrides,
    };
  }

  function makeCanvas() {
    return { getSize: () => ({ width: 400, height: 300 }) };
  }

  function selectPath(tree, node, events) {
    events.push(["select-path", node.id]);
    tree.nodes.forEach((candidate) => { candidate.selected = false; });
    let candidate = node;
    while (candidate) {
      candidate.selected = true;
      candidate = candidate.parent;
    }
  }

  function makeGeometry(tree, config, events) {
    return {
      switchOrientation(orientation) {
        events.push(["orientation", orientation]);
        config.orientation = orientation;
      },
      getRightLevelToShow(node) {
        events.push(["right-level", node.id]);
        return 1;
      },
      setRightLevelToShow(node, _canvas, options) {
        events.push(["set-right-level", node.id, options === false ? false : Boolean(options)]);
        if (options && options.onShow) {
          node.eachLevel(0, config.levelsToShow, options.onShow);
        }
      },
      translate(position, phases) {
        const list = Array.isArray(phases) ? phases : [phases];
        events.push(["translate", position.x, position.y, [...list]]);
        for (const node of tree.nodes) {
          for (const phase of list) {
            const target = phase === "current" ? node.pos : node[`${phase}Pos`];
            target.$add(position);
          }
        }
      },
    };
  }

  function makeGroup(events) {
    return {
      requestNodes(nodes, controller) {
        events.push(["request-nodes", nodes.map((node) => [node.id, node._level])]);
        controller.onComplete();
      },
      contract(nodes, controller) {
        events.push(["contract", nodes.map((node) => node.id)]);
        controller.onComplete();
      },
      expand(nodes, controller) {
        events.push(["expand", nodes.map((node) => node.id)]);
        controller.onComplete();
      },
      prepare(nodes) {
        events.push(["prepare", nodes.map((node) => node.id)]);
        return nodes;
      },
      hide(nodes, controller) {
        events.push(["hide", nodes.map((node) => node.id)]);
        controller.onComplete();
      },
      show(nodes) { events.push(["show", nodes.map((node) => node.id)]); },
      getSiblings(nodes) {
        return Object.fromEntries(nodes.map((node) => [node.id,
          node.parent ? node.parent.children : [node]]));
      },
    };
  }

  const modernConfig = makeConfig(modernEvents);
  const oldConfig = makeConfig(oldEvents);
  const modernGraph = makeGraph(modernTree, modernEvents);
  const oldGraph = makeGraph(oldTree, oldEvents);
  const modernCanvas = makeCanvas();
  const oldCanvas = makeCanvas();
  const modernGeometry = makeGeometry(modernTree, modernConfig, modernEvents);
  const oldGeometry = makeGeometry(oldTree, oldConfig, oldEvents);
  const modernGroup = makeGroup(modernEvents);
  const oldGroup = makeGroup(oldEvents);

  const modernVisualization = {
    root: "root",
    clickedNode: modernTree.root,
    graph: modernGraph,
    canvas: modernCanvas,
    config: modernConfig,
    compute(phase, recompute) { modernEvents.push(["compute", phase, recompute]); },
    plot() { modernEvents.push(["plot"]); },
    animate(options) {
      modernEvents.push(["animate", normalizeRealm(options.modes)]);
      options.onComplete?.();
    },
    selectPath(node) { selectPath(modernTree, node, modernEvents); },
  };

  const old = {
    root: "root",
    clickedNode: oldTree.root,
    graph: oldGraph,
    canvas: oldCanvas,
    config: oldConfig,
    controller: oldConfig,
    geom: oldGeometry,
    group: oldGroup,
    busy: false,
    compute(phase, recompute) { oldEvents.push(["compute", phase, recompute]); },
    plot() { oldEvents.push(["plot"]); },
    selectPath(node) { selectPath(oldTree, node, oldEvents); },
    fx: {
      busy: false,
      plot() { oldEvents.push(["plot"]); },
      animate(options) {
        oldEvents.push(["animate", normalizeRealm(options.modes)]);
        options.onComplete?.();
      },
    },
    op: {
      sum(subtree, options) {
        oldEvents.push(["sum", normalizeRealm(subtree), normalizeRealm(options)]);
      },
      removeNode(ids, options) {
        oldEvents.push(["remove", [...ids], normalizeRealm(options)]);
      },
    },
    labels: { clearLabels() {} },
  };
  for (const method of [
    "requestNodes", "contract", "move", "expand", "switchPosition",
    "switchAlignment", "refresh", "reposition", "select", "onClick",
    "setRoot", "addSubtree", "removeSubtree",
  ]) {
    old[method] = legacyMethods[method].bind(old);
  }

  const modern = new SpaceTreeWorkflow({
    visualization: modernVisualization,
    geometry: modernGeometry,
    group: modernGroup,
    controller: modernConfig,
    sumSubtree(subtree, options) {
      modernEvents.push(["sum", normalizeRealm(subtree), normalizeRealm(options)]);
    },
    removeNodes(ids, options) {
      modernEvents.push(["remove", [...ids], normalizeRealm(options)]);
    },
  });

  return {
    modern,
    old,
    modernTree,
    oldTree,
    modernEvents,
    oldEvents,
    modernVisualization,
  };
}

test("SpaceTree request leaf selection and remaining-level values match legacy", () => {
  const pair = createPair();
  pair.modern.requestNodes(pair.modernTree.a, { request() {} });
  pair.old.requestNodes(pair.oldTree.a, { request() {} });
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
  assert.deepEqual(normalizeRealm(snapshot(pair.modernTree)), normalizeRealm(snapshot(pair.oldTree)));
});

test("SpaceTree synchronous selection workflow matches legacy ordering and state", () => {
  const pair = createPair();
  pair.modern.select("a");
  pair.old.select("a");
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
  assert.deepEqual(normalizeRealm(snapshot(pair.modernTree)), normalizeRealm(snapshot(pair.oldTree)));
  assert.equal(pair.modernVisualization.clickedNode.id, pair.old.clickedNode.id);
});

test("SpaceTree animated click pipeline matches legacy request/contract/move/expand", () => {
  const pair = createPair();
  pair.modern.onClick("a", {
    onBeforeRequest(node) { pair.modernEvents.push(["before-request", node.id]); },
    onBeforeContract(node) { pair.modernEvents.push(["before-contract", node.id]); },
    onBeforeMove(node) { pair.modernEvents.push(["before-move", node.id]); },
    onBeforeExpand(node) { pair.modernEvents.push(["before-expand", node.id]); },
  });
  pair.old.onClick("a", {
    onBeforeRequest(node) { pair.oldEvents.push(["before-request", node.id]); },
    onBeforeContract(node) { pair.oldEvents.push(["before-contract", node.id]); },
    onBeforeMove(node) { pair.oldEvents.push(["before-move", node.id]); },
    onBeforeExpand(node) { pair.oldEvents.push(["before-expand", node.id]); },
  });
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
  assert.deepEqual(normalizeRealm(snapshot(pair.modernTree)), normalizeRealm(snapshot(pair.oldTree)));
  assert.equal(pair.modern.busy, pair.old.busy);
});

test("SpaceTree orientation and alignment switches retain legacy method routing", () => {
  const animatePair = createPair();
  animatePair.modern.switchPosition("right", "animate");
  animatePair.old.switchPosition("right", "animate");
  assert.deepEqual(normalizeRealm(animatePair.modernEvents), normalizeRealm(animatePair.oldEvents));

  const replotPair = createPair();
  replotPair.modern.switchAlignment("right", "replot");
  replotPair.old.switchAlignment("right", "replot");
  assert.deepEqual(normalizeRealm(replotPair.modernEvents), normalizeRealm(replotPair.oldEvents));
});

test("SpaceTree root switching and multitree orientation reversal match legacy", () => {
  const pair = createPair({ multitree: true });
  pair.modernTree.a.data.$orn = "left";
  pair.oldTree.a.data.$orn = "left";
  pair.modern.setRoot("a", "animate");
  pair.old.setRoot("a", "animate");
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
  assert.deepEqual(normalizeRealm(snapshot(pair.modernTree)), normalizeRealm(snapshot(pair.oldTree)));
  assert.equal(pair.modernVisualization.root, pair.old.root);
  assert.equal(pair.modern.busy, pair.old.busy);
});

test("SpaceTree subtree operation routing matches legacy modes and ids", () => {
  const pair = createPair();
  const subtree = { id: "new", name: "New", data: {}, children: [] };
  pair.modern.addSubtree(subtree, "animate", { marker: 1 });
  pair.old.addSubtree(subtree, "animate", { marker: 1 });
  pair.modern.removeSubtree("a", false, "replot", { marker: 2 });
  pair.old.removeSubtree("a", false, "replot", { marker: 2 });
  assert.deepEqual(normalizeRealm(pair.modernEvents), normalizeRealm(pair.oldEvents));
});

test("SpaceTree workflow entry is browser-global and registry free", async () => {
  const output = await readFile(
    new URL("../dist/visualizations/space-tree-workflow.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /canvas\/canvas|browser\/dom|graph\/labels|extras\//);
  assert.doesNotMatch(output, /\$jit|globalThis|document|window/);
});
