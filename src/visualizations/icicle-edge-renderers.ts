import type {
  RenderPoint,
  RenderingCanvas,
} from "../graph/rendering/contracts.js";

export function renderIcicleNoneEdge(
  _type: string,
  _edge: unknown,
  _canvas: RenderingCanvas,
  _animating?: boolean,
): void {}

export function containsIcicleNoneEdge(
  _edge: unknown,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}
