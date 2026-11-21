import type {
  SunburstDOMLabelController,
  SunburstLabelCanvas,
  SunburstLabelNode,
  SunburstLabelState,
} from "./sunburst-label-contracts.js";

export interface SunburstDOMLabelPosition {
  x: number;
  y: number;
}

function fitsInCanvas(
  position: SunburstDOMLabelPosition,
  canvas: SunburstLabelCanvas,
): boolean {
  const size = canvas.getSize();
  return (
    position.x < size.width &&
    position.x >= 0 &&
    position.y < size.height &&
    position.y >= 0
  );
}

export function getSunburstSVGLabelPosition(
  node: SunburstLabelNode,
  canvas: SunburstLabelCanvas,
): SunburstDOMLabelPosition {
  const position = node.pos.getc(true);
  const size = canvas.getSize();
  return {
    x: Math.round(position.x + size.width / 2),
    y: Math.round(position.y + size.height / 2),
  };
}

export function getSunburstHTMLLabelPosition(
  node: SunburstLabelNode,
  canvas: SunburstLabelCanvas,
  state: SunburstLabelState,
): SunburstDOMLabelPosition {
  const position = node.pos.clone();
  const height = node.getData<number>("height");
  const radialOffset =
    ((height || node._depth == 0) ? height : state.config.levelDistance) / 2;
  position.rho += radialOffset;
  const cartesian = position.getc(true);
  const size = canvas.getSize();
  return {
    x: Math.round(cartesian.x + size.width / 2),
    y: Math.round(cartesian.y + size.height / 2),
  };
}

/** Place a Sunburst HTML label along the radial midpoint of its slice. */
export function placeSunburstHTMLLabel<
  TNode extends SunburstLabelNode,
  TElement extends HTMLElement,
  TCanvas extends SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
  state: SunburstLabelState,
): void {
  const labelPosition = getSunburstHTMLLabelPosition(node, canvas, state);
  element.style.left = `${labelPosition.x}px`;
  element.style.top = `${labelPosition.y}px`;
  element.style.display = fitsInCanvas(labelPosition, canvas) ? "" : "none";
  controller.onPlaceLabel(element, node);
}

/** Place and rotate a Sunburst SVG label using the original angular rules. */
export function placeSunburstSVGLabel<
  TNode extends SunburstLabelNode,
  TElement extends SVGTextElement,
  TCanvas extends SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<TNode, TElement>,
>(
  element: TElement,
  node: TNode,
  canvas: TCanvas,
  controller: TController,
  state: SunburstLabelState,
): void {
  const labelPosition = getSunburstSVGLabelPosition(node, canvas);
  element.setAttribute("x", String(labelPosition.x));
  element.setAttribute("y", String(labelPosition.y));

  const bounds = element.getBBox();
  if (bounds) {
    const x = element.getAttribute("x") as string;
    const y = element.getAttribute("y") as string;
    const polar = node.pos.getp(true);
    const pi = Math.PI;
    const pointsLeft = polar.theta > pi / 2 && polar.theta < (3 * pi) / 2;

    if (pointsLeft) {
      element.setAttribute("x", String(Number(x) - bounds.width));
      element.setAttribute("y", String(Number(y) - bounds.height));
    } else if (node.id == state.root) {
      element.setAttribute("x", String(Number(x) - bounds.width / 2));
    }

    const labelAngle = pointsLeft ? polar.theta + pi : polar.theta;
    if (node._depth) {
      element.setAttribute(
        "transform",
        `rotate(${(labelAngle * 360) / (2 * pi)} ${x} ${y})`,
      );
    }
  }

  controller.onPlaceLabel(element, node);
}
