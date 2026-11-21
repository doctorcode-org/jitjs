import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  containsCircle,
  containsRectangle,
  containsSquare,
  containsStar,
  containsTriangle,
  renderCircle,
  renderEllipse,
  renderRectangle,
  renderSquare,
  renderStar,
  renderTriangle,
} from "../graph/rendering/node-shapes.js";
import type { HypertreeRenderableNode } from "./hypertree-renderer-contracts.js";

function scaledPosition(node: HypertreeRenderableNode) {
  return node.pos.getc().$scale(Number(node.scale));
}

function transformedDimension(
  node: HypertreeRenderableNode,
  property: string,
): { dimension: number; position: ReturnType<HypertreeRenderableNode["pos"]["getc"]> } {
  let dimension = node.getData<number>(property);
  const position = node.pos.getc();
  if (node.Node?.transform) {
    dimension *= 1 - position.squaredNorm();
  }
  return { dimension, position };
}

export function renderHypertreeNoneNode(
  _type: string,
  _node: HypertreeRenderableNode,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsHypertreeNoneNode(
  _node: HypertreeRenderableNode,
  _position: RenderPoint,
): false {
  return false;
}

export function renderHypertreeCircleNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { dimension, position } = transformedDimension(node, "dim");
  position.$scale(Number(node.scale));
  if (dimension > 0.2) {
    renderCircle("fill", position, dimension, canvas);
  }
}

export function containsHypertreeCircleNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  const dimension = node.getData<number>("dim");
  return containsCircle(scaledPosition(node), position, dimension);
}

export function renderHypertreeEllipseNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderEllipse(
    "fill",
    scaledPosition(node),
    node.getData<number>("width"),
    node.getData<number>("height"),
    canvas,
  );
}

export function containsHypertreeEllipseNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  // JIT 2.0.1 delegates to circle.contains and the extra height is ignored.
  const width = node.getData<number>("width");
  node.getData<number>("height");
  return containsCircle(scaledPosition(node), position, width);
}

export function renderHypertreeSquareNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { dimension, position } = transformedDimension(node, "dim");
  position.$scale(Number(node.scale));
  if (dimension > 0.2) {
    renderSquare("fill", position, dimension, canvas);
  }
}

export function containsHypertreeSquareNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  const dimension = node.getData<number>("dim");
  return containsSquare(scaledPosition(node), position, dimension);
}

export function renderHypertreeRectangleNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  let width = node.getData<number>("width");
  let height = node.getData<number>("height");
  const cartesian = node.pos.getc();
  if (node.Node?.transform) {
    const scale = 1 - cartesian.squaredNorm();
    width *= scale;
    height *= scale;
  }
  cartesian.$scale(Number(node.scale));
  if (width > 0.2 && height > 0.2) {
    renderRectangle("fill", cartesian, width, height, canvas);
  }
}

export function containsHypertreeRectangleNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  return containsRectangle(scaledPosition(node), position, width, height);
}

export function renderHypertreeTriangleNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { dimension, position } = transformedDimension(node, "dim");
  position.$scale(Number(node.scale));
  if (dimension > 0.2) {
    renderTriangle("fill", position, dimension, canvas);
  }
}

export function containsHypertreeTriangleNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  const dimension = node.getData<number>("dim");
  return containsTriangle(scaledPosition(node), position, dimension);
}

export function renderHypertreeStarNode(
  _type: string,
  node: HypertreeRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { dimension, position } = transformedDimension(node, "dim");
  position.$scale(Number(node.scale));
  if (dimension > 0.2) {
    renderStar("fill", position, dimension, canvas);
  }
}

export function containsHypertreeStarNode(
  node: HypertreeRenderableNode,
  position: RenderPoint,
): boolean {
  const dimension = node.getData<number>("dim");
  return containsStar(scaledPosition(node), position, dimension);
}
