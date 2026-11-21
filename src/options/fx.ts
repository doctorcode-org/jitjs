import { Quart, type EasingFunction } from "../core/easing.js";

export interface FxOptions {
  fps: number;
  duration: number;
  transition: EasingFunction;
  clearCanvas: boolean;
}

export function createFxOptions(): FxOptions {
  return {
    fps: 40,
    duration: 2500,
    transition: Quart.easeInOut,
    clearCanvas: true,
  };
}
