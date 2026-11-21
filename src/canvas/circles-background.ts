import { merge } from "../core/util.js";

/** Canvas context capabilities used by the circles background. */
export interface CirclesBackgroundContext {
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  stroke(): void;
  closePath(): void;
}

/** Structural layer contract, intentionally independent from the canvas class. */
export interface CirclesBackgroundLayer<
  TContext extends CirclesBackgroundContext = CirclesBackgroundContext,
> {
  readonly canvas: unknown;
  getCtx(): TContext;
}

export interface CirclesBackgroundOptions {
  idSuffix?: string;
  levelDistance?: number;
  numberOfCircles?: number;
  CanvasStyles?: Record<string, unknown>;
  offset?: number;
}

export interface CirclesBackgroundConfig {
  idSuffix: string;
  levelDistance: number;
  numberOfCircles: number;
  CanvasStyles: Record<string, unknown>;
  offset: number;
}

const defaultConfig: CirclesBackgroundConfig = {
  idSuffix: "-bkcanvas",
  levelDistance: 100,
  numberOfCircles: 6,
  CanvasStyles: {},
  offset: 0,
};

/**
 * Draws the concentric background rings used by the radial JIT visualizations.
 *
 * The class is directly usable as a modern `Canvas` layer definition. Importing
 * it performs no registration and touches neither the DOM nor a global object.
 */
export class CirclesBackground<TVisualization = unknown> {
  readonly viz: TVisualization;
  readonly config: CirclesBackgroundConfig;

  constructor(
    visualization: TVisualization,
    options: CirclesBackgroundOptions = {},
  ) {
    this.viz = visualization;
    this.config = merge(defaultConfig, options) as CirclesBackgroundConfig;
  }

  /** Allows the instance to be passed directly in `CanvasOptions.layers`. */
  get idSuffix(): string {
    return this.config.idSuffix;
  }

  resize(
    _width: number,
    _height: number,
    base: CirclesBackgroundLayer,
  ): void {
    this.plot(base);
  }

  plot(base: CirclesBackgroundLayer): void {
    // JIT 2.0.1 reads this property even though drawing only needs the context.
    // Keeping the read also preserves behavior for structural layers/getters.
    void base.canvas;

    const context = base.getCtx();
    const writableContext = context as unknown as Record<string, unknown>;
    for (const style in this.config.CanvasStyles) {
      writableContext[style] = this.config.CanvasStyles[style];
    }

    const circleCount = this.config.numberOfCircles;
    const levelDistance = this.config.levelDistance;
    for (let index = 1; index <= circleCount; index += 1) {
      context.beginPath();
      context.arc(
        0,
        0,
        levelDistance * index,
        0,
        2 * Math.PI,
        false,
      );
      context.stroke();
      context.closePath();
    }
  }
}
