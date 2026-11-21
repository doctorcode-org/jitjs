import { Complex } from "../core/geometry.js";

/** A mutable two-dimensional point accepted by the legacy geometry helpers. */
export interface ComputationalPoint<TAttached = unknown> {
  x: number;
  y: number;
  attached?: TAttached | undefined;
  area?: unknown;
  __distBase?: [number] | undefined;
}

/** A polygon may carry the site area copied by the Voronoi implementation. */
export type ComputationalPolygon<
  TPoint extends ComputationalPoint = ComputationalPoint,
> = TPoint[] & { area?: unknown };

export type LineEquation = readonly [number, number, number];
export type PointLine<TPoint extends ComputationalPoint = ComputationalPoint> =
  readonly [TPoint, TPoint];

export interface OffsetConnection<
  TPoint extends ComputationalPoint = ComputationalPoint,
> {
  line: PointLine<TPoint>;
  cline: PointLine<TPoint>;
}

/** Squared Euclidean distance between two points. */
export function dist2(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
export function dist(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
): number {
  return Math.sqrt(dist2(point1, point2));
}

/** Linear interpolation using the legacy, unclamped weight convention. */
export function weightedPoint(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
  weight: number,
): Complex {
  return new Complex(
    (point2.x - point1.x) * weight + point1.x,
    (point2.y - point1.y) * weight + point1.y,
  );
}

/** Recover a point's weight using only its x coordinate. */
export function weightOfPoint(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
  point3: ComputationalPoint,
): number {
  return (point3.x - point1.x) / (point2.x - point1.x);
}

/**
 * Test one or more points against a polygon.
 *
 * The legacy API returns `false` for a degenerate polygon, but returns a
 * boolean array even when the input is a single point.
 */
export function pointInPolygon(
  points: ComputationalPoint | readonly ComputationalPoint[],
  polygon: readonly ComputationalPoint[],
): false | boolean[] {
  if (polygon.length < 3) {
    return false;
  }

  // Keep the original instanceof behavior rather than broadening it to every
  // array-like value.
  const pointList = points instanceof Array ? points : [points];
  const conjugates = pointList.map(() => 0);

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index] as ComputationalPoint;
    const stop = (polygon[index + 1] || polygon[0]) as ComputationalPoint;
    for (let pointIndex = 0; pointIndex < pointList.length; pointIndex += 1) {
      const position = pointList[pointIndex] as ComputationalPoint;
      if (
        (start.y >= position.y && stop.y < position.y) ||
        (start.y <= position.y && stop.y > position.y)
      ) {
        const inverseSlope = (stop.x - start.x) / (stop.y - start.y);
        const crossingX =
          (position.y - start.y) * inverseSlope + start.x;
        if (crossingX === position.x) {
          continue;
        }
        if (crossingX > position.x) {
          conjugates[pointIndex] =
            (conjugates[pointIndex] as number) + 1;
        }
      }
    }
  }

  return conjugates.map((count) => count % 2 !== 0);
}

/** Signed cross product; counter-clockwise turns are positive. */
export function cross(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
  point3: ComputationalPoint,
): number {
  return (
    (point2.x - point1.x) * (point3.y - point1.y) -
    (point2.y - point1.y) * (point3.x - point1.x)
  );
}

/** Clip a convex polygon to the left side of a directed line. */
export function convexCut<TAttached = unknown>(
  convex: readonly ComputationalPoint<TAttached>[],
  line: PointLine,
  attached?: TAttached,
): ComputationalPoint<TAttached>[] {
  if (convex.length < 3) {
    return [];
  }

  const result: ComputationalPoint<TAttached>[] = [];
  for (let index = 0; index < convex.length; index += 1) {
    const start = convex[index] as ComputationalPoint<TAttached>;
    const stop = (convex[index + 1] || convex[0]) as ComputationalPoint<TAttached>;
    if (start.x === stop.x && start.y === stop.y) {
      continue;
    }

    const startCross = cross(line[0], line[1], start);
    let stopCross: number;
    if (startCross > 0) {
      stopCross = cross(line[0], line[1], stop);
      if (stopCross >= 0) {
        result.push(stop);
      } else if (startCross - stopCross !== 0) {
        const scale = startCross / (startCross - stopCross);
        const cut = new Complex(
          (stop.x - start.x) * scale + start.x,
          (stop.y - start.y) * scale + start.y,
        ) as Complex & ComputationalPoint<TAttached>;
        cut.attached = attached;
        result.push(cut);
      }
    } else {
      stopCross = cross(line[0], line[1], stop);
      if (stopCross > 0) {
        const scale = startCross / (startCross - stopCross);
        const cut = new Complex(
          (stop.x - start.x) * scale + start.x,
          (stop.y - start.y) * scale + start.y,
        ) as Complex & ComputationalPoint<TAttached>;
        cut.attached = start.attached;
        result.push(cut);
        result.push(stop);
      } else if (stopCross === 0 && startCross !== 0) {
        result.push(stop);
      }
    }
  }
  return result;
}

/** Signed polygon area. */
export function area(polygon: readonly ComputationalPoint[]): number {
  if (polygon.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let index = 2; index < polygon.length; index += 1) {
    sum += cross(
      polygon[0] as ComputationalPoint,
      polygon[index - 1] as ComputationalPoint,
      polygon[index] as ComputationalPoint,
    );
  }
  return sum * 0.5;
}

/**
 * Length of consecutive polygon edges.
 *
 * The original implementation intentionally does not close the final edge.
 */
export function circum(polygon: readonly ComputationalPoint[]): number {
  let circumference = 0;
  for (let index = 1; index < polygon.length; index += 1) {
    const current = polygon[index] as ComputationalPoint;
    const previous = polygon[index - 1] as ComputationalPoint;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    circumference += Math.sqrt(dx * dx + dy * dy);
  }
  return circumference;
}

/** Intersect two convex polygons with repeated half-plane clipping. */
export function convexIntersect<TAttached = unknown>(
  convex1: ComputationalPoint<TAttached>[],
  convex2: ComputationalPoint<TAttached>[],
): ComputationalPoint<TAttached>[] {
  if (convex1.length < 3 || convex2.length < 3) {
    return [];
  }
  if (area(convex1) < 0) {
    convex1.reverse();
  }
  if (area(convex2) < 0) {
    convex2.reverse();
  }

  let result = convex1;
  for (let index = 0; index < convex2.length; index += 1) {
    const start = convex2[index] as ComputationalPoint<TAttached>;
    const stop = (convex2[index + 1] || convex2[0]) as ComputationalPoint<TAttached>;
    result = convexCut(result, [start, stop]);
  }
  return result;
}

/** Perpendicular-bisector line equation for two points. */
export function bisector(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
): [number, number, number] {
  return [
    2 * (point2.x - point1.x),
    2 * (point2.y - point1.y),
    -(
      point2.x * point2.x -
      point1.x * point1.x +
      point2.y * point2.y -
      point1.y * point1.y
    ),
  ];
}

/** Intersect two infinite lines expressed as `ax + by + c = 0`. */
export function intersection(
  line1: LineEquation,
  line2: LineEquation,
): LineEquation | Complex | null {
  const determinant = line1[0] * line2[1] - line1[1] * line2[0];
  if (determinant === 0) {
    if (line1[0] * line2[2] - line1[2] * line2[0] === 0) {
      return line1;
    }
    return null;
  }
  return new Complex(
    -(line1[2] * line2[1] - line1[1] * line2[2]) / determinant,
    -(line1[0] * line2[2] - line1[2] * line2[0]) / determinant,
  );
}

/** Axis-aligned extent as `[left, top, right, bottom]`. */
export function getExtent(
  bound: readonly ComputationalPoint[],
): [number, number, number, number] {
  if (!bound[0]) {
    return [0, 0, 0, 0];
  }
  let left = bound[0].x;
  let top = bound[0].y;
  let right = left;
  let bottom = top;
  for (const point of bound) {
    if (left > point.x) left = point.x;
    if (top > point.y) top = point.y;
    if (right < point.x) right = point.x;
    if (bottom < point.y) bottom = point.y;
  }
  return [left, top, right, bottom];
}

/** Offset a directed line to its left. */
export function offsetLine(
  line: PointLine,
  offset: number,
): [Complex, Complex] {
  let dx = line[1].x - line[0].x;
  let dy = line[1].y - line[0].y;
  let radius = dx * dx + dy * dy;
  radius = Math.sqrt(radius);
  radius = offset / radius;
  dx *= radius;
  dy *= radius;
  return [
    new Complex(line[0].x - dy, line[0].y + dx),
    new Complex(line[1].x - dy, line[1].y + dx),
  ];
}

/** Intersect two lines, optionally constraining both to their segments. */
export function intersectionSeg(
  line1: PointLine,
  line2: PointLine,
  constraint?: boolean,
): Complex | null {
  const cross1 = cross(line1[0], line2[0], line2[1]);
  const cross2 = cross(line1[1], line2[0], line2[1]);
  if (cross1 === cross2) {
    return null;
  }
  const weight = cross1 / (cross1 - cross2);
  if (constraint) {
    if (weight < 0 || weight > 1) {
      return null;
    }
    const cross3 = cross(line2[0], line1[0], line1[1]);
    const cross4 = cross(line2[1], line1[0], line1[1]);
    if (cross3 === cross4) {
      return null;
    }
    const weight2 = cross3 / (cross3 - cross4);
    if (weight2 < 0 || weight2 > 1) {
      return null;
    }
  }
  return weightedPoint(line1[0], line1[1], weight);
}

/** Legacy triangle centroid, including its truncated one-third constant. */
export function centroid3(
  triangle: readonly [ComputationalPoint, ComputationalPoint, ComputationalPoint],
): Complex {
  return new Complex(
    (triangle[0].x + triangle[1].x + triangle[2].x) * 0.333333333333,
    (triangle[0].y + triangle[1].y + triangle[2].y) * 0.333333333333,
  );
}

/** Area-weighted centroid of a polygon fan. */
export function centroid<TPoint extends ComputationalPoint>(
  convex: readonly TPoint[] & { area?: unknown },
): TPoint | (Complex & { area?: unknown }) {
  if (convex.length === 1) {
    return convex[0] as TPoint;
  }
  const sum = new Complex(0, 0) as Complex & { area?: unknown };
  let total = 0;
  if (convex.area) {
    sum.area = convex.area;
  }
  for (let index = 2; index < convex.length; index += 1) {
    const triangle = [
      convex[0] as TPoint,
      convex[index - 1] as TPoint,
      convex[index] as TPoint,
    ] as const;
    const triangleArea = area(triangle);
    if (Math.abs(triangleArea) > 1e-5) {
      const triangleCentroid = centroid3(triangle);
      total += triangleArea;
      sum.x += triangleArea * triangleCentroid.x;
      sum.y += triangleArea * triangleCentroid.y;
    }
  }
  total = 1 / total;
  sum.x *= total;
  sum.y *= total;
  return sum;
}

/** Whether an offset connection reverses direction; returns legacy `0 | 1`. */
export function inverse(connection: OffsetConnection): number {
  const dx = connection.line[1].x - connection.line[0].x;
  const connectedDx = connection.cline[1].x - connection.cline[0].x;
  if (dx === connectedDx && dx === 0) {
    const dy = connection.line[1].y - connection.line[0].y;
    const connectedDy = connection.cline[1].y - connection.cline[0].y;
    return Number((dy > 0) !== (connectedDy > 0));
  }
  return Number((dx > 0) !== (connectedDx > 0));
}

interface OffsetLink {
  line: [Complex, Complex];
  cline: [Complex | null | -1, Complex | null | -1];
  prev?: OffsetLink | null;
  next?: OffsetLink | null;
}

/** Offset all edges of a convex polygon and reconnect adjacent lines. */
export function offsetConvex(
  convex: ComputationalPoint[],
  offset: number,
): ComputationalPoint[] | ComputationalPoint {
  if (convex.length < 3) {
    return [];
  }
  if (area(convex) < 0) {
    convex.reverse();
  }

  let lastLine: OffsetLink | null = null;
  let firstLine: OffsetLink | null = null;
  let count = 0;
  for (let index = 0; index < convex.length; index += 1) {
    const start = convex[index] as ComputationalPoint;
    const stop = (convex[index + 1] || convex[0]) as ComputationalPoint;
    if (start.x === stop.x && start.y === stop.y) {
      continue;
    }
    const line: OffsetLink = {
      line: offsetLine([start, stop], -offset),
      cline: [-1, -1],
      prev: lastLine,
    };
    if (lastLine) {
      lastLine.next = line;
    } else {
      firstLine = line;
    }
    lastLine = line;
    count += 1;
  }

  // These assertions intentionally preserve the original failure for a
  // polygon made entirely from coincident points: linking happens before the
  // edge-count guard.
  (lastLine as OffsetLink).next = firstLine;
  (firstLine as OffsetLink).prev = lastLine;
  if (count < 3) {
    return [];
  }

  let start = firstLine as OffsetLink;
  let stop = start.next as OffsetLink;
  while (true) {
    const crossing = intersectionSeg(start.line, stop.line);
    stop.cline[0] = crossing;
    start.cline[1] = crossing;
    if (stop === firstLine) {
      break;
    }
    start = stop;
    stop = stop.next as OffsetLink;
  }

  const result: ComputationalPoint[] = [
    (firstLine as OffsetLink).cline[1] as ComputationalPoint,
  ];
  for (
    start = (firstLine as OffsetLink).next as OffsetLink;
    start !== firstLine;
    start = start.next as OffsetLink
  ) {
    result.push(start.cline[1] as ComputationalPoint);
  }
  return offset < 0 ? cleanConvexHull(result) : result;
}

/** Remove loops from an inward-offset hull. */
export function cleanConvexHull(
  convex: ComputationalPoint[],
): ComputationalPoint[] | ComputationalPoint {
  let last = convex[0] as ComputationalPoint;
  const stack: ComputationalPoint[] = [last];
  const found: ComputationalPoint[][] = [];
  for (let index = 1; index <= convex.length; index += 1) {
    const current = (convex[index] || convex[0]) as ComputationalPoint;
    for (let stackIndex = stack.length - 1; stackIndex > 0; stackIndex -= 1) {
      const point1 = stack[stackIndex] as ComputationalPoint;
      const point2 = stack[stackIndex - 1] as ComputationalPoint;
      const crossing = intersectionSeg(
        [last, current],
        [point1, point2],
        true,
      );
      if (crossing) {
        const polygon: ComputationalPoint[] = [
          crossing as ComputationalPoint,
          ...stack.slice(stackIndex),
        ];
        if (area(polygon) > 0) {
          found.push(polygon);
        }
        stack.length = stackIndex;
        stack.push(crossing);
      }
    }
    stack.push(current);
    last = current;
  }
  if (area(stack)) {
    found.push(stack);
  }
  return found[0] || centroid(convex);
}

/** Uniform random point in a triangle using the legacy reflection method. */
export function randPointInTriangle(
  triangle: readonly [ComputationalPoint, ComputationalPoint, ComputationalPoint],
): Complex {
  let x = Math.random();
  let y = Math.random();
  if (x + y > 1) {
    x = 1 - x;
    y = 1 - y;
  }
  const dx1 = triangle[1].x - triangle[0].x;
  const dy1 = triangle[1].y - triangle[0].y;
  const dx2 = triangle[2].x - triangle[0].x;
  const dy2 = triangle[2].y - triangle[0].y;
  return new Complex(
    triangle[0].x + dx1 * x + dx2 * y,
    triangle[0].y + dy1 * x + dy2 * y,
  );
}

/** Random point in a polygon fan with the original non-cumulative odds. */
export function randPointInPolygon(
  polygon: readonly ComputationalPoint[],
): ComputationalPoint {
  let argument = Math.random();
  if (polygon.length === 1) {
    return polygon[0] as ComputationalPoint;
  }
  if (polygon.length === 2) {
    return new Complex(
      (polygon[0] as ComputationalPoint).x +
        argument *
          ((polygon[1] as ComputationalPoint).x -
            (polygon[0] as ComputationalPoint).x),
      (polygon[0] as ComputationalPoint).y +
        argument *
          ((polygon[1] as ComputationalPoint).y -
            (polygon[0] as ComputationalPoint).y),
    );
  }

  const odds: number[] = [];
  let totalArea = 0;
  for (let index = 2; index < polygon.length; index += 1) {
    const triangleArea = cross(
      polygon[0] as ComputationalPoint,
      polygon[index - 1] as ComputationalPoint,
      polygon[index] as ComputationalPoint,
    );
    totalArea += triangleArea;
    odds.push(triangleArea);
  }
  odds.forEach((odd, index) => {
    odds[index] = odd / totalArea;
  });
  for (let index = 0; index < polygon.length - 2; index += 1) {
    if (argument < (odds[index] as number)) {
      return randPointInTriangle([
        polygon[0] as ComputationalPoint,
        polygon[index + 1] as ComputationalPoint,
        polygon[index + 2] as ComputationalPoint,
      ]);
    }
    argument -= odds[index] as number;
  }
  return randPointInTriangle([
    polygon[0] as ComputationalPoint,
    polygon[polygon.length - 2] as ComputationalPoint,
    polygon[polygon.length - 1] as ComputationalPoint,
  ]);
}

/** Comparator factory used by the legacy Graham-scan hull. */
export function polarComparator<TPoint extends ComputationalPoint>(
  base: TPoint,
): (point: TPoint, other: TPoint) => number {
  return (point, other) => {
    if (point === base) {
      return -1;
    }
    if (other === base) {
      return 1;
    }
    const crossMagnitude = cross(base, point, other);
    if (crossMagnitude === 0) {
      if (!point.__distBase) {
        const dx = base.x - point.x;
        const dy = base.y - point.y;
        point.__distBase = [dx * dx + dy * dy];
      }
      if (!other.__distBase) {
        const dx = base.x - other.x;
        const dy = base.y - other.y;
        other.__distBase = [dx * dx + dy * dy];
      }
      if (point.__distBase[0] < other.__distBase[0]) {
        return -1;
      }
      if (point.__distBase[0] === other.__distBase[0]) {
        return 0;
      }
      return 1;
    }
    if (crossMagnitude > 0) {
      return -1;
    }
    if (crossMagnitude < 0) {
      return 1;
    }
    // JavaScript's Array#sort treats the original undefined fallthrough as 0.
    return 0;
  };
}

/** Convex hull using the mutating Graham scan from the optional geometry API. */
export function convexHull<TPoint extends ComputationalPoint>(
  sites: TPoint[],
): TPoint[] {
  const count = sites.length;
  for (let index = 1; index < count; index += 1) {
    const site = sites[index] as TPoint;
    const first = sites[0] as TPoint;
    if (site.y < first.y || (site.y === first.y && site.x < first.x)) {
      sites[index] = first;
      sites[0] = site;
    }
  }
  const base = sites[0] as TPoint;
  sites.sort(polarComparator(base));
  const result = [sites[0], sites[1]] as TPoint[];
  for (let index = 2; index < count; index += 1) {
    const site = sites[index] as TPoint;
    while (
      result.length > 0 &&
      cross(
        result[result.length - 2] as TPoint,
        result[result.length - 1] as TPoint,
        site,
      ) <= 0
    ) {
      result.pop();
    }
    result.push(site);
  }
  return result;
}

/** Circumcenter of a triangle. */
export function circumcenter(
  triangle: readonly [ComputationalPoint, ComputationalPoint, ComputationalPoint],
): Complex {
  const bx = triangle[1].x - triangle[0].x;
  const by = triangle[1].y - triangle[0].y;
  const squaredB = bx * bx + by * by;
  const cx = triangle[2].x - triangle[0].x;
  const cy = triangle[2].y - triangle[0].y;
  const squaredC = cx * cx + cy * cy;
  const divisor = 2 * (bx * cy - by * cx);
  const x = cy * squaredB - by * squaredC;
  const y = bx * squaredC - cx * squaredB;
  return new Complex(
    x / divisor + triangle[0].x,
    y / divisor + triangle[0].y,
  );
}

export type HyperbolaBranches = readonly [
  (x: number) => number,
  (x: number) => number,
];

/**
 * Return the unfinished legacy hyperbola branches.
 *
 * Vertical inputs work; invoking either non-vertical branch preserves the
 * source's unresolved `x1` reference as a deterministic ReferenceError.
 */
export function hyperbola(
  point1: ComputationalPoint,
  point2: ComputationalPoint,
): HyperbolaBranches {
  if (point1.x === point2.x) {
    const middleY = (point1.y + point2.y) * 0.5;
    return [() => middleY, () => middleY];
  }

  return [
    () => {
      throw new ReferenceError("x1 is not defined");
    },
    () => {
      throw new ReferenceError("x1 is not defined");
    },
  ];
}

/** Naive Voronoi tessellation clipped to a convex boundary. */
export function voronoi<
  TAttached = number[],
  TPoint extends ComputationalPoint<TAttached> = ComputationalPoint<TAttached>,
>(
  vertices: readonly TPoint[],
  boundary: readonly ComputationalPoint<TAttached>[],
): Array<ComputationalPolygon<ComputationalPoint<TAttached>>> {
  const polygons = vertices.map(
    () => boundary.slice() as ComputationalPolygon<ComputationalPoint<TAttached>>,
  );
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index] as TPoint;
    for (let otherIndex = index + 1; otherIndex < vertices.length; otherIndex += 1) {
      const other = vertices[otherIndex] as TPoint;
      const dx = other.x - vertex.x;
      const dy = other.y - vertex.y;
      const middle = new Complex(
        (vertex.x + other.x) * 0.5,
        (vertex.y + other.y) * 0.5,
      );
      const perpendicular = new Complex(middle.x + dy, middle.y - dx);
      polygons[index] = convexCut(
        polygons[index] as ComputationalPoint<TAttached>[],
        [perpendicular, middle],
        [otherIndex] as TAttached,
      ) as ComputationalPolygon<ComputationalPoint<TAttached>>;
      polygons[otherIndex] = convexCut(
        polygons[otherIndex] as ComputationalPoint<TAttached>[],
        [middle, perpendicular],
        [index] as TAttached,
      ) as ComputationalPolygon<ComputationalPoint<TAttached>>;
    }
    (polygons[index] as ComputationalPolygon).area = vertex.area;
  }
  return polygons;
}
