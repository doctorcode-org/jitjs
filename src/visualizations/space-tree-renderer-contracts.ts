import type {
  RenderPoint,
  RenderingCanvas,
  RenderingContext2DLike,
} from "../graph/rendering/contracts.js";

export type SpaceTreeOrientation = "left" | "right" | "top" | "bottom";
export type SpaceTreeNodeAlignment = "center" | "left" | "right";

export interface SpaceTreeRendererConfig {
  readonly orientation: SpaceTreeOrientation;
  readonly multitree: boolean;
  readonly Node: {
    readonly align: SpaceTreeNodeAlignment;
  };
}

export interface SpaceTreeRendererPosition {
  getc(simple: true): RenderPoint;
  add(position: RenderPoint): RenderPoint;
}

export interface SpaceTreeRenderableNode {
  readonly id: string;
  readonly _depth: number;
  readonly data: Readonly<Record<string, unknown>>;
  readonly pos: SpaceTreeRendererPosition;
  getData<TValue = unknown>(property: string): TValue;
}

export interface SpaceTreeRenderableEdge<
  TNode extends SpaceTreeRenderableNode = SpaceTreeRenderableNode,
> {
  readonly nodeFrom: TNode;
  readonly nodeTo: TNode;
  readonly data: Readonly<Record<string, unknown>>;
  getData<TValue = unknown>(property: string): TValue;
}

export interface SpaceTreeRenderingContext extends RenderingContext2DLike {
  bezierCurveTo(
    controlPoint1X: number,
    controlPoint1Y: number,
    controlPoint2X: number,
    controlPoint2Y: number,
    x: number,
    y: number,
  ): void;
  quadraticCurveTo(
    controlPointX: number,
    controlPointY: number,
    x: number,
    y: number,
  ): void;
}

export interface SpaceTreeRenderingCanvas extends RenderingCanvas {
  getCtx(): SpaceTreeRenderingContext;
}

export type SpaceTreeNodeRenderAdapter<
  TNode extends SpaceTreeRenderableNode = SpaceTreeRenderableNode,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SpaceTreeConfiguredNodeRenderer<
  TNode extends SpaceTreeRenderableNode = SpaceTreeRenderableNode,
  TCanvas extends RenderingCanvas = RenderingCanvas,
> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
) => void;

export type SpaceTreeNodeContainsAdapter<
  TNode extends SpaceTreeRenderableNode = SpaceTreeRenderableNode,
> = (node: TNode, position: RenderPoint) => boolean | undefined;

export type SpaceTreeConfiguredNodeContains<
  TNode extends SpaceTreeRenderableNode = SpaceTreeRenderableNode,
> = (
  node: TNode,
  position: RenderPoint,
  config: SpaceTreeRendererConfig,
) => boolean | undefined;

export type SpaceTreeEdgeRenderAdapter<
  TEdge extends SpaceTreeRenderableEdge = SpaceTreeRenderableEdge,
  TCanvas extends SpaceTreeRenderingCanvas = SpaceTreeRenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SpaceTreeConfiguredEdgeRenderer<
  TEdge extends SpaceTreeRenderableEdge = SpaceTreeRenderableEdge,
  TCanvas extends SpaceTreeRenderingCanvas = SpaceTreeRenderingCanvas,
> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
) => void;

export type SpaceTreeEdgeContainsAdapter<
  TEdge extends SpaceTreeRenderableEdge = SpaceTreeRenderableEdge,
> = (edge: TEdge, position: RenderPoint, epsilon: number) => boolean;

export type SpaceTreeConfiguredEdgeContains<
  TEdge extends SpaceTreeRenderableEdge = SpaceTreeRenderableEdge,
> = (
  edge: TEdge,
  position: RenderPoint,
  epsilon: number,
  config: SpaceTreeRendererConfig,
) => boolean;

/**
 * Return the top-left corner used by every SpaceTree node and label backend.
 * The branches intentionally mirror ST.Plot#getAlignedPos from JIT 2.0.1.
 */
export function getSpaceTreeAlignedPosition(
  position: RenderPoint,
  width: number,
  height: number,
  config: Pick<SpaceTreeRendererConfig, "orientation" | "Node">,
): RenderPoint {
  const alignment = config.Node.align;
  if (alignment === "center") {
    return {
      x: position.x - width / 2,
      y: position.y - height / 2,
    };
  }

  const vertical =
    config.orientation === "bottom" || config.orientation === "top";
  if (alignment === "left") {
    return vertical
      ? { x: position.x - width / 2, y: position.y }
      : { x: position.x, y: position.y - height / 2 };
  }
  if (alignment === "right") {
    return vertical
      ? { x: position.x - width / 2, y: position.y - height }
      : { x: position.x - width, y: position.y - height / 2 };
  }

  // Preserve the legacy thrown value for invalid custom configurations.
  throw "align: not implemented";
}

/** Bind one named node renderer without creating a shape registry. */
export function bindSpaceTreeNodeRenderer<
  TNode extends SpaceTreeRenderableNode,
  TCanvas extends RenderingCanvas,
>(
  renderer: SpaceTreeConfiguredNodeRenderer<TNode, TCanvas>,
  config: SpaceTreeRendererConfig,
): SpaceTreeNodeRenderAdapter<TNode, TCanvas> {
  return (type, node, canvas, animating) => {
    renderer(type, node, canvas, animating, config);
  };
}

/** Bind one named edge renderer without creating a shape registry. */
export function bindSpaceTreeEdgeRenderer<
  TEdge extends SpaceTreeRenderableEdge,
  TCanvas extends SpaceTreeRenderingCanvas,
>(
  renderer: SpaceTreeConfiguredEdgeRenderer<TEdge, TCanvas>,
  config: SpaceTreeRendererConfig,
): SpaceTreeEdgeRenderAdapter<TEdge, TCanvas> {
  return (type, edge, canvas, animating) => {
    renderer(type, edge, canvas, animating, config);
  };
}

/** Bind one named node hit tester without creating a shape registry. */
export function bindSpaceTreeNodeContains<
  TNode extends SpaceTreeRenderableNode,
>(
  contains: SpaceTreeConfiguredNodeContains<TNode>,
  config: SpaceTreeRendererConfig,
): SpaceTreeNodeContainsAdapter<TNode> {
  return (node, position) => contains(node, position, config);
}

/** Bind one named edge hit tester without creating a shape registry. */
export function bindSpaceTreeEdgeContains<
  TEdge extends SpaceTreeRenderableEdge,
>(
  contains: SpaceTreeConfiguredEdgeContains<TEdge>,
  config: SpaceTreeRendererConfig,
): SpaceTreeEdgeContainsAdapter<TEdge> {
  return (edge, position, epsilon) =>
    contains(edge, position, epsilon, config);
}
