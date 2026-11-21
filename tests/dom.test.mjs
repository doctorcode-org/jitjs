import assert from "node:assert/strict";
import test from "node:test";

import {
  addClass,
  addEvent,
  addEvents,
  clean,
  destroy,
  event,
  getEvent,
  getEventPosition,
  getPos,
  getWheel,
  hasClass,
  id,
  isRightClick,
  removeClass,
  stopEvent,
} from "../dist/browser/dom.js";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

function createNode(name, child = null) {
  const node = {
    name,
    childNodes: child ? [child] : [],
    parentNode: null,
    cleared: false,
    clearAttributes() {
      this.cleared = true;
    },
    removeChild(target) {
      const index = this.childNodes.indexOf(target);
      if (index !== -1) this.childNodes.splice(index, 1);
      target.parentNode = null;
      return target;
    },
  };
  if (child) child.parentNode = node;
  return node;
}

function createOffsetTree() {
  const body = {
    tagName: "BODY",
    offsetLeft: 100,
    offsetTop: 100,
    scrollLeft: 100,
    scrollTop: 100,
    offsetParent: null,
    parentNode: null,
  };
  const parent = {
    tagName: "DIV",
    offsetLeft: 10,
    offsetTop: 20,
    scrollLeft: 3,
    scrollTop: 4,
    offsetParent: body,
    parentNode: body,
  };
  const child = {
    tagName: "SPAN",
    offsetLeft: 5,
    offsetTop: 7,
    scrollLeft: 1,
    scrollTop: 2,
    offsetParent: parent,
    parentNode: parent,
  };
  return child;
}

test("browser helpers can be imported without a browser global", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.deepEqual(Object.keys(event).sort(), [
    "get",
    "getPos",
    "getWheel",
    "isRightClick",
    "stop",
  ]);
});

test("id lookup reads the provided document only when called", () => {
  const element = { id: "example" };
  const calls = [];
  const ownerDocument = {
    getElementById(identifier) {
      calls.push(identifier);
      return identifier === "example" ? element : null;
    },
  };

  assert.strictEqual(id("example", ownerDocument), element);
  assert.equal(id("missing", ownerDocument), null);
  assert.deepEqual(calls, ["example", "missing"]);
});

test("destroy and clean retain the legacy recursive cleanup order", () => {
  for (const implementation of [
    { clean, destroy },
    { clean: legacy.util.clean, destroy: legacy.util.destroy },
  ]) {
    const grandchild = createNode("grandchild");
    const child = createNode("child", grandchild);
    const root = createNode("root", child);

    implementation.clean(root);

    assert.equal(root.childNodes.length, 0);
    assert.equal(child.childNodes.length, 0);
    assert.equal(child.cleared, true);
    assert.equal(grandchild.cleared, true);
  }
});

test("event registration follows standard and attachEvent paths", () => {
  const modernCalls = [];
  const legacyCalls = [];
  const handler = () => {};
  const modernTarget = {
    addEventListener(...args) {
      modernCalls.push(args);
    },
  };
  const oldTarget = {
    attachEvent(...args) {
      legacyCalls.push(args);
    },
  };

  addEvent(modernTarget, "click", handler);
  addEvent(oldTarget, "focus", handler);
  addEvents(modernTarget, { mousemove: handler, mouseup: handler });

  assert.deepEqual(modernCalls, [
    ["click", handler, false],
    ["mousemove", handler, false],
    ["mouseup", handler, false],
  ]);
  assert.deepEqual(legacyCalls, [["onfocus", handler]]);
});

test("class manipulation matches JIT 2.0.1", () => {
  const modernTarget = { className: "alpha beta" };
  const legacyTarget = { className: "alpha beta" };

  assert.equal(hasClass(modernTarget, "alpha"), legacy.util.hasClass(legacyTarget, "alpha"));
  addClass(modernTarget, "gamma");
  legacy.util.addClass(legacyTarget, "gamma");
  addClass(modernTarget, "gamma");
  legacy.util.addClass(legacyTarget, "gamma");
  removeClass(modernTarget, "beta");
  legacy.util.removeClass(legacyTarget, "beta");

  assert.equal(modernTarget.className, legacyTarget.className);
});

test("element and pointer coordinates preserve legacy fallbacks", () => {
  assert.deepEqual(getPos(createOffsetTree()), normalizeRealm(legacy.util.getPos(createOffsetTree())));

  const targetWindow = {
    event: { clientX: 12, clientY: 9 },
    document: {
      documentElement: { scrollLeft: 4, scrollTop: 6 },
      body: { scrollLeft: 100, scrollTop: 100 },
    },
  };
  assert.strictEqual(getEvent(null, targetWindow), targetWindow.event);
  assert.deepEqual(getEventPosition(null, targetWindow), { x: 16, y: 15 });
  assert.deepEqual(
    getEventPosition(
      { touches: [{ pageX: 30, pageY: 40 }] },
      targetWindow,
    ),
    { x: 30, y: 40 },
  );

  const legacyWindow = normalizeRealm(targetWindow);
  assert.deepEqual(
    getEventPosition({ pageX: 0, pageY: 0, clientX: 2, clientY: 3 }, targetWindow),
    normalizeRealm(
      legacy.util.event.getPos(
        { pageX: 0, pageY: 0, clientX: 2, clientY: 3 },
        legacyWindow,
      ),
    ),
  );
});

test("wheel, right-click, and event cancellation match legacy behavior", () => {
  for (const sample of [{ wheelDelta: 240 }, { detail: 6 }, {}]) {
    assert.equal(getWheel(sample), legacy.util.event.getWheel(sample));
  }
  for (const sample of [{ which: 3 }, { button: 2 }, { which: 1, button: 0 }]) {
    assert.equal(isRightClick(sample), legacy.util.event.isRightClick(sample));
  }

  const calls = [];
  const suppliedEvent = {
    stopPropagation() {
      calls.push("stop");
    },
    preventDefault() {
      calls.push("prevent");
    },
  };
  stopEvent(suppliedEvent);
  assert.deepEqual(calls, ["stop", "prevent"]);
  assert.equal(suppliedEvent.cancelBubble, true);

  const fallback = {};
  stopEvent(fallback);
  assert.equal(fallback.cancelBubble, true);
  assert.equal(fallback.returnValue, false);
});
