import type {
  LabelController,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";

export interface TreemapLabelNode extends LabelNode {
  _depth: number;
}

export type TreemapLeafPredicate<TNode extends TreemapLabelNode> = (
  node: TNode,
) => boolean;

export interface TreemapLabelConfig extends Record<string, unknown> {
  titleHeight: number;
}

export interface TreemapDOMLabelController<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}

export type TreemapLabelCanvas = TransformedLabelCanvas;
