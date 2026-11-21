/** Cartesian point consumed by the two-dimensional rendering primitives. */
export interface RenderPoint {
  readonly x: number;
  readonly y: number;
}

/** Hyperbolic points retain the legacy `Complex.squaredNorm()` contract. */
export interface HyperbolicRenderPoint extends RenderPoint {
  squaredNorm(): number;
}

export type RenderMode = "fill" | "stroke";

/**
 * The minimal 2D context surface required by node and edge primitives.
 * A browser `CanvasRenderingContext2D` satisfies this contract structurally.
 */
export interface RenderingContext2DLike {
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  beginPath(): void;
  closePath(): void;
  fill(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
  restore(): void;
  rotate(angle: number): void;
  save(): void;
  scale(x: number, y: number): void;
  stroke(): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  translate(x: number, y: number): void;
}

/** Canvas is injected structurally; this module never imports the Canvas class. */
export interface RenderingCanvas {
  getCtx(): RenderingContext2DLike;
}
