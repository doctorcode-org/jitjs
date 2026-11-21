import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";
import {
  containsArrow,
  containsLine,
  renderArrow,
  renderHyperline,
  renderLine,
} from "../graph/rendering/edge-shapes.js";
import type { SunburstRenderableEdge } from "./sunburst-renderer-contracts.js";

export function renderSunburstNoneEdge(
  _type: string,
  _edge: SunburstRenderableEdge,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsSunburstNoneEdge(
  _edge: SunburstRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}

export function renderSunburstLineEdge(
  _type: string,
  edge: SunburstRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderLine(
    edge.nodeFrom.pos.getc(true),
    edge.nodeTo.pos.getc(true),
    canvas,
  );
}

export function containsSunburstLineEdge(
  edge: SunburstRenderableEdge,
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

export function renderSunburstArrowEdge(
  _type: string,
  edge: SunburstRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const from = edge.nodeFrom.pos.getc(true);
  const to = edge.nodeTo.pos.getc(true);
  const dimension = edge.getData<number>("dim");
  const direction = edge.data.$direction as ArrayLike<unknown> | null | undefined;
  const inverted = Boolean(
    direction && direction.length > 1 && direction[0] != edge.nodeFrom.id,
  );
  renderArrow(from, to, dimension, inverted, canvas);
}

export function containsSunburstArrowEdge(
  edge: SunburstRenderableEdge,
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

export function renderSunburstHyperlineEdge(
  _type: string,
  edge: SunburstRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  const from = edge.nodeFrom.pos.getc();
  const to = edge.nodeTo.pos.getc();
  const dimension = Math.max(from.norm(), to.norm());
  renderHyperline(
    from.$scale(1 / dimension),
    to.$scale(1 / dimension),
    dimension,
    canvas,
  );
}

export function containsSunburstHyperlineEdge(
  _edge: SunburstRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}
