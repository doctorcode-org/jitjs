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
import type { ForceDirectedRenderableEdge } from "./force-directed-renderer-contracts.js";

export function renderForceDirectedNoneEdge(
  _type: string,
  _edge: ForceDirectedRenderableEdge,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsForceDirectedNoneEdge(
  _edge: ForceDirectedRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}

export function renderForceDirectedLineEdge(
  _type: string,
  edge: ForceDirectedRenderableEdge,
  canvas: RenderingCanvas,
  _animating?: boolean,
): void {
  renderLine(
    edge.nodeFrom.pos.getc(true),
    edge.nodeTo.pos.getc(true),
    canvas,
  );
}

export function containsForceDirectedLineEdge(
  edge: ForceDirectedRenderableEdge,
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

export function renderForceDirectedArrowEdge(
  _type: string,
  edge: ForceDirectedRenderableEdge,
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

  renderArrow(
    from,
    to,
    dimension,
    inverted,
    canvas,
  );
}

export function containsForceDirectedArrowEdge(
  edge: ForceDirectedRenderableEdge,
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
