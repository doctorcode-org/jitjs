import type {
  Graph,
  GraphNode,
  GraphPosition,
} from "../../graph/graph.js";
import type {
  EdgeData,
  NodeData,
} from "../../types.js";

export type TreemapOrientation = "h" | "v";

/** Cartesian position operations used by every treemap algorithm. */
export interface TreemapPosition extends GraphPosition {
  x: number;
  y: number;
  setc(x: number, y: number): void;
}

export interface TreemapCanvasSize {
  width: number;
  height: number;
}

export interface TreemapLayoutConfig extends Record<string, unknown> {
  orientation?: TreemapOrientation;
  titleHeight?: number;
  offset?: number;
}

export interface ResolvedTreemapLayoutConfig extends TreemapLayoutConfig {
  orientation: TreemapOrientation;
  titleHeight: number;
  offset: number;
}

export interface TreemapCoordinates {
  top: number;
  left: number;
  width: number;
  height: number;
  dim?: number;
}

export type TreemapNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> = GraphNode<TNodeData, TEdgeData, TPosition>;

export type TreemapAreaNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> = TreemapNode<TNodeData, TEdgeData, TPosition> & {
  _area?: number;
};

export interface TreemapLayoutController<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreemapPosition,
> {
  onBeforeCompute(
    root: TreemapNode<TNodeData, TEdgeData, TPosition>,
  ): void;
  onAfterCompute(
    root: TreemapNode<TNodeData, TEdgeData, TPosition>,
  ): void;
}

export interface TreemapLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreemapPosition,
> {
  graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  /** Supplies dimensions without coupling the layout to the canvas package. */
  getSize: () => TreemapCanvasSize;
  config?: TreemapLayoutConfig;
  controller?: TreemapLayoutController<TNodeData, TEdgeData, TPosition>;
  clickedNode?: TreemapNode<TNodeData, TEdgeData, TPosition> | null;
}
