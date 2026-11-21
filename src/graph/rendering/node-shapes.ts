import type {
  RenderMode,
  RenderingCanvas,
  RenderingContext2DLike,
  RenderPoint,
} from "./contracts.js";

function paintPath(context: RenderingContext2DLike, mode: RenderMode): void {
  if (mode === "fill") {
    context.fill();
  } else {
    context.stroke();
  }
}

export function renderNone(
  _mode: RenderMode,
  _position: RenderPoint,
  _dimension: number,
  _canvas: RenderingCanvas,
): void {}

export function containsNone(
  _nodePosition: RenderPoint,
  _position: RenderPoint,
  _dimension: number,
): false {
  return false;
}

export function renderCircle(
  mode: RenderMode,
  position: RenderPoint,
  radius: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, Math.PI * 2, true);
  context.closePath();
  paintPath(context, mode);
}

export function containsCircle(
  nodePosition: RenderPoint,
  position: RenderPoint,
  radius: number,
): boolean {
  const differenceX = nodePosition.x - position.x;
  const differenceY = nodePosition.y - position.y;
  const squaredDistance =
    differenceX * differenceX + differenceY * differenceY;
  return squaredDistance <= radius * radius;
}

export function renderEllipse(
  mode: RenderMode,
  position: RenderPoint,
  width: number,
  height: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  let scaleX = 1;
  let scaleY = 1;
  let positionScaleX = 1;
  let positionScaleY = 1;
  let radius = 0;

  if (width > height) {
    radius = width / 2;
    scaleY = height / width;
    positionScaleY = width / height;
  } else {
    radius = height / 2;
    scaleX = width / height;
    positionScaleX = height / width;
  }

  context.save();
  context.scale(scaleX, scaleY);
  context.beginPath();
  context.arc(
    position.x * positionScaleX,
    position.y * positionScaleY,
    radius,
    0,
    Math.PI * 2,
    true,
  );
  context.closePath();
  paintPath(context, mode);
  context.restore();
}

export function containsEllipse(
  nodePosition: RenderPoint,
  position: RenderPoint,
  width: number,
  height: number,
): boolean {
  let radius = 0;
  let scaleX = 1;
  let scaleY = 1;

  if (width > height) {
    radius = width / 2;
    scaleY = height / width;
  } else {
    radius = height / 2;
    scaleX = width / height;
  }

  const differenceX = (nodePosition.x - position.x) * (1 / scaleX);
  const differenceY = (nodePosition.y - position.y) * (1 / scaleY);
  const squaredDistance =
    differenceX * differenceX + differenceY * differenceY;
  return squaredDistance <= radius * radius;
}

export function renderSquare(
  mode: RenderMode,
  position: RenderPoint,
  dimension: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  const x = position.x - dimension;
  const y = position.y - dimension;
  const size = 2 * dimension;
  if (mode === "fill") {
    context.fillRect(x, y, size, size);
  } else {
    context.strokeRect(x, y, size, size);
  }
}

export function containsSquare(
  nodePosition: RenderPoint,
  position: RenderPoint,
  dimension: number,
): boolean {
  return (
    Math.abs(position.x - nodePosition.x) <= dimension &&
    Math.abs(position.y - nodePosition.y) <= dimension
  );
}

export function renderRectangle(
  mode: RenderMode,
  position: RenderPoint,
  width: number,
  height: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  const x = position.x - width / 2;
  const y = position.y - height / 2;
  if (mode === "fill") {
    context.fillRect(x, y, width, height);
  } else {
    context.strokeRect(x, y, width, height);
  }
}

export function containsRectangle(
  nodePosition: RenderPoint,
  position: RenderPoint,
  width: number,
  height: number,
): boolean {
  return (
    Math.abs(position.x - nodePosition.x) <= width / 2 &&
    Math.abs(position.y - nodePosition.y) <= height / 2
  );
}

export function renderTriangle(
  mode: RenderMode,
  position: RenderPoint,
  dimension: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  const firstX = position.x;
  const firstY = position.y - dimension;
  const secondX = firstX - dimension;
  const secondY = position.y + dimension;
  const thirdX = firstX + dimension;

  context.beginPath();
  context.moveTo(firstX, firstY);
  context.lineTo(secondX, secondY);
  context.lineTo(thirdX, secondY);
  context.closePath();
  paintPath(context, mode);
}

export function containsTriangle(
  nodePosition: RenderPoint,
  position: RenderPoint,
  dimension: number,
): boolean {
  return containsCircle(nodePosition, position, dimension);
}

export function renderStar(
  mode: RenderMode,
  position: RenderPoint,
  dimension: number,
  canvas: RenderingCanvas,
): void {
  const context = canvas.getCtx();
  const fifthPi = Math.PI / 5;

  context.save();
  context.translate(position.x, position.y);
  context.beginPath();
  context.moveTo(dimension, 0);
  for (let index = 0; index < 9; index += 1) {
    context.rotate(fifthPi);
    if (index % 2 === 0) {
      context.lineTo((dimension / 0.525731) * 0.200811, 0);
    } else {
      context.lineTo(dimension, 0);
    }
  }
  context.closePath();
  paintPath(context, mode);
  context.restore();
}

export function containsStar(
  nodePosition: RenderPoint,
  position: RenderPoint,
  dimension: number,
): boolean {
  return containsCircle(nodePosition, position, dimension);
}

/** Individually importable shape pairs; no runtime string registry is created. */
export const none = { render: renderNone, contains: containsNone };
export const circle = { render: renderCircle, contains: containsCircle };
export const ellipse = { render: renderEllipse, contains: containsEllipse };
export const square = { render: renderSquare, contains: containsSquare };
export const rectangle = {
  render: renderRectangle,
  contains: containsRectangle,
};
export const triangle = { render: renderTriangle, contains: containsTriangle };
export const star = { render: renderStar, contains: containsStar };
