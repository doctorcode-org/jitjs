import type { LabelNode } from "../graph/labels/contracts.js";
import type { DOMLabelsOptions } from "../graph/labels/dom.js";
import { HTMLLabels } from "../graph/labels/html.js";
import {
  type IcicleDOMLabelController,
  placeIcicleHTMLLabel,
} from "./icicle-dom-labels.js";

export type IcicleHTMLLabelsOptions<
  TNode extends LabelNode = LabelNode,
  TCanvas extends import("../graph/labels/contracts.js").LabelCanvas = import("../graph/labels/contracts.js").LabelCanvas,
  TController extends IcicleDOMLabelController<
    TNode,
    HTMLElement
  > = IcicleDOMLabelController<TNode, HTMLElement>,
> = Omit<
  DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  "placeLabel"
>;

/** Icicle's HTML backend, composed over the shared DOM label lifecycle. */
export class IcicleHTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends import("../graph/labels/contracts.js").LabelCanvas = import("../graph/labels/contracts.js").LabelCanvas,
  TController extends IcicleDOMLabelController<
    TNode,
    HTMLElement
  > = IcicleDOMLabelController<TNode, HTMLElement>,
> extends HTMLLabels<TNode, TCanvas, TController> {
  constructor(options: IcicleHTMLLabelsOptions<TNode, TCanvas, TController>) {
    super({
      container: options.container,
      ...(options.document === undefined ? {} : { document: options.document }),
      hasNode: options.hasNode,
      placeLabel: placeIcicleHTMLLabel,
    });
  }
}
