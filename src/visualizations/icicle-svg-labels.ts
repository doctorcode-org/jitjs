import type { LabelNode } from "../graph/labels/contracts.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import {
  type IcicleDOMLabelController,
  placeIcicleSVGLabel,
} from "./icicle-dom-labels.js";

export type IcicleSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends import("../graph/labels/contracts.js").LabelCanvas = import("../graph/labels/contracts.js").LabelCanvas,
  TController extends IcicleDOMLabelController<
    TNode,
    SVGTextElement
  > = IcicleDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
>;

/** Icicle's SVG backend, composed over the shared DOM label lifecycle. */
export class IcicleSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends import("../graph/labels/contracts.js").LabelCanvas = import("../graph/labels/contracts.js").LabelCanvas,
  TController extends IcicleDOMLabelController<
    TNode,
    SVGTextElement
  > = IcicleDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: IcicleSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeIcicleSVGLabel,
    });
  }
}
