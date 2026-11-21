import { hexToRgb, map, rgbToHex } from "../core/util.js";
import {
  area,
  centroid,
  offsetConvex,
  pointInPolygon,
  type ComputationalPoint,
} from "../geometry/computational.js";
import type { RenderPoint } from "../graph/rendering/contracts.js";
import type {
  TreemapLeafPredicate,
  TreemapRenderableNode,
  TreemapRendererConfig,
  TreemapRenderingCanvas,
} from "./treemap-renderer-contracts.js";

export interface VoronoiRenderableNode extends TreemapRenderableNode {
  _depth?: number;
  getSubnodes(levels?: number[], flags?: unknown): VoronoiRenderableNode[];
}

export interface VoronoiRendererConfig extends TreemapRendererConfig {
  levelsToShow?: number;
}

export interface VoronoiRendererGraph<TNode extends VoronoiRenderableNode> {
  getNode(id: string): TNode | null | false | undefined;
}

export interface VoronoiHitState<TNode extends VoronoiRenderableNode> {
  graph: VoronoiRendererGraph<TNode>;
  root: string;
  clickedNode?: TNode | null;
}

function polygonContains(
  position: RenderPoint,
  polygon: ComputationalPoint[],
): boolean {
  const result = pointInPolygon([position], polygon);
  return result !== false && Boolean(result[0]);
}

function darkerHalf(color: string): string {
  return rgbToHex(
    map(hexToRgb(color) as readonly number[], (component) =>
      (component * 0.5) >> 0,
    ) as [number, number, number],
  ) as string;
}

export function renderVoronoiPolygonNode<
  TNode extends VoronoiRenderableNode,
>(
  _type: string,
  node: TNode,
  canvas: TreemapRenderingCanvas,
  _animating?: boolean,
  config: VoronoiRendererConfig = {},
  leaf: TreemapLeafPredicate<TNode> = () => false,
): void {
  const vertices = node.getData<ComputationalPoint[]>("vertices");
  if (!vertices || vertices.length === 0) return;
  let points = vertices.slice();
  if (area(points) < 0) points.reverse();
  const context = canvas.getCtx();
  const offset = config.offset ?? 2;
  const titleHeight = config.titleHeight ?? 13;

  if (leaf(node)) {
    context.lineJoin = "bevel";
    if (config.cushion) {
      // The source computes this centroid but shades from the vertex average.
      centroid(points);
      let x = 0;
      let y = 0;
      for (const point of points) {
        x += point.x;
        y += point.y;
      }
      x /= points.length;
      y /= points.length;
      let maximumDistance: number | undefined;
      for (const point of points) {
        const distance = Math.hypot(x - point.x, y - point.y);
        maximumDistance =
          maximumDistance === undefined
            ? distance
            : Math.max(maximumDistance, distance);
      }
      const gradient = context.createRadialGradient(
        x,
        y,
        1,
        x,
        y,
        maximumDistance as number,
      );
      const color = node.getData<string>("color");
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, darkerHalf(color));
      context.fillStyle = gradient;
    }
    context.beginPath();
    context.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index]!.x, points[index]!.y);
    }
    context.closePath();
    context.fill();
    const border = node.getData<unknown>("border");
    if (border) {
      context.save();
      context.strokeStyle = border;
      context.stroke();
      context.restore();
    }
    return;
  }

  if (titleHeight > 0) {
    const inset = offsetConvex(points, -offset * 0.5);
    points = Array.isArray(inset) ? inset : [inset];
    if (points.length === 0) return;
    context.beginPath();
    context.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index]!.x, points[index]!.y);
    }
    context.lineTo(points[0]!.x, points[0]!.y);
    context.closePath();
    context.save();
    context.lineWidth = offset;
    context.stroke();
    context.restore();
  }
}

export function containsVoronoiPolygonNode<
  TNode extends VoronoiRenderableNode,
>(
  node: TNode,
  position: RenderPoint,
  config: VoronoiRendererConfig,
  state: VoronoiHitState<TNode>,
): boolean {
  if (node.ignore || node.getData<number>("alpha") < 1) return false;
  const currentId = state.clickedNode?.id || state.root;
  const current = state.graph.getNode(currentId);
  if (!current) return false;
  const levels = config.levelsToShow ?? 0;
  if (levels) {
    if (
      !(
        (node._depth as number) > (current._depth as number) &&
        (node._depth as number) <= (current._depth as number) + levels
      )
    ) {
      return false;
    }
  } else if ((node._depth as number) <= (current._depth as number)) {
    return false;
  }

  const vertices = node.getData<ComputationalPoint[]>("vertices");
  if (!vertices) return false;
  const isBranchBoundary =
    (levels && (node._depth as number) < (current._depth as number) + levels) ||
    (!levels && node.getSubnodes([1, 1]).length > 0);
  if (isBranchBoundary) {
    const offset = config.offset ?? 2;
    if (offset === 0) return false;
    const inset = offsetConvex(vertices, -offset * 2);
    if (!Array.isArray(inset)) return polygonContains(position, vertices);
    return polygonContains(position, vertices) && !polygonContains(position, inset);
  }
  return polygonContains(position, vertices);
}

export function renderVoronoiNoneNode(): void {}

export function containsVoronoiNoneNode(): false {
  return false;
}
