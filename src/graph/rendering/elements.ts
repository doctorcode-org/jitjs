export interface ElementRenderContext {
  lineWidth: unknown;
  fillStyle: unknown;
  strokeStyle: unknown;
  globalAlpha: unknown;
  save(): void;
  restore(): void;
  [property: string]: unknown;
}

export interface ElementRenderCanvas<TContext extends ElementRenderContext> {
  getCtx(): TContext;
}

export interface RenderableElement {
  getData<TValue = unknown>(property: string): TValue;
  getCanvasStyle<TValue = unknown>(property: string): TValue;
}

export interface RenderableNode extends RenderableElement {}

export interface RenderableEdge<TNode extends RenderableNode = RenderableNode>
  extends RenderableElement {
  nodeFrom: TNode;
  nodeTo: TNode;
}

export type CanvasStyleConfig = Readonly<Record<string, unknown>>;

export interface NodeElementRenderer<
  TNode extends RenderableNode,
  TCanvas,
> {
  (
    type: string,
    node: TNode,
    canvas: TCanvas,
    animating?: boolean,
  ): void;
}

export interface EdgeElementRenderer<
  TEdge extends RenderableEdge,
  TCanvas,
> {
  (
    type: string,
    edge: TEdge,
    canvas: TCanvas,
    animating?: boolean,
  ): void;
}

/** Apply legacy node context state, then delegate shape selection explicitly. */
export function renderNodeElement<
  TNode extends RenderableNode,
  TContext extends ElementRenderContext,
  TCanvas extends ElementRenderCanvas<TContext>,
>(
  node: TNode,
  canvas: TCanvas,
  canvasStyles: CanvasStyleConfig,
  render: NodeElementRenderer<TNode, TCanvas>,
  animating?: boolean,
): void {
  const type = node.getData<string>("type");
  if (type == "none") {
    return;
  }

  const context = canvas.getCtx();
  context.save();
  context.lineWidth = node.getData("lineWidth");
  const color = node.getData("color");
  context.strokeStyle = color;
  context.fillStyle = color;
  context.globalAlpha = node.getData("alpha");

  for (const property in canvasStyles) {
    (context as ElementRenderContext)[property] =
      node.getCanvasStyle(property);
  }

  render(type, node, canvas, animating);
  context.restore();
}

/** Apply legacy edge context state, including endpoint alpha composition. */
export function renderEdgeElement<
  TNode extends RenderableNode,
  TEdge extends RenderableEdge<TNode>,
  TContext extends ElementRenderContext,
  TCanvas extends ElementRenderCanvas<TContext>,
>(
  edge: TEdge,
  canvas: TCanvas,
  canvasStyles: CanvasStyleConfig,
  render: EdgeElementRenderer<TEdge, TCanvas>,
  animating?: boolean,
): void {
  const type = edge.getData<string>("type");
  if (type == "none") {
    return;
  }

  const context = canvas.getCtx();
  context.save();
  context.lineWidth = edge.getData("lineWidth");
  const color = edge.getData("color");
  context.strokeStyle = color;
  context.fillStyle = color;
  context.globalAlpha = Math.min(
    edge.nodeFrom.getData<number>("alpha"),
    edge.nodeTo.getData<number>("alpha"),
    edge.getData<number>("alpha"),
  );

  for (const property in canvasStyles) {
    (context as ElementRenderContext)[property] =
      edge.getCanvasStyle(property);
  }

  render(type, edge, canvas, animating);
  context.restore();
}
