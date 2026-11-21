import { HTMLLabels } from "../graph/labels/html.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import type { LabelNode } from "../graph/labels/contracts.js";
import type {
  SpaceTreeDOMLabelController,
  SpaceTreeLabelCanvas,
  SpaceTreeLabelConfig,
} from "./space-tree-label-contracts.js";
import { placeSpaceTreeDOMLabel } from "./space-tree-dom-labels.js";

export type SpaceTreeHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends SpaceTreeLabelCanvas = SpaceTreeLabelCanvas,
  TController extends SpaceTreeDOMLabelController<
    TNode,
    HTMLElement
  > = SpaceTreeDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
> & {
  config: SpaceTreeLabelConfig;
};

/** SpaceTree's HTML backend, composed over the shared DOM label lifecycle. */
export class SpaceTreeHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends SpaceTreeLabelCanvas = SpaceTreeLabelCanvas,
  TController extends SpaceTreeDOMLabelController<
    TNode,
    HTMLElement
  > = SpaceTreeDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: SpaceTreeHTMLLabelsOptions<TNode, TCanvas, TController>) {
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
