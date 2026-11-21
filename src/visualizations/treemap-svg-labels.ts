import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { SVGLabels } from "../graph/labels/svg.js";
import {
  type TreemapDOMLabelController,
  type TreemapLabelCanvas,
  type TreemapLabelConfig,
  type TreemapLabelNode,
  type TreemapLeafPredicate,
} from "./treemap-label-contracts.js";
import { placeTreemapSVGLabel } from "./treemap-dom-labels.js";

export type TreemapSVGLabelsOptions<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TCanvas extends TreemapLabelCanvas = TreemapLabelCanvas,
  TController extends TreemapDOMLabelController<
    TNode,
    SVGTextElement
  > = TreemapDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
> & {
  leaf: TreemapLeafPredicate<TNode>;
  config: TreemapLabelConfig;
};

export class TreemapSVGLabels<
  TNode extends TreemapLabelNode = TreemapLabelNode,
  TCanvas extends TreemapLabelCanvas = TreemapLabelCanvas,
  TController extends TreemapDOMLabelController<
    TNode,
    SVGTextElement
  > = TreemapDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: TreemapSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) =>
        placeTreemapSVGLabel(
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
