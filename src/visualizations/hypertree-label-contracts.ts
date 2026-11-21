import type {
  LabelController,
  LabelNode,
  TransformedLabelCanvas,
} from "../graph/labels/contracts.js";

/** Canvas surface required by Hypertree's scaled radial label projection. */
export type HypertreeLabelCanvas = TransformedLabelCanvas;

/**
 * Resolves the current Hypertree radius without coupling a label backend to the
 * visualization facade. Keeping this as an injected function also preserves
 * automatic radii when a canvas is resized.
 */
export type HypertreeRadiusResolver = () => number;

export interface HypertreeDOMLabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}
