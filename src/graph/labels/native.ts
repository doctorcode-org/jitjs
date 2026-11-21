import type {
  LabelCanvas,
  LabelNode,
} from "./contracts.js";

export type NativeLabelRenderer<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> = (
  canvas: LabelCanvas,
  node: TNode,
  controller: TController,
) => void;

export function renderNativeLabel<TNode extends LabelNode, TController = unknown>(
  canvas: LabelCanvas,
  node: TNode,
  _controller: TController,
): void {
  const position = node.pos.getc(true);
  canvas.getCtx().fillText(
    node.name,
    position.x,
    position.y + node.getData<number>("height") / 2,
  );
}

/** Canvas-native labels with no DOM dependency or runtime import. */
export class NativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> {
  private readonly renderer: NativeLabelRenderer<TNode, TController>;

  constructor(
    renderer: NativeLabelRenderer<TNode, TController> = renderNativeLabel,
  ) {
    this.renderer = renderer;
  }

  plotLabel(
    canvas: LabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle = node.getLabelData<string>("color");
    context.textBaseline = node.getLabelData<CanvasTextBaseline>("textBaseline");
    this.renderer(canvas, node, controller);
  }

  hideLabel(_node: TNode | readonly TNode[], _show?: boolean): void {}

  hideLabels(_hide?: boolean): void {}
}
