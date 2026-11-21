import type {
  LabelCoordinates,
  LabelNode,
} from "../graph/labels/contracts.js";
import type {
  HypertreeDOMLabelController,
  HypertreeLabelCanvas,
  HypertreeRadiusResolver,
} from "./hypertree-label-contracts.js";

/** Project a normalized Hypertree position into the transformed label canvas. */
export function getHypertreeLabelPosition(
  node: LabelNode,
  canvas: HypertreeLabelCanvas,
  getRadius: HypertreeRadiusResolver,
): LabelCoordinates {
  // Keep reads in JIT 2.0.1 order; user supplied accessors can be observable.
  const position = node.pos.getc(true);
  const translateOffsetX = canvas.translateOffsetX;
  const translateOffsetY = canvas.translateOffsetY;
  const scaleOffsetX = canvas.scaleOffsetX;
  const scaleOffsetY = canvas.scaleOffsetY;
  const size = canvas.getSize();
  const radius = getRadius();

  return {
    x: Math.round(
      position.x * scaleOffsetX * radius +
        translateOffsetX +
        size.width / 2,
    ),
    y: Math.round(
      position.y * scaleOffsetY * radius +
        translateOffsetY +
        size.height / 2,
    ),
  };
}

function fitsInCanvas(
  position: LabelCoordinates,
  canvas: HypertreeLabelCanvas,
): boolean {
  const size = canvas.getSize();
  return (
    position.x < size.width &&
    position.x >= 0 &&
    position.y < size.height &&
    position.y >= 0
  );
}

export function placeHypertreeHTMLLabel<
  TNode extends LabelNode,
  TElement extends HTMLElement,
  TCanvas extends HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
  getRadius: HypertreeRadiusResolver,
): void {
  const position = getHypertreeLabelPosition(node, canvas, getRadius);
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.style.display = fitsInCanvas(position, canvas) ? "" : "none";
  controller.onPlaceLabel(element, node);
}

export function placeHypertreeSVGLabel<
  TNode extends LabelNode,
  TElement extends SVGElement,
  TCanvas extends HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
  getRadius: HypertreeRadiusResolver,
): void {
  const position = getHypertreeLabelPosition(node, canvas, getRadius);
  element.setAttribute("x", String(position.x));
  element.setAttribute("y", String(position.y));
  controller.onPlaceLabel(element, node);
}
