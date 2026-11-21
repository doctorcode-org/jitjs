import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runSequence } from "../dist/core/sequence.js";
import { loadLegacyNamespace } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace();

class ManualScheduler {
  constructor() {
    this.handlers = new Map();
    this.durations = new Map();
    this.nextHandle = 1;
  }

  setInterval(handler, duration) {
    const handle = this.nextHandle++;
    this.handlers.set(handle, handler);
    this.durations.set(handle, duration);
    return handle;
  }

  clearInterval(handle) {
    this.handlers.delete(handle);
    this.durations.delete(handle);
  }

  tick(handle = 1) {
    this.handlers.get(handle)?.();
  }
}

test("sequence is import-safe and has no runtime module dependencies", async () => {
  const output = await readFile(
    new URL("../dist/core/sequence.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\$jit|\b(?:window|document)\b/);
});

test("injected sequencing retains tick, completion, and refresh order", () => {
  const scheduler = new ManualScheduler();
  const events = [];
  let index = 0;
  const sequence = runSequence(
    {
      condition: () => index < 2,
      step: () => events.push(["step", index++]),
      onComplete: () => events.push(["complete"]),
      duration: 17,
    },
    {
      scheduler,
      refresh: (reposition) => events.push(["refresh", reposition]),
    },
  );

  assert.equal(sequence.running, true);
  assert.equal(scheduler.durations.get(1), 17);
  scheduler.tick();
  scheduler.tick();
  scheduler.tick();

  assert.deepEqual(events, [
    ["step", 0],
    ["refresh", true],
    ["step", 1],
    ["refresh", true],
    ["complete"],
    ["refresh", true],
  ]);
  assert.equal(sequence.running, false);
  assert.equal(scheduler.handlers.size, 0);
});

test("cancellation is idempotent and does not synthesize completion", () => {
  const scheduler = new ManualScheduler();
  const events = [];
  const sequence = runSequence(
    {
      condition: () => true,
      step: () => events.push("step"),
      onComplete: () => events.push("complete"),
    },
    { scheduler },
  );

  sequence.cancel();
  sequence.cancel();
  scheduler.tick();
  assert.equal(sequence.running, false);
  assert.deepEqual(events, []);
});

test("real timer behavior matches Graph.Plot.sequence", async () => {
  async function collect(run) {
    const events = [];
    let index = 0;
    await new Promise((resolve) => {
      run({
        condition: () => index < 2,
        step: () => events.push(["step", index++]),
        onComplete: () => {
          events.push(["complete"]);
          resolve();
        },
        duration: 1,
      }, events);
    });
    return events;
  }

  const modern = await collect((options, events) => {
    runSequence(options, {
      refresh: (reposition) => events.push(["refresh", reposition]),
    });
  });
  const old = await collect((options, events) => {
    legacy.Graph.Plot.sequence.call(
      { viz: { refresh: (reposition) => events.push(["refresh", reposition]) } },
      options,
    );
  });

  assert.deepEqual(modern, old);
});
