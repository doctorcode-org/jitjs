import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import {
  NativeLabels,
  renderNativeLabel,
} from "../graph/labels/native.js";

/** ForceDirected uses Graph.Label.Native's renderer without modification. */
export function renderForceDirectedNativeLabel<
  TNode extends LabelNode,
  TController = unknown,
>(
  canvas: LabelCanvas,
  node: TNode,
  controller: TController,
): void {
  renderNativeLabel(canvas, node, controller);
}

/**
 * Canvas-native ForceDirected labels. The explicit override retains the
 * otherwise-unused position read performed by Graph.Label.Native in JIT 2.0.1.
 */
export class ForceDirectedNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  constructor() {
    super(renderForceDirectedNativeLabel);
  }

  override plotLabel(
    canvas: LabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();
    node.pos.getc(true);
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle =
      node.getLabelData<string>("color");
    context.textBaseline =
      node.getLabelData<CanvasTextBaseline>("textBaseline");
    renderForceDirectedNativeLabel(canvas, node, controller);
  }
}
