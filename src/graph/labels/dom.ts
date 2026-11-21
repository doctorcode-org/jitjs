import type {
  LabelCanvas,
  LabelContainer,
  LabelController,
  LabelCoordinates,
  LabelDocument,
  LabelNode,
} from "./contracts.js";

export interface DOMLabelsOptions<
  TNode extends LabelNode,
  TElement extends HTMLElement | SVGElement,
  TCanvas extends LabelCanvas = LabelCanvas,
  TController extends LabelController<TNode, TElement> = LabelController<
    TNode,
    TElement
  >,
> {
  /** A container element or its id. */
  container: string | LabelContainer;
  /** Explicit document for SSR, tests, iframes, and multiple-document applications. */
  document?: LabelDocument;
  /** Used by `clearLabels(false)` to retain labels for nodes still in the graph. */
  hasNode(id: string): boolean;
  /** Visualization-specific placement replaces the old mixin override. */
  placeLabel(
    element: TElement,
    node: TNode,
    canvas: TCanvas,
    controller: TController,
  ): void;
}

function ambientDocument(): LabelDocument | undefined {
  return (globalThis as typeof globalThis & { document?: Document }).document;
}

function resolveDocument(
  container: string | LabelContainer,
  supplied?: LabelDocument,
): LabelDocument {
  const ownerDocument =
    typeof container === "string"
      ? undefined
      : (container.ownerDocument as LabelDocument | null);
  const resolved = supplied ?? ownerDocument ?? ambientDocument();
  if (!resolved) {
    throw new Error(
      "DOM labels require an injected document when no browser document is available",
    );
  }
  return resolved;
}

/** Shared lifecycle for HTML and SVG labels, isolated from either backend. */
export abstract class DOMLabels<
  TNode extends LabelNode = LabelNode,
  TElement extends HTMLElement | SVGElement = HTMLElement | SVGElement,
  TCanvas extends LabelCanvas = LabelCanvas,
  TController extends LabelController<TNode, TElement> = LabelController<
    TNode,
    TElement
  >,
> {
  labelsHidden = false;
  readonly labels: Record<string, TElement | null> = Object.create(null) as Record<
    string,
    TElement | null
  >;

  protected readonly document: LabelDocument;
  protected readonly place: DOMLabelsOptions<
    TNode,
    TElement,
    TCanvas,
    TController
  >["placeLabel"];

  private readonly hasNode: (id: string) => boolean;
  private readonly containerReference: string | LabelContainer;
  private labelContainer: LabelContainer | undefined;

  protected constructor(
    options: DOMLabelsOptions<TNode, TElement, TCanvas, TController>,
  ) {
    this.containerReference = options.container;
    this.document = resolveDocument(options.container, options.document);
    this.hasNode = options.hasNode;
    this.place = options.placeLabel;
  }

  getLabelContainer(): LabelContainer {
    if (this.labelContainer) {
      return this.labelContainer;
    }
    if (typeof this.containerReference !== "string") {
      this.labelContainer = this.containerReference;
      return this.labelContainer;
    }

    const container = this.document.getElementById(this.containerReference);
    if (!container) {
      throw new Error(
        `Label container was not found: ${this.containerReference}`,
      );
    }
    if (!("style" in container)) {
      throw new TypeError(
        `Label container does not expose style: ${this.containerReference}`,
      );
    }
    this.labelContainer = container as LabelContainer;
    return this.labelContainer;
  }

  getLabel(id: string): TElement | null {
    const cached = this.labels[id];
    if (cached != null) {
      return cached;
    }
    const label = this.document.getElementById(id) as TElement | null;
    this.labels[id] = label;
    return label;
  }

  hideLabels(hide: boolean): void {
    this.getLabelContainer().style.display = hide ? "none" : "";
    this.labelsHidden = hide;
  }

  clearLabels(force = false): void {
    for (const id of Object.keys(this.labels)) {
      if (force || !this.hasNode(id)) {
        this.disposeLabel(id);
        delete this.labels[id];
      }
    }
  }

  disposeLabel(id: string): void {
    const element = this.getLabel(id);
    if (element?.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  hideLabel(nodes: TNode | readonly TNode[], show: boolean): void {
    const display = show ? "" : "none";
    const normalized = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of normalized) {
      const label = this.getLabel(node.id);
      if (label) {
        label.style.display = display;
      }
    }
  }

  fitsInCanvas(position: LabelCoordinates, canvas: LabelCanvas): boolean {
    const size = canvas.getSize();
    return (
      position.x < size.width &&
      position.x >= 0 &&
      position.y < size.height &&
      position.y >= 0
    );
  }

  abstract plotLabel(
    canvas: TCanvas,
    node: TNode,
    controller: TController,
  ): void;
}
