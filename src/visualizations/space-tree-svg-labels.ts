import { SVGLabels } from "../graph/labels/svg.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import type {
  SpaceTreeDOMLabelController,
  SpaceTreeLabelCanvas,
  SpaceTreeLabelConfig,
} from "./space-tree-label-contracts.js";
import { placeSpaceTreeDOMLabel } from "./space-tree-dom-labels.js";

export type SpaceTreeSVGLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends SpaceTreeLabelCanvas = SpaceTreeLabelCanvas,
  TController extends SpaceTreeDOMLabelController<
    TNode,
    SVGTextElement
  > = SpaceTreeDOMLabelController<TNode, SVGTextElement>,
> = Omit<
  DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
  "placeLabel"
> & {
  config: SpaceTreeLabelConfig;
};

/** SpaceTree's SVG backend, composed over the shared DOM label lifecycle. */
export class SpaceTreeSVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends SpaceTreeLabelCanvas = SpaceTreeLabelCanvas,
  TController extends SpaceTreeDOMLabelController<
    TNode,
    SVGTextElement
  > = SpaceTreeDOMLabelController<TNode, SVGTextElement>,
> extends SVGLabels<TNode, TCanvas, TController> {
  constructor(options: SpaceTreeSVGLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: (element, node, canvas, controller) => {
        placeSpaceTreeDOMLabel(
          element,
          node,
          canvas,
          controller,
          options.config,
        );
      },
    });
  }
}
