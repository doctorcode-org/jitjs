import { Quart } from "./easing.js";
import type { EasingFunction } from "./easing.js";
import { empty, merge, time } from "./util.js";

export type AnimationLink = "ignore" | "cancel" | (string & {});

export interface AnimationOptions {
  duration: number;
  fps: number;
  transition: EasingFunction;
  compute: (delta: number) => void;
  complete: () => void;
  link: AnimationLink;
  [option: string]: unknown;
}

export type AnimationOptionsInput = Partial<AnimationOptions>;

/** Timer-based animation with the same state transitions as JIT 2.0.1. */
export class Animation {
  readonly $$family = "class" as const;

  declare opt: AnimationOptions;
  declare time: number;
  declare timer: ReturnType<typeof setInterval> | undefined;

  constructor(options?: AnimationOptionsInput | null) {
    this.setOptions(options);
  }

  setOptions(options?: AnimationOptionsInput | null): this {
    const defaults: AnimationOptions = {
      duration: 2500,
      fps: 40,
      transition: Quart.easeInOut,
      compute: empty,
      complete: empty,
      link: "ignore",
    };
    this.opt = merge(defaults, options || {}) as unknown as AnimationOptions;
    return this;
  }

  step(): void {
    const currentTime = time();
    const options = this.opt;
    if (currentTime < this.time + options.duration) {
      const delta = options.transition(
        (currentTime - this.time) / options.duration,
      );
      options.compute(delta);
    } else {
      clearInterval(this.timer);
      this.timer = undefined;
      options.compute(1);
      options.complete();
    }
  }

  start(): this {
    if (!this.check()) {
      return this;
    }
    this.time = 0;
    this.startTimer();
    return this;
  }

  startTimer(): boolean {
    if (this.timer) {
      return false;
    }
    this.time = time() - this.time;
    this.timer = setInterval(() => {
      this.step();
    }, Math.round(1000 / this.opt.fps));
    return true;
  }

  pause(): this {
    this.stopTimer();
    return this;
  }

  resume(): this {
    this.startTimer();
    return this;
  }

  stopTimer(): boolean {
    if (!this.timer) {
      return false;
    }
    this.time = time() - this.time;
    clearInterval(this.timer);
    this.timer = undefined;
    return true;
  }

  check(): boolean {
    if (!this.timer) {
      return true;
    }
    if (this.opt.link == "cancel") {
      this.stopTimer();
      return true;
    }
    return false;
  }
}
