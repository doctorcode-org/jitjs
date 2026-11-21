import assert from "node:assert/strict";
import test from "node:test";

import {
  findParent,
  findSubtree,
  forEachLevel,
  forEachNode,
  prune,
} from "../src/core/json.ts";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace().json;

function createTree() {
  return {
    id: "root",
    name: "Root",
    data: { value: 0 },
    children: [
      {
        id: "left",
        name: "Left",
        data: { value: 1 },
        children: [
          {
            id: "left.deep",
            name: "Left deep",
            data: { value: 2 },
            children: [
              {
                id: "left.leaf",
                name: "Left leaf",
                data: { value: 3 },
              },
            ],
          },
        ],
      },
      {
        id: "right",
        name: "Right",
        data: { value: 4 },
        children: [],
      },
    ],
  };
}

test("JSON tree module has no global installation side effect", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
});

test("prune mutates the same levels as legacy json.prune", () => {
  for (const maxLevel of [-1, 0, 1, 2, 2.5, 10]) {
    const modernTree = createTree();
    const legacyTree = createTree();

    assert.equal(prune(modernTree, maxLevel), undefined);
    assert.equal(legacy.prune(legacyTree, maxLevel), undefined);
    assert.deepEqual(modernTree, normalizeRealm(legacyTree));
  }
});

test("findParent matches legacy parent selection and sentinel values", () => {
  const modernTree = createTree();
  const legacyTree = createTree();

  for (const id of ["root", "left", "left.deep", "left.leaf", "right", "missing"]) {
    const modernParent = findParent(modernTree, id);
    const legacyParent = legacy.getParent(legacyTree, id);

    assert.deepEqual(
      modernParent === false ? false : modernParent.id,
      legacyParent === false ? false : legacyParent.id,
    );
  }

  assert.strictEqual(findParent(modernTree, "left.deep"), modernTree.children[0]);
});

test("findSubtree matches legacy depth-first lookup and null sentinel", () => {
  const modernTree = createTree();
  const legacyTree = createTree();

  for (const id of ["root", "left", "left.leaf", "right", "missing"]) {
    const modernSubtree = findSubtree(modernTree, id);
    const legacySubtree = legacy.getSubtree(legacyTree, id);

    assert.deepEqual(
      modernSubtree === null ? null : normalizeRealm(modernSubtree),
      legacySubtree === null ? null : normalizeRealm(legacySubtree),
    );
  }

  assert.strictEqual(findSubtree(modernTree, "root"), modernTree);
  assert.strictEqual(findSubtree(modernTree, "left.leaf"), modernTree.children[0].children[0].children[0]);
});

test("id lookup retains legacy coercion for JavaScript callers", () => {
  const modernTree = {
    id: 0,
    children: [{ id: 1, children: [{ id: 2 }] }],
  };
  const legacyTree = structuredClone(modernTree);

  assert.equal(findParent(modernTree, "2")?.id, legacy.getParent(legacyTree, "2")?.id);
  assert.equal(findSubtree(modernTree, "2")?.id, legacy.getSubtree(legacyTree, "2")?.id);
});

test("forEachLevel matches legacy preorder, relative depths, and bounds", () => {
  for (const [initialLevel, toLevel] of [
    [0, 0],
    [0, 2],
    [2, 3],
    [3, 2],
    [-1, 1],
  ]) {
    const modernVisits = [];
    const legacyVisits = [];

    forEachLevel(createTree(), initialLevel, toLevel, (node, level) => {
      modernVisits.push([node.id, level]);
    });
    legacy.eachLevel(createTree(), initialLevel, toLevel, (node, level) => {
      legacyVisits.push([node.id, level]);
    });

    assert.deepEqual(modernVisits, legacyVisits);
  }
});

test("forEachNode matches legacy json.each order and callback levels", () => {
  const modernVisits = [];
  const legacyVisits = [];

  assert.equal(
    forEachNode(createTree(), (node, level) => {
      modernVisits.push([node.id, level]);
    }),
    undefined,
  );
  assert.equal(
    legacy.each(createTree(), (node, level) => {
      legacyVisits.push([node.id, level]);
    }),
    undefined,
  );

  assert.deepEqual(modernVisits, legacyVisits);
});
