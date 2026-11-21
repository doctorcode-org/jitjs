import { indexOf } from "../core/util.js";
import type {
  Graph,
  GraphPosition,
} from "../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../types.js";

export interface MeasurementDocument {
  body: Pick<HTMLElement, "appendChild">;
  createElement(tagName: "div"): HTMLDivElement;
}

export interface NodeDimensionOptions extends Readonly<Record<string, unknown>> {}

function ambientDocument(): MeasurementDocument | undefined {
  return (globalThis as typeof globalThis & { document?: Document }).document;
}

/**
 * DOM-backed node label measurer. Importing the module is SSR-safe; a document
 * is resolved only when an instance first needs its hidden measurement label.
 */
export class NodeDimensionMeasurer {
  private readonly suppliedDocument: MeasurementDocument | undefined;
  private label: HTMLDivElement | undefined;

  constructor(ownerDocument?: MeasurementDocument) {
    this.suppliedDocument = ownerDocument;
  }

  compute<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
  >(
    graph: Pick<Graph<TNodeData, TEdgeData, TPosition>, "eachNode">,
    _properties?: PositionPhase | readonly PositionPhase[],
    options: NodeDimensionOptions = {},
  ): void {
    const label = this.initializeLabel(options);
    const style = label.style;

    graph.eachNode((node) => {
      const autoWidth = node.getData("autoWidth");
      const autoHeight = node.getData("autoHeight");
      if (!autoWidth && !autoHeight) {
        return;
      }

      delete node.data.$width;
      delete node.data.$height;
      delete node.data.$dim;

      const width = node.getData<number>("width");
      const height = node.getData<number>("height");
      style.width = autoWidth ? "auto" : `${width}px`;
      style.height = autoHeight ? "auto" : `${height}px`;
      label.innerHTML = node.name;

      const measuredWidth = label.offsetWidth;
      const measuredHeight = label.offsetHeight;
      const type = node.getData("type");
      if (indexOf(["circle", "square", "triangle", "star"], type) === -1) {
        node.setData("width", measuredWidth);
        node.setData("height", measuredHeight);
        return;
      }

      const dimension = Math.max(measuredWidth, measuredHeight);
      node.setData("width", dimension);
      node.setData("height", dimension);
      node.setData("dim", dimension);
    });
  }

  getLabel(): HTMLDivElement | undefined {
    return this.label;
  }

  dispose(): void {
    this.label?.parentNode?.removeChild(this.label);
    this.label = undefined;
  }

  private initializeLabel(options: NodeDimensionOptions): HTMLDivElement {
    if (!this.label) {
      const ownerDocument = this.suppliedDocument ?? ambientDocument();
      if (!ownerDocument) {
        throw new Error(
          "Node dimension measurement requires an injected document in non-browser environments",
        );
      }
      this.label = ownerDocument.createElement("div");
      ownerDocument.body.appendChild(this.label);
    }
    this.setLabelStyles(this.label, options);
    return this.label;
  }

  private setLabelStyles(
    label: HTMLDivElement,
    _options: NodeDimensionOptions,
  ): void {
    label.style.visibility = "hidden";
    label.style.position = "absolute";
    label.style.width = "auto";
    label.style.height = "auto";
    label.className = "jit-autoadjust-label";
  }
}

/** Create the callback shape accepted by the modern layout classes. */
export function createNodeDimensionComputer(
  ownerDocument?: MeasurementDocument,
): {
  measurer: NodeDimensionMeasurer;
  compute: NodeDimensionMeasurer["compute"];
} {
  const measurer = new NodeDimensionMeasurer(ownerDocument);
  return {
    measurer,
    compute: measurer.compute.bind(measurer),
  };
}
