import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import type { LabelController, LabelNode, TransformedLabelCanvas } from "../graph/labels/contracts.js";
import { placeGridChartHTMLLabel } from "./grid-chart-dom-labels.js";

export type GridChartHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends TransformedLabelCanvas = TransformedLabelCanvas,
  TController extends LabelController<TNode, HTMLElement> = LabelController<TNode, HTMLElement>,
> = Omit<DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>, "placeLabel">;

export class GridChartHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends TransformedLabelCanvas = TransformedLabelCanvas,
  TController extends LabelController<TNode, HTMLElement> = LabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: GridChartHTMLLabelsOptions<TNode, TCanvas, TController>) {
    super({ ...options, placeLabel: placeGridChartHTMLLabel });
  }
}
