import { projectToCanvas } from "../graph/labels/placement.js";
import type {
  TreemapDOMLabelController,
  TreemapLabelCanvas,
  TreemapLabelConfig,
  TreemapLabelNode,
  TreemapLeafPredicate,
} from "./treemap-label-contracts.js";

export function getTreemapLabelPosition(
  node: TreemapLabelNode,
  canvas: TreemapLabelCanvas,
): { x: number; y: number } {
  return projectToCanvas(node.pos.getc(true), canvas);
}

export function placeTreemapHTMLLabel<
  TNode extends TreemapLabelNode,
  TElement extends HTMLElement,
  TController extends TreemapDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TreemapLabelCanvas,
  controller: TController,
  leaf: TreemapLeafPredicate<TNode>,
  config: TreemapLabelConfig,
): void {
  const position = getTreemapLabelPosition(node, canvas);
  const style = element.style;
  style.left = `${position.x}px`;
  style.top = `${position.y}px`;
  style.width = `${node.getData<number>("width") * canvas.scaleOffsetX}px`;
  style.height = `${node.getData<number>("height") * canvas.scaleOffsetY}px`;
  // Direct numeric assignment is the 2.0.1 behavior; real CSS declarations
  // coerce it to text while structural test/style objects retain the number.
  (style as unknown as { zIndex: number }).zIndex = node._depth * 100;
  style.display = "";
  if (!leaf(node) && !config.titleHeight) style.display = "none";
  controller.onPlaceLabel(element, node);
}

export function placeTreemapSVGLabel<
  TNode extends TreemapLabelNode,
  TElement extends SVGElement,
  TController extends TreemapDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TreemapLabelCanvas,
  controller: TController,
  leaf: TreemapLeafPredicate<TNode>,
  config: TreemapLabelConfig,
): void {
  const position = getTreemapLabelPosition(node, canvas);
  element.setAttribute("x", String(position.x));
  element.setAttribute("y", String(position.y));
  if (!leaf(node) && !config.titleHeight) element.style.display = "none";
  controller.onPlaceLabel(element, node);
}
