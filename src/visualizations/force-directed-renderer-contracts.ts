import type { RenderPoint, RenderingCanvas } from "../graph/rendering/contracts.js";

/** Position surface used by the legacy ForceDirected shape adapters. */
export interface ForceDirectedRendererPosition {
  getc(simple: true): RenderPoint;
}

/**
 * Structural node contract keeps the adapters independent from Graph and the
 * ForceDirected facade. A GraphNode with a two-dimensional position satisfies
 * it without an adapter object or a runtime import.
 */
export interface ForceDirectedRenderableNode {
  readonly id: string;
  readonly pos: ForceDirectedRendererPosition;
  getData<TValue = unknown>(property: string): TValue;
}

/** Structural edge contract shared by the line and arrow adapters. */
export interface ForceDirectedRenderableEdge<
  TNode extends ForceDirectedRenderableNode = ForceDirectedRenderableNode,
> {
  readonly nodeFrom: TNode;
  readonly nodeTo: TNode;
  readonly data: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

/** Directly assignable to ForceDirectedVisualization's node-render callback. */
export type ForceDirectedNodeRenderAdapter<
  TNode extends ForceDirectedRenderableNode = ForceDirectedRenderableNode,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

/** Directly assignable to ForceDirectedVisualization's edge-render callback. */
export type ForceDirectedEdgeRenderAdapter<
  TEdge extends ForceDirectedRenderableEdge = ForceDirectedRenderableEdge,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type ForceDirectedNodeContainsAdapter<
  TNode extends ForceDirectedRenderableNode = ForceDirectedRenderableNode,
> = (node: TNode, position: RenderPoint) => boolean;

export type ForceDirectedEdgeContainsAdapter<
  TEdge extends ForceDirectedRenderableEdge = ForceDirectedRenderableEdge,
> = (edge: TEdge, position: RenderPoint, epsilon: number) => boolean;

