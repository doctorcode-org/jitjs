import { Animation } from "../core/animation.js";
import { Polar } from "../core/geometry.js";
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
  RadialLayout,
  type NodeDimensionComputer,
  type RadialNode,
} from "../layouts/radial.js";
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

export type SunburstVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Polar>;

export type SunburstVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Polar>;

export interface SunburstVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface SunburstVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface SunburstVisualizationConfig<TNode, TEdge>
  extends PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  interpolation?: string;
  levelDistance?: number;
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
}

export type SunburstNodeRenderer<TNode, TCanvas, TConfig> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
  config?: TConfig,
) => void;

export type SunburstEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SunburstInterpolator<TNode> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
) => void;

export interface SunburstAnimationDriver extends PlotAnimationDriver {
  pause?(): this;
}

export interface SunburstVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends SunburstVisualizationCanvas<TContext>,
  TConfig extends SunburstVisualizationConfig<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    SunburstVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: SunburstVisualizationLabels<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: SunburstNodeRenderer<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderEdge: SunburstEdgeRenderer<
    SunburstVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: SunburstInterpolator<
    SunburstVisualizationNode<TNodeData, TEdgeData>
  >;
  animation?: SunburstAnimationDriver;
  computeNodeDimensions?: NodeDimensionComputer<TNodeData, TEdgeData>;
}

export interface SunburstRotateOptions
  extends Partial<PlotAnimationOptions> {
  property?: PositionPhase;
}

/** Registry-free Sunburst composition with explicit rendering dependencies. */
export class SunburstVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends SunburstVisualizationCanvas<TContext> =
    SunburstVisualizationCanvas<TContext>,
  TConfig extends SunburstVisualizationConfig<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    SunburstVisualizationEdge<TNodeData, TEdgeData>
  > = SunburstVisualizationConfig<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    SunburstVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: SunburstVisualizationLabels<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: SunburstAnimationDriver;
  readonly renderNode: SunburstNodeRenderer<
    SunburstVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly renderEdge: SunburstEdgeRenderer<
    SunburstVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | SunburstInterpolator<SunburstVisualizationNode<TNodeData, TEdgeData>>
    | undefined;
  readonly computeNodeDimensions:
    | NodeDimensionComputer<TNodeData, TEdgeData>
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Polar>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  rotated: SunburstVisualizationNode<TNodeData, TEdgeData> | null = null;
  busy = false;

  constructor(
    dependencies: SunburstVisualizationDependencies<
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
    this.animation = dependencies.animation ?? new Animation();
    this.renderNode = dependencies.renderNode;
    this.renderEdge = dependencies.renderEdge;
    this.interpolate = dependencies.interpolate;
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
    this.rotated = null;
    this.busy = false;
  }

  createLevelDistance(): (
    node: RadialNode<TNodeData, TEdgeData>,
  ) => number {
    const distance = this.config.levelDistance ?? 100;
    return (node) => ((node._depth as number) + 1) * distance;
  }

  refresh(): void {
    this.compute();
    this.plot();
  }

  reposition(): void {
    this.compute("end");
  }

  compute(property?: PositionPhase | readonly PositionPhase[]): void {
    this.ensureLoaded();
    this.createLayout().compute(property);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      SunburstVisualizationNode<TNodeData, TEdgeData>,
      SunburstVisualizationEdge<TNodeData, TEdgeData>,
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
            (type, candidate, target, rendering) =>
              this.renderNode(
                type,
                candidate,
                target,
                rendering,
                this.config,
              ),
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
  ): SunburstAnimationDriver {
    this.ensureLoaded();
    const options = merge(
      this.config,
      { modes: ["linear"] },
      requestedOptions,
    ) as TConfig & PlotAnimationOptions;
    return animatePlot<
      SunburstVisualizationNode<TNodeData, TEdgeData>,
      TConfig & PlotAnimationOptions
    >(
      {
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta) => {
          if (!this.interpolate) {
            throw new TypeError(
              `No Sunburst interpolator was supplied for mode: ${mode}`,
            );
          }
          this.interpolate(mode, node, properties, delta);
        },
        plot: (plotOptions, active) => this.plot(plotOptions as TConfig, active),
        setLabelsHidden: (hidden) => this.labels.hideLabels(hidden),
      },
      options,
    ) as SunburstAnimationDriver;
  }

  rotate(
    node: SunburstVisualizationNode<TNodeData, TEdgeData>,
    method: "animate" | "replot",
    options: SunburstRotateOptions = {},
  ): void {
    const position = node.getPos(options.property ?? "current");
    if (!position) {
      throw new Error(`Unknown position phase: ${String(options.property)}`);
    }
    this.rotated = node;
    this.rotateAngle(-position.theta, method, options);
  }

  rotateAngle(
    theta: number,
    method: "animate" | "replot",
    requestedOptions: SunburstRotateOptions = {},
  ): void {
    this.ensureLoaded();
    const options = merge(this.config, requestedOptions, {
      modes: ["polar"],
    }) as TConfig & PlotAnimationOptions & SunburstRotateOptions;
    const phase =
      requestedOptions.property ??
      (method === "animate" ? "end" : "current");

    if (method === "animate") {
      this.animation.pause?.();
    }
    this.graph.eachNode((node) => {
      const position = node.getPos(phase) as Polar;
      position.theta += theta;
      if (position.theta < 0) {
        position.theta += Math.PI * 2;
      }
    });

    if (method === "animate") {
      this.animate(options);
    } else if (method === "replot") {
      this.plot();
      this.busy = false;
    }
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

  private createLayout(): RadialLayout<TNodeData, TEdgeData> {
    return new RadialLayout({
      graph: this.graph,
      root: this.root,
      config: this.config,
      createLevelDistance: () => this.createLevelDistance(),
      ...(this.computeNodeDimensions === undefined
        ? {}
        : { computeNodeDimensions: this.computeNodeDimensions }),
    });
  }

  private createGraph(): Graph<TNodeData, TEdgeData, Polar> {
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
        klass: Polar,
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.config.Node,
      edge: this.config.Edge,
      label: this.config.Label,
    };
  }

  private ensureLoaded(): void {
    if (!this.root || !this.graph.getNode(this.root)) {
      throw new Error("No graph data has been loaded");
    }
  }
}
