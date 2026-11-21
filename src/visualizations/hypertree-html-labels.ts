import type { LabelNode } from "../graph/labels/contracts.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import {
  type HypertreeDOMLabelController,
  type HypertreeLabelCanvas,
  type HypertreeRadiusResolver,
} from "./hypertree-label-contracts.js";
import { placeHypertreeHTMLLabel } from "./hypertree-dom-labels.js";

export type HypertreeHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends HypertreeLabelCanvas = HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<
    TNode,
    HTMLElement
  > = HypertreeDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
> & {
  getRadius: HypertreeRadiusResolver;
};

/** Hypertree's HTML backend, composed over the shared DOM lifecycle. */
export class HypertreeHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends HypertreeLabelCanvas = HypertreeLabelCanvas,
  TController extends HypertreeDOMLabelController<
    TNode,
    HTMLElement
  > = HypertreeDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(
    options: HypertreeHTMLLabelsOptions<TNode, TCanvas, TController>,
  ) {
    const getRadius = options.getRadius;
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) => {
        placeHypertreeHTMLLabel(
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
