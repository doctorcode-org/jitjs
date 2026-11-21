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
import { sumIntoGraph } from "../graph/operations/sum.js";
import {
  animatePlot,
  type PlotAnimationDriver,
  type PlotAnimationOptions,
} from "../graph/plot-animation.js";
import { prepareGraphForAnimation } from "../graph/plot-preparation.js";
import { plotTree, type PlotTreeOptions } from "../graph/plot-tree.js";
import type { PlotGraphOptions } from "../graph/plotting.js";
import {
  renderEdgeElement,
  renderNodeElement,
  type ElementRenderCanvas,
  type ElementRenderContext,
} from "../graph/rendering/elements.js";
import type {
  TreemapLayoutDependencies,
  TreemapOrientation,
} from "../layouts/treemap/types.js";
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

export type TreemapVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex>;

export type TreemapVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Complex>;

export interface TreemapVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface TreemapVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface TreemapRequestResult<TNodeData extends NodeData> {
  children?: TreeNodeJson<TNodeData>[];
  [key: string]: unknown;
}

export interface TreemapRequestController<TNodeData extends NodeData> {
  onComplete(nodeId: string, data?: TreemapRequestResult<TNodeData>): void;
}

export type TreemapRequest<TNodeData extends NodeData> = (
  nodeId: string,
  level: number,
  controller: TreemapRequestController<TNodeData>,
) => void;

export interface TreemapVisualizationConfig<TNode, TEdge, TNodeData extends NodeData>
  extends PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  orientation?: TreemapOrientation;
  titleHeight?: number;
  offset?: number;
  constrained?: boolean;
  levelsToShow?: number;
  animate?: boolean;
  cushion?: boolean;
  request?: TreemapRequest<TNodeData>;
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig & { type?: string };
  onBeforeCompute(node: TNode): void;
  onAfterCompute(node: TNode): void;
}

export interface TreemapLayoutEngine {
  orientation: TreemapOrientation;
  compute(property?: PositionPhase): void;
}

export type TreemapLayoutFactory<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = (
  dependencies: TreemapLayoutDependencies<
    TNodeData,
    TEdgeData,
    Complex
  >,
) => TreemapLayoutEngine;

export type TreemapNodeRenderer<TNode, TCanvas, TConfig> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
  config?: TConfig,
  leaf?: (node: TNode) => boolean,
  clickedNode?: TNode | null,
) => void;

export type TreemapEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type TreemapInterpolator<TNode> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
) => void;

export interface TreemapEventState {
  hoveredNode: unknown;
}

export interface TreemapVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends TreemapVisualizationCanvas<TContext>,
  TConfig extends TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  >,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: TreemapVisualizationLabels<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: TreemapNodeRenderer<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderEdge: TreemapEdgeRenderer<
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  createLayout: TreemapLayoutFactory<TNodeData, TEdgeData>;
  interpolate?: TreemapInterpolator<
    TreemapVisualizationNode<TNodeData, TEdgeData>
  >;
  animation?: PlotAnimationDriver;
  events?: TreemapEventState;
}

export type TreemapVisualizationBaseDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends TreemapVisualizationCanvas<TContext>,
  TConfig extends TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  >,
> = Omit<
  TreemapVisualizationDependencies<
    TNodeData,
    TEdgeData,
    TContext,
    TCanvas,
    TConfig
  >,
  "createLayout"
>;

/** Shared, dependency-injected façade for all three legacy treemap variants. */
export class TreemapVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends TreemapVisualizationCanvas<TContext> =
    TreemapVisualizationCanvas<TContext>,
  TConfig extends TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  > = TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  >,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: TreemapVisualizationLabels<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: TreemapNodeRenderer<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly renderEdge: TreemapEdgeRenderer<
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly createLayoutEngine: TreemapLayoutFactory<TNodeData, TEdgeData>;
  readonly interpolate:
    | TreemapInterpolator<TreemapVisualizationNode<TNodeData, TEdgeData>>
    | undefined;
  readonly events: TreemapEventState | undefined;

  graph: Graph<TNodeData, TEdgeData, Complex>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  clickedNode: TreemapVisualizationNode<TNodeData, TEdgeData> | null = null;
  busy = false;
  orientation: TreemapOrientation;

  constructor(
    dependencies: TreemapVisualizationDependencies<
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
    this.createLayoutEngine = dependencies.createLayout;
    this.interpolate = dependencies.interpolate;
    this.events = dependencies.events;
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

  refresh(): boolean {
    this.ensureLoaded();
    if (this.busy) {
      return false;
    }
    this.busy = true;
    if (this.config.animate) {
      this.compute("end");
      if ((this.config.levelsToShow ?? 0) > 0) {
        this.setRightLevelToShow(this.selectedRoot());
      }
      this.animate({
        modes: this.geometryModes(),
        onComplete: () => {
          this.busy = false;
        },
      });
      return true;
    }

    if (this.config.Label.type != "Native") {
      this.graph.eachNode((node) => this.labels.hideLabel(node, false));
    }
    this.busy = false;
    this.compute();
    if ((this.config.levelsToShow ?? 0) > 0) {
      this.setRightLevelToShow(this.selectedRoot());
    }
    this.plot();
    return true;
  }

  reposition(): void {
    this.compute("end");
  }

  protected geometryModes(): string[] {
    return ["linear", "node-property:width:height"];
  }

  compute(property: PositionPhase = "current"): void {
    this.ensureLoaded();
    const layout = this.createLayoutEngine({
      graph: this.graph,
      root: this.root,
      getSize: () => this.canvas.getSize(),
      config: { ...this.config, orientation: this.orientation },
      controller: {
        onBeforeCompute: (root) => this.config.onBeforeCompute(root),
        onAfterCompute: (root) => this.config.onAfterCompute(root),
      },
      clickedNode: this.clickedNode,
    });
    layout.compute(property);
    this.orientation = layout.orientation;
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    const root = this.selectedRoot();
    const treeOptions = {
      ...this.config,
      ...options,
      withLabels: true,
      hideLabels: false,
      plotSubtree: (
        node: TreemapVisualizationNode<TNodeData, TEdgeData>,
      ) => node.anySubnode("exist"),
    } as TConfig &
      PlotTreeOptions<
        TreemapVisualizationNode<TNodeData, TEdgeData>,
        TreemapVisualizationEdge<TNodeData, TEdgeData>
      >;
    this.canvas.clear();
    plotTree<
      TreemapVisualizationNode<TNodeData, TEdgeData>,
      TreemapVisualizationEdge<TNodeData, TEdgeData>,
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
            (type, candidate, target, rendering) =>
              this.renderNode(
                type,
                candidate,
                target,
                rendering,
                this.config,
                (value) => this.leaf(value),
                this.clickedNode,
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
      root,
      treeOptions,
      animating,
    );
  }

  animate(
    requestedOptions: Partial<PlotAnimationOptions> = {},
  ): PlotAnimationDriver {
    this.ensureLoaded();
    const options = merge(
      this.config,
      { modes: this.geometryModes() },
      requestedOptions,
    ) as TConfig & PlotAnimationOptions;
    return animatePlot<
      TreemapVisualizationNode<TNodeData, TEdgeData>,
      TConfig & PlotAnimationOptions
    >(
      {
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta) => {
          if (!this.interpolate) {
            throw new TypeError(
              `No Treemap interpolator was supplied for mode: ${mode}`,
            );
          }
          this.interpolate(mode, node, properties, delta);
        },
        plot: (plotOptions, active) => this.plot(plotOptions as TConfig, active),
        setLabelsHidden: (hidden) => this.labels.hideLabels(hidden),
      },
      options,
    );
  }

  leaf(node: TreemapVisualizationNode<TNodeData, TEdgeData>): boolean {
    return node.getSubnodes([1, 1], "ignore").length === 0;
  }

  setRightLevelToShow(
    node: TreemapVisualizationNode<TNodeData, TEdgeData>,
  ): void {
    const level = this.config.levelsToShow ?? 0;
    node.eachLevel(0, level + 1, (candidate) => {
      const depth = (candidate._depth as number) - (node._depth as number);
      if (depth > level) {
        candidate.drawn = false;
        candidate.exist = false;
        candidate.ignore = true;
        this.labels.hideLabel(candidate, false);
      } else {
        candidate.drawn = true;
        candidate.exist = true;
        delete candidate.ignore;
      }
    });
    node.drawn = true;
    delete node.ignore;
  }

  enter(node: TreemapVisualizationNode<TNodeData, TEdgeData>): boolean {
    this.ensureLoaded();
    if (this.busy || this.graph.getNode(node.id) !== node) {
      return false;
    }
    this.busy = true;
    const previousClickedNode = this.clickedNode;
    const complete = () => {
      if ((this.config.levelsToShow ?? 0) > 0) {
        this.setRightLevelToShow(node);
      }
      if ((this.config.levelsToShow ?? 0) > 0 || this.config.request) {
        this.compute();
      }
      if (!this.config.animate) {
        this.busy = false;
        this.clickedNode = node;
        this.refresh();
        return;
      }

      this.graph.nodeList.setData("alpha", 0, "end");
      node.eachSubgraph((candidate) => {
        candidate.setData("alpha", 1, "end");
      }, "ignore");
      this.animate({
        duration: 500,
        modes: ["node-property:alpha"],
        onComplete: () => {
          this.clickedNode = node;
          this.compute("end");
          this.clickedNode = previousClickedNode;
          this.animate({
            duration: 1000,
            modes: this.geometryModes(),
            onComplete: () => {
              this.busy = false;
              this.clickedNode = node;
            },
          });
        },
      });
    };

    if (this.config.request) {
      this.requestNodes(node, complete);
    } else {
      complete();
    }
    return true;
  }

  out(): boolean {
    this.ensureLoaded();
    if (this.busy) {
      return false;
    }
    this.busy = true;
    if (this.events) {
      this.events.hoveredNode = false;
    }
    const previousClickedNode = this.clickedNode;
    const parent = this.selectedRoot().getParents()[0];
    if (!parent) {
      this.busy = false;
      return false;
    }

    const complete = () => {
      this.clickedNode = parent;
      if (this.config.request) {
        this.requestNodes(parent, () => {
          this.compute();
          this.plot();
          this.busy = false;
        });
      } else {
        this.compute();
        this.plot();
        this.busy = false;
      }
    };
    if ((this.config.levelsToShow ?? 0) > 0) {
      this.setRightLevelToShow(parent);
    }
    if (!this.config.animate) {
      complete();
      return true;
    }

    this.clickedNode = parent;
    this.compute("end");
    this.clickedNode = previousClickedNode;
    this.animate({
      duration: 1000,
      modes: this.geometryModes(),
      onComplete: () => {
        this.clickedNode = parent;
        this.graph.eachNode((node) => {
          node.setDataset(["current", "end"], { alpha: [0, 1] });
        }, "ignore");
        previousClickedNode?.eachSubgraph((node) => {
          node.setData("alpha", 1);
        }, "ignore");
        this.animate({
          duration: 500,
          modes: ["node-property:alpha"],
          onComplete: complete,
        });
      },
    });
    return true;
  }

  requestNodes(
    node: TreemapVisualizationNode<TNodeData, TEdgeData>,
    onComplete: () => void,
  ): void {
    const request = this.config.request;
    if (!request) {
      onComplete();
      return;
    }
    const levels = this.config.levelsToShow ?? 0;
    const leaves: Array<TreemapVisualizationNode<TNodeData, TEdgeData>> = [];
    const depth = node._depth as number;
    node.eachLevel(0, levels, (candidate) => {
      const nodeLevel = levels - ((candidate._depth as number) - depth);
      if (candidate.drawn && !candidate.anySubnode() && nodeLevel > 0) {
        leaves.push(candidate);
        candidate._level = nodeLevel;
      }
    });
    if (leaves.length === 0) {
      onComplete();
      return;
    }

    let completed = 0;
    for (const leaf of leaves) {
      request(leaf.id, leaf._level as number, {
        onComplete: (nodeId, data) => {
          if (data?.children) {
            const incoming = {
              ...data,
              id: nodeId,
            } as TreeNodeJson<TNodeData>;
            const graph = constructGraph(incoming, this.constructionOptions());
            sumIntoGraph(this.graph, graph);
          }
          completed += 1;
          if (completed === leaves.length) {
            this.graph.computeLevels(this.root, 0);
            onComplete();
          }
        },
      });
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

  private selectedRoot(): TreemapVisualizationNode<TNodeData, TEdgeData> {
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
        Node: { selected: false, exist: true, drawn: true },
      },
      node: this.config.Node,
      edge: this.config.Edge,
      label: this.config.Label,
    };
  }

  private requireNode(
    id: string,
  ): TreemapVisualizationNode<TNodeData, TEdgeData> {
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
