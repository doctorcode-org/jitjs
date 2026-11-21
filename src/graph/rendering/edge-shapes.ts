import type {
  HyperbolicRenderPoint,
  RenderingCanvas,
  RenderPoint,
} from "./contracts.js";

interface HyperlineArc {
  x: number;
  y: number;
  ratio: number;
  a?: number;
  b?: number;
}

export function renderLine(
  from: RenderPoint,
  to: RenderPoint,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

export function containsLine(
  from: RenderPoint,
  to: RenderPoint,
  position: RenderPoint,
  epsilon: number,
): boolean {
  const minimumX = Math.min(from.x, to.x);
  const maximumX = Math.max(from.x, to.x);
  const minimumY = Math.min(from.y, to.y);
  const maximumY = Math.max(from.y, to.y);

  if (
    position.x >= minimumX &&
    position.x <= maximumX &&
    position.y >= minimumY &&
    position.y <= maximumY
  ) {
    if (Math.abs(to.x - from.x) <= epsilon) {
      return true;
    }
    const expectedY =
      ((to.y - from.y) / (to.x - from.x)) * (position.x - from.x) +
      from.y;
    return Math.abs(expectedY - position.y) <= epsilon;
  }
  return false;
}

export function renderArrow(
  from: RenderPoint,
  to: RenderPoint,
  dimension: number,
  swap: boolean,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  let start = from;
  let end = to;
  if (swap) {
    start = to;
    end = from;
  }

  const differenceX = end.x - start.x;
  const differenceY = end.y - start.y;
  const norm = Math.sqrt(
    differenceX * differenceX + differenceY * differenceY,
  );
  const scale = dimension / norm;
  const vectorX = differenceX * scale;
  const vectorY = differenceY * scale;
  const intermediateX = end.x - vectorX;
  const intermediateY = end.y - vectorY;
  const normalX = -vectorY / 2;
  const normalY = vectorX / 2;
  const firstX = intermediateX + normalX;
  const firstY = intermediateY + normalY;
  const secondX = intermediateX - normalX;
  const secondY = intermediateY - normalY;

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(firstX, firstY);
  context.lineTo(secondX, secondY);
  context.lineTo(end.x, end.y);
  context.closePath();
  context.fill();
}

export function containsArrow(
  from: RenderPoint,
  to: RenderPoint,
  position: RenderPoint,
  epsilon: number,
): boolean {
  return containsLine(from, to, position, epsilon);
}

function computeArcThroughTwoPoints(
  first: HyperbolicRenderPoint,
  second: HyperbolicRenderPoint,
): HyperlineArc {
  const denominator = first.x * second.y - first.y * second.x;
  const firstSquaredNorm = first.squaredNorm();
  const secondSquaredNorm = second.squaredNorm();

  if (denominator == 0) {
    return { x: 0, y: 0, ratio: -1 };
  }

  const a =
    (first.y * secondSquaredNorm -
      second.y * firstSquaredNorm +
      first.y -
      second.y) /
    denominator;
  const b =
    (second.x * firstSquaredNorm -
      first.x * secondSquaredNorm +
      second.x -
      first.x) /
    denominator;
  const x = -a / 2;
  const y = -b / 2;
  const squaredRatio = (a * a + b * b) / 4 - 1;

  if (squaredRatio < 0) {
    return { x: 0, y: 0, ratio: -1 };
  }

  const ratio = Math.sqrt(squaredRatio);
  return {
    x,
    y,
    ratio: ratio > 1000 ? -1 : ratio,
    a,
    b,
  };
}

function clockwiseSense(angleBegin: number, angleEnd: number): boolean {
  return angleBegin < angleEnd
    ? !(angleBegin + Math.PI > angleEnd)
    : angleEnd + Math.PI > angleBegin;
}

export function renderHyperline(
  from: HyperbolicRenderPoint,
  to: HyperbolicRenderPoint,
  radius: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  const center = computeArcThroughTwoPoints(from, to);

  if (
    (center.a !== undefined && center.a > 1000) ||
    (center.b !== undefined && center.b > 1000) ||
    center.ratio < 0
  ) {
    context.beginPath();
    context.moveTo(from.x * radius, from.y * radius);
    context.lineTo(to.x * radius, to.y * radius);
    context.stroke();
    return;
  }

  const angleBegin = Math.atan2(to.y - center.y, to.x - center.x);
  const angleEnd = Math.atan2(from.y - center.y, from.x - center.x);
  context.beginPath();
  context.arc(
    center.x * radius,
    center.y * radius,
    center.ratio * radius,
    angleBegin,
    angleEnd,
    clockwiseSense(angleBegin, angleEnd),
  );
  context.stroke();
}

export function containsHyperline(
  _from: RenderPoint,
  _to: RenderPoint,
  _position: RenderPoint,
  _epsilon: number,
): false {
  return false;
}

/** Individually importable shape pairs; no runtime string registry is created. */
export const line = { render: renderLine, contains: containsLine };
export const arrow = { render: renderArrow, contains: containsArrow };
export const hyperline = {
  render: renderHyperline,
  contains: containsHyperline,
};
