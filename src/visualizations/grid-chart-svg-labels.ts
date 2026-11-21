import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import type { LabelController, LabelNode, TransformedLabelCanvas } from "../graph/labels/contracts.js";
import { placeGridChartSVGLabel } from "./grid-chart-dom-labels.js";

export type GridChartSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends TransformedLabelCanvas = TransformedLabelCanvas,
  TController extends LabelController<TNode, SVGTextElement> = LabelController<TNode, SVGTextElement>,
> = Omit<DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>, "placeLabel">;

export class GridChartSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends TransformedLabelCanvas = TransformedLabelCanvas,
  TController extends LabelController<TNode, SVGTextElement> = LabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: GridChartSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({ ...options, placeLabel: placeGridChartSVGLabel });
  }
}
