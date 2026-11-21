export interface PlotTreeNodeLike<TEdge> {
  id: string;
  drawn: unknown;
  exist: unknown;
  getData<TValue = unknown>(property: string): TValue;
  getAdjacency(id: string): TEdge | undefined;
  eachSubnode(visit: (node: this) => void): void;
}

export interface PlotTreeCanvasLike {
  getCtx(): unknown;
}

export interface PlotTreeOptions<TNode, TEdge>
  extends Record<string, unknown> {
  withLabels?: unknown;
  hideLabels?: unknown;
  plotSubtree(node: TNode, child: TNode): unknown;
  onBeforePlotLine(edge: TEdge): void;
  onAfterPlotLine(edge: TEdge): void;
  onBeforePlotNode(node: TNode): void;
  onAfterPlotNode(node: TNode): void;
}

export interface PlotTreeLabels<TNode, TCanvas, TOptions> {
  plotLabel(canvas: TCanvas, node: TNode, options: TOptions): void;
  hideLabel(node: TNode, show: boolean): void;
}

export interface PlotTreeDependencies<
  TNode extends PlotTreeNodeLike<TEdge>,
  TEdge,
  TCanvas extends PlotTreeCanvasLike,
  TOptions extends PlotTreeOptions<TNode, TEdge>,
> {
  canvas: TCanvas;
  labels: PlotTreeLabels<TNode, TCanvas, TOptions>;
  renderNode(node: TNode, canvas: TCanvas, animating?: boolean): void;
  renderEdge(edge: TEdge, canvas: TCanvas, animating?: boolean): void;
}

/**
 * Render one rooted subtree with Graph.Plot.plotTree's recursive ordering.
 * Every external policy is injected, leaving this emitted module import-free.
 */
export function plotTree<
  TNode extends PlotTreeNodeLike<TEdge>,
  TEdge,
  TCanvas extends PlotTreeCanvasLike,
  TOptions extends PlotTreeOptions<TNode, TEdge>,
>(
  dependencies: PlotTreeDependencies<TNode, TEdge, TCanvas, TOptions>,
  node: TNode,
  options: TOptions,
  animating?: boolean,
): void {
  // Legacy obtains the context once for every recursive invocation.
  dependencies.canvas.getCtx();
  const nodeAlpha = node.getData<number>("alpha");

  node.eachSubnode((child) => {
    if (
      options.plotSubtree(node, child) &&
      child.exist &&
      child.drawn
    ) {
      const edge = node.getAdjacency(child.id) as TEdge;
      if (!animating) {
        options.onBeforePlotLine(edge);
      }
      dependencies.renderEdge(edge, dependencies.canvas, animating);
      if (!animating) {
        options.onAfterPlotLine(edge);
      }
      plotTree(dependencies, child, options, animating);
    }
  });

  if (node.drawn) {
    if (!animating) {
      options.onBeforePlotNode(node);
    }
    dependencies.renderNode(node, dependencies.canvas, animating);
    if (!animating) {
      options.onAfterPlotNode(node);
    }
    if (!options.hideLabels && options.withLabels && nodeAlpha >= 0.95) {
      dependencies.labels.plotLabel(dependencies.canvas, node, options);
    } else {
      dependencies.labels.hideLabel(node, false);
    }
  } else {
    dependencies.labels.hideLabel(node, true);
  }
}
