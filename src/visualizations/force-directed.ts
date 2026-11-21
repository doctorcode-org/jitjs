import { Animation } from "../core/animation.js";
import { Complex } from "../core/geometry.js";
import { merge } from "../core/util.js";
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
import { plotGraph, type PlotGraphOptions } from "../graph/plotting.js";
import {
  renderEdgeElement,
  renderNodeElement,
  type ElementRenderCanvas,
  type ElementRenderContext,
} from "../graph/rendering/elements.js";
import {
  ForceDirectedLayout,
  type ForceDirectedIncrementalOptions,
  type ForceDirectedLayoutConfig,
  type ForceDirectedNodeDimensionComputer,
  type ForceDirectedTimer,
} from "../layouts/force-directed.js";
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

export type ForceDirectedVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex>;

export type ForceDirectedVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Complex>;

export interface ForceDirectedVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface ForceDirectedVisualizationLabels<
  TNode,
  TCanvas,
  TOptions,
> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface ForceDirectedVisualizationConfig<
  TNode,
  TEdge,
> extends ForceDirectedLayoutConfig,
    PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode | undefined): void;
}

export type ForceDirectedNodeRenderer<TNode, TCanvas> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type ForceDirectedEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type ForceDirectedInterpolator<TNode, TVersor = unknown> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface ForceDirectedVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends ForceDirectedVisualizationCanvas<TContext>,
  TConfig extends ForceDirectedVisualizationConfig<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    ForceDirectedVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: ForceDirectedVisualizationLabels<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: ForceDirectedNodeRenderer<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: ForceDirectedEdgeRenderer<
    ForceDirectedVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: ForceDirectedInterpolator<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    TVersor
  >;
  animation?: PlotAnimationDriver;
  random?: () => number;
  timer?: ForceDirectedTimer;
  computeNodeDimensions?: ForceDirectedNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;
}

export interface ForceDirectedComputeIncrementalOptions
  extends Partial<ForceDirectedIncrementalOptions> {
  property?: PositionPhase | readonly PositionPhase[];
}

/**
 * Modern ForceDirected façade. Browser surfaces, label backend, renderers,
 * and interpolation policy are explicit dependencies rather than registries.
 */
export class ForceDirectedVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends ForceDirectedVisualizationCanvas<TContext> =
    ForceDirectedVisualizationCanvas<TContext>,
  TConfig extends ForceDirectedVisualizationConfig<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    ForceDirectedVisualizationEdge<TNodeData, TEdgeData>
  > = ForceDirectedVisualizationConfig<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    ForceDirectedVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor = unknown,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: ForceDirectedVisualizationLabels<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: ForceDirectedNodeRenderer<
    ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: ForceDirectedEdgeRenderer<
    ForceDirectedVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | ForceDirectedInterpolator<
        ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
        TVersor
      >
    | undefined;
  readonly random: (() => number) | undefined;
  readonly timer: ForceDirectedTimer | undefined;
  readonly computeNodeDimensions:
    | ForceDirectedNodeDimensionComputer<TNodeData, TEdgeData>
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Complex>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;

  constructor(
    dependencies: ForceDirectedVisualizationDependencies<
      TNodeData,
      TEdgeData,
      TContext,
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
    this.root = Array.isArray(json)
      ? json[index ? index : 0]!.id
      : json.id;
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
    incremental?: ForceDirectedIncrementalOptions,
  ): void {
    this.ensureLoaded();
    this.createLayout().compute(property, incremental);
  }

  computeIncremental(options: ForceDirectedComputeIncrementalOptions = {}): void {
    this.ensureLoaded();
    const incremental: ForceDirectedIncrementalOptions = {
      iter: options.iter ?? 20,
      onStep: options.onStep ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
    };
    this.config.onBeforeCompute(this.graph.getNode(this.root));
    this.compute(options.property ?? "end", incremental);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
      ForceDirectedVisualizationEdge<TNodeData, TEdgeData>,
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
            this.renderNode,
            active,
          );
        },
        renderEdge: (edge, canvas, active) => {
          renderEdgeElement(
            edge,
            canvas,
            this.config.Edge.CanvasStyles,
            this.renderEdge,
            active,
          );
        },
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
      ForceDirectedVisualizationNode<TNodeData, TEdgeData>,
      TConfig & PlotAnimationOptions,
      TVersor
    >(
      {
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta, value) => {
          if (!this.interpolate) {
            throw new TypeError(
              `No ForceDirected interpolator was supplied for mode: ${mode}`,
            );
          }
          this.interpolate(mode, node, properties, delta, value);
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
        Node: {
          selected: false,
          exist: true,
          drawn: true,
        },
      },
      node: this.config.Node,
      edge: this.config.Edge,
      label: this.config.Label,
    };
  }

  private createLayout(): ForceDirectedLayout<TNodeData, TEdgeData> {
    return new ForceDirectedLayout({
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
