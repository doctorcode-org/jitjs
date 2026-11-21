import type { LabelCoordinates, LabelNode } from "../graph/labels/contracts.js";
import { projectToCanvas } from "../graph/labels/placement.js";
import type {
  ForceDirectedDOMLabelController,
  ForceDirectedLabelCanvas,
} from "./force-directed-label-contracts.js";

/** Projects a force-layout coordinate through the canvas scale and translation. */
export function getForceDirectedLabelPosition(
  node: LabelNode,
  canvas: ForceDirectedLabelCanvas,
): LabelCoordinates {
  return projectToCanvas(node.pos.getc(true), canvas);
}

function fitsInCanvas(
  position: LabelCoordinates,
  canvas: ForceDirectedLabelCanvas,
): boolean {
  const size = canvas.getSize();
  return (
    position.x < size.width &&
    position.x >= 0 &&
    position.y < size.height &&
    position.y >= 0
  );
}

/** ForceDirected's HTML placement override from JIT 2.0.1. */
export function placeForceDirectedHTMLLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement,
  TCanvas extends ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const labelPosition = getForceDirectedLabelPosition(node, canvas);
  element.style.left = `${labelPosition.x}px`;
  element.style.top = `${labelPosition.y}px`;
  element.style.display = fitsInCanvas(labelPosition, canvas) ? "" : "none";
  controller.onPlaceLabel(element, node);
}

/** ForceDirected's SVG placement override from JIT 2.0.1. */
export function placeForceDirectedSVGLabel<
  TNode extends LabelNode,
  TElement extends SVGTextElement,
  TCanvas extends ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const labelPosition = getForceDirectedLabelPosition(node, canvas);
  element.setAttribute("x", String(labelPosition.x));
  element.setAttribute("y", String(labelPosition.y));
  controller.onPlaceLabel(element, node);
}
