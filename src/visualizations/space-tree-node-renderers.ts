import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  containsCircle,
  containsEllipse,
  containsRectangle,
  containsSquare,
  renderCircle,
  renderEllipse,
  renderRectangle,
  renderSquare,
} from "../graph/rendering/node-shapes.js";
import {
  getSpaceTreeAlignedPosition,
  type SpaceTreeRenderableNode,
  type SpaceTreeRendererConfig,
} from "./space-tree-renderer-contracts.js";

function alignedCenter(
  node: SpaceTreeRenderableNode,
  width: number,
  height: number,
  config: SpaceTreeRendererConfig,
): RenderPoint {
  const corner = getSpaceTreeAlignedPosition(
    node.pos.getc(true),
    width,
    height,
    config,
  );
  return {
    x: corner.x + width / 2,
    y: corner.y + height / 2,
  };
}

export function renderSpaceTreeNoneNode(
  _type: string,
  _node: SpaceTreeRenderableNode,
  _canvas: RenderingCanvas,
  _animating: boolean | undefined,
  _config: SpaceTreeRendererConfig,
): void {}

export function containsSpaceTreeNoneNode(
  _node: SpaceTreeRenderableNode,
  _position: RenderPoint,
  _config: SpaceTreeRendererConfig,
): false {
  return false;
}

export function renderSpaceTreeCircleNode(
  _type: string,
  node: SpaceTreeRenderableNode,
  canvas: RenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const dimension = node.getData<number>("dim");
  const center = alignedCenter(node, dimension, dimension, config);
  renderCircle("fill", center, dimension / 2, canvas);
}

export function containsSpaceTreeCircleNode(
  node: SpaceTreeRenderableNode,
  position: RenderPoint,
  config: SpaceTreeRendererConfig,
): undefined {
  const dimension = node.getData<number>("dim");
  const center = alignedCenter(node, dimension, dimension, config);
  // ST 2.0.1 calls the helper but accidentally omits the return statement.
  containsCircle(center, position, dimension / 2);
  return undefined;
}

export function renderSpaceTreeSquareNode(
  _type: string,
  node: SpaceTreeRenderableNode,
  canvas: RenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const dimension = node.getData<number>("dim");
  const center = alignedCenter(node, dimension, dimension, config);
  renderSquare("fill", center, dimension / 2, canvas);
}

export function containsSpaceTreeSquareNode(
  node: SpaceTreeRenderableNode,
  position: RenderPoint,
  config: SpaceTreeRendererConfig,
): undefined {
  const dimension = node.getData<number>("dim");
  const center = alignedCenter(node, dimension, dimension, config);
  containsSquare(center, position, dimension / 2);
  return undefined;
}

export function renderSpaceTreeEllipseNode(
  _type: string,
  node: SpaceTreeRenderableNode,
  canvas: RenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const center = alignedCenter(node, width, height, config);
  renderEllipse("fill", center, width, height, canvas);
}

export function containsSpaceTreeEllipseNode(
  node: SpaceTreeRenderableNode,
  position: RenderPoint,
  config: SpaceTreeRendererConfig,
): undefined {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const center = alignedCenter(node, width, height, config);
  containsEllipse(center, position, width, height);
  return undefined;
}

export function renderSpaceTreeRectangleNode(
  _type: string,
  node: SpaceTreeRenderableNode,
  canvas: RenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const center = alignedCenter(node, width, height, config);
  renderRectangle("fill", center, width, height, canvas);
}

export function containsSpaceTreeRectangleNode(
  node: SpaceTreeRenderableNode,
  position: RenderPoint,
  config: SpaceTreeRendererConfig,
): undefined {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const center = alignedCenter(node, width, height, config);
  containsRectangle(center, position, width, height);
  return undefined;
}
