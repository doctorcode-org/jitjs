import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";

export interface HeatMapLabelController {
  showNodeNames?: unknown;
}

export function renderHeatMapNativeLabel<
  TNode extends LabelNode,
  TController extends HeatMapLabelController,
>(canvas: LabelCanvas, node: TNode, controller: TController): void {
  if (!controller.showNodeNames) return;
  const position = node.pos.getc(true);
  canvas.getCtx().fillText(
    node.name,
    position.x + node.getData<number>("width") / 2,
    position.y + node.getData<number>("height") / 2,
  );
}

export class HeatMapNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController extends HeatMapLabelController = HeatMapLabelController,
> extends NativeLabels<TNode, TController> {
  constructor() {
    super(renderHeatMapNativeLabel);
  }
}
