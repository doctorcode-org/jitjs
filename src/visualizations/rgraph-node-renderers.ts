import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  containsCircle,
  containsEllipse,
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
import type { RGraphRenderableNode } from "./rgraph-renderer-contracts.js";

export function renderRGraphNoneNode(
  _type: string,
  _node: RGraphRenderableNode,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsRGraphNoneNode(
  _node: RGraphRenderableNode,
  _position: RenderPoint,
): false {
  return false;
}

export function renderRGraphCircleNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderCircle(
    "fill",
    node.pos.getc(true),
    node.getData<number>("dim"),
    canvas,
  );
}

export function containsRGraphCircleNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsCircle(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderRGraphEllipseNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderEllipse(
    "fill",
    node.pos.getc(true),
    node.getData<number>("width"),
    node.getData<number>("height"),
    canvas,
  );
}

export function containsRGraphEllipseNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsEllipse(
    node.pos.getc(true),
    position,
    node.getData<number>("width"),
    node.getData<number>("height"),
  );
}

export function renderRGraphSquareNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderSquare(
    "fill",
    node.pos.getc(true),
    node.getData<number>("dim"),
    canvas,
  );
}

export function containsRGraphSquareNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsSquare(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderRGraphRectangleNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderRectangle(
    "fill",
    node.pos.getc(true),
    node.getData<number>("width"),
    node.getData<number>("height"),
    canvas,
  );
}

export function containsRGraphRectangleNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsRectangle(
    node.pos.getc(true),
    position,
    node.getData<number>("width"),
    node.getData<number>("height"),
  );
}

export function renderRGraphTriangleNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderTriangle(
    "fill",
    node.pos.getc(true),
    node.getData<number>("dim"),
    canvas,
  );
}

export function containsRGraphTriangleNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsTriangle(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderRGraphStarNode(
  _type: string,
  node: RGraphRenderableNode,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderStar(
    "fill",
    node.pos.getc(true),
    node.getData<number>("dim"),
    canvas,
  );
}

export function containsRGraphStarNode(
  node: RGraphRenderableNode,
  position: RenderPoint,
): boolean {
  return containsStar(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}
