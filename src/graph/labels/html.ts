import { DOMLabels, type DOMLabelsOptions } from "./dom.js";
import type {
  LabelCanvas,
  LabelController,
  LabelNode,
} from "./contracts.js";

export class HTMLLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends LabelCanvas = LabelCanvas,
  TController extends LabelController<TNode, HTMLElement> = LabelController<
    TNode,
    HTMLElement
  >,
> extends DOMLabels<TNode, HTMLElement, TCanvas, TController> {
  constructor(
    options: DOMLabelsOptions<TNode, HTMLElement, TCanvas, TController>,
  ) {
    super(options);
  }

  plotLabel(
    canvas: TCanvas,
    node: TNode,
    controller: TController,
  ): void {
    let label = this.getLabel(node.id);
    if (!label) {
      label = this.document.createElement("div");
      label.id = node.id;
      label.className = "node";
      label.style.position = "absolute";
      controller.onCreateLabel?.(label, node);
      this.getLabelContainer().appendChild(label);
      this.labels[node.id] = label;
    }
    this.place(label, node, canvas, controller);
  }
}
