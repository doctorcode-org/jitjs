import { merge } from "../core/util.js";
import {
  Graph,
  type GraphElementConfig,
  type GraphLabelConfig,
  type GraphNodeInput,
  type GraphOptions,
  type GraphPosition,
} from "../graph/graph.js";
import type {
  EdgeData,
  GraphAdjacencyJson,
  GraphJson,
  GraphNodeJson,
  NodeData,
  TreeNodeJson,
} from "../types.js";

export type LoaderJson<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = TreeNodeJson<TNodeData> | GraphJson<TNodeData, TEdgeData>;

export interface GraphConstructionOptions<
  TPosition extends GraphPosition,
> {
  graph?: GraphOptions<TPosition>;
  node?: GraphElementConfig;
  edge?: GraphElementConfig;
  label?: GraphLabelConfig;
}

export interface LabelStore {
  clearLabels(force?: boolean): void;
}

export interface GraphLoaderOptions<
  TPosition extends GraphPosition,
> extends GraphConstructionOptions<TPosition> {
  labels?: LabelStore;
}

function toNodeInput<TNodeData extends NodeData>(
  node: Pick<TreeNodeJson<TNodeData>, "id" | "name" | "data">,
): GraphNodeInput<TNodeData> {
  return {
    id: node.id,
    name: node.name,
    ...(node.data === undefined ? {} : { data: node.data }),
  };
}

function addTree<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  node: TreeNodeJson<TNodeData>,
): void {
  const input = toNodeInput(node);
  graph.addNode(input);
  if (!node.children) {
    return;
  }

  for (const child of node.children) {
    graph.addAdjacence(input, toNodeInput(child));
    addTree(graph, child);
  }
}

function findGraphNode<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  json: GraphJson<TNodeData, TEdgeData>,
  id: string,
): GraphNodeInput<TNodeData> {
  for (const node of json) {
    // Preserve the loose comparison accepted by legacy JavaScript callers.
    if (node.id == id) {
      return toNodeInput(node);
    }
  }

  const generated: GraphNodeInput<TNodeData> = { id, name: id };
  graph.addNode(generated);
  return generated;
}

function adjacencyTarget<TEdgeData extends EdgeData>(
  adjacency: string | GraphAdjacencyJson<TEdgeData>,
): { id: string; data: TEdgeData } {
  if (typeof adjacency === "string") {
    return { id: adjacency, data: {} as TEdgeData };
  }

  return {
    id: adjacency.nodeTo,
    data: merge(adjacency.data || {}, {}) as TEdgeData,
  };
}

/** Convert legacy tree or graph JSON into the isolated graph data model. */
export function constructGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GraphPosition = GraphPosition,
>(
  json: LoaderJson<TNodeData, TEdgeData>,
  options: GraphConstructionOptions<TPosition> = {},
): Graph<TNodeData, TEdgeData, TPosition> {
  const graph = new Graph<TNodeData, TEdgeData, TPosition>(
    options.graph,
    options.node,
    options.edge,
    options.label,
  );

  if (!Array.isArray(json)) {
    addTree(graph, json);
    return graph;
  }

  for (const node of json) {
    const input = toNodeInput(node);
    graph.addNode(input);
    for (const adjacency of node.adjacencies || []) {
      const target = adjacencyTarget(adjacency);
      graph.addAdjacence(input, findGraphNode(graph, json, target.id), target.data);
    }
  }
  return graph;
}

/** Serialize the depth-oriented graph as legacy tree JSON. */
export function graphToTreeJson<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  rootId: string,
): TreeNodeJson<TNodeData> {
  const root = graph.getNode(rootId);
  if (!root) {
    throw new Error(`Unknown graph root: ${rootId}`);
  }

  const serialize = (
    node: typeof root,
  ): TreeNodeJson<TNodeData> => {
    const children: TreeNodeJson<TNodeData>[] = [];
    node.eachSubnode((child) => {
      children.push(serialize(child));
    });
    return {
      id: node.id,
      name: node.name,
      data: node.data,
      children,
    };
  };

  return serialize(root);
}

/** Serialize each undirected edge once, retaining the legacy visited toggle. */
export function graphToGraphJson<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  rootId: string,
): GraphJson<TNodeData, TEdgeData> {
  const root = graph.getNode(rootId);
  if (!root) {
    throw new Error(`Unknown graph root: ${rootId}`);
  }

  const output: GraphJson<TNodeData, TEdgeData> = [];
  const visitedState = Boolean(root.visited);
  graph.eachNode((node) => {
    const adjacencies: GraphAdjacencyJson<TEdgeData>[] = [];
    node.eachAdjacency((adjacency) => {
      if (Boolean(adjacency.nodeTo.visited) === visitedState) {
        adjacencies.push({
          nodeTo: adjacency.nodeTo.id,
          data: adjacency.data,
        });
      }
    });
    output.push({
      id: node.id,
      name: node.name,
      data: node.data,
      adjacencies,
    });
    node.visited = !visitedState;
  });
  return output;
}

/** Stateful composition replacement for the old visualization Loader mixin. */
export class GraphLoader<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GraphPosition = GraphPosition,
> {
  readonly construction: GraphConstructionOptions<TPosition>;
  readonly labels: LabelStore | undefined;
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  graph: Graph<TNodeData, TEdgeData, TPosition> | undefined;
  root: string | undefined;

  constructor(options: GraphLoaderOptions<TPosition> = {}) {
    this.construction = {
      ...(options.graph === undefined ? {} : { graph: options.graph }),
      ...(options.node === undefined ? {} : { node: options.node }),
      ...(options.edge === undefined ? {} : { edge: options.edge }),
      ...(options.label === undefined ? {} : { label: options.label }),
    };
    this.labels = options.labels;
  }

  construct(
    json: LoaderJson<TNodeData, TEdgeData>,
  ): Graph<TNodeData, TEdgeData, TPosition> {
    return constructGraph(json, this.construction);
  }

  loadJSON(json: TreeNodeJson<TNodeData>): void;
  loadJSON(json: GraphJson<TNodeData, TEdgeData>, index?: number): void;
  loadJSON(json: LoaderJson<TNodeData, TEdgeData>, index?: number): void {
    this.json = json;
    this.labels?.clearLabels(true);
    this.graph = this.construct(json);
    this.root = Array.isArray(json)
      ? (json[index ? index : 0] as GraphNodeJson<TNodeData, TEdgeData>).id
      : json.id;
  }

  toJSON(type?: "tree"): TreeNodeJson<TNodeData>;
  toJSON(type: "graph"): GraphJson<TNodeData, TEdgeData>;
  toJSON(
    type: "tree" | "graph" = "tree",
  ): TreeNodeJson<TNodeData> | GraphJson<TNodeData, TEdgeData> {
    if (!this.graph || this.root === undefined) {
      throw new Error("No JSON data has been loaded");
    }
    return type === "tree"
      ? graphToTreeJson(this.graph, this.root)
      : graphToGraphJson(this.graph, this.root);
  }
}
