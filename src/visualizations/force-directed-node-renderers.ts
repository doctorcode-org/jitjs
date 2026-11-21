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
import type { ForceDirectedRenderableNode } from "./force-directed-renderer-contracts.js";

export function renderForceDirectedNoneNode(
  _type: string,
  _node: ForceDirectedRenderableNode,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsForceDirectedNoneNode(
  _node: ForceDirectedRenderableNode,
  _position: RenderPoint,
): false {
  return false;
}

export function renderForceDirectedCircleNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedCircleNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsCircle(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderForceDirectedEllipseNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedEllipseNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsEllipse(
    node.pos.getc(true),
    position,
    node.getData<number>("width"),
    node.getData<number>("height"),
  );
}

export function renderForceDirectedSquareNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedSquareNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsSquare(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderForceDirectedRectangleNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedRectangleNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsRectangle(
    node.pos.getc(true),
    position,
    node.getData<number>("width"),
    node.getData<number>("height"),
  );
}

export function renderForceDirectedTriangleNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedTriangleNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsTriangle(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

export function renderForceDirectedStarNode(
  _type: string,
  node: ForceDirectedRenderableNode,
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

export function containsForceDirectedStarNode(
  node: ForceDirectedRenderableNode,
  position: RenderPoint,
): boolean {
  return containsStar(
    node.pos.getc(true),
    position,
    node.getData<number>("dim"),
  );
}

