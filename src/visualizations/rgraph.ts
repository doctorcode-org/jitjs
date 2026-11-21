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

export type RGraphVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Polar>;

export type RGraphVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Polar>;

export interface RGraphVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface RGraphVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface RGraphVisualizationConfig<TNode, TEdge>
  extends PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  interpolation?: string;
  levelDistance?: number;
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode): void;
}

export type RGraphNodeRenderer<TNode, TCanvas> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type RGraphEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type RGraphInterpolator<TNode, TVersor = unknown> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface RGraphVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends RGraphVisualizationCanvas<TContext>,
  TConfig extends RGraphVisualizationConfig<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    RGraphVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: RGraphVisualizationLabels<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: RGraphNodeRenderer<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: RGraphEdgeRenderer<
    RGraphVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: RGraphInterpolator<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    TVersor
  >;
  animation?: PlotAnimationDriver;
  computeNodeDimensions?: NodeDimensionComputer<TNodeData, TEdgeData>;
}

export interface RGraphClickOptions
  extends Partial<PlotAnimationOptions> {
  onComplete?: () => void;
}

export interface RGraphParentAngle<TNode> {
  parent: TNode | null;
  theta: number | false;
}

/**
 * Registry-free RGraph composition. Rendering, labels, Canvas, interpolation,
 * and optional dimension measurement remain explicit dependencies.
 */
export class RGraphVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends RGraphVisualizationCanvas<TContext> =
    RGraphVisualizationCanvas<TContext>,
  TConfig extends RGraphVisualizationConfig<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    RGraphVisualizationEdge<TNodeData, TEdgeData>
  > = RGraphVisualizationConfig<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    RGraphVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor = unknown,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: RGraphVisualizationLabels<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: RGraphNodeRenderer<
    RGraphVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: RGraphEdgeRenderer<
    RGraphVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | RGraphInterpolator<
        RGraphVisualizationNode<TNodeData, TEdgeData>,
        TVersor
      >
    | undefined;
  readonly computeNodeDimensions:
    | NodeDimensionComputer<TNodeData, TEdgeData>
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Polar>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  busy = false;
  parent: RGraphVisualizationNode<TNodeData, TEdgeData> | null = null;

  constructor(
    dependencies: RGraphVisualizationDependencies<
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
    this.busy = false;
    this.parent = null;
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
      RGraphVisualizationNode<TNodeData, TEdgeData>,
      RGraphVisualizationEdge<TNodeData, TEdgeData>,
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
      RGraphVisualizationNode<TNodeData, TEdgeData>,
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
              `No RGraph interpolator was supplied for mode: ${mode}`,
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

  getNodeAndParentAngle(
    id: string,
  ): RGraphParentAngle<RGraphVisualizationNode<TNodeData, TEdgeData>> {
    const node = this.requireNode(id);
    const parent = node.getParents()[0] ?? null;
    let theta: number | false = false;
    if (parent) {
      const parentPosition = parent.pos.getc(true);
      const childPosition = node.pos.getc(true);
      theta = Math.atan2(
        parentPosition.y - childPosition.y,
        parentPosition.x - childPosition.x,
      );
      if (theta < 0) {
        theta += Math.PI * 2;
      }
    }
    return { parent, theta };
  }

  tagChildren(
    parent: RGraphVisualizationNode<TNodeData, TEdgeData> | null,
    id: string,
  ): void {
    if (!parent?.angleSpan) {
      return;
    }
    const adjacent: Array<RGraphVisualizationNode<TNodeData, TEdgeData>> = [];
    parent.eachAdjacency((edge) => adjacent.push(edge.nodeTo), "ignore");
    const length = adjacent.length;
    let index = 0;
    while (index < length && id != adjacent[index]?.id) {
      index += 1;
    }
    if (index === length || length === 0) {
      return;
    }
    let distance = 0;
    for (
      let cursor = (index + 1) % length;
      id != adjacent[cursor]?.id;
      cursor = (cursor + 1) % length
    ) {
      (adjacent[cursor] as RGraphVisualizationNode<TNodeData, TEdgeData>).dist =
        distance++;
    }
  }

  onClick(id: string, options: RGraphClickOptions = {}): boolean {
    this.ensureLoaded();
    if (this.root == id || this.busy) {
      return false;
    }

    this.busy = true;
    this.root = id;
    const node = this.requireNode(id);
    this.config.onBeforeCompute(node);
    const parentAngle = this.getNodeAndParentAngle(id);
    if (!parentAngle.parent || parentAngle.theta === false) {
      this.busy = false;
      throw new Error(`Cannot center a node without a parent: ${id}`);
    }

    this.tagChildren(parentAngle.parent, id);
    this.parent = parentAngle.parent;
    this.compute("end");

    const thetaDifference =
      parentAngle.theta - parentAngle.parent.endPos.theta;
    this.graph.eachNode((candidate) => {
      const end = candidate.endPos.getp();
      candidate.endPos.setp(end.theta + thetaDifference, end.rho);
    });

    const onComplete = options.onComplete ?? (() => {});
    this.animate({
      hideLabels: true,
      modes: [this.config.interpolation ?? "linear"],
      ...options,
      onComplete: () => {
        this.busy = false;
        onComplete();
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

  private createLayout(): RadialLayout<TNodeData, TEdgeData> {
    return new RadialLayout({
      graph: this.graph,
      root: this.root,
      config: this.config,
      parent: this.parent,
      createLevelDistance: () => this.createLevelDistance(),
      ...(this.computeNodeDimensions === undefined
        ? {}
        : { computeNodeDimensions: this.computeNodeDimensions }),
    });
  }

  private requireNode(
    id: string,
  ): RGraphVisualizationNode<TNodeData, TEdgeData> {
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
