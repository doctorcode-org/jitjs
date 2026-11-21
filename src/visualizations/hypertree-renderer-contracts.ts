import type {
  HyperbolicRenderPoint,
  RenderingCanvas,
  RenderPoint,
} from "../graph/rendering/contracts.js";

export interface HypertreeScaledPoint extends HyperbolicRenderPoint {
  $scale(factor: number): this;
}

export interface HypertreeRendererPosition {
  getc(simple: true): RenderPoint;
  getc(simple?: false): HypertreeScaledPoint;
}

export interface HypertreeRenderableNode {
  readonly id: string;
  readonly pos: HypertreeRendererPosition;
  readonly scale?: unknown;
  readonly Node?: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

export interface HypertreeRenderableEdge<
  TNode extends HypertreeRenderableNode = HypertreeRenderableNode,
> {
  readonly nodeFrom: TNode;
  readonly nodeTo: TNode;
  readonly data: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

export type HypertreeNodeRenderAdapter<
  TNode extends HypertreeRenderableNode = HypertreeRenderableNode,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type HypertreeEdgeRenderAdapter<
  TEdge extends HypertreeRenderableEdge = HypertreeRenderableEdge,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type HypertreeNodeContainsAdapter<
  TNode extends HypertreeRenderableNode = HypertreeRenderableNode,
> = (node: TNode, position: RenderPoint) => boolean;

export type HypertreeEdgeContainsAdapter<
  TEdge extends HypertreeRenderableEdge = HypertreeRenderableEdge,
> = (
  edge: TEdge,
  position: RenderPoint,
  epsilon: number,
) => boolean | undefined;
