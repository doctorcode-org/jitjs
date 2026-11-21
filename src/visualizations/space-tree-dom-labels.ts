import type {
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";
import { getSpaceTreeAlignedPosition } from "./space-tree-renderer-contracts.js";
import type {
  SpaceTreeDOMLabelController,
  SpaceTreeLabelConfig,
} from "./space-tree-label-contracts.js";

export function placeSpaceTreeDOMLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement | SVGElement,
  TCanvas extends TransformedLabelCanvas,
  TController extends SpaceTreeDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
  config: SpaceTreeLabelConfig,
): void {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const size = canvas.getSize();
  const projected = {
    x: position.x * canvas.scaleOffsetX + canvas.translateOffsetX,
    y: position.y * canvas.scaleOffsetY + canvas.translateOffsetY,
  };
  const corner = getSpaceTreeAlignedPosition(
    projected,
    width,
    height,
    config,
  );
  const labelPosition = {
    x: Math.round(corner.x + size.width / 2),
    y: Math.round(corner.y + size.height / 2),
  };

  element.style.left = `${labelPosition.x}px`;
  element.style.top = `${labelPosition.y}px`;
  // ST.Label.DOM delegates this check to Graph.Label.DOM#fitsInCanvas,
  // which reads the canvas size a second time. Preserve that behavior for
  // dynamically resized canvases and observable custom canvas adapters.
  const boundary = canvas.getSize();
  element.style.display =
    labelPosition.x < boundary.width &&
    labelPosition.x >= 0 &&
    labelPosition.y < boundary.height &&
    labelPosition.y >= 0
      ? ""
      : "none";
  controller.onPlaceLabel(element, node);
}
