import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

let clock = 10_000;
let importTimerCalls = 0;
const originalDateNow = Date.now;
const originalSetInterval = globalThis.setInterval;

Date.now = () => clock;
globalThis.setInterval = () => {
  importTimerCalls += 1;
  return 1;
};

const coreSourceUrl = new URL('../src/core/', import.meta.url).href;
const sourceHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.startsWith(coreSourceUrl) &&
      specifier.startsWith('./') &&
      specifier.endsWith('.js')
    ) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL).href,
      };
    }
    return nextResolve(specifier, context);
  },
});

let easingModule;
let animationModule;
let transitionsModule;
try {
  easingModule = await import('../src/core/easing.ts');
  animationModule = await import('../src/core/animation.ts');
  transitionsModule = await import('../src/core/transitions.ts');
} finally {
  sourceHooks.deregister();
  Date.now = originalDateNow;
  globalThis.setInterval = originalSetInterval;
}

const {
  Back,
  Bounce,
  Circ,
  Cubic,
  Elastic,
  Expo,
  Pow,
  Quad,
  Quart,
  Quint,
  Sine,
  Trans,
  linear,
} = easingModule;
const { Animation } = animationModule;

function createTimerHarness() {
  let nextId = 1;
  const active = new Map();
  const scheduled = [];
  const cleared = [];

  return {
    setInterval(callback, delay) {
      const id = nextId;
      nextId += 1;
      active.set(id, { callback, delay });
      scheduled.push([id, delay]);
      return id;
    },

    clearInterval(id) {
      cleared.push(id);
      active.delete(id);
      return undefined;
    },

    tick(id) {
      const timer = active.get(id);
      assert.ok(timer, `timer ${id} should be active`);
      timer.callback();
    },

    reset() {
      nextId = 1;
      active.clear();
      scheduled.length = 0;
      cleared.length = 0;
    },

    snapshot() {
      return {
        scheduled: scheduled.map((entry) => [...entry]),
        cleared: [...cleared],
        active: [...active.keys()],
      };
    },
  };
}

function loadLegacy(timerHarness) {
  const originalSource = readFileSync(
    new URL('../jit.js', import.meta.url),
    'utf8',
  );
  const declaration = 'var Animation = new Class( {';
  assert.ok(originalSource.includes(declaration));
  const source = originalSource.replace(
    declaration,
    'var Animation = window.__LegacyAnimation = new Class( {',
  );

  class ControlledDate extends Date {}
  ControlledDate.now = () => clock;

  const context = vm.createContext({
    clearInterval: timerHarness.clearInterval,
    clearTimeout,
    console,
    Date: ControlledDate,
    document: {},
    setInterval: timerHarness.setInterval,
    setTimeout,
  });
  context.window = context;
  vm.runInContext(source, context, { filename: 'jit.js' });

  return {
    Animation: context.__LegacyAnimation,
    Trans: context.$jit.Trans,
  };
}

const modernTimers = createTimerHarness();
const legacyTimers = createTimerHarness();
const legacy = loadLegacy(legacyTimers);

function assertSameNumber(modern, legacyValue) {
  assert.ok(
    Object.is(modern, legacyValue),
    `expected ${String(modern)} to be identical to ${String(legacyValue)}`,
  );
}

function withModernTimers(callback) {
  const savedSetInterval = globalThis.setInterval;
  const savedClearInterval = globalThis.clearInterval;
  globalThis.setInterval = modernTimers.setInterval;
  globalThis.clearInterval = modernTimers.clearInterval;
  try {
    return callback();
  } finally {
    globalThis.setInterval = savedSetInterval;
    globalThis.clearInterval = savedClearInterval;
  }
}

test('import has no timer or global namespace side effects', () => {
  assert.strictEqual(importTimerCalls, 0);
  assert.strictEqual(Object.hasOwn(globalThis, '$jit'), false);
});

test('namespace and independently importable transitions expose the same easing API', () => {
  const namedTransitions = {
    Pow,
    Expo,
    Circ,
    Sine,
    Back,
    Bounce,
    Elastic,
    Quad,
    Cubic,
    Quart,
    Quint,
  };

  assert.deepStrictEqual(
    Object.keys(Trans),
    Object.keys(legacy.Trans).filter((key) => key !== '$extend'),
  );
  assert.strictEqual(Trans.linear, linear);
  assert.strictEqual(transitionsModule.Animation, Animation);
  assert.strictEqual(transitionsModule.Trans, Trans);
  assert.strictEqual(transitionsModule.linear, linear);

  for (const [name, transition] of Object.entries(namedTransitions)) {
    assert.strictEqual(Trans[name], transition);
    assert.strictEqual(transitionsModule[name], transition);
    assert.deepStrictEqual(Object.keys(transition), Object.keys(legacy.Trans[name]));
  }
});

test('all easing modes match JIT 2.0.1 across their normal domain', () => {
  const names = [
    'Pow',
    'Expo',
    'Circ',
    'Sine',
    'Back',
    'Bounce',
    'Elastic',
    'Quad',
    'Cubic',
    'Quart',
    'Quint',
  ];
  const methods = ['easeIn', 'easeOut', 'easeInOut'];
  const positions = [-0, 0, 0.1, 0.49, 0.5, 0.51, 0.9, 1];

  for (const position of positions) {
    assertSameNumber(linear(position), legacy.Trans.linear(position));
    for (const name of names) {
      for (const method of methods) {
        assertSameNumber(
          Trans[name][method](position),
          legacy.Trans[name][method](position),
        );
      }
    }
  }
});

test('raw transition functions retain parameter and error semantics', () => {
  const positions = [0, 0.25, 0.5, 1];
  const parameters = [[], [undefined], [null], [0], [2], [-0.5]];

  for (const name of ['Pow', 'Back', 'Elastic']) {
    for (const position of positions) {
      for (const parameter of parameters) {
        assertSameNumber(
          Trans[name](position, parameter),
          legacy.Trans[name](position, parameter),
        );
      }
      const isTypeError = (error) => error?.name === 'TypeError';
      assert.throws(() => Trans[name](position), isTypeError);
      assert.throws(() => legacy.Trans[name](position), isTypeError);
    }
  }

  for (const name of ['Expo', 'Circ', 'Sine', 'Bounce', 'Quad', 'Cubic', 'Quart', 'Quint']) {
    for (const position of positions) {
      assertSameNumber(Trans[name](position), legacy.Trans[name](position));
    }
  }
});

test('Animation defaults and option cloning match the legacy class', () => {
  const input = {
    duration: 900,
    extra: {
      nested: { value: 3 },
      list: [{ value: 4 }],
    },
  };
  const modern = new Animation(input);
  const legacyAnimation = new legacy.Animation(input);

  assert.strictEqual(modern.$$family, legacyAnimation.$$family);
  assert.deepStrictEqual(
    [modern.opt.duration, modern.opt.fps, modern.opt.link],
    [
      legacyAnimation.opt.duration,
      legacyAnimation.opt.fps,
      legacyAnimation.opt.link,
    ],
  );
  for (const position of [0, 0.25, 0.5, 0.75, 1]) {
    assertSameNumber(
      modern.opt.transition(position),
      legacyAnimation.opt.transition(position),
    );
  }

  input.extra.nested.value = 30;
  input.extra.list[0].value = 40;
  assert.deepStrictEqual(modern.opt.extra, {
    nested: { value: 3 },
    list: [{ value: 4 }],
  });
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(legacyAnimation.opt.extra)),
    modern.opt.extra,
  );
  assert.strictEqual(modern.setOptions({ fps: 25 }), modern);
  assert.strictEqual(legacyAnimation.setOptions({ fps: 25 }), legacyAnimation);
  assert.deepStrictEqual(
    [modern.opt.duration, modern.opt.fps, modern.opt.link],
    [
      legacyAnimation.opt.duration,
      legacyAnimation.opt.fps,
      legacyAnimation.opt.link,
    ],
  );
});

function runToCompletion(AnimationClass, transition, timers) {
  const trace = [];
  const animation = new AnimationClass({
    duration: 100,
    fps: 20,
    transition,
    compute(delta) {
      trace.push(['compute', delta]);
    },
    complete() {
      trace.push(['complete']);
    },
  });

  const started = animation.start();
  const startedAt = animation.time;
  const timerId = animation.timer;
  clock += 50;
  timers.tick(timerId);
  clock += 50;
  timers.tick(timerId);

  return {
    returnedSelf: started === animation,
    startedAt,
    timerAfterCompletion: animation.timer,
    trace,
    timers: timers.snapshot(),
  };
}

test('Animation scheduling, stepping, and completion match legacy behavior', () => {
  modernTimers.reset();
  legacyTimers.reset();
  clock = 20_000;
  const modern = withModernTimers(() =>
    runToCompletion(Animation, linear, modernTimers),
  );
  clock = 20_000;
  const legacyResult = runToCompletion(
    legacy.Animation,
    legacy.Trans.linear,
    legacyTimers,
  );
  assert.deepStrictEqual(modern, legacyResult);
});

function runPauseResume(AnimationClass, transition, timers) {
  const computed = [];
  const animation = new AnimationClass({
    duration: 100,
    fps: 25,
    transition,
    compute(delta) {
      computed.push(delta);
    },
  });

  const startResult = animation.start();
  clock += 30;
  const pauseResult = animation.pause();
  const elapsed = animation.time;
  clock += 70;
  const resumeResult = animation.resume();
  const resumedAt = animation.time;
  const timerId = animation.timer;
  clock += 20;
  timers.tick(timerId);
  const stopResult = animation.stopTimer();
  const secondStopResult = animation.stopTimer();

  return {
    startReturnedSelf: startResult === animation,
    pauseReturnedSelf: pauseResult === animation,
    resumeReturnedSelf: resumeResult === animation,
    stopResult,
    secondStopResult,
    elapsed,
    resumedAt,
    computed,
    timers: timers.snapshot(),
  };
}

test('Animation pause and resume bookkeeping matches legacy behavior', () => {
  modernTimers.reset();
  legacyTimers.reset();
  clock = 30_000;
  const modern = withModernTimers(() =>
    runPauseResume(Animation, linear, modernTimers),
  );
  clock = 30_000;
  const legacyResult = runPauseResume(
    legacy.Animation,
    legacy.Trans.linear,
    legacyTimers,
  );
  assert.deepStrictEqual(modern, legacyResult);
});

function runLinkPolicy(AnimationClass, transition, timers, link) {
  const animation = new AnimationClass({
    duration: 100,
    fps: 10,
    transition,
    link,
  });
  animation.start();
  const firstStart = animation.time;
  clock += 10;
  const secondResult = animation.start();
  return {
    returnedSelf: secondResult === animation,
    firstStart,
    secondStart: animation.time,
    timer: animation.timer,
    timers: timers.snapshot(),
  };
}

test('Animation ignore and cancel link policies match legacy behavior', () => {
  for (const link of ['ignore', 'cancel']) {
    modernTimers.reset();
    legacyTimers.reset();
    clock = 40_000;
    const modern = withModernTimers(() =>
      runLinkPolicy(Animation, linear, modernTimers, link),
    );
    clock = 40_000;
    const legacyResult = runLinkPolicy(
      legacy.Animation,
      legacy.Trans.linear,
      legacyTimers,
      link,
    );
    assert.deepStrictEqual(modern, legacyResult);
  }
});
