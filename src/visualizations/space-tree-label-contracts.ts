import type {
  LabelController,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";
import type { SpaceTreeRendererConfig } from "./space-tree-renderer-contracts.js";

export type SpaceTreeLabelConfig = Pick<
  SpaceTreeRendererConfig,
  "orientation" | "Node"
>;

export type SpaceTreeLabelNode = LabelNode;

export type SpaceTreeLabelCanvas = TransformedLabelCanvas;

export interface SpaceTreeDOMLabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}
