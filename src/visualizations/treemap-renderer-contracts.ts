import type {
  RenderingCanvas,
  RenderPoint,
} from "../graph/rendering/contracts.js";

export interface TreemapRendererPosition {
  getc(simple: true): RenderPoint;
}

export interface TreemapRendererConfig {
  readonly offset?: number;
  readonly titleHeight?: number;
  readonly cushion?: boolean;
}

export interface TreemapRenderableNode {
  readonly id: string;
  readonly pos: TreemapRendererPosition;
  readonly ignore?: unknown;
  isDescendantOf(id: string): boolean;
  getData<TValue = unknown>(property: string): TValue;
}

export interface TreemapGradient {
  addColorStop(offset: number, color: string): void;
}

export interface TreemapRenderingCanvas extends RenderingCanvas {
  getCtx(): ReturnType<RenderingCanvas["getCtx"]> & {
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ): TreemapGradient;
    fillStyle: unknown;
    lineJoin: string;
    lineWidth: number;
    strokeStyle: unknown;
  };
}

export type TreemapLeafPredicate<
  TNode extends TreemapRenderableNode = TreemapRenderableNode,
> = (node: TNode) => boolean;

export type TreemapNodeRenderAdapter<
  TNode extends TreemapRenderableNode = TreemapRenderableNode,
  TCanvas extends TreemapRenderingCanvas = TreemapRenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
  config?: TreemapRendererConfig,
  leaf?: TreemapLeafPredicate<TNode>,
  clickedNode?: TNode | null,
) => void;

export type TreemapNodeContainsAdapter<
  TNode extends TreemapRenderableNode = TreemapRenderableNode,
> = (
  node: TNode,
  position: RenderPoint,
  config?: TreemapRendererConfig,
  leaf?: TreemapLeafPredicate<TNode>,
  clickedNode?: TNode | null,
) => boolean;
