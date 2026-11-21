import { Animation } from "../core/animation.js";
import { merge } from "../core/util.js";
import { Vector3 } from "../geometry/vector3.js";
import {
  Graph,
  type GraphAdjacency,
  type GraphElementConfig,
  type GraphLabelConfig,
  type GraphNode,
} from "../graph/graph.js";
import {
  animatePlot,
  type PlotAnimationDriver,
  type PlotAnimationOptions,
} from "../graph/plot-animation.js";
import { prepareGraphForAnimation } from "../graph/plot-preparation.js";
import { interpolate3DLinear } from "../graph/plot3d.js";
import { plotGraph, type PlotGraphOptions } from "../graph/plotting.js";
import {
  ForceDirected3DLayout,
  type ForceDirected3DIncrementalOptions,
  type ForceDirected3DLayoutConfig,
  type ForceDirected3DNodeDimensionComputer,
  type ForceDirected3DTimer,
} from "../layouts/force-directed3d.js";
import {
  constructGraph,
  graphToGraphJson,
  graphToTreeJson,
  type LoaderJson,
} from "../loader/loader.js";
import type {
  EdgeData,
  GraphJson,
  NodeData,
  PositionPhase,
  TreeNodeJson,
} from "../types.js";

export type ForceDirected3DVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Vector3>;

export type ForceDirected3DVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Vector3>;

export interface ForceDirected3DVisualizationCanvas {
  getCtx(): unknown;
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface ForceDirected3DVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface ForceDirected3DVisualizationConfig<TNode, TEdge>
  extends ForceDirected3DLayoutConfig,
    PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  Node: GraphElementConfig;
  Edge: GraphElementConfig;
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode | undefined): void;
}

export type ForceDirected3DRenderer<TElement, TCanvas> = (
  element: TElement,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type ForceDirected3DInterpolator<TNode, TVersor = unknown> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface ForceDirected3DVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TCanvas extends ForceDirected3DVisualizationCanvas,
  TConfig extends ForceDirected3DVisualizationConfig<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: ForceDirected3DVisualizationLabels<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: ForceDirected3DRenderer<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: ForceDirected3DRenderer<
    ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: ForceDirected3DInterpolator<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    TVersor
  >;
  animation?: PlotAnimationDriver;
  random?: () => number;
  timer?: ForceDirected3DTimer;
  computeNodeDimensions?: ForceDirected3DNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;
}

export interface ForceDirected3DComputeIncrementalOptions
  extends Partial<ForceDirected3DIncrementalOptions> {
  property?: PositionPhase | readonly PositionPhase[];
}

/** Registry-free composition façade for the legacy ForceDirected3D workflow. */
export class ForceDirected3DVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TCanvas extends ForceDirected3DVisualizationCanvas =
    ForceDirected3DVisualizationCanvas,
  TConfig extends ForceDirected3DVisualizationConfig<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>
  > = ForceDirected3DVisualizationConfig<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor = unknown,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: ForceDirected3DVisualizationLabels<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: ForceDirected3DRenderer<
    ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: ForceDirected3DRenderer<
    ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | ForceDirected3DInterpolator<
        ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
        TVersor
      >
    | undefined;
  readonly random: (() => number) | undefined;
  readonly timer: ForceDirected3DTimer | undefined;
  readonly computeNodeDimensions:
    | ForceDirected3DNodeDimensionComputer<TNodeData, TEdgeData>
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Vector3>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;

  constructor(
    dependencies: ForceDirected3DVisualizationDependencies<
      TNodeData,
      TEdgeData,
      TCanvas,
      TConfig,
      TVersor
    >,
  ) {
    this.canvas = dependencies.canvas;
    this.config = dependencies.config;
    this.labels = dependencies.labels;
    this.animation = dependencies.animation ?? new Animation();
    this.renderNode = dependencies.renderNode;
    this.renderEdge = dependencies.renderEdge;
    this.interpolate = dependencies.interpolate;
    this.random = dependencies.random;
    this.timer = dependencies.timer;
    this.computeNodeDimensions = dependencies.computeNodeDimensions;
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

  refresh(): void {
    this.compute();
    this.plot();
  }

  reposition(): void {
    this.compute("end");
  }

  compute(
    property?: PositionPhase | readonly PositionPhase[],
    incremental?: ForceDirected3DIncrementalOptions,
  ): void {
    this.ensureLoaded();
    this.createLayout().compute(property, incremental);
  }

  computeIncremental(
    options: ForceDirected3DComputeIncrementalOptions = {},
  ): void {
    this.ensureLoaded();
    const incremental: ForceDirected3DIncrementalOptions = {
      iter: options.iter ?? 20,
      onStep: options.onStep ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
    };
    this.config.onBeforeCompute(this.graph.getNode(this.root) || undefined);
    this.compute(options.property ?? "end", incremental);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
      ForceDirected3DVisualizationEdge<TNodeData, TEdgeData>,
      TCanvas,
      TConfig
    >(
      {
        graph: this.graph,
        rootId: this.root,
        canvas: this.canvas,
        labels: this.labels,
        renderNode: this.renderNode,
        renderEdge: this.renderEdge,
      },
      options,
      animating,
    );
  }

  animate(
    requestedOptions: Partial<PlotAnimationOptions> = {},
    versor?: TVersor,
  ): PlotAnimationDriver {
    this.ensureLoaded();
    const options = merge(
      this.config,
      { modes: ["linear"] },
      requestedOptions,
    ) as TConfig & PlotAnimationOptions;

    return animatePlot<
      ForceDirected3DVisualizationNode<TNodeData, TEdgeData>,
      TConfig & PlotAnimationOptions,
      TVersor
    >(
      {
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta, value) => {
          if (this.interpolate) {
            this.interpolate(mode, node, properties, delta, value);
            return;
          }
          if (mode !== "linear") {
            throw new TypeError(
              `No ForceDirected3D interpolator was supplied for mode: ${mode}`,
            );
          }
          interpolate3DLinear(node, properties, delta);
        },
        plot: (plotOptions, active) => {
          this.plot(plotOptions as TConfig, active);
        },
        setLabelsHidden: (hidden) => this.labels.hideLabels(hidden),
      },
      options,
      versor,
    );
  }

  toJSON(type?: "tree"): TreeNodeJson<TNodeData>;
  toJSON(type: "graph"): GraphJson<TNodeData, TEdgeData>;
  toJSON(
    type: "tree" | "graph" = "tree",
  ): TreeNodeJson<TNodeData> | GraphJson<TNodeData, TEdgeData> {
    this.ensureLoaded();
    return type === "tree"
      ? graphToTreeJson(this.graph, this.root)
      : graphToGraphJson(this.graph, this.root);
  }

  private createGraph(): Graph<TNodeData, TEdgeData, Vector3> {
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
        klass: Vector3,
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.config.Node,
      edge: this.config.Edge,
      label: this.config.Label,
    };
  }

  private createLayout(): ForceDirected3DLayout<TNodeData, TEdgeData> {
    return new ForceDirected3DLayout({
      graph: this.graph,
      root: this.root,
      getSize: () => this.canvas.getSize(),
      config: this.config,
      ...(this.random === undefined ? {} : { random: this.random }),
      ...(this.timer === undefined ? {} : { timer: this.timer }),
      ...(this.computeNodeDimensions === undefined
        ? {}
        : { computeNodeDimensions: this.computeNodeDimensions }),
    });
  }

  private ensureLoaded(): void {
    if (!this.root || !this.graph.getNode(this.root)) {
      throw new Error("No graph data has been loaded");
    }
  }
}
