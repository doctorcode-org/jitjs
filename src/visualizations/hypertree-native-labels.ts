import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";
import type { HypertreeRadiusResolver } from "./hypertree-label-contracts.js";

export function renderHypertreeNativeLabel<
  TNode extends LabelNode,
  TController = unknown,
>(
  canvas: LabelCanvas,
  node: TNode,
  _controller: TController,
  getRadius: HypertreeRadiusResolver,
): void {
  const context = canvas.getCtx();
  const position = node.pos.getc(true);
  const radius = getRadius();
  context.fillText(node.name, position.x * radius, position.y * radius);
}

/** Hypertree's native Canvas labels with an explicitly injected radius. */
export class HypertreeNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  private readonly getRadius: HypertreeRadiusResolver;

  constructor(getRadius: HypertreeRadiusResolver) {
    super();
    this.getRadius = getRadius;
  }

  override plotLabel(
    canvas: LabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();
    // The original base label implementation performs this unused read before
    // applying styles. Preserve it because custom position objects can observe it.
    node.pos.getc(true);
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle =
      node.getLabelData<string>("color");
    context.textBaseline =
      node.getLabelData<CanvasTextBaseline>("textBaseline");
    renderHypertreeNativeLabel(
      canvas,
      node,
      controller,
      // Resolve only inside the renderer to retain legacy access order.
      this.getRadius,
    );
  }
}
