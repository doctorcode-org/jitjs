import type {
  LabelCanvas,
  LabelController,
  LabelNode,
} from "../graph/labels/contracts.js";

export interface IcicleDOMLabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}

export function getIcicleDOMLabelPosition(
  node: LabelNode,
  canvas: LabelCanvas,
): { x: number; y: number } {
  const position = node.pos.getc(true);
  const size = canvas.getSize();
  return {
    x: Math.round(position.x + size.width / 2),
    y: Math.round(position.y + size.height / 2),
  };
}

export function placeIcicleHTMLLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement,
  TCanvas extends LabelCanvas,
  TController extends IcicleDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const position = getIcicleDOMLabelPosition(node, canvas);
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.style.display = "";
  controller.onPlaceLabel(element, node);
}

export function placeIcicleSVGLabel<
  TNode extends LabelNode,
  TElement extends SVGElement,
  TCanvas extends LabelCanvas,
  TController extends IcicleDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
): void {
  const position = getIcicleDOMLabelPosition(node, canvas);
  element.setAttribute("x", String(position.x));
  element.setAttribute("y", String(position.y));
  controller.onPlaceLabel(element, node);
}
