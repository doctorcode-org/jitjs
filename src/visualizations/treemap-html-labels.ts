import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import {
  type TreemapDOMLabelController,
  type TreemapLabelCanvas,
  type TreemapLabelConfig,
  type TreemapLabelNode,
  type TreemapLeafPredicate,
} from "./treemap-label-contracts.js";
import { placeTreemapHTMLLabel } from "./treemap-dom-labels.js";

export type TreemapHTMLLabelsOptions<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TCanvas extends TreemapLabelCanvas = TreemapLabelCanvas,
  TController extends TreemapDOMLabelController<
    TNode,
    HTMLElement
  > = TreemapDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
> & {
  leaf: TreemapLeafPredicate<TNode>;
  config: TreemapLabelConfig;
};

export class TreemapHTMLLabels<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TCanvas extends TreemapLabelCanvas = TreemapLabelCanvas,
  TController extends TreemapDOMLabelController<
    TNode,
    HTMLElement
  > = TreemapDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: TreemapHTMLLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) =>
        placeTreemapHTMLLabel(
          element,
          node,
          canvas,
          controller,
          options.leaf,
          options.config,
        ),
    });
  }
}
