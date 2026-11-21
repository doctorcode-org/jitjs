import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";

export function renderIcicleNativeLabel<
  TNode extends LabelNode,
  TController = unknown,
>(
  canvas: LabelCanvas,
  node: TNode,
  _controller: TController,
): void {
  const context = canvas.getCtx();
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const size = node.getLabelData<number>("size");
  const measurement = context.measureText(node.name);

  if (height < size * 1.5 || width < measurement.width) {
    return;
  }

  const position = node.pos.getc(true);
  context.fillText(
    node.name,
    position.x + width / 2,
    position.y + height / 2,
  );
}

/** Icicle's Canvas label backend, kept independent of DOM label code. */
export class IcicleNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  constructor() {
    super(renderIcicleNativeLabel);
  }

  override plotLabel(
    canvas: LabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();
    // Graph.Label.Native in JIT 2.0.1 reads this position before styling even
    // though its local value is unused. Preserve the observable access order.
    node.pos.getc(true);
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle =
      node.getLabelData<string>("color");
    context.textBaseline =
      node.getLabelData<CanvasTextBaseline>("textBaseline");
    renderIcicleNativeLabel(canvas, node, controller);
  }
}
