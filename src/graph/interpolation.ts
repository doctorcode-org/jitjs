import { hexToRgb, rgbToHex } from "../core/util.js";

export type InterpolationPhase = "start" | "end";

export type NumberArrayValue = readonly (
  | number
  | readonly number[]
)[];

export type InterpolatedNumberArray = Array<number | number[]>;

export interface CartesianPoint {
  x: number;
  y: number;
}

export type PolygonValue = CartesianPoint[] & { offset?: number };

export interface PolarPoint {
  theta: number;
  rho: number;
}

export interface PolarInterpolator extends PolarPoint {
  interpolate(from: PolarPoint, delta: number): PolarPoint;
}

export interface ReadableInterpolationPosition {
  getc(simple: true): CartesianPoint;
  getp(simple: true): PolarPoint;
  getp(): PolarInterpolator;
}

export interface WritableInterpolationPosition {
  setc(x: number, y: number): void;
  setp(theta: number, rho: number): void;
}

export interface PositionInterpolationTarget {
  pos: WritableInterpolationPosition;
  startPos: ReadableInterpolationPosition;
  endPos: ReadableInterpolationPosition;
}

export interface MoebiusVector extends CartesianPoint {}

export interface PropertyInterpolationTarget {
  getData<TValue = unknown>(
    property: string,
    phase?: InterpolationPhase,
  ): TValue;
  setData(property: string, value: unknown): void;
  getCanvasStyle<TValue = unknown>(
    property: string,
    phase?: InterpolationPhase,
  ): TValue;
  setCanvasStyle(property: string, value: unknown): void;
  getLabelData<TValue = unknown>(
    property: string,
    phase?: InterpolationPhase,
  ): TValue;
  setLabelData(property: string, value: unknown): void;
}

export interface EdgeInterpolationSource {
  adjacencies: Record<string, PropertyInterpolationTarget>;
}

type PropertyKind = "number" | "color" | "array-number" | "polygon";
type PropertyChannel = "data" | "canvas" | "label";

const DATA_PROPERTIES = [
  "border",
  "color",
  "width",
  "height",
  "dim",
  "alpha",
  "lineWidth",
  "angularWidth",
  "span",
  "valueArray",
  "dimArray",
] as const;

const CANVAS_PROPERTIES = [
  "globalAlpha",
  "fillStyle",
  "strokeStyle",
  "lineWidth",
  "shadowBlur",
  "shadowColor",
  "shadowOffsetX",
  "shadowOffsetY",
  "miterLimit",
] as const;

const LABEL_PROPERTIES = ["size", "color"] as const;

/** Linearly interpolate a scalar value. */
export function interpolateNumber(
  from: number,
  to: number,
  delta: number,
): number {
  return from + (to - from) * delta;
}

/**
 * Interpolate an RGB color while retaining JIT's integer truncation and
 * non-clamping behavior.
 */
export function interpolateColor(
  from: string,
  to: string,
  delta: number,
): string {
  const fromRgb = hexToRgb(from) as readonly [number, number, number];
  const toRgb = hexToRgb(to) as readonly [number, number, number];
  const components: [number, number, number] = [
    Number.parseInt(String(interpolateNumber(fromRgb[0], toRgb[0], delta))),
    Number.parseInt(String(interpolateNumber(fromRgb[1], toRgb[1], delta))),
    Number.parseInt(String(interpolateNumber(fromRgb[2], toRgb[2], delta))),
  ];

  return rgbToHex(components) as string;
}

/** Interpolate the flat or one-level nested numeric arrays used by JIT charts. */
export function interpolateNumberArray(
  from: NumberArrayValue,
  to: NumberArrayValue,
  delta: number,
): InterpolatedNumberArray {
  const current: InterpolatedNumberArray = [];

  for (let index = 0; index < from.length; index += 1) {
    const fromValue = from[index] as number | readonly number[];
    const toValue = to[index] as number | readonly number[];

    // The legacy implementation treats only non-empty nested arrays as
    // arrays. Valid chart data uses non-empty series, so preserve that branch.
    if (Array.isArray(fromValue) && fromValue.length > 0) {
      const nested: number[] = [];
      for (let nestedIndex = 0; nestedIndex < fromValue.length; nestedIndex += 1) {
        nested.push(
          interpolateNumber(
            fromValue[nestedIndex] as number,
            (toValue as readonly number[])[nestedIndex] as number,
            delta,
          ),
        );
      }
      current.push(nested);
    } else {
      current.push(
        interpolateNumber(fromValue as number, toValue as number, delta),
      );
    }
  }

  return current;
}

/**
 * Interpolate polygon vertices while retaining the legacy alignment and
 * unequal-vertex-count rules used by the optional Voronoi treemap.
 */
export function interpolatePolygon(
  fromValue: PolygonValue | 0,
  toValue: PolygonValue,
  delta: number,
): PolygonValue {
  let from = fromValue;
  const to = toValue;

  if (typeof (from as PolygonValue).offset === "undefined") {
    if (from === 0) {
      from = to.map(() => ({ x: 0, y: 0 })) as PolygonValue;
      from.offset = 0;
    } else {
      if (from.length === 0) from.push({ x: 0, y: 0 });
      while (from.length < to.length) from.push(from[0] as CartesianPoint);
      while (from.length > to.length) {
        to.push(to[0] ?? { x: 0, y: 0 });
      }
      if (from.length === 0) return [] as PolygonValue;

      let minimumDistance = 1e300;
      for (let offset = 0; offset < from.length; offset += 1) {
        let distance = 0;
        for (let index = 0; index < from.length; index += 1) {
          const source = from[(offset + index) % from.length] as CartesianPoint;
          const target = to[index] as CartesianPoint;
          const dx = source.x - target.x;
          const dy = source.y - target.y;
          distance += dx * dx + dy * dy;
        }
        if (distance < minimumDistance) {
          from.offset = offset;
          minimumDistance = distance;
        }
      }
    }
  }

  const polygonFrom = from as PolygonValue;
  const current = [] as PolygonValue;
  const offset = polygonFrom.offset as number;
  for (let index = 0; index < polygonFrom.length; index += 1) {
    const source = polygonFrom[
      (index + offset) % polygonFrom.length
    ] as CartesianPoint;
    const target = to[index] as CartesianPoint;
    current.push({
      x: interpolateNumber(source.x, target.x, delta),
      y: interpolateNumber(source.y, target.y, delta),
    });
  }
  return current;
}

/** Interpolate cartesian node positions. */
export function interpolateLinearPosition(
  element: PositionInterpolationTarget,
  delta: number,
): void {
  const from = element.startPos.getc(true);
  const to = element.endPos.getc(true);
  element.pos.setc(
    interpolateNumber(from.x, to.x, delta),
    interpolateNumber(from.y, to.y, delta),
  );
}

/** Interpolate polar node positions with the position type's wrap semantics. */
export function interpolatePolarPosition(
  element: PositionInterpolationTarget,
  delta: number,
): void {
  const from = element.startPos.getp(true);
  const to = element.endPos.getp();
  const current = to.interpolate(from, delta);
  element.pos.setp(current.theta, current.rho);
}

/**
 * Apply the disk translation used by the legacy Hypertree interpolator.
 * The calculation is kept local so importing this module does not patch or
 * depend on the concrete Complex class.
 */
export function interpolateMoebiusPosition(
  element: PositionInterpolationTarget,
  delta: number,
  vector: MoebiusVector,
): void {
  const vectorX = vector.x * -delta;
  const vectorY = vector.y * -delta;

  if (Math.sqrt(vectorX * vectorX + vectorY * vectorY) >= 1) {
    return;
  }

  const from = element.startPos.getc(true);
  const numeratorX = from.x + vectorX;
  const numeratorY = from.y + vectorY;
  const conjugateY = -vectorY;
  const denominatorX = vectorX * from.x - conjugateY * from.y + 1;
  const denominatorY = conjugateY * from.x + vectorX * from.y;
  const denominatorSquared =
    denominatorX * denominatorX + denominatorY * denominatorY;

  element.pos.setc(
    (numeratorX * denominatorX + numeratorY * denominatorY) /
      denominatorSquared,
    (numeratorY * denominatorX - numeratorX * denominatorY) /
      denominatorSquared,
  );
}

function propertyKind(channel: PropertyChannel, property: string): PropertyKind {
  if (channel === "data") {
    switch (property) {
      case "border":
      case "color":
        return "color";
      case "valueArray":
      case "dimArray":
        return "array-number";
      case "vertices":
        return "polygon";
      case "width":
      case "height":
      case "dim":
      case "alpha":
      case "lineWidth":
      case "angularWidth":
      case "span":
        return "number";
      default:
        throw new TypeError(`Unsupported data interpolation property: ${property}`);
    }
  }

  if (channel === "canvas") {
    switch (property) {
      case "fillStyle":
      case "strokeStyle":
      case "shadowColor":
        return "color";
      case "globalAlpha":
      case "lineWidth":
      case "shadowBlur":
      case "shadowOffsetX":
      case "shadowOffsetY":
      case "miterLimit":
        return "number";
      default:
        throw new TypeError(`Unsupported canvas interpolation property: ${property}`);
    }
  }

  switch (property) {
    case "color":
      return "color";
    case "size":
      return "number";
    default:
      throw new TypeError(`Unsupported label interpolation property: ${property}`);
  }
}

function defaultProperties(channel: PropertyChannel): readonly string[] {
  if (channel === "data") return DATA_PROPERTIES;
  if (channel === "canvas") return CANVAS_PROPERTIES;
  return LABEL_PROPERTIES;
}

function getProperty(
  element: PropertyInterpolationTarget,
  channel: PropertyChannel,
  property: string,
  phase: InterpolationPhase,
): unknown {
  if (channel === "data") return element.getData(property, phase);
  if (channel === "canvas") return element.getCanvasStyle(property, phase);
  return element.getLabelData(property, phase);
}

function setProperty(
  element: PropertyInterpolationTarget,
  channel: PropertyChannel,
  property: string,
  value: unknown,
): void {
  if (channel === "data") {
    element.setData(property, value);
  } else if (channel === "canvas") {
    element.setCanvasStyle(property, value);
  } else {
    element.setLabelData(property, value);
  }
}

function interpolateProperty(
  element: PropertyInterpolationTarget,
  channel: PropertyChannel,
  property: string,
  delta: number,
): void {
  const from = getProperty(element, channel, property, "start");
  const to = getProperty(element, channel, property, "end");
  let value: unknown;

  switch (propertyKind(channel, property)) {
    case "number":
      value = interpolateNumber(from as number, to as number, delta);
      break;
    case "color":
      value = interpolateColor(from as string, to as string, delta);
      break;
    case "array-number":
      value = interpolateNumberArray(
        from as NumberArrayValue,
        to as NumberArrayValue,
        delta,
      );
      break;
    case "polygon":
      value = interpolatePolygon(
        from as PolygonValue | 0,
        to as PolygonValue,
        delta,
      );
      break;
  }

  setProperty(element, channel, property, value);
}

function interpolateProperties(
  element: PropertyInterpolationTarget,
  channel: PropertyChannel,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  const selected = properties ?? defaultProperties(channel);
  for (const property of selected) {
    interpolateProperty(element, channel, property, delta);
  }
}

function interpolateEdges(
  node: EdgeInterpolationSource,
  channel: PropertyChannel,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  for (const id in node.adjacencies) {
    interpolateProperties(
      node.adjacencies[id] as PropertyInterpolationTarget,
      channel,
      properties,
      delta,
    );
  }
}

/** Interpolate node data properties such as alpha, color, or dimensions. */
export function interpolateNodeProperties(
  element: PropertyInterpolationTarget,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  interpolateProperties(element, "data", properties, delta);
}

/** Interpolate data properties for every adjacency owned by a node. */
export function interpolateEdgeProperties(
  node: EdgeInterpolationSource,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  interpolateEdges(node, "data", properties, delta);
}

/** Interpolate label properties on a node. */
export function interpolateLabelProperties(
  element: PropertyInterpolationTarget,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  interpolateProperties(element, "label", properties, delta);
}

/** Interpolate Canvas-style properties on a node. */
export function interpolateNodeStyles(
  element: PropertyInterpolationTarget,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  interpolateProperties(element, "canvas", properties, delta);
}

/** Interpolate Canvas-style properties for every adjacency owned by a node. */
export function interpolateEdgeStyles(
  node: EdgeInterpolationSource,
  properties: readonly string[] | undefined,
  delta: number,
): void {
  interpolateEdges(node, "canvas", properties, delta);
}
