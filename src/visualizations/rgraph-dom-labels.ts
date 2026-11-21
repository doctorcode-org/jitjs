import type {
  LabelController,
  LabelCoordinates,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";
import { projectToCanvas } from "../graph/labels/placement.js";

export type RGraphLabelNode = LabelNode;
export type RGraphLabelCanvas = TransformedLabelCanvas;

export interface RGraphDOMLabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}

export function getRGraphLabelPosition(
  node: LabelNode,
  canvas: TransformedLabelCanvas,
): LabelCoordinates {
  return projectToCanvas(node.pos.getc(true), canvas);
}

function fitsInCanvas(
  position: LabelCoordinates,
  canvas: TransformedLabelCanvas,
): boolean {
  const size = canvas.getSize();
  return (
    position.x < size.width &&
    position.x >= 0 &&
    position.y < size.height &&
    position.y >= 0
  );
}

export function placeRGraphHTMLLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement,
  TCanvas extends TransformedLabelCanvas,
  TController extends RGraphDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const labelPosition = getRGraphLabelPosition(node, canvas);
  element.style.left = `${labelPosition.x}px`;
  element.style.top = `${labelPosition.y}px`;
  element.style.display = fitsInCanvas(labelPosition, canvas) ? "" : "none";
  controller.onPlaceLabel(element, node);
}

export function placeRGraphSVGLabel<
  TNode extends LabelNode,
  TElement extends SVGTextElement,
  TCanvas extends TransformedLabelCanvas,
  TController extends RGraphDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const labelPosition = getRGraphLabelPosition(node, canvas);
  element.setAttribute("x", String(labelPosition.x));
  element.setAttribute("y", String(labelPosition.y));
  controller.onPlaceLabel(element, node);
}
