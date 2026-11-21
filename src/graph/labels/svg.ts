import { DOMLabels, type DOMLabelsOptions } from "./dom.js";
import type {
  LabelCanvas,
  LabelController,
  LabelNode,
} from "./contracts.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export class SVGLabels<
  TNode extends LabelNode = LabelNode,
  TCanvas extends LabelCanvas = LabelCanvas,
  TController extends LabelController<TNode, SVGTextElement> = LabelController<
    TNode,
    SVGTextElement
  >,
> extends DOMLabels<TNode, SVGTextElement, TCanvas, TController> {
  constructor(
    options: DOMLabelsOptions<TNode, SVGTextElement, TCanvas, TController>,
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
      label = this.document.createElementNS(
        SVG_NAMESPACE,
        "svg:text",
      ) as SVGTextElement;
      const text = this.document.createElementNS(SVG_NAMESPACE, "svg:tspan");
      label.appendChild(text);
      label.setAttribute("id", node.id);
      label.setAttribute("class", "node");
      this.getLabelContainer().appendChild(label);
      controller.onCreateLabel?.(label, node);
      this.labels[node.id] = label;
    }
    this.place(label, node, canvas, controller);
  }
}
