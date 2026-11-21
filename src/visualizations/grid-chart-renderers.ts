import { containsArrow, containsLine, renderArrow, renderLine } from "../graph/rendering/edge-shapes.js";
import { containsRectangle, renderRectangle } from "../graph/rendering/node-shapes.js";
import type { RenderingCanvas, RenderPoint } from "../graph/rendering/contracts.js";

export interface GridChartNode {
  id: string;
  pos: { getc(simple: true): RenderPoint };
  getData<TValue = unknown>(property: string): TValue;
}

export interface GridChartEdge<TNode extends GridChartNode = GridChartNode> {
  nodeFrom: TNode;
  nodeTo: TNode;
  data: { $direction?: readonly string[] };
  getData<TValue = unknown>(property: string): TValue;
}

export interface GridChartRenderConfig {
  nodeOffsetWidth: number;
  nodeOffsetHeight: number;
  edgeEpsilon?: number;
}

function centered(node: GridChartNode): RenderPoint {
  const position = node.pos.getc(true);
  return {
    x: position.x + node.getData<number>("width") / 2,
    y: position.y + node.getData<number>("height") / 2,
  };
}

export function renderGridChartRectangleNode(
  node: GridChartNode,
  canvas: RenderingCanvas,
  config: GridChartRenderConfig,
): void {
  renderRectangle(
    "fill",
    centered(node),
    node.getData<number>("width") - config.nodeOffsetWidth,
    node.getData<number>("height") - config.nodeOffsetHeight,
    canvas,
  );
}

/** Hit testing deliberately ignores visual offsets, matching JIT 2.0.1. */
export function containsGridChartRectangleNode(
  node: GridChartNode,
  position: RenderPoint,
): boolean {
  return containsRectangle(
    centered(node),
    position,
    node.getData<number>("width"),
    node.getData<number>("height"),
  );
}

export function renderGridChartLineEdge(
  edge: GridChartEdge,
  canvas: RenderingCanvas,
): void {
  renderLine(centered(edge.nodeFrom), centered(edge.nodeTo), canvas);
}

export function containsGridChartLineEdge(
  edge: GridChartEdge,
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

export function renderGridChartArrowEdge(
  edge: GridChartEdge,
  canvas: RenderingCanvas,
): void {
  const direction = edge.data.$direction;
  const inverted = Boolean(
    direction && direction.length > 1 && direction[0] != edge.nodeFrom.id,
  );
  renderArrow(
    centered(edge.nodeFrom),
    centered(edge.nodeTo),
    edge.getData<number>("dim"),
    inverted,
    canvas,
  );
}

export function containsGridChartArrowEdge(
  edge: GridChartEdge,
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
