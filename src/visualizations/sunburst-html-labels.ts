import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import {
  placeSunburstHTMLLabel,
} from "./sunburst-dom-labels.js";
import type {
  SunburstDOMLabelController,
  SunburstLabelCanvas,
  SunburstLabelNode,
  SunburstLabelState,
} from "./sunburst-label-contracts.js";

export type SunburstHTMLLabelsOptions<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TCanvas extends SunburstLabelCanvas = SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<
    TNode,
    HTMLElement
  > = SunburstDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
> & {
  state: SunburstLabelState;
};

/** Sunburst's HTML backend, composed over the shared DOM label lifecycle. */
export class SunburstHTMLLabels<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TCanvas extends SunburstLabelCanvas = SunburstLabelCanvas,
  TController extends SunburstDOMLabelController<
    TNode,
    HTMLElement
  > = SunburstDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: SunburstHTMLLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) => {
        placeSunburstHTMLLabel(
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
