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
import { plotGraph, type PlotGraphOptions } from "../graph/plotting.js";
import {
  renderEdgeElement,
  renderNodeElement,
  type ElementRenderCanvas,
  type ElementRenderContext,
} from "../graph/rendering/elements.js";
import {
  TreeLayout,
  type NodeDimensionResolver,
  type TreeAlignment,
  type TreeLayoutConfig,
  type TreeOrientation,
} from "../layouts/tree.js";
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

export type SpaceTreeVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex>;

export type SpaceTreeVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Complex>;

export interface SpaceTreeVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface SpaceTreeVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface SpaceTreeVisualizationConfig<TNode, TEdge>
  extends TreeLayoutConfig,
    PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  offsetX?: number;
  offsetY?: number;
  Node: TreeLayoutConfig["Node"] &
    GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode): void;
  onAfterCompute(node: TNode): void;
}

export type SpaceTreeNodeRenderer<TNode, TCanvas> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SpaceTreeEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type SpaceTreeInterpolator<TNode, TVersor = unknown> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: TVersor | undefined,
) => void;

export interface SpaceTreeVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends SpaceTreeVisualizationCanvas<TContext>,
  TConfig extends SpaceTreeVisualizationConfig<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    SpaceTreeVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: SpaceTreeVisualizationLabels<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: SpaceTreeNodeRenderer<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: SpaceTreeEdgeRenderer<
    SpaceTreeVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  getNodeDimensions: NodeDimensionResolver<
    TNodeData,
    TEdgeData,
    Complex
  >;
  interpolate?: SpaceTreeInterpolator<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    TVersor
  >;
  animation?: PlotAnimationDriver;
}

export interface SpaceTreeSelectOptions {
  offsetX?: number;
  offsetY?: number;
  onComplete?: () => void;
}

/**
 * Core SpaceTree composition. The asynchronous request/group policy used by
 * legacy ST.onClick remains outside this class; layout, plotting, animation,
 * path selection, and synchronous centering are complete and injectable.
 */
export class SpaceTreeVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends SpaceTreeVisualizationCanvas<TContext> =
    SpaceTreeVisualizationCanvas<TContext>,
  TConfig extends SpaceTreeVisualizationConfig<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    SpaceTreeVisualizationEdge<TNodeData, TEdgeData>
  > = SpaceTreeVisualizationConfig<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    SpaceTreeVisualizationEdge<TNodeData, TEdgeData>
  >,
  TVersor = unknown,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: SpaceTreeVisualizationLabels<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: SpaceTreeNodeRenderer<
    SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: SpaceTreeEdgeRenderer<
    SpaceTreeVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly getNodeDimensions: NodeDimensionResolver<
    TNodeData,
    TEdgeData,
    Complex
  >;
  readonly interpolate:
    | SpaceTreeInterpolator<
        SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
        TVersor
      >
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Complex>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  clickedNode: SpaceTreeVisualizationNode<TNodeData, TEdgeData> | null = null;

  constructor(
    dependencies: SpaceTreeVisualizationDependencies<
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
    this.getNodeDimensions = dependencies.getNodeDimensions;
    this.interpolate = dependencies.interpolate;
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
  }

  refresh(): void {
    this.compute(undefined, true);
    this.plot();
  }

  reposition(): void {
    this.compute("end", true);
  }

  compute(
    property?: PositionPhase,
    recomputeLevels?: boolean,
  ): void {
    this.ensureLoaded();
    this.createLayout().compute(property, recomputeLevels);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
      SpaceTreeVisualizationEdge<TNodeData, TEdgeData>,
      TCanvas,
      TConfig
    >(
      {
        graph: this.graph,
        rootId: this.root,
        canvas: this.canvas,
        labels: this.labels,
        renderNode: (node, canvas, active) => this.drawNode(node, canvas, active),
        renderEdge: (edge, canvas, active) => this.drawEdge(edge, canvas, active),
      },
      options,
      animating,
    );
  }

  plotSubtree(
    node: SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    options: TConfig = this.config,
    animating?: boolean,
    scale?: number,
    getScaledTreePosition?: (
      node: SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
      scale: number,
    ) => { x: number; y: number },
  ): void {
    const normalizedScale = Math.min(Math.max(0.001, scale as number), 1);
    if (normalizedScale >= 0) {
      if (!getScaledTreePosition) {
        throw new TypeError(
          "Scaled SpaceTree plotting requires a position resolver",
        );
      }
      node.drawn = false;
      const context = this.canvas.getCtx() as TContext & {
        translate(x: number, y: number): void;
        scale(x: number, y: number): void;
      };
      const difference = getScaledTreePosition(node, normalizedScale);
      context.translate(difference.x, difference.y);
      context.scale(normalizedScale, normalizedScale);
    }
    const treeOptions = {
      ...options,
      withLabels: true,
      hideLabels: Boolean(normalizedScale),
      plotSubtree: () => {
        const multitreeRoot =
          this.config.multitree && !("$orn" in node.data);
        const orientations = multitreeRoot && node.getData<{
          indexOf(value: unknown): number;
        }>("orns");
        return (
          !multitreeRoot ||
          (orientations as { indexOf(value: unknown): number }).indexOf(
            node.getData("orn"),
          ) > -1
        );
      },
    } as TConfig &
      PlotTreeOptions<
        SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
        SpaceTreeVisualizationEdge<TNodeData, TEdgeData>
      >;

    plotTree<
      SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
      SpaceTreeVisualizationEdge<TNodeData, TEdgeData>,
      TCanvas,
      typeof treeOptions
    >(
      {
        canvas: this.canvas,
        labels: this.labels,
        renderNode: (candidate, canvas, active) =>
          this.drawNode(candidate, canvas, active),
        renderEdge: (edge, canvas, active) =>
          this.drawEdge(edge, canvas, active),
      },
      node,
      treeOptions,
      animating,
    );
    if (normalizedScale >= 0) node.drawn = true;
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
      SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
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
              `No SpaceTree interpolator was supplied for mode: ${mode}`,
            );
          }
          this.interpolate(mode, node, properties, delta, value);
        },
        plot: (plotOptions, active) => this.plot(plotOptions as TConfig, active),
        setLabelsHidden: (hidden) => this.labels.hideLabels(hidden),
      },
      options,
      versor,
    );
  }

  selectPath(
    node: SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    pinnedIds: readonly string[] = [],
  ): void {
    this.graph.eachNode((candidate) => {
      candidate.selected = false;
    });

    const selectAncestors = (
      candidate: SpaceTreeVisualizationNode<TNodeData, TEdgeData> | null,
    ): void => {
      if (!candidate || candidate.selected) {
        return;
      }
      candidate.selected = true;
      const parent = candidate.getParents()[0];
      if (parent) {
        parent.eachSubnode((sibling) => {
          sibling.exist = true;
          sibling.drawn = true;
        });
      } else {
        candidate.exist = true;
        candidate.drawn = true;
      }
      selectAncestors(parent ?? null);
    };

    for (const id of [node.id, ...pinnedIds]) {
      selectAncestors(this.graph.getNode(id) ?? null);
    }
  }

  /** Synchronous, request-free equivalent of ST.select's layout and centering. */
  select(id: string, options: SpaceTreeSelectOptions = {}): void {
    this.ensureLoaded();
    const node = this.requireNode(id);
    this.config.onBeforeCompute(node);
    this.selectPath(node);
    this.clickedNode = node;
    this.compute("current", true);
    this.graph.eachNode((candidate) => {
      const position = candidate.pos.getc(true);
      candidate.startPos.setc(position.x, position.y);
      candidate.endPos.setc(position.x, position.y);
      candidate.visited = false;
    });

    const offsetX = options.offsetX ?? this.config.offsetX ?? 0;
    const offsetY = options.offsetY ?? this.config.offsetY ?? 0;
    const translation = node.endPos
      .add({ x: offsetX, y: offsetY })
      .$scale(-1);
    this.graph.eachNode((candidate) => {
      candidate.pos.$add(translation);
      candidate.startPos.$add(translation);
      candidate.endPos.$add(translation);
    });
    this.plot();
    this.config.onAfterCompute(node);
    options.onComplete?.();
  }

  switchOrientation(
    orientation: TreeOrientation,
    property: PositionPhase = "end",
  ): void {
    this.config.orientation = orientation;
    this.compute(property, false);
  }

  switchAlignment(
    alignment: TreeAlignment,
    property: PositionPhase = "end",
  ): void {
    this.config.align = alignment;
    this.compute(property, false);
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

  private drawNode(
    node: SpaceTreeVisualizationNode<TNodeData, TEdgeData>,
    canvas: TCanvas,
    animating?: boolean,
  ): void {
    renderNodeElement(
      node,
      canvas,
      this.config.Node.CanvasStyles,
      this.renderNode,
      animating,
    );
  }

  private drawEdge(
    edge: SpaceTreeVisualizationEdge<TNodeData, TEdgeData>,
    canvas: TCanvas,
    animating?: boolean,
  ): void {
    renderEdgeElement(
      edge,
      canvas,
      this.config.Edge.CanvasStyles,
      this.renderEdge,
      animating,
    );
  }

  private createLayout(): TreeLayout<TNodeData, TEdgeData, Complex> {
    return new TreeLayout({
      graph: this.graph,
      root: this.root,
      config: this.config,
      getNodeDimensions: this.getNodeDimensions,
    });
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

  private requireNode(
    id: string,
  ): SpaceTreeVisualizationNode<TNodeData, TEdgeData> {
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
