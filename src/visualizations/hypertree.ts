import { Animation } from "../core/animation.js";
import { Complex, Polar } from "../core/geometry.js";
import { merge } from "../core/util.js";
import {
  Graph,
  type GraphAdjacency,
  type GraphElementConfig,
  type GraphLabelConfig,
  type GraphNode,
} from "../graph/graph.js";
import { transformGraphMoebius } from "../graph/moebius.js";
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

export type HypertreeVisualizationNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Polar>;

export type HypertreeVisualizationEdge<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphAdjacency<TNodeData, TEdgeData, Polar>;

export interface HypertreeVisualizationCanvas<
  TContext extends ElementRenderContext = ElementRenderContext,
> extends ElementRenderCanvas<TContext> {
  clear(): void;
  getSize(): { width: number; height: number };
}

export interface HypertreeVisualizationLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
  hideLabels(hidden: boolean): void;
  clearLabels?(force?: boolean): void;
}

export interface HypertreeVisualizationConfig<TNode, TEdge>
  extends PlotGraphOptions<TNode, TEdge>,
    Record<string, unknown> {
  radius?: "auto" | number;
  offset?: number;
  Node: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Edge: GraphElementConfig & { CanvasStyles: Record<string, unknown> };
  Label: GraphLabelConfig;
  onBeforeCompute(node: TNode): void;
}

export type HypertreeNodeRenderer<TNode, TCanvas> = (
  type: string,
  node: TNode,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type HypertreeEdgeRenderer<TEdge, TCanvas> = (
  type: string,
  edge: TEdge,
  canvas: TCanvas,
  animating?: boolean,
) => void;

export type HypertreeInterpolator<TNode> = (
  mode: string,
  node: TNode,
  properties: readonly string[],
  delta: number,
  versor: Complex | undefined,
) => void;

export interface HypertreeVisualizationDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TContext extends ElementRenderContext,
  TCanvas extends HypertreeVisualizationCanvas<TContext>,
  TConfig extends HypertreeVisualizationConfig<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    HypertreeVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  canvas: TCanvas;
  config: TConfig;
  labels: HypertreeVisualizationLabels<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  renderNode: HypertreeNodeRenderer<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  renderEdge: HypertreeEdgeRenderer<
    HypertreeVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  interpolate?: HypertreeInterpolator<
    HypertreeVisualizationNode<TNodeData, TEdgeData>
  >;
  animation?: PlotAnimationDriver;
  computeNodeDimensions?: NodeDimensionComputer<TNodeData, TEdgeData>;
}

export interface HypertreeMoveOptions
  extends Partial<PlotAnimationOptions> {
  onComplete?: () => void;
}

/** Dependency-injected Hypertree without prototype or namespace patching. */
export class HypertreeVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends HypertreeVisualizationCanvas<TContext> =
    HypertreeVisualizationCanvas<TContext>,
  TConfig extends HypertreeVisualizationConfig<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    HypertreeVisualizationEdge<TNodeData, TEdgeData>
  > = HypertreeVisualizationConfig<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    HypertreeVisualizationEdge<TNodeData, TEdgeData>
  >,
> {
  readonly canvas: TCanvas;
  readonly config: TConfig;
  readonly labels: HypertreeVisualizationLabels<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas,
    TConfig
  >;
  readonly animation: PlotAnimationDriver;
  readonly renderNode: HypertreeNodeRenderer<
    HypertreeVisualizationNode<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly renderEdge: HypertreeEdgeRenderer<
    HypertreeVisualizationEdge<TNodeData, TEdgeData>,
    TCanvas
  >;
  readonly interpolate:
    | HypertreeInterpolator<HypertreeVisualizationNode<TNodeData, TEdgeData>>
    | undefined;
  readonly computeNodeDimensions:
    | NodeDimensionComputer<TNodeData, TEdgeData>
    | undefined;

  graph: Graph<TNodeData, TEdgeData, Polar>;
  root = "";
  json: LoaderJson<TNodeData, TEdgeData> | undefined;
  busy = false;

  constructor(
    dependencies: HypertreeVisualizationDependencies<
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
    this.busy = false;
  }

  getRadius(): number {
    const radius = this.config.radius ?? "auto";
    if (radius !== "auto") {
      return radius;
    }
    const size = this.canvas.getSize();
    return Math.min(size.width, size.height) / 2;
  }

  createLevelDistance(): (
    node: RadialNode<TNodeData, TEdgeData>,
  ) => number {
    const radius = this.getRadius();
    let depth = 0;
    this.graph.eachNode((node) => {
      depth = Math.max(node._depth as number, depth);
    }, "ignore");
    depth += 1;
    const generator = (factor: number) =>
      (node: RadialNode<TNodeData, TEdgeData>): number => {
        node.scale = radius;
        let remaining = (node._depth as number) + 1;
        let accumulated = 0;
        while (remaining) {
          accumulated += Math.pow(factor, remaining--);
        }
        return accumulated - (this.config.offset ?? 0);
      };

    for (let factor = 0.51; factor <= 1; factor += 0.01) {
      const series =
        (1 - Math.pow(factor, depth)) / (1 - factor);
      if (series >= 2) {
        return generator(factor - 0.01);
      }
    }
    return generator(0.75);
  }

  refresh(reposition = false): void {
    this.ensureLoaded();
    if (reposition) {
      this.reposition();
      this.graph.eachNode((node) => {
        node.startPos.rho = node.pos.rho = node.endPos.rho;
        node.startPos.theta = node.pos.theta = node.endPos.theta;
      });
    } else {
      this.compute();
    }
    this.plot();
  }

  reposition(): void {
    this.ensureLoaded();
    this.compute("end");
    const vector = this.requireNode(this.root).pos.getc().scale(-1);
    transformGraphMoebius(
      this.graph,
      [vector],
      ["end"],
      "end",
      "ignore",
    );
    this.graph.eachNode((node) => {
      if (node.ignore) {
        node.endPos.rho = node.pos.rho;
        node.endPos.theta = node.pos.theta;
      }
    });
  }

  compute(property?: PositionPhase | readonly PositionPhase[]): void {
    this.ensureLoaded();
    this.createLayout().compute(property);
  }

  plot(options: TConfig = this.config, animating?: boolean): void {
    this.ensureLoaded();
    plotGraph<
      HypertreeVisualizationNode<TNodeData, TEdgeData>,
      HypertreeVisualizationEdge<TNodeData, TEdgeData>,
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
    versor?: Complex,
  ): PlotAnimationDriver {
    this.ensureLoaded();
    const options = merge(
      this.config,
      { modes: ["moebius"] },
      requestedOptions,
    ) as TConfig & PlotAnimationOptions;
    return animatePlot<
      HypertreeVisualizationNode<TNodeData, TEdgeData>,
      TConfig & PlotAnimationOptions,
      Complex
    >(
      {
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta, value) => {
          if (!this.interpolate) {
            throw new TypeError(
              `No Hypertree interpolator was supplied for mode: ${mode}`,
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

  onClick(id: string, options: HypertreeMoveOptions = {}): boolean {
    const position = this.requireNode(id).pos.getc(true);
    return this.move(position, options);
  }

  move(
    position: { x: number; y: number },
    options: HypertreeMoveOptions = {},
  ): boolean {
    this.ensureLoaded();
    const versor = new Complex(position.x, position.y);
    if (this.busy !== false || versor.norm() >= 1) {
      return false;
    }

    this.busy = true;
    const closest = this.graph.getClosestNodeToPos(versor);
    if (!closest) {
      this.busy = false;
      return false;
    }
    this.graph.computeLevels(closest.id, 0);
    this.config.onBeforeCompute(closest);
    const onComplete = options.onComplete ?? (() => {});
    this.animate(
      {
        modes: ["moebius"],
        hideLabels: true,
        ...options,
        onComplete: () => {
          this.busy = false;
          onComplete();
        },
      },
      versor,
    );
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
  ): HypertreeVisualizationNode<TNodeData, TEdgeData> {
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
