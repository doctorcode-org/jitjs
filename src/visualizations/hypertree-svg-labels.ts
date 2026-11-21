import type { LabelNode } from "../graph/labels/contracts.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import {
  type HypertreeDOMLabelController,
  type HypertreeLabelCanvas,
  type HypertreeRadiusResolver,
} from "./hypertree-label-contracts.js";
import { placeHypertreeSVGLabel } from "./hypertree-dom-labels.js";

export type HypertreeSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends HypertreeLabelCanvas = HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<
    TNode,
    SVGTextElement
  > = HypertreeDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
> & {
  getRadius: HypertreeRadiusResolver;
};

/** Hypertree's SVG backend, composed over the shared DOM lifecycle. */
export class HypertreeSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends HypertreeLabelCanvas = HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<
    TNode,
    SVGTextElement
  > = HypertreeDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(
    options: HypertreeSVGLabelsOptions<TNode, TCanvas, TController>,
  ) {
    const getRadius = options.getRadius;
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) => {
        placeHypertreeSVGLabel(
          element,
          node,
          canvas,
          controller,
          getRadius,
        );
      },
    });
  }
}
