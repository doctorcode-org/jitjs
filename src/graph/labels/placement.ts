import type {
  LabelCoordinates,
  TransformedLabelCanvas,
} from "./contracts.js";

/** Shared cartesian-to-label projection used by force and radial visualizations. */
export function projectToCanvas(
  position: LabelCoordinates,
  canvas: TransformedLabelCanvas,
): LabelCoordinates {
  const size = canvas.getSize();
  return {
    x: Math.round(
      position.x * canvas.scaleOffsetX +
        canvas.translateOffsetX +
        size.width / 2,
    ),
    y: Math.round(
      position.y * canvas.scaleOffsetY +
        canvas.translateOffsetY +
        size.height / 2,
    ),
  };
}
