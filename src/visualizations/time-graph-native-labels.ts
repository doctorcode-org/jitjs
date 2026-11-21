import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";

export function renderTimeGraphNativeLabel<TNode extends LabelNode>(
  canvas: LabelCanvas,
  node: TNode,
): void {
  const position = node.pos.getc(true);
  canvas.getCtx().fillText(
    node.name,
    position.x + node.getData<number>("width") / 2,
    position.y + node.getData<number>("height") / 2,
  );
}

export class TimeGraphNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  constructor() {
    super(renderTimeGraphNativeLabel);
  }
}
