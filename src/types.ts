export type DataValue = unknown;

export type NodeData = Record<string, DataValue>;

export type EdgeData = Record<string, DataValue>;

export interface TreeNodeJson<TData extends NodeData = NodeData> {
  id: string;
  name: string;
  data?: TData;
  children?: TreeNodeJson<TData>[];
}

export interface GraphAdjacencyJson<TEdgeData extends EdgeData = EdgeData> {
  nodeTo: string;
  data?: TEdgeData;
}

export interface GraphNodeJson<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> {
  id: string;
  name: string;
  data?: TNodeData;
  adjacencies?: Array<string | GraphAdjacencyJson<TEdgeData>>;
}

export type GraphJson<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = Array<GraphNodeJson<TNodeData, TEdgeData>>;

export type PositionPhase = "current" | "start" | "end";

export type LabelType = "HTML" | "SVG" | "Native";
