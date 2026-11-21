import type {
  LabelController,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";
import { projectToCanvas } from "../graph/labels/placement.js";

export function placeGridChartHTMLLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement,
  TCanvas extends TransformedLabelCanvas,
  TController extends LabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const position = projectToCanvas(node.pos.getc(true), canvas);
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.style.width = `${(node.getData<number>("width") * canvas.scaleOffsetX) >> 0}px`;
  element.style.height = `${(node.getData<number>("height") * canvas.scaleOffsetY) >> 0}px`;
  controller.onPlaceLabel?.(element, node);
}

export function placeGridChartSVGLabel<
  TNode extends LabelNode,
  TElement extends SVGTextElement,
  TCanvas extends TransformedLabelCanvas,
  TController extends LabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const position = projectToCanvas(node.pos.getc(true), canvas);
  element.setAttribute("x", String(position.x));
  element.setAttribute("y", String(position.y));
  controller.onPlaceLabel?.(element, node);
}
