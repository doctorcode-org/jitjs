import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import {
  type ForceDirectedDOMLabelController,
  type ForceDirectedLabelCanvas,
} from "./force-directed-label-contracts.js";
import { placeForceDirectedSVGLabel } from "./force-directed-dom-labels.js";

export type ForceDirectedSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends ForceDirectedLabelCanvas = ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<
    TNode,
    SVGTextElement
  > = ForceDirectedDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
>;

/** SVG ForceDirected labels with the visualization's projection injected. */
export class ForceDirectedSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends ForceDirectedLabelCanvas = ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<
    TNode,
    SVGTextElement
  > = ForceDirectedDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(
    options: ForceDirectedSVGLabelsOptions<TNode, TCanvas, TController>,
  ) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeForceDirectedSVGLabel,
    });
  }
}
