import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";

/** Minimal cartesian position surface consumed by RGraph shape adapters. */
export interface RGraphRendererPosition {
  getc(simple: true): RenderPoint;
}

/**
 * Structural node contract keeps RGraph rendering independent from the graph
 * implementation and the visualization facade.
 */
export interface RGraphRenderableNode {
  readonly id: string;
  readonly pos: RGraphRendererPosition;
  getData<TValue = unknown>(property: string): TValue;
}

/** Structural adjacency surface consumed by RGraph edge adapters. */
export interface RGraphRenderableEdge<
  TNode extends RGraphRenderableNode = RGraphRenderableNode,
> {
  readonly nodeFrom: TNode;
  readonly nodeTo: TNode;
  readonly data: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

export type RGraphNodeRenderAdapter<
  TNode extends RGraphRenderableNode = RGraphRenderableNode,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type RGraphNodeContainsAdapter<
  TNode extends RGraphRenderableNode = RGraphRenderableNode,
> = (node: TNode, position: RenderPoint) => boolean;

export type RGraphEdgeRenderAdapter<
  TEdge extends RGraphRenderableEdge = RGraphRenderableEdge,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type RGraphEdgeContainsAdapter<
  TEdge extends RGraphRenderableEdge = RGraphRenderableEdge,
> = (edge: TEdge, position: RenderPoint, epsilon: number) => boolean;
