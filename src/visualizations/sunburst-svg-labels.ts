import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import {
  placeSunburstSVGLabel,
} from "./sunburst-dom-labels.js";
import type {
  SunburstDOMLabelController,
  SunburstLabelCanvas,
  SunburstLabelNode,
  SunburstLabelState,
} from "./sunburst-label-contracts.js";

export type SunburstSVGLabelsOptions<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TCanvas extends SunburstLabelCanvas = SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<
    TNode,
    SVGTextElement
  > = SunburstDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
> & {
  state: SunburstLabelState;
};

/** Sunburst's SVG backend, composed over the shared DOM label lifecycle. */
export class SunburstSVGLabels<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TCanvas extends SunburstLabelCanvas = SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<
    TNode,
    SVGTextElement
  > = SunburstDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: SunburstSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) => {
        placeSunburstSVGLabel(
          element,
          node,
          canvas,
          controller,
          options.state,
        );
      },
    });
  }
}
