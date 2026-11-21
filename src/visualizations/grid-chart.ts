import { Complex } from "../core/geometry.js";
import {
  Graph,
  type GraphAdjacency,
  type GraphElementConfig,
  type GraphLabelConfig,
  type GraphNode,
} from "../graph/graph.js";
import { plotGraph, type PlotGraphOptions } from "../graph/plotting.js";
import {
  renderEdgeElement,
  renderNodeElement,
  type ElementRenderCanvas,
  type ElementRenderContext,
} from "../graph/rendering/elements.js";
import { GridLayout, type GridLayoutConfig } from "../layouts/grid.js";
import {
  constructGraph,
  graphToGraphJson,
  graphToTreeJson,
  type LoaderJson,
} from "../loader/loader.js";
import type { EdgeData, GraphJson, NodeData, PositionPhase, TreeNodeJson } from "../types.js";

export type GridChartVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex>;

export type GridChartVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Complex>;

export interface GridChartVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface GridChartVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels?(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface GridChartVisualizationConfig<TNode, TEdge>
  extends GridLayoutConfig,
    PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  nodeOffsetWidth: number;
  nodeOffsetHeight: number;
  colors: readonly string[];
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(): void;
  onAfterCompute(): void;
}

export type GridChartNodeRenderer<TNode, TCanvas, TConfig> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  config: TConfig,
  animating?: boolean,
) => void;

export type GridChartEdgeRenderer<TEdge, TCanvas, TConfig> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  config: TConfig,
  animating?: boolean,
) => void;

export interface GridChartVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends GridChartVisualizationCanvas<TContext>,
  TConfig extends GridChartVisualizationConfig<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    GridChartVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: GridChartVisualizationLabels<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: GridChartNodeRenderer<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderEdge: GridChartEdgeRenderer<
    GridChartVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
}

export class GridChartVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends GridChartVisualizationCanvas<TContext> = GridChartVisualizationCanvas<TContext>,
  TConfig extends GridChartVisualizationConfig<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    GridChartVisualizationEdge<TNodeData, TEdgeData>
  > = GridChartVisualizationConfig<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    GridChartVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: GridChartVisualizationLabels<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly renderNode: GridChartNodeRenderer<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly renderEdge: GridChartEdgeRenderer<
    GridChartVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;

  graph: Graph<TNodeData, TEdgeData, Complex>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;

  constructor(
    dependencies: GridChartVisualizationDependencies<
      TNodeData,
      TEdgeData,
      TContext,
      TCanvas,
      TConfig
    >,
  ) {
    this.canvas = dependencies.canvas;
    this.config = dependencies.config;
    this.labels = dependencies.labels;
    this.renderNode = dependencies.renderNode;
    this.renderEdge = dependencies.renderEdge;
    this.graph = this.createGraph();
  }

  loadJSON(json: TreeNodeJson<TNodeData>): void;
  loadJSON(json: GraphJson<TNodeData, TEdgeData>, index?: number): void;
  loadJSON(json: LoaderJson<TNodeData, TEdgeData>, index?: number): void {
    this.json = json;
    this.labels.clearLabels?.(true);
    this.graph = constructGraph(json, this.constructionOptions());
    this.root = Array.isArray(json) ? json[index ? index : 0]!.id : json.id;
  }

  compute(property: PositionPhase = "current"): void {
    this.ensureLoaded();
    new GridLayout(
      this.graph,
      this.canvas,
      this.config,
      this.config,
    ).compute(property);
  }

  refresh(): void {
    this.compute();
    this.plot();
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      GridChartVisualizationNode<TNodeData, TEdgeData>,
      GridChartVisualizationEdge<TNodeData, TEdgeData>,
      TCanvas,
      TConfig
    >(
      {
        graph: this.graph,
        rootId: this.root,
        canvas: this.canvas,
        labels: this.labels,
        renderNode: (node, canvas, active) => {
          renderNodeElement(
            node,
            canvas,
            this.config.Node.CanvasStyles,
            (type, value, target, running) =>
              this.renderNode(type, value, target, this.config, running),
            active,
          );
        },
        renderEdge: (edge, canvas, active) => {
          renderEdgeElement(
            edge,
            canvas,
            this.config.Edge.CanvasStyles,
            (type, value, target, running) =>
              this.renderEdge(type, value, target, this.config, running),
            active,
          );
        },
      },
      options,
      animating,
    );
  }

  toJSON(type?: "tree"): TreeNodeJson<TNodeData>;
  toJSON(type: "graph"): GraphJson<TNodeData, TEdgeData>;
  toJSON(type: "tree" | "graph" = "tree"): TreeNodeJson<TNodeData> | GraphJson<TNodeData, TEdgeData> {
    this.ensureLoaded();
    return type === "tree"
      ? graphToTreeJson(this.graph, this.root)
      : graphToGraphJson(this.graph, this.root);
  }

  protected ensureLoaded(): void {
    if (!this.root || !this.graph.getNode(this.root)) {
      throw new Error("No graph data has been loaded");
    }
  }

  private createGraph(): Graph<TNodeData, TEdgeData, Complex> {
    return new Graph(
      this.constructionOptions().graph,
      this.config.Node,
      this.config.Edge,
      this.config.Label,
    );
  }

  private constructionOptions() {
    return {
      graph: {
        klass: Complex,
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.config.Node,
      edge: this.config.Edge,
      label: this.config.Label,
    };
  }
}

export const GRID_CHART_COLORS = [
  "#416D9C",
  "#70A35E",
  "#EBB056",
  "#C74243",
  "#83548B",
  "#909291",
  "#557EAA",
] as const;

export function createGridChartDefaults(): {
  legendX: unknown[];
  legendY: unknown[];
  nodeOffsetWidth: number;
  nodeOffsetHeight: number;
  colors: readonly string[];
  Node: { overridable: true; color: string; type: "rectangle" };
  Label: { textAlign: "center"; textBaseline: "middle" };
} {
  return {
    legendX: [],
    legendY: [],
    nodeOffsetWidth: 0,
    nodeOffsetHeight: 0,
    colors: GRID_CHART_COLORS,
    Node: {
      overridable: true,
      color: "rgba(0, 0, 0, 0)",
      type: "rectangle",
    },
    Label: { textAlign: "center", textBaseline: "middle" },
  };
}
