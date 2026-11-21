import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { InputManager } from "../dist/extras/input-manager.js";
import { loadLegacyBinding } from "./legacy-harness.mjs";

const LegacyMouseEventsManager = loadLegacyBinding("MouseEventsManager");

class FakeTarget {
  listeners = new Map();
  addCalls = [];
  removeCalls = [];

  addEventListener(type, listener, options) {
    this.addCalls.push({ type, listener, options });
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener, options) {
    this.removeCalls.push({ type, listener, options });
    const listeners = this.listeners.get(type) ?? [];
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  }

  emit(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
}

function dependencies(target, overrides = {}) {
  return {
    target,
    makeEventInfo(event, environment) {
      return { eventName: event.name, environment };
    },
    isRightClick(event) {
      return event.which === 3 || event.button === 2;
    },
    getWheelDelta(event) {
      return event.wheelDelta
        ? event.wheelDelta / 120
        : -(event.detail || 0) / 3;
    },
    ...overrides,
  };
}

function recordingReceiver(log) {
  const recordInfo = (kind, event, info, extra) => {
    log.push([kind, event.name, info.eventName, extra]);
  };
  return {
    onMouseUp(event, _environment, info, right) {
      recordInfo("MouseUp", event, info, right);
    },
    onMouseDown(event, _environment, info, right) {
      recordInfo("MouseDown", event, info, right);
    },
    onMouseMove(event, _environment, info) {
      recordInfo("MouseMove", event, info);
    },
    onMouseOver(event, _environment, info) {
      recordInfo("MouseOver", event, info);
    },
    onMouseOut(event, _environment, info) {
      recordInfo("MouseOut", event, info);
    },
    onTouchStart(event, _environment, info) {
      recordInfo("TouchStart", event, info);
    },
    onTouchMove(event, _environment, info) {
      recordInfo("TouchMove", event, info);
    },
    onTouchEnd(event, _environment, info) {
      recordInfo("TouchEnd", event, info);
    },
    onTouchCancel(event, _environment, info) {
      recordInfo("TouchCancel", event, info);
    },
    onMouseWheel(event, _environment, delta) {
      log.push(["MouseWheel", event.name, undefined, delta]);
    },
    onContextMenu(event, _environment, info) {
      recordInfo("ContextMenu", event, info);
    },
  };
}

function legacyRecordingReceiver(log) {
  const recordInfo = (kind, event, info, extra) => {
    log.push([kind, event.name, info ? event.name : undefined, extra]);
  };
  return {
    onMouseUp(event, _environment, info, right) {
      recordInfo("MouseUp", event, info, right);
    },
    onMouseDown(event, _environment, info, right) {
      recordInfo("MouseDown", event, info, right);
    },
    onMouseMove(event, _environment, info) {
      recordInfo("MouseMove", event, info);
    },
    onMouseOver(event, _environment, info) {
      recordInfo("MouseOver", event, info);
    },
    onMouseOut(event, _environment, info) {
      recordInfo("MouseOut", event, info);
    },
    onTouchStart(event, _environment, info) {
      recordInfo("TouchStart", event, info);
    },
    onTouchMove(event, _environment, info) {
      recordInfo("TouchMove", event, info);
    },
    onTouchEnd(event, _environment, info) {
      recordInfo("TouchEnd", event, info);
    },
    onMouseWheel(event, _environment, delta) {
      log.push(["MouseWheel", event.name, undefined, delta]);
    },
  };
}

test("mouse, touch, and legacy wheel routing matches MouseEventsManager", () => {
  const modernTarget = new FakeTarget();
  const legacyTarget = new FakeTarget();
  const modernLog = [];
  const legacyLog = [];

  const modern = new InputManager(dependencies(modernTarget), {
    wheelEvent: "mousewheel",
  });
  modern.register(recordingReceiver(modernLog));
  modern.attach();

  const legacy = new LegacyMouseEventsManager({
    canvas: {
      getElement() {
        return legacyTarget;
      },
    },
    graph: { nodes: {}, edges: {} },
    fx: { nodeTypes: {}, edgeTypes: {} },
  });
  legacy.register(legacyRecordingReceiver(legacyLog));

  const cases = [
    ["mousedown", { name: "left-down", which: 1 }],
    ["mouseup", { name: "right-up", which: 3 }],
    ["mousemove", { name: "move" }],
    ["mouseover", { name: "over" }],
    ["mouseout", { name: "out" }],
    ["touchstart", { name: "touch-start" }],
    ["touchmove", { name: "touch-move" }],
    ["touchend", { name: "touch-end" }],
    ["mousewheel", { name: "wheel", wheelDelta: -240 }],
  ];

  for (const [type, event] of cases) {
    modernTarget.emit(type, event);
    legacyTarget.emit(type, event);
  }

  assert.deepEqual(modernLog, legacyLog);
});

test("attach and detach are idempotent and use symmetric listener options", () => {
  const target = new FakeTarget();
  const options = new Map();
  const events = [];
  const manager = new InputManager(
    dependencies(target, {
      getListenerOptions(eventName) {
        const value = { capture: eventName === "contextmenu" };
        options.set(eventName, value);
        return value;
      },
    }),
  );
  manager.register(recordingReceiver(events));

  assert.equal(manager.attached, false);
  assert.equal(target.addCalls.length, 0);
  assert.strictEqual(manager.attach(), manager);
  manager.attach();
  assert.equal(manager.attached, true);
  assert.deepEqual(
    target.addCalls.map(({ type }) => type),
    [
      "mouseup",
      "mousedown",
      "mousemove",
      "mouseover",
      "mouseout",
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
      "wheel",
      "contextmenu",
    ],
  );
  assert.equal(target.addCalls.length, 11);

  target.emit("mousemove", { name: "before-detach" });
  assert.equal(events.length, 1);

  assert.strictEqual(manager.detach(), manager);
  manager.detach();
  assert.equal(manager.attached, false);
  assert.equal(target.removeCalls.length, 11);
  for (let index = 0; index < target.addCalls.length; index++) {
    const added = target.addCalls[index];
    const removed = target.removeCalls[index];
    assert.equal(removed.type, added.type);
    assert.strictEqual(removed.listener, added.listener);
    assert.strictEqual(removed.options, options.get(added.type));
  }

  target.emit("mousemove", { name: "after-detach" });
  assert.equal(events.length, 1);
});

test("registration disposal, dynamic environments, and context menus compose", () => {
  const target = new FakeTarget();
  const calls = [];
  const manager = new InputManager(
    dependencies(target, {
      getEnvironment(event) {
        return `environment:${event.name}`;
      },
    }),
  );

  let disposeSecond = () => {};
  manager.register({
    onMouseMove(event, environment) {
      calls.push(["first", event.name, environment]);
      disposeSecond();
    },
  });
  disposeSecond = manager.register({
    onMouseMove() {
      calls.push(["second"]);
    },
  });
  manager.attach();

  target.emit("mousemove", { name: "move" });
  assert.deepEqual(calls, [["first", "move", "environment:move"]]);
  assert.equal(manager.size, 1);
  disposeSecond();

  const contextCalls = [];
  const receiver = recordingReceiver(contextCalls);
  const disposeContext = manager.register(receiver);
  const contextEvent = {
    name: "menu",
    returnValue: true,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  target.emit("contextmenu", contextEvent);

  assert.equal(contextEvent.defaultPrevented, true);
  assert.equal(contextEvent.returnValue, false);
  assert.deepEqual(contextCalls, [
    ["ContextMenu", "menu", "menu", undefined],
  ]);
  assert.equal(manager.unregister(receiver), true);
  assert.equal(manager.unregister(receiver), false);
  disposeContext();
});

test("context-menu cancellation can be delegated or disabled", () => {
  const delegatedTarget = new FakeTarget();
  const delegatedCalls = [];
  const delegated = new InputManager(
    dependencies(delegatedTarget, {
      cancelContextMenu(event, environment) {
        delegatedCalls.push([event.name, environment]);
      },
      environment: "frame",
    }),
  );
  delegated.attach();
  delegatedTarget.emit("contextmenu", { name: "delegated" });
  assert.deepEqual(delegatedCalls, [["delegated", "frame"]]);

  const allowedTarget = new FakeTarget();
  const allowed = new InputManager(
    dependencies(allowedTarget, { cancelContextMenu: false }),
  );
  allowed.attach();
  const event = {
    name: "allowed",
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
  allowedTarget.emit("contextmenu", event);
  assert.equal(event.prevented, false);
});

test("input manager emits as an import-free, ambient-free leaf", async () => {
  const output = await readFile(
    new URL("../dist/extras/input-manager.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});
