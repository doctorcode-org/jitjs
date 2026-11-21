import type { AnimationOptionsInput } from "../core/animation.js";
import type {
  NormalizedPlotModes,
  PlotModesInput,
} from "./plot-preparation.js";

export type PlotAnimationOptions = Omit<
  AnimationOptionsInput,
  "compute" | "complete"
> & {
  modes: PlotModesInput;
  hideLabels?: boolean;
  onComplete?: () => void;
};

export interface PlotAnimationDriver {
  setOptions(options?: AnimationOptionsInput | null): this;
  start(): this;
}

export type PlotModeInterpolator<TNode, TVersor = unknown> = (
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface PlotAnimationDependencies<
  TNode,
  TOptions extends PlotAnimationOptions = PlotAnimationOptions,
  TVersor = unknown,
> {
  animation: PlotAnimationDriver;
  prepare(modes: PlotModesInput): NormalizedPlotModes;
  eachNode(visit: (node: TNode) => void): void;
  interpolate(
    mode: string,
    node: TNode,
    properties: readonly string[],
    delta: number,
    versor: TVersor | undefined,
  ): void;
  plot(options: TOptions, animating?: boolean, delta?: number): void;
  setLabelsHidden?(hidden: boolean): void;
}

/**
 * Coordinate Graph.Plot-style animation without importing a graph,
 * animation implementation, interpolator set, renderer, or configuration
 * merger. Callers resolve those choices explicitly, keeping this entry point
 * and their bundles as narrow as possible.
 */
export function animatePlot<
  TNode,
  TOptions extends PlotAnimationOptions = PlotAnimationOptions,
  TVersor = unknown,
>(
  dependencies: PlotAnimationDependencies<TNode, TOptions, TVersor>,
  options: TOptions,
  versor?: TVersor,
): PlotAnimationDriver {
  const modes = dependencies.prepare(options.modes);
  const onComplete = options.onComplete ?? (() => {});
  let animating = false;

  if (options.hideLabels) {
    dependencies.setLabelsHidden?.(true);
  }

  dependencies.animation
    .setOptions({
      ...options,
      $animating: false,
      compute(delta) {
        dependencies.eachNode((node) => {
          for (const mode in modes) {
            dependencies.interpolate(
              mode,
              node,
              modes[mode] as string[],
              delta,
              versor,
            );
          }
        });
        dependencies.plot(options, animating, delta);
        animating = true;
      },
      complete() {
        if (options.hideLabels) {
          dependencies.setLabelsHidden?.(false);
        }
        dependencies.plot(options);
        onComplete();
      },
    })
    .start();

  return dependencies.animation;
}
