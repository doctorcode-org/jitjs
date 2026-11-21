import type {
  RenderPoint,
  RenderingCanvas,
  RenderingContext2DLike,
} from "../graph/rendering/contracts.js";

export interface IcicleRendererPosition {
  getc(simple: true): RenderPoint;
}

export interface IcicleRendererConfig {
  readonly offset?: number;
  readonly cushion?: boolean;
}

export interface IcicleRenderableNode {
  readonly id: string;
  readonly pos: IcicleRendererPosition;
  isDescendantOf(id: string): boolean;
  getData<TValue = unknown>(property: string): TValue;
}

export interface IcicleGradient {
  addColorStop(offset: number, color: string): void;
}

export interface IcicleRenderingContext extends RenderingContext2DLike {
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): IcicleGradient;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
}

export interface IcicleRenderingCanvas extends RenderingCanvas {
  getCtx(): IcicleRenderingContext;
}

export type IcicleNodeRenderAdapter<
  TNode extends IcicleRenderableNode = IcicleRenderableNode,
  TCanvas extends IcicleRenderingCanvas = IcicleRenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
  config?: IcicleRendererConfig,
  clickedNode?: TNode | null,
) => void;

export type IcicleNodeContainsAdapter<
  TNode extends IcicleRenderableNode = IcicleRenderableNode,
> = (
  node: TNode,
  position: RenderPoint,
  config?: IcicleRendererConfig,
  clickedNode?: TNode | null,
) => boolean;
