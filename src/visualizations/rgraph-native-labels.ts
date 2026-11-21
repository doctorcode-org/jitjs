import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import {
  NativeLabels,
  renderNativeLabel,
} from "../graph/labels/native.js";

export function renderRGraphNativeLabel<
  TNode extends LabelNode,
  TController = unknown,
>(
  canvas: LabelCanvas,
  node: TNode,
  controller: TController,
): void {
  renderNativeLabel(canvas, node, controller);
}

/** RGraph's native backend is the unmodified Graph.Label.Native behavior. */
export class RGraphNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  constructor() {
    super(renderRGraphNativeLabel);
  }
}
