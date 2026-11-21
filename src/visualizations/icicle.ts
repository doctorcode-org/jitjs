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
import {
  plotTree,
  type PlotTreeOptions,
} from "../graph/plot-tree.js";
import type { PlotGraphOptions } from "../graph/plotting.js";
import {
  renderEdgeElement,
  renderNodeElement,
  type ElementRenderCanvas,
  type ElementRenderContext,
} from "../graph/rendering/elements.js";
import {
  IcicleLayout,
  type IcicleLayoutConfig,
  type IcicleOrientation,
} from "../layouts/icicle.js";
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

export type IcicleVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex>;

export type IcicleVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Complex>;

export interface IcicleVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface IcicleVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface IcicleVisualizationConfig<TNode, TEdge>
  extends IcicleLayoutConfig,
    PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  animate?: boolean;
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode): void;
}

export type IcicleNodeRenderer<TNode, TCanvas> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type IcicleEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type IcicleInterpolator<TNode, TVersor = unknown> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface IcicleVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends IcicleVisualizationCanvas<TContext>,
  TConfig extends IcicleVisualizationConfig<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    IcicleVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: IcicleVisualizationLabels<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: IcicleNodeRenderer<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: IcicleEdgeRenderer<
    IcicleVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: IcicleInterpolator<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    TVersor
  >;
  animation?: PlotAnimationDriver;
}

/**
 * Modern Icicle façade. Canvas creation, label backends, shape selection, and
 * interpolation policy remain explicit dependencies, so importing this module
 * does not install a namespace or pull a renderer registry into the bundle.
 */
export class IcicleVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends IcicleVisualizationCanvas<TContext> =
    IcicleVisualizationCanvas<TContext>,
  TConfig extends IcicleVisualizationConfig<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    IcicleVisualizationEdge<TNodeData, TEdgeData>
  > = IcicleVisualizationConfig<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    IcicleVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor = unknown,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: IcicleVisualizationLabels<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: IcicleNodeRenderer<
    IcicleVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: IcicleEdgeRenderer<
    IcicleVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | IcicleInterpolator<
        IcicleVisualizationNode<TNodeData, TEdgeData>,
        TVersor
      >
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Complex>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  clickedNode: IcicleVisualizationNode<TNodeData, TEdgeData> | null = null;
  busy = false;
  orientation: IcicleOrientation;

  constructor(
    dependencies: IcicleVisualizationDependencies<
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
    this.orientation = dependencies.config.orientation ?? "h";
    this.graph = this.createGraph();
  }

  loadJSON(json: TreeNodeJson<TNodeData>): void;
  loadJSON(json: GraphJson<TNodeData, TEdgeData>, index?: number): void;
  loadJSON(json: LoaderJson<TNodeData, TEdgeData>, index?: number): void {
    this.json = json;
    this.labels.clearLabels?.(true);
    this.graph = constructGraph(json, this.constructionOptions());
    this.root = Array.isArray(json) ? json[index ? index : 0]!.id : json.id;
    this.clickedNode = null;
    this.busy = false;
  }

  horizontal(): boolean {
    return this.orientation === "h";
  }

  vertical(): boolean {
    return this.orientation === "v";
  }

  changeOrientation(): void {
    this.orientation = this.vertical() ? "h" : "v";
  }

  refresh(): void {
    this.ensureLoaded();
    if (this.config.Label.type != "Native") {
      this.graph.eachNode((node) => this.labels.hideLabel(node, false));
    }
    this.compute();
    this.plot();
  }

  reposition(): void {
    this.compute("end");
  }

  compute(property: PositionPhase = "current"): void {
    this.ensureLoaded();
    this.createLayout().compute(property);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    const root = this.selectedRoot();
    const initialDepth = root._depth as number;
    const constrained = this.config.constrained ?? false;
    const levelsToShow = this.config.levelsToShow ?? Number.MAX_VALUE;
    const treeOptions = {
      ...options,
      withLabels: true,
      hideLabels: false,
      plotSubtree: (
        _node: IcicleVisualizationNode<TNodeData, TEdgeData>,
        child: IcicleVisualizationNode<TNodeData, TEdgeData>,
      ) =>
        !constrained ||
        (child._depth as number) - initialDepth < levelsToShow,
    } as TConfig &
      PlotTreeOptions<
        IcicleVisualizationNode<TNodeData, TEdgeData>,
        IcicleVisualizationEdge<TNodeData, TEdgeData>
      >;

    // Icicle.Plot clears unconditionally, then plotTree obtains the context.
    this.canvas.clear();
    plotTree<
      IcicleVisualizationNode<TNodeData, TEdgeData>,
      IcicleVisualizationEdge<TNodeData, TEdgeData>,
      TCanvas,
      typeof treeOptions
    >(
      {
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
      root,
      treeOptions,
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
      { modes: ["linear", "node-property:width:height"] },
      requestedOptions,
    ) as TConfig & PlotAnimationOptions;

    return animatePlot<
      IcicleVisualizationNode<TNodeData, TEdgeData>,
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
              `No Icicle interpolator was supplied for mode: ${mode}`,
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

  /** Select a subtree, retaining the legacy two-stage fade and resize flow. */
  enter(node: IcicleVisualizationNode<TNodeData, TEdgeData>): boolean {
    this.ensureLoaded();
    if (this.busy || this.graph.getNode(node.id) !== node) {
      return false;
    }

    this.busy = true;
    if (!this.config.animate) {
      this.clickedNode = node;
      this.busy = false;
      this.refresh();
      return true;
    }

    this.graph.nodeList.setDataset(["current", "end"], {
      alpha: [1, 0],
    });
    node.eachSubgraph((candidate) => {
      candidate.setData("alpha", 1, "end");
    }, "ignore");

    this.animate({
      duration: 500,
      modes: ["node-property:alpha"],
      onComplete: () => {
        this.clickedNode = node;
        this.compute("end");
        this.animate({
          duration: 1000,
          modes: ["linear", "node-property:width:height"],
          onComplete: () => {
            this.busy = false;
            this.clickedNode = node;
          },
        });
      },
    });
    return true;
  }

  /** Select the parent subtree, retaining the legacy resize-then-fade flow. */
  out(): boolean {
    this.ensureLoaded();
    if (this.busy) {
      return false;
    }

    const current = this.selectedRoot();
    const parent = current.getParents()[0];
    if (!parent) {
      return false;
    }

    this.busy = true;
    if (!this.config.animate) {
      this.clickedNode = parent;
      this.compute();
      this.plot();
      this.busy = false;
      return true;
    }

    const previousClickedNode = this.clickedNode;
    this.clickedNode = parent;
    this.compute("end");
    this.clickedNode = previousClickedNode;
    this.animate({
      duration: 1000,
      modes: ["linear", "node-property:width:height"],
      onComplete: () => {
        this.clickedNode = parent;
        this.graph.nodeList.setDataset(["current", "end"], {
          alpha: [0, 1],
        });
        previousClickedNode?.eachSubgraph((node) => {
          node.setData("alpha", 1);
        }, "ignore");
        this.animate({
          duration: 500,
          modes: ["node-property:alpha"],
          onComplete: () => {
            this.compute();
            this.plot();
            this.busy = false;
          },
        });
      },
    });
    return true;
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

  private selectedRoot(): IcicleVisualizationNode<TNodeData, TEdgeData> {
    return this.clickedNode ?? this.requireNode(this.root);
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

  private createLayout(): IcicleLayout<TNodeData, TEdgeData, Complex> {
    return new IcicleLayout({
      graph: this.graph,
      root: this.root,
      getSize: () => this.canvas.getSize(),
      config: { ...this.config, orientation: this.orientation },
      controller: {
        onBeforeCompute: (root) => this.config.onBeforeCompute(root),
      },
      clickedNode: this.clickedNode,
    });
  }

  private requireNode(
    id: string,
  ): IcicleVisualizationNode<TNodeData, TEdgeData> {
    const node = this.graph.getNode(id);
    if (!node) {
      throw new Error(`Unknown graph node: ${id}`);
    }
    return node;
  }

  private ensureLoaded(): void {
    if (!this.root || !this.graph.getNode(this.root)) {
      throw new Error("No graph data has been loaded");
    }
  }
}
