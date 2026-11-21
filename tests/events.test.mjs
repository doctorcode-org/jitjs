import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { InteractionEventsController } from "../dist/extras/events.js";
import { loadLegacyBinding } from "./legacy-harness.mjs";

const LegacyEvents = loadLegacyBinding("Extras").Classes.Events;

function target(id, type = "circle") {
  return {
    id,
    getData(property) {
      return property === "type" ? type : undefined;
    },
  };
}

function info(name, { node = false, edge = false, inside = false } = {}) {
  return {
    name,
    getNode: () => node,
    getEdge: () => edge,
    getPos: () => ({ inside }),
  };
}

function callbackConfig(events, enableForEdges = true) {
  const record = (kind, value, eventInfo, rawEvent) => {
    events.push([
      kind,
      value && typeof value === "object" ? value.id : value,
      eventInfo?.name,
      rawEvent?.name,
    ]);
  };
  return {
    enableForEdges,
    onClick: (value, eventInfo, rawEvent) =>
      record("click", value, eventInfo, rawEvent),
    onRightClick: (value, eventInfo, rawEvent) =>
      record("right", value, eventInfo, rawEvent),
    onMouseMove: (value, eventInfo, rawEvent) =>
      record("move", value, eventInfo, rawEvent),
    onMouseEnter: (value, eventInfo, rawEvent) =>
      record("enter", value, eventInfo, rawEvent),
    onMouseLeave: (value, eventInfo, rawEvent) =>
      record("leave", value, eventInfo, rawEvent),
    onDragStart: (value, eventInfo, rawEvent) =>
      record("drag-start", value, eventInfo, rawEvent),
    onDragMove: (value, eventInfo, rawEvent) =>
      record("drag-move", value, eventInfo, rawEvent),
    onDragCancel: (value, eventInfo, rawEvent) =>
      record("drag-cancel", value, eventInfo, rawEvent),
    onDragEnd: (value, eventInfo, rawEvent) =>
      record("drag-end", value, eventInfo, rawEvent),
    onTouchStart: (value, eventInfo, rawEvent) =>
      record("touch-start", value, eventInfo, rawEvent),
    onTouchMove: (value, eventInfo, rawEvent) =>
      record("touch-move", value, eventInfo, rawEvent),
    onTouchEnd: (value, eventInfo, rawEvent) =>
      record("touch-end", value, eventInfo, rawEvent),
    onTouchCancel: (value, eventInfo, rawEvent) =>
      record("touch-cancel", value, eventInfo, rawEvent),
    onMouseWheel(delta, rawEvent) {
      events.push(["wheel", delta, undefined, rawEvent?.name]);
    },
  };
}

function createModern(events, dom = false) {
  return new InteractionEventsController(
    callbackConfig(events),
    {
      contains(_target, eventInfo) {
        return eventInfo.getPos().inside;
      },
    },
    { dom },
  );
}

function createLegacy(events, dom = false) {
  const controller = Object.create(LegacyEvents.prototype);
  Object.assign(controller, {
    config: callbackConfig(events),
    dom,
    hovered: false,
    pressed: false,
    touched: false,
    touchMoved: false,
    moved: false,
    fx: {},
    ntypes: {
      circle: {
        contains(_target, position) {
          return position.inside;
        },
      },
    },
    etypes: {
      line: {
        contains(_target, position) {
          return position.inside;
        },
      },
    },
  });
  return controller;
}

function raw(name) {
  return { name };
}

function state(controller) {
  return {
    hovered: controller.hovered ? controller.hovered.id : false,
    pressed: controller.pressed ? controller.pressed.id : false,
    touched: controller.touched ? controller.touched.id : false,
    moved: controller.moved,
    touchMoved: controller.touchMoved,
  };
}

test("click, drag, right-click, touch, and wheel transitions match legacy", () => {
  const modernEvents = [];
  const legacyEvents = [];
  const modern = createModern(modernEvents);
  const old = createLegacy(legacyEvents);
  const node = target("node");
  const nodeInfo = info("node-info", { node });

  modern.onMouseDown(nodeInfo, raw("down"));
  LegacyEvents.prototype.onMouseDown.call(old, raw("down"), undefined, nodeInfo);
  modern.onMouseUp(nodeInfo, raw("up"), false);
  LegacyEvents.prototype.onMouseUp.call(old, raw("up"), undefined, nodeInfo, false);

  modern.onMouseDown(nodeInfo, raw("drag-down"));
  LegacyEvents.prototype.onMouseDown.call(
    old,
    raw("drag-down"),
    undefined,
    nodeInfo,
  );
  modern.onMouseMove(nodeInfo, raw("drag-move"));
  LegacyEvents.prototype.onMouseMove.call(
    old,
    raw("drag-move"),
    undefined,
    nodeInfo,
  );
  modern.onMouseUp(nodeInfo, raw("drag-up"), false);
  LegacyEvents.prototype.onMouseUp.call(
    old,
    raw("drag-up"),
    undefined,
    nodeInfo,
    false,
  );

  modern.hovered = node;
  old.hovered = node;
  modern.onMouseUp(nodeInfo, raw("right-up"), true);
  LegacyEvents.prototype.onMouseUp.call(
    old,
    raw("right-up"),
    undefined,
    nodeInfo,
    true,
  );

  modern.onTouchStart(nodeInfo, raw("touch-start"));
  LegacyEvents.prototype.onTouchStart.call(
    old,
    raw("touch-start"),
    undefined,
    nodeInfo,
  );
  modern.onTouchMove(nodeInfo, raw("touch-move"));
  LegacyEvents.prototype.onTouchMove.call(
    old,
    raw("touch-move"),
    undefined,
    nodeInfo,
  );
  modern.onTouchEnd(nodeInfo, raw("touch-end"));
  LegacyEvents.prototype.onTouchEnd.call(
    old,
    raw("touch-end"),
    undefined,
    nodeInfo,
  );

  modern.onTouchStart(nodeInfo, raw("tap-start"));
  LegacyEvents.prototype.onTouchStart.call(
    old,
    raw("tap-start"),
    undefined,
    nodeInfo,
  );
  modern.onTouchEnd(nodeInfo, raw("tap-end"));
  LegacyEvents.prototype.onTouchEnd.call(
    old,
    raw("tap-end"),
    undefined,
    nodeInfo,
  );

  modern.onMouseWheel(-2, raw("wheel"));
  LegacyEvents.prototype.onMouseWheel.call(old, raw("wheel"), undefined, -2);

  assert.deepEqual(modernEvents, legacyEvents);
  assert.deepEqual(state(modern), state(old));
});

test("native hover and edge fallback match legacy", () => {
  const modernEvents = [];
  const legacyEvents = [];
  const modern = createModern(modernEvents);
  const old = createLegacy(legacyEvents);
  const edge = { ...target("edge", "line"), nodeFrom: {} };

  const enter = info("enter-info", { edge, inside: true });
  modern.onMouseMove(enter, raw("enter"));
  LegacyEvents.prototype.onMouseMove.call(old, raw("enter"), undefined, enter);

  const stay = info("stay-info", { inside: true });
  modern.onMouseMove(stay, raw("stay"));
  LegacyEvents.prototype.onMouseMove.call(old, raw("stay"), undefined, stay);

  const leave = info("leave-info", { inside: false });
  modern.onMouseMove(leave, raw("leave"));
  LegacyEvents.prototype.onMouseMove.call(old, raw("leave"), undefined, leave);

  assert.deepEqual(modernEvents, legacyEvents);
  assert.deepEqual(state(modern), state(old));
});

test("DOM-mode movement reports the adapter-managed hovered target", () => {
  const modernEvents = [];
  const legacyEvents = [];
  const modern = createModern(modernEvents, true);
  const old = createLegacy(legacyEvents, true);
  const node = target("label-node");
  const eventInfo = info("dom-info");
  modern.hovered = node;
  old.hovered = node;

  modern.onMouseMove(eventInfo, raw("dom-move"));
  LegacyEvents.prototype.onMouseMove.call(
    old,
    raw("dom-move"),
    undefined,
    eventInfo,
  );

  assert.deepEqual(modernEvents, legacyEvents);
});

test("events controller is an isolated ESM leaf", async () => {
  const output = await readFile(
    new URL("../dist/extras/events.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
