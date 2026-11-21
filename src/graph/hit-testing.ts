export interface Point2D {
  x: number;
  y: number;
}

export function containsNone(..._arguments: unknown[]): false {
  return false;
}

export function containsCircle(
  center: Point2D,
  point: Point2D,
  radius: number,
): boolean {
  const differenceX = center.x - point.x;
  const differenceY = center.y - point.y;
  return (
    differenceX * differenceX + differenceY * differenceY <= radius * radius
  );
}

export function containsEllipse(
  center: Point2D,
  point: Point2D,
  width: number,
  height: number,
): boolean {
  let radius: number;
  let scaleX = 1;
  let scaleY = 1;

  if (width > height) {
    radius = width / 2;
    scaleY = height / width;
  } else {
    radius = height / 2;
    scaleX = width / height;
  }

  const differenceX = (center.x - point.x) * (1 / scaleX);
  const differenceY = (center.y - point.y) * (1 / scaleY);
  return (
    differenceX * differenceX + differenceY * differenceY <= radius * radius
  );
}

export function containsSquare(
  center: Point2D,
  point: Point2D,
  halfSize: number,
): boolean {
  return (
    Math.abs(point.x - center.x) <= halfSize &&
    Math.abs(point.y - center.y) <= halfSize
  );
}

export function containsRectangle(
  center: Point2D,
  point: Point2D,
  width: number,
  height: number,
): boolean {
  return (
    Math.abs(point.x - center.x) <= width / 2 &&
    Math.abs(point.y - center.y) <= height / 2
  );
}

/** JIT 2.0.1 approximates triangle hit-testing with its circumscribed circle. */
export function containsTriangle(
  center: Point2D,
  point: Point2D,
  halfSize: number,
): boolean {
  return containsCircle(center, point, halfSize);
}

/** JIT 2.0.1 approximates star hit-testing with its outer circle. */
export function containsStar(
  center: Point2D,
  point: Point2D,
  radius: number,
): boolean {
  return containsCircle(center, point, radius);
}

/**
 * Legacy line hit-testing: the point must first be inside the exact segment
 * bounding box, then its vertical distance from the line is compared.
 */
export function containsLine(
  from: Point2D,
  to: Point2D,
  point: Point2D,
  epsilon: number,
): boolean {
  const minimumX = Math.min(from.x, to.x);
  const maximumX = Math.max(from.x, to.x);
  const minimumY = Math.min(from.y, to.y);
  const maximumY = Math.max(from.y, to.y);

  if (
    point.x < minimumX ||
    point.x > maximumX ||
    point.y < minimumY ||
    point.y > maximumY
  ) {
    return false;
  }
  if (Math.abs(to.x - from.x) <= epsilon) {
    return true;
  }

  const lineY =
    ((to.y - from.y) / (to.x - from.x)) * (point.x - from.x) + from.y;
  return Math.abs(lineY - point.y) <= epsilon;
}

export function containsArrow(
  from: Point2D,
  to: Point2D,
  point: Point2D,
  epsilon: number,
): boolean {
  return containsLine(from, to, point, epsilon);
}

export function containsHyperline(
  _from: Point2D,
  _to: Point2D,
  _point: Point2D,
  _epsilon: number,
): false {
  return false;
}
