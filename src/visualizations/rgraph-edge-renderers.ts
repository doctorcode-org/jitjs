import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  containsArrow,
  containsLine,
  renderArrow,
  renderLine,
} from "../graph/rendering/edge-shapes.js";
import type { RGraphRenderableEdge } from "./rgraph-renderer-contracts.js";

export function renderRGraphNoneEdge(
  _type: string,
  _edge: RGraphRenderableEdge,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsRGraphNoneEdge(
  _edge: RGraphRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}

export function renderRGraphLineEdge(
  _type: string,
  edge: RGraphRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderLine(
    edge.nodeFrom.pos.getc(true),
    edge.nodeTo.pos.getc(true),
    canvas,
  );
}

export function containsRGraphLineEdge(
  edge: RGraphRenderableEdge,
  position: RenderPoint,
  epsilon: number,
): boolean {
  return containsLine(
    edge.nodeFrom.pos.getc(true),
    edge.nodeTo.pos.getc(true),
    position,
    epsilon,
  );
}

export function renderRGraphArrowEdge(
  _type: string,
  edge: RGraphRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const from = edge.nodeFrom.pos.getc(true);
  const to = edge.nodeTo.pos.getc(true);
  const dimension = edge.getData<number>("dim");
  const direction = edge.data.$direction as
    | ArrayLike<unknown>
    | null
    | undefined;
  const inverted = Boolean(
    direction &&
      direction.length > 1 &&
      direction[0] != edge.nodeFrom.id,
  );
  renderArrow(from, to, dimension, inverted, canvas);
}

export function containsRGraphArrowEdge(
  edge: RGraphRenderableEdge,
  position: RenderPoint,
  epsilon: number,
): boolean {
  return containsArrow(
    edge.nodeFrom.pos.getc(true),
    edge.nodeTo.pos.getc(true),
    position,
    epsilon,
  );
}
