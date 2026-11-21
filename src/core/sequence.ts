export interface SequenceOptions {
  /** Continue while this returns true; completion runs on the first false tick. */
  condition?: () => boolean;
  step?: () => void;
  onComplete?: () => void;
  duration?: number;
}

export interface SequenceScheduler<THandle = unknown> {
  setInterval(handler: () => void, duration: number): THandle;
  clearInterval(handle: THandle): void;
}

export interface SequenceDependencies<THandle = unknown> {
  scheduler?: SequenceScheduler<THandle>;
  /** Mirrors the legacy visualization refresh call after every tick. */
  refresh?: (reposition: true) => void;
}

export interface SequenceController {
  readonly running: boolean;
  cancel(): void;
}

function defaultScheduler(): SequenceScheduler<ReturnType<typeof setInterval>> {
  return {
    setInterval: (handler, duration) => globalThis.setInterval(handler, duration),
    clearInterval: (handle) => globalThis.clearInterval(handle),
  };
}

/**
 * Run the interval-based sequence used by Graph.Plot without owning a
 * visualization. The scheduler is injectable for deterministic environments.
 */
export function runSequence<THandle = ReturnType<typeof setInterval>>(
  options: SequenceOptions = {},
  dependencies: SequenceDependencies<THandle> = {},
): SequenceController {
  const condition = options.condition ?? (() => false);
  const step = options.step ?? (() => {});
  const onComplete = options.onComplete ?? (() => {});
  const duration = options.duration ?? 200;
  const scheduler =
    dependencies.scheduler ??
    (defaultScheduler() as unknown as SequenceScheduler<THandle>);
  const refresh = dependencies.refresh ?? (() => {});
  let running = true;

  const handle = scheduler.setInterval(() => {
    if (condition()) {
      step();
    } else {
      scheduler.clearInterval(handle);
      running = false;
      onComplete();
    }
    refresh(true);
  }, duration);

  return {
    get running() {
      return running;
    },
    cancel() {
      if (!running) return;
      scheduler.clearInterval(handle);
      running = false;
    },
  };
}
