import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import {
  type RGraphDOMLabelController,
  type RGraphLabelCanvas,
  placeRGraphHTMLLabel,
} from "./rgraph-dom-labels.js";

export type RGraphHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends RGraphLabelCanvas = RGraphLabelCanvas,
  TController extends RGraphDOMLabelController<
    TNode,
    HTMLElement
  > = RGraphDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
>;

/** RGraph HTML labels with radial canvas projection captured explicitly. */
export class RGraphHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends RGraphLabelCanvas = RGraphLabelCanvas,
  TController extends RGraphDOMLabelController<
    TNode,
    HTMLElement
  > = RGraphDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: RGraphHTMLLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeRGraphHTMLLabel,
    });
  }
}
