import type {
  RenderingCanvas,
  RenderPoint,
} from "../graph/rendering/contracts.js";

export function renderTreemapNoneEdge(
  _type: string,
  _edge: unknown,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsTreemapNoneEdge(
  _edge: unknown,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}
