import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  renderArrow,
  renderHyperline,
  renderLine,
} from "../graph/rendering/edge-shapes.js";
import type { HypertreeRenderableEdge } from "./hypertree-renderer-contracts.js";

function endpoints(edge: HypertreeRenderableEdge) {
  const from = edge.nodeFrom.pos.getc(true);
  const to = edge.nodeTo.pos.getc(true);
  const radius = Number(edge.nodeFrom.scale);
  return {
    from: { x: from.x * radius, y: from.y * radius },
    to: { x: to.x * radius, y: to.y * radius },
  };
}

export function renderHypertreeNoneEdge(
  _type: string,
  _edge: HypertreeRenderableEdge,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsHypertreeNoneEdge(
  _edge: HypertreeRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}

export function renderHypertreeLineEdge(
  _type: string,
  edge: HypertreeRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { from, to } = endpoints(edge);
  renderLine(from, to, canvas);
}

export function containsHypertreeLineEdge(
  edge: HypertreeRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): undefined {
  // The original adapter calls line.contains without returning its value.
  endpoints(edge);
  return undefined;
}

export function renderHypertreeArrowEdge(
  _type: string,
  edge: HypertreeRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const { from, to } = endpoints(edge);
  const dimension = edge.getData<number>("dim");
  const direction = edge.data.$direction as ArrayLike<unknown> | null | undefined;
  const inverted = Boolean(
    direction &&
      direction.length > 1 &&
      direction[0] != edge.nodeFrom.id,
  );
  renderArrow(from, to, dimension, inverted, canvas);
}

export function containsHypertreeArrowEdge(
  edge: HypertreeRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): undefined {
  // The original adapter calls arrow.contains without returning its value.
  endpoints(edge);
  return undefined;
}

export function renderHypertreeHyperlineEdge(
  _type: string,
  edge: HypertreeRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderHyperline(
    edge.nodeFrom.pos.getc(),
    edge.nodeTo.pos.getc(),
    Number(edge.nodeFrom.scale),
    canvas,
  );
}

export function containsHypertreeHyperlineEdge(
  _edge: HypertreeRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}
