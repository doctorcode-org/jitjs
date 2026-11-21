import type {
  LabelController,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";

/** Minimal node surface consumed by ForceDirected label backends. */
export type ForceDirectedLabelNode = LabelNode;

/** Canvas transform surface used by ForceDirected DOM labels. */
export type ForceDirectedLabelCanvas = TransformedLabelCanvas;

export interface ForceDirectedDOMLabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}
