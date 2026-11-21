import type {
  HyperbolicRenderPoint,
  RenderingCanvas,
  RenderPoint,
} from "../graph/rendering/contracts.js";

export interface SunburstPolarPoint {
  readonly theta: number;
  readonly rho: number;
}

export interface SunburstCartesianPoint extends HyperbolicRenderPoint {
  norm(): number;
  $scale(factor: number): this;
}

export interface SunburstRendererPosition {
  readonly theta: number;
  readonly rho: number;
  getp(simple?: true): SunburstPolarPoint;
  getc(simple: true): RenderPoint;
  getc(simple?: false): SunburstCartesianPoint;
}

export interface SunburstRendererConfig {
  readonly levelDistance?: number;
}

export interface SunburstRenderableNode {
  readonly id: string;
  readonly pos: SunburstRendererPosition;
  readonly _depth?: number;
  readonly collapsed?: unknown;
  getPos(): SunburstRendererPosition;
  getData<TValue = unknown>(property: string): TValue;
}

export interface SunburstRenderableEdge<
  TNode extends SunburstRenderableNode = SunburstRenderableNode,
> {
  readonly nodeFrom: TNode;
  readonly nodeTo: TNode;
  readonly data: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

export interface SunburstGradient {
  addColorStop(offset: number, color: string): void;
}

export interface SunburstRenderingCanvas extends RenderingCanvas {
  getCtx(): ReturnType<RenderingCanvas["getCtx"]> & {
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ): SunburstGradient;
    fillStyle: unknown;
    lineWidth: unknown;
  };
}

export type SunburstNodeRenderAdapter<
  TNode extends SunburstRenderableNode = SunburstRenderableNode,
  TCanvas extends SunburstRenderingCanvas = SunburstRenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
  config?: SunburstRendererConfig,
) => void;

export type SunburstNodeContainsAdapter<
  TNode extends SunburstRenderableNode = SunburstRenderableNode,
> = (
  node: TNode,
  position: RenderPoint,
  config?: SunburstRendererConfig,
) => boolean;

export type SunburstEdgeRenderAdapter<
  TEdge extends SunburstRenderableEdge = SunburstRenderableEdge,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SunburstEdgeContainsAdapter<
  TEdge extends SunburstRenderableEdge = SunburstRenderableEdge,
> = (edge: TEdge, position: RenderPoint, epsilon: number) => boolean;
