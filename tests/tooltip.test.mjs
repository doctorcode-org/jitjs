import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  computeTooltipPosition,
  TooltipController,
} from "../dist/extras/tooltip.js";
import {
  loadLegacyBinding,
  setLegacyDocument,
} from "./legacy-harness.mjs";

const LegacyTips = loadLegacyBinding("Extras").Classes.Tips;

function createTooltip(width, height, events = []) {
  const style = { display: "none", top: "", left: "" };
  return {
    style,
    get offsetWidth() {
      events.push(["measure-width", style.display]);
      return typeof width === "function" ? width() : width;
    },
    get offsetHeight() {
      events.push(["measure-height", style.display]);
      return typeof height === "function" ? height() : height;
    },
  };
}

function createLegacyTips(tooltip, config) {
  const tips = Object.create(LegacyTips.prototype);
  tips.tip = tooltip;
  tips.config = config;
  tips.dom = false;
  tips.node = false;
  return tips;
}

function createOptions(overrides = {}) {
  return {
    offsetX: 20,
    offsetY: 20,
    onShow() {},
    onHide() {},
    ...overrides,
  };
}

function createLegacyDocument(viewport) {
  return {
    body: {
      clientWidth: viewport.width,
      clientHeight: viewport.height,
      scrollLeft: 0,
      scrollTop: 0,
    },
    documentElement: null,
  };
}

test("tooltip is an import-safe leaf with no browser-global reads", async () => {
  assert.equal(globalThis.document, undefined);
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);

  const output = await readFile(
    new URL("../dist/extras/tooltip.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|globalThis)\b|\$jit/);
  assert.doesNotMatch(output, /\bdocument\s*(?:\.|\[)/);
});

test("pure offset and overflow calculation retains strict legacy boundaries", () => {
  const viewport = { width: 100, height: 80 };
  const tooltip = { width: 30, height: 20 };
  const offsets = { offsetX: 20, offsetY: 20 };

  assert.deepEqual(
    computeTooltipPosition(
      { x: 10, y: 10 },
      viewport,
      tooltip,
      offsets,
    ),
    { left: 30, top: 30 },
  );
  assert.deepEqual(
    computeTooltipPosition(
      { x: 50, y: 40 },
      viewport,
      tooltip,
      offsets,
    ),
    // Equality is not overflow: the original comparison is `>` rather than `>=`.
    { left: 70, top: 60 },
  );
  assert.deepEqual(
    computeTooltipPosition(
      { x: 60, y: 50 },
      viewport,
      tooltip,
      offsets,
    ),
    { left: 10, top: 10 },
  );
});

test("positioning matches legacy offsets and overflow call-for-call", () => {
  const cases = [
    {
      pointer: { x: 10, y: 10 },
      viewport: { width: 100, height: 80 },
      size: { width: 30, height: 20 },
      offsets: { offsetX: 20, offsetY: 20 },
    },
    {
      pointer: { x: 50, y: 40 },
      viewport: { width: 100, height: 80 },
      size: { width: 30, height: 20 },
      offsets: { offsetX: 20, offsetY: 20 },
    },
    {
      pointer: { x: 60, y: 50 },
      viewport: { width: 100, height: 80 },
      size: { width: 30, height: 20 },
      offsets: { offsetX: 20, offsetY: 20 },
    },
    {
      pointer: { x: -4.5, y: 7.25 },
      viewport: { width: 40, height: 30 },
      size: { width: 11.5, height: 9.75 },
      offsets: { offsetX: -3, offsetY: 4.5 },
    },
  ];

  for (const { pointer, viewport, size, offsets } of cases) {
    const modernEvents = [];
    const legacyEvents = [];
    const modernTooltip = createTooltip(
      size.width,
      size.height,
      modernEvents,
    );
    const legacyTooltip = createTooltip(
      size.width,
      size.height,
      legacyEvents,
    );
    const options = createOptions(offsets);
    const modern = new TooltipController(modernTooltip, options);
    const old = createLegacyTips(legacyTooltip, options);

    setLegacyDocument(createLegacyDocument(viewport));
    modern.setTooltipPosition(pointer, viewport);
    old.setTooltipPosition(pointer);

    assert.deepEqual(modernTooltip.style, legacyTooltip.style);
    assert.deepEqual(modernEvents, legacyEvents);
    assert.deepEqual(modernEvents, [
      ["measure-width", ""],
      ["measure-height", ""],
    ]);
  }
});

test("show callback runs before reveal and before post-callback measurement", () => {
  const pointer = { x: 72, y: 54 };
  const viewport = { width: 120, height: 90 };
  const node = { id: "node-1" };
  const contains = { kind: "circle" };

  function exerciseModern() {
    const events = [];
    const size = { width: 10, height: 8 };
    const tooltip = createTooltip(
      () => size.width,
      () => size.height,
      events,
    );
    const options = createOptions({
      onShow(current, currentNode, currentContains) {
        events.push([
          "show",
          current.style.display,
          currentNode.id,
          currentContains.kind,
        ]);
        size.width = 35;
        size.height = 18;
      },
    });
    new TooltipController(tooltip, options).show(
      node,
      contains,
      pointer,
      viewport,
    );
    return { events, style: tooltip.style };
  }

  function exerciseLegacy() {
    const events = [];
    const size = { width: 10, height: 8 };
    const tooltip = createTooltip(
      () => size.width,
      () => size.height,
      events,
    );
    const document = createLegacyDocument(viewport);
    const options = createOptions({
      force: false,
      onShow(current, currentNode, currentContains) {
        events.push([
          "show",
          current.style.display,
          currentNode.id,
          currentContains.kind,
        ]);
        size.width = 35;
        size.height = 18;
      },
    });
    const tips = createLegacyTips(tooltip, options);
    setLegacyDocument(document);
    tips.onMouseMove(
      { pageX: pointer.x, pageY: pointer.y },
      { document },
      {
        getNode() {
          return node;
        },
        getContains() {
          return contains;
        },
      },
    );
    return { events, style: tooltip.style };
  }

  assert.deepEqual(exerciseModern(), exerciseLegacy());
});

test("hide mutates visibility before optionally invoking onHide", () => {
  function exercise(legacy, triggerCallback) {
    const events = [];
    const tooltip = createTooltip(10, 8);
    tooltip.style.display = "";
    const options = createOptions({
      onHide() {
        events.push(["hide", tooltip.style.display]);
      },
    });
    const controller = legacy
      ? createLegacyTips(tooltip, options)
      : new TooltipController(tooltip, options);
    controller.hide(triggerCallback);
    return { events, display: tooltip.style.display };
  }

  assert.deepEqual(exercise(false, true), exercise(true, true));
  assert.deepEqual(exercise(false, true), {
    events: [["hide", "none"]],
    display: "none",
  });
  assert.deepEqual(exercise(false, false), exercise(true, false));
  assert.deepEqual(exercise(false, false), {
    events: [],
    display: "none",
  });
});
