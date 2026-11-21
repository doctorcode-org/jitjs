import type { LabelCanvas, LabelNode } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";
import { getSpaceTreeAlignedPosition } from "./space-tree-renderer-contracts.js";
import type { SpaceTreeLabelConfig } from "./space-tree-label-contracts.js";

export function renderSpaceTreeNativeLabel<
  TNode extends LabelNode,
  TController = unknown,
>(
  canvas: LabelCanvas,
  node: TNode,
  _controller: TController,
  config: SpaceTreeLabelConfig,
): void {
  const context = canvas.getCtx();
  const coordinate = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const position = getSpaceTreeAlignedPosition(
    coordinate,
    width,
    height,
    config,
  );
  context.fillText(
    node.name,
    position.x + width / 2,
    position.y + height / 2,
  );
}

/** SpaceTree's Canvas label backend with configuration captured explicitly. */
export class SpaceTreeNativeLabels<
  TNode extends LabelNode = LabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  private readonly config: SpaceTreeLabelConfig;

  constructor(config: SpaceTreeLabelConfig) {
    super((canvas, node, controller) => {
      renderSpaceTreeNativeLabel(canvas, node, controller, config);
    });
    this.config = config;
  }

  override plotLabel(
    canvas: LabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();

    // Graph.Label.Native in JIT 2.0.1 reads the Cartesian position here even
    // though its SpaceTree override reads it again while rendering. Retaining
    // that observable getter call keeps custom position implementations exact.
    node.pos.getc(true);
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle = node.getLabelData<string>("color");
    context.textBaseline =
      node.getLabelData<CanvasTextBaseline>("textBaseline");

    renderSpaceTreeNativeLabel(canvas, node, controller, this.config);
  }
}
