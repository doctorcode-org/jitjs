export interface PlotEdgeLike<TNode> {
  nodeTo: TNode;
}

export interface PlotNodeLike<TEdge> {
  drawn: unknown;
  visited?: unknown;
  getData<TValue = unknown>(property: string): TValue;
  eachAdjacency(visit: (edge: TEdge) => void): void;
}

export interface PlotGraphLike<TNode> {
  getNode(id: string): TNode | null | false | undefined;
  eachNode(visit: (node: TNode) => void): void;
}

export interface PlotCanvasLike {
  getCtx(): unknown;
  clear(): void;
}

export interface PlotGraphOptions<TNode, TEdge> extends Record<string, unknown> {
  clearCanvas?: unknown;
  withLabels?: unknown;
  onBeforePlotLine(edge: TEdge): void;
  onAfterPlotLine(edge: TEdge): void;
  onBeforePlotNode(node: TNode): void;
  onAfterPlotNode(node: TNode): void;
}

export interface PlotLabelRenderer<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
}

export interface PlotGraphDependencies<
  TNode extends PlotNodeLike<TEdge>,
  TEdge extends PlotEdgeLike<TNode>,
  TCanvas extends PlotCanvasLike,
  TOptions extends PlotGraphOptions<TNode, TEdge>,
> {
  graph: PlotGraphLike<TNode>;
  rootId: string;
  canvas: TCanvas;
  labels: PlotLabelRenderer<TNode, TCanvas, TOptions>;
  labelsHidden?: boolean;
  renderNode(node: TNode, canvas: TCanvas, animating?: boolean): void;
  renderEdge(edge: TEdge, canvas: TCanvas, animating?: boolean): void;
}

/**
 * Traverse and render a graph with Graph.Plot ordering and visited-state
 * semantics. Rendering primitives, Canvas, labels, and concrete Graph classes
 * are injected, so this module emits as a standalone leaf.
 */
export function plotGraph<
  TNode extends PlotNodeLike<TEdge>,
  TEdge extends PlotEdgeLike<TNode>,
  TCanvas extends PlotCanvasLike,
  TOptions extends PlotGraphOptions<TNode, TEdge>,
>(
  dependencies: PlotGraphDependencies<TNode, TEdge, TCanvas, TOptions>,
  options: TOptions,
  animating?: boolean,
): void {
  const { graph, canvas } = dependencies;

  // The legacy method obtains the context before clearing or validating root.
  canvas.getCtx();
  if (options.clearCanvas) {
    canvas.clear();
  }

  const root = graph.getNode(dependencies.rootId);
  if (!root) {
    return;
  }

  const visitedState = Boolean(root.visited);
  graph.eachNode((node) => {
    const nodeAlpha = node.getData<number>("alpha");
    node.eachAdjacency((edge) => {
      const nodeTo = edge.nodeTo;
      if (
        Boolean(nodeTo.visited) === visitedState &&
        Boolean(node.drawn) &&
        Boolean(nodeTo.drawn)
      ) {
        if (!animating) {
          options.onBeforePlotLine(edge);
        }
        dependencies.renderEdge(edge, canvas, animating);
        if (!animating) {
          options.onAfterPlotLine(edge);
        }
      }
    });

    if (node.drawn) {
      if (!animating) {
        options.onBeforePlotNode(node);
      }
      dependencies.renderNode(node, canvas, animating);
      if (!animating) {
        options.onAfterPlotNode(node);
      }
    }

    if (!dependencies.labelsHidden && options.withLabels) {
      if (node.drawn && nodeAlpha >= 0.95) {
        dependencies.labels.plotLabel(canvas, node, options);
      } else {
        dependencies.labels.hideLabel(node, false);
      }
    }

    node.visited = !visitedState;
  });
}
