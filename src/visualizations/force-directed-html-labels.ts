import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import {
  type ForceDirectedDOMLabelController,
  type ForceDirectedLabelCanvas,
} from "./force-directed-label-contracts.js";
import { placeForceDirectedHTMLLabel } from "./force-directed-dom-labels.js";

export type ForceDirectedHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends ForceDirectedLabelCanvas = ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<
    TNode,
    HTMLElement
  > = ForceDirectedDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
>;

/** HTML ForceDirected labels with the visualization's projection injected. */
export class ForceDirectedHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends ForceDirectedLabelCanvas = ForceDirectedLabelCanvas,
  TController extends ForceDirectedDOMLabelController<
    TNode,
    HTMLElement
  > = ForceDirectedDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(
    options: ForceDirectedHTMLLabelsOptions<TNode, TCanvas, TController>,
  ) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeForceDirectedHTMLLabel,
    });
  }
}
