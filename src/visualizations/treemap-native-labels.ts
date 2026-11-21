import type { LabelCanvas } from "../graph/labels/contracts.js";
import { NativeLabels } from "../graph/labels/native.js";
import type {
  TreemapLabelConfig,
  TreemapLabelNode,
  TreemapLeafPredicate,
} from "./treemap-label-contracts.js";

export function renderTreemapNativeLabel<TNode extends TreemapLabelNode>(
  canvas: LabelCanvas,
  node: TNode,
  _controller: unknown,
  leaf: TreemapLeafPredicate<TNode>,
  config: TreemapLabelConfig,
): void {
  if (!leaf(node) && !config.titleHeight) return;
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  // The legacy renderer reads height even though the value is not used. Keep
  // that observable getter call for nodes with computed/lazy data accessors.
  node.getData<number>("height");
  canvas
    .getCtx()
    .fillText(node.name, position.x + width / 2, position.y, width);
}

/** Canvas-native Treemap labels without DOM or a global backend registry. */
export class TreemapNativeLabels<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TController = unknown,
> extends NativeLabels<TNode, TController> {
  private readonly leaf: TreemapLeafPredicate<TNode>;
  private readonly config: TreemapLabelConfig;

  constructor(
    leaf: TreemapLeafPredicate<TNode>,
    config: TreemapLabelConfig,
  ) {
    super((canvas, node, controller) =>
      renderTreemapNativeLabel(canvas, node, controller, leaf, config),
    );
    this.leaf = leaf;
    this.config = config;
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
    renderTreemapNativeLabel(
      canvas,
      node,
      controller,
      this.leaf,
      this.config,
    );
  }
}
