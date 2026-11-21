import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NavigationController } from "../dist/extras/navigation.js";
import {
  loadLegacyBinding,
  normalizeRealm,
} from "./legacy-harness.mjs";

const LegacyNavigation = loadLegacyBinding("Extras").Classes.Navigation;

function createCanvas(overrides = {}) {
  const calls = [];
  const canvas = {
    translateOffsetX: 12,
    translateOffsetY: -9,
    scaleOffsetX: 2,
    scaleOffsetY: 0.5,
    scale(x, y) {
      calls.push(["scale", x, y]);
      this.scaleOffsetX *= x;
      this.scaleOffsetY *= y;
    },
    translate(x, y) {
      calls.push(["translate", x, y]);
      this.translateOffsetX += x * this.scaleOffsetX;
      this.translateOffsetY += y * this.scaleOffsetY;
    },
    ...overrides,
  };
  return { calls, canvas };
}

function createEvent() {
  return {
    cancelBubble: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}

function eventState(event) {
  return {
    cancelBubble: event.cancelBubble,
    defaultPrevented: event.defaultPrevented,
    propagationStopped: event.propagationStopped,
    returnValue: event.returnValue,
  };
}

function stopEvent(event) {
  event.stopPropagation?.();
  event.cancelBubble = true;
  if (event.preventDefault) event.preventDefault();
  else event.returnValue = false;
}

function createInfo(point, node, counters = {}) {
  return {
    getPos() {
      counters.position = (counters.position ?? 0) + 1;
      return point;
    },
    getNode() {
      counters.node = (counters.node ?? 0) + 1;
      return node;
    },
  };
}

function createLegacyController(config, canvas, options = {}) {
  const labelContainer = options.labelContainer ?? {};
  return new LegacyNavigation("Navigation", {
    canvas,
    config: {
      Label: { type: options.dom ? "HTML" : "Native" },
      Navigation: {
        enable: true,
        type: options.dom ? "HTML" : "Native",
        ...config,
      },
    },
    fx: { nodeTypes: {} },
    labels: {
      getLabelContainer() {
        return labelContainer;
      },
    },
  });
}

function controllerState(controller) {
  return {
    pos: controller.pos,
    pressed: controller.pressed,
  };
}

test("navigation emits as an import-free, environment-neutral leaf", async () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  const output = await readFile(
    new URL("../dist/extras/navigation.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:window|document|globalThis)\b|\$jit/);
});

test("wheel zoom and event cancellation match legacy navigation", () => {
  for (const [zooming, scroll] of [[20, -2], [true, 5], [false, 4]]) {
    const modernCanvas = createCanvas();
    const legacyCanvas = createCanvas();
    const modernEvent = createEvent();
    const legacyEvent = createEvent();
    const environment = {};
    const config = { panning: false, zooming };

    const modern = new NavigationController(config, {
      canvas: modernCanvas.canvas,
      stopEvent,
    });
    const legacy = createLegacyController(config, legacyCanvas.canvas);

    modern.onMouseWheel(modernEvent, environment, scroll);
    legacy.onMouseWheel(legacyEvent, environment, scroll);

    assert.deepEqual(modernCanvas.calls, legacyCanvas.calls);
    assert.deepEqual(eventState(modernEvent), eventState(legacyEvent));
    assert.deepEqual(
      {
        x: modernCanvas.canvas.scaleOffsetX,
        y: modernCanvas.canvas.scaleOffsetY,
      },
      {
        x: legacyCanvas.canvas.scaleOffsetX,
        y: legacyCanvas.canvas.scaleOffsetY,
      },
    );
  }
});

test("scaled panning math and press lifecycle match legacy navigation", () => {
  const modernCanvas = createCanvas();
  const legacyCanvas = createCanvas();
  const config = { panning: true, zooming: false };
  const modern = new NavigationController(config, {
    canvas: modernCanvas.canvas,
    stopEvent,
  });
  const legacy = createLegacyController(config, legacyCanvas.canvas);
  const environment = {};

  const modernDownPoint = { x: 3, y: -2 };
  const legacyDownPoint = { x: 3, y: -2 };
  modern.onMouseDown(
    {},
    environment,
    createInfo(modernDownPoint, false),
  );
  legacy.onMouseDown(
    {},
    environment,
    createInfo(legacyDownPoint, false),
  );

  assert.deepEqual(modernDownPoint, legacyDownPoint);
  assert.deepEqual(controllerState(modern), normalizeRealm(controllerState(legacy)));

  const modernMovePoint = { x: 8, y: 6 };
  const legacyMovePoint = { x: 8, y: 6 };
  modern.onMouseMove(
    {},
    environment,
    createInfo(modernMovePoint, false),
  );
  legacy.onMouseMove(
    {},
    environment,
    createInfo(legacyMovePoint, false),
  );

  assert.deepEqual(modernMovePoint, legacyMovePoint);
  assert.deepEqual(modernCanvas.calls, legacyCanvas.calls);
  assert.deepEqual(controllerState(modern), normalizeRealm(controllerState(legacy)));

  modern.onMouseUp({}, environment, createInfo({ x: 0, y: 0 }, false), true);
  legacy.onMouseUp({}, environment, createInfo({ x: 0, y: 0 }, false), true);
  assert.deepEqual(controllerState(modern), normalizeRealm(controllerState(legacy)));
  assert.notEqual(modern.pos, false, "mouse-up retains the last projected position");
});

test("native avoid-nodes panning preserves the pending drag across hits", () => {
  const modernCanvas = createCanvas();
  const legacyCanvas = createCanvas();
  const config = { panning: "avoid nodes", zooming: false };
  const modern = new NavigationController(config, {
    canvas: modernCanvas.canvas,
    stopEvent,
  });
  const legacy = createLegacyController(config, legacyCanvas.canvas);
  const environment = {};
  const modernCounters = {};
  const legacyCounters = {};

  modern.onMouseDown(
    {},
    environment,
    createInfo({ x: 1, y: 1 }, { id: "blocked" }, modernCounters),
  );
  legacy.onMouseDown(
    {},
    environment,
    createInfo({ x: 1, y: 1 }, { id: "blocked" }, legacyCounters),
  );
  assert.equal(modern.pressed, false);

  modern.onMouseDown(
    {},
    environment,
    createInfo({ x: 2, y: 3 }, false, modernCounters),
  );
  legacy.onMouseDown(
    {},
    environment,
    createInfo({ x: 2, y: 3 }, false, legacyCounters),
  );

  modern.onMouseMove(
    {},
    environment,
    createInfo({ x: 50, y: 60 }, { id: "blocked" }, modernCounters),
  );
  legacy.onMouseMove(
    {},
    environment,
    createInfo({ x: 50, y: 60 }, { id: "blocked" }, legacyCounters),
  );
  assert.equal(modernCanvas.calls.length, 0);

  modern.onMouseMove(
    {},
    environment,
    createInfo({ x: 7, y: 11 }, false, modernCounters),
  );
  legacy.onMouseMove(
    {},
    environment,
    createInfo({ x: 7, y: 11 }, false, legacyCounters),
  );

  assert.deepEqual(modernCounters, legacyCounters);
  assert.deepEqual(modernCanvas.calls, legacyCanvas.calls);
  assert.deepEqual(controllerState(modern), normalizeRealm(controllerState(legacy)));
});

test("DOM-label avoidance uses only the injected label predicate", () => {
  const labelContainer = {};
  const labelParent = { parentNode: labelContainer };
  const label = { parentNode: labelParent };
  const outside = { parentNode: null };
  const config = { panning: "avoid nodes", zooming: false };
  const modernCanvas = createCanvas();
  const legacyCanvas = createCanvas();
  const modernCounters = {};
  const legacyCounters = {};
  const isLabel = (event) => {
    let element = event.target;
    while (element?.parentNode) {
      if (element.parentNode === labelContainer) return element;
      element = element.parentNode;
    }
    return false;
  };
  const modern = new NavigationController(config, {
    canvas: modernCanvas.canvas,
    stopEvent,
    isLabel,
  });
  const legacy = createLegacyController(config, legacyCanvas.canvas, {
    dom: true,
    labelContainer,
  });
  const environment = {};

  modern.onMouseDown(
    { target: label },
    environment,
    createInfo({ x: 1, y: 2 }, { id: "must-not-be-read" }, modernCounters),
  );
  legacy.onMouseDown(
    { target: label },
    environment,
    createInfo({ x: 1, y: 2 }, { id: "must-not-be-read" }, legacyCounters),
  );
  assert.equal(modern.pressed, false);

  modern.onMouseDown(
    { target: outside },
    environment,
    createInfo({ x: 4, y: 5 }, { id: "must-not-be-read" }, modernCounters),
  );
  legacy.onMouseDown(
    { target: outside },
    environment,
    createInfo({ x: 4, y: 5 }, { id: "must-not-be-read" }, legacyCounters),
  );

  modern.onMouseMove(
    { target: label },
    environment,
    createInfo({ x: 99, y: 99 }, { id: "must-not-be-read" }, modernCounters),
  );
  legacy.onMouseMove(
    { target: label },
    environment,
    createInfo({ x: 99, y: 99 }, { id: "must-not-be-read" }, legacyCounters),
  );

  assert.equal(modernCounters.node, undefined);
  assert.deepEqual(modernCounters, legacyCounters);
  assert.deepEqual(modernCanvas.calls, legacyCanvas.calls);
  assert.deepEqual(controllerState(modern), normalizeRealm(controllerState(legacy)));
});
