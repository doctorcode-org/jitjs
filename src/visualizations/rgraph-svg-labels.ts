import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import {
  type RGraphDOMLabelController,
  type RGraphLabelCanvas,
  placeRGraphSVGLabel,
} from "./rgraph-dom-labels.js";

export type RGraphSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends RGraphLabelCanvas = RGraphLabelCanvas,
  TController extends RGraphDOMLabelController<
    TNode,
    SVGTextElement
  > = RGraphDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
>;

/** RGraph SVG labels with radial canvas projection captured explicitly. */
export class RGraphSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends RGraphLabelCanvas = RGraphLabelCanvas,
  TController extends RGraphDOMLabelController<
    TNode,
    SVGTextElement
  > = RGraphDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: RGraphSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeRGraphSVGLabel,
    });
  }
}
