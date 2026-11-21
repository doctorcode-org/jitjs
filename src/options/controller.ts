import { empty } from "../core/util.js";

export type ControllerCallback = (...arguments_: unknown[]) => void;

export interface ControllerOptions {
  onBeforeCompute: ControllerCallback;
  onAfterCompute: ControllerCallback;
  onCreateLabel: ControllerCallback;
  onPlaceLabel: ControllerCallback;
  onComplete: ControllerCallback;
  onBeforePlotLine: ControllerCallback;
  onAfterPlotLine: ControllerCallback;
  onBeforePlotNode: ControllerCallback;
  onAfterPlotNode: ControllerCallback;
  request: false | ((...arguments_: unknown[]) => unknown);
}

export function createControllerOptions(): ControllerOptions {
  return {
    onBeforeCompute: empty,
    onAfterCompute: empty,
    onCreateLabel: empty,
    onPlaceLabel: empty,
    onComplete: empty,
    onBeforePlotLine: empty,
    onAfterPlotLine: empty,
    onBeforePlotNode: empty,
    onAfterPlotNode: empty,
    request: false,
  };
}
