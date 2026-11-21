export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export type CanvasPathType = "fill" | "stroke";

export interface CanvasDocument {
  createElement(tagName: string): HTMLElement;
  createElementNS(namespace: string, qualifiedName: string): Element;
  getElementById(id: string): HTMLElement | null;
}

export interface CanvasWindow {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(handle: number): void;
}

export interface CanvasEnvironment {
  /** Explicit browser document. Useful for SSR, tests, and multiple documents. */
  document?: CanvasDocument;
  /** Scroll observation is enabled only when this dependency is supplied. */
  window?: CanvasWindow;
  getPosition?: (element: HTMLElement) => CanvasPosition;
}

export interface CanvasLayerConfig extends CanvasSize {
  injectInto: string;
  idSuffix?: string;
}

export interface CanvasLayerCallbacks {
  plot?: (layer: CanvasLayer) => void;
  resize?: (width: number, height: number, layer: CanvasLayer) => void;
}

export interface CanvasLayerDefinition extends CanvasLayerCallbacks {
  idSuffix: string;
}

export interface CanvasLabelOptions {
  type?: "HTML" | "Native" | "SVG";
}

export interface CanvasOptions {
  injectInto: string | HTMLElement;
  type?: "2D";
  width?: number;
  height?: number;
  /** Kept capitalized because the rest of JIT's option model uses `Label`. */
  Label?: CanvasLabelOptions;
  /** Additional layers are placed behind the primary visualization layer. */
  layers?: readonly CanvasLayerDefinition[];
}

export interface CanvasVisualization {
  fx: {
    plot(): void;
  };
  refresh(): void;
}

type CanvasLabelElement = HTMLElement | SVGSVGElement;
export type CanvasLabelRoot = HTMLElement | SVGGElement;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function ambientDocument(): CanvasDocument | undefined {
  return (globalThis as typeof globalThis & { document?: Document }).document;
}

function resolveDocument(
  target: string | HTMLElement,
  supplied?: CanvasDocument,
): CanvasDocument {
  const ownerDocument =
    typeof target === "string"
      ? undefined
      : (target.ownerDocument as CanvasDocument | null);
  const resolved = supplied ?? ownerDocument ?? ambientDocument();
  if (!resolved) {
    throw new Error(
      "Canvas requires an injected document when no browser document is available",
    );
  }
  return resolved;
}

function resolveHost(
  target: string | HTMLElement,
  ownerDocument: CanvasDocument,
): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }
  const host = ownerDocument.getElementById(target);
  if (!host) {
    throw new Error(`Canvas host element was not found: ${target}`);
  }
  return host;
}

function setAbsoluteSize(
  element: HTMLElement,
  width: number,
  height: number,
): void {
  element.style.position = "absolute";
  element.style.top = "0";
  element.style.left = "0";
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
}

function defaultPosition(element: HTMLElement): CanvasPosition {
  let offsetX = 0;
  let offsetY = 0;
  let offsetElement: HTMLElement | null = element;
  while (offsetElement && !/^(?:body|html)$/i.test(offsetElement.tagName)) {
    offsetX += offsetElement.offsetLeft;
    offsetY += offsetElement.offsetTop;
    offsetElement = offsetElement.offsetParent as HTMLElement | null;
  }

  let scrollX = 0;
  let scrollY = 0;
  let scrollElement: HTMLElement | null = element;
  while (scrollElement && !/^(?:body|html)$/i.test(scrollElement.tagName)) {
    scrollX += scrollElement.scrollLeft;
    scrollY += scrollElement.scrollTop;
    scrollElement = scrollElement.parentNode as HTMLElement | null;
  }

  return { x: offsetX - scrollX, y: offsetY - scrollY };
}

/**
 * A single two-dimensional canvas layer.
 *
 * It retains JIT 2.0.1's centered coordinate system and transform bookkeeping,
 * while replacing the old class and string registries with a direct class.
 */
export class CanvasLayer {
  readonly config: Readonly<CanvasLayerConfig>;
  readonly canvas: HTMLCanvasElement;

  translateOffsetX = 0;
  translateOffsetY = 0;
  scaleOffsetX = 1;
  scaleOffsetY = 1;

  private readonly callbacks: Readonly<CanvasLayerCallbacks>;
  private context: CanvasRenderingContext2D | undefined;
  private size: CanvasSize | undefined;

  constructor(
    config: CanvasLayerConfig,
    callbacks: CanvasLayerCallbacks = {},
    ownerDocument?: CanvasDocument,
  ) {
    const documentDependency =
      ownerDocument ?? ambientDocument();
    if (!documentDependency) {
      throw new Error(
        "Canvas.Layer requires an injected document when no browser document is available",
      );
    }

    this.config = { ...config };
    this.callbacks = callbacks;
    const canvas = documentDependency.createElement(
      "canvas",
    ) as HTMLCanvasElement;
    canvas.id = `${config.injectInto}${config.idSuffix ?? "-canvas"}`;
    canvas.width = config.width;
    canvas.height = config.height;
    setAbsoluteSize(canvas, config.width, config.height);
    this.canvas = canvas;
    this.translateToCenter();
  }

  getCtx(): CanvasRenderingContext2D {
    if (this.context) {
      return this.context;
    }
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("A 2D rendering context is not available");
    }
    this.context = context;
    return context;
  }

  getSize(): CanvasSize {
    if (!this.size) {
      this.size = {
        width: this.canvas.width,
        height: this.canvas.height,
      };
    }
    return this.size;
  }

  translateToCenter(): void {
    const size = this.getSize();
    this.getCtx().translate(size.width / 2, size.height / 2);
  }

  resize(width: number, height: number): void {
    const styles = this.canvas.style;
    this.size = undefined;
    this.canvas.width = width;
    this.canvas.height = height;
    styles.width = `${width}px`;
    styles.height = `${height}px`;

    // Assigning either canvas dimension resets its context transform.
    this.translateToCenter();
    this.translateOffsetX = 0;
    this.translateOffsetY = 0;
    this.scaleOffsetX = 1;
    this.scaleOffsetY = 1;
    this.clear();
    this.callbacks.resize?.(width, height, this);
  }

  translate(x: number, y: number, disablePlot = false): void {
    this.translateOffsetX += x * this.scaleOffsetX;
    this.translateOffsetY += y * this.scaleOffsetY;
    this.getCtx().translate(x, y);
    if (!disablePlot) {
      this.plot();
    }
  }

  scale(x: number, y: number, disablePlot = false): void {
    this.scaleOffsetX *= x;
    this.scaleOffsetY *= y;
    this.getCtx().scale(x, y);
    if (!disablePlot) {
      this.plot();
    }
  }

  clear(): void {
    const size = this.getSize();
    const reciprocalX = 1 / this.scaleOffsetX;
    const reciprocalY = 1 / this.scaleOffsetY;
    this.getCtx().clearRect(
      (-size.width / 2 - this.translateOffsetX) * reciprocalX,
      (-size.height / 2 - this.translateOffsetY) * reciprocalY,
      size.width * reciprocalX,
      size.height * reciprocalY,
    );
  }

  plot(): void {
    this.clear();
    this.callbacks.plot?.(this);
  }
}

/**
 * The canvas widget that owns the primary layer, optional background layers,
 * and the label container. Construction is browser-dependent; importing is not.
 */
export class Canvas {
  /** Modern direct replacements for the old `Canvas.Base['2D']` registry. */
  static readonly Base = CanvasLayer;
  static readonly Layer = CanvasLayer;

  readonly viz: CanvasVisualization;
  readonly opt: Readonly<CanvasOptions>;
  readonly config: Readonly<CanvasOptions>;
  readonly id: string;
  readonly element: HTMLElement;
  readonly labelContainer: CanvasLabelElement;
  readonly labelRoot: CanvasLabelRoot;
  readonly canvases: CanvasLayer[];

  translateOffsetX = 0;
  translateOffsetY = 0;
  scaleOffsetX = 1;
  scaleOffsetY = 1;

  private position: CanvasPosition | undefined;
  private readonly getPosition: (element: HTMLElement) => CanvasPosition;
  private scrollWindow: CanvasWindow | undefined;
  private scrollListener: EventListener | undefined;
  private scrollTimer: number | undefined;

  constructor(
    viz: CanvasVisualization,
    options: CanvasOptions,
    environment: CanvasEnvironment = {},
  ) {
    if (options.type !== undefined && options.type !== "2D") {
      throw new Error(`Unsupported canvas type: ${String(options.type)}`);
    }

    this.viz = viz;
    this.opt = options;
    this.config = options;

    const ownerDocument = resolveDocument(
      options.injectInto,
      environment.document,
    );
    const host = resolveHost(options.injectInto, ownerDocument);
    this.id =
      typeof options.injectInto === "string"
        ? options.injectInto
        : options.injectInto.id;
    if (!this.id) {
      throw new Error("Canvas host element must have an id");
    }

    const width = options.width || host.offsetWidth;
    const height = options.height || host.offsetHeight;
    this.getPosition = environment.getPosition ?? defaultPosition;

    const element = ownerDocument.createElement("div");
    element.id = `${this.id}-canvaswidget`;
    element.style.position = "relative";
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    this.element = element;

    const labels = this.createLabelContainer(
      options.Label?.type ?? "HTML",
      `${this.id}-label`,
      { width, height },
      ownerDocument,
    );
    this.labelContainer = labels.container;
    this.labelRoot = labels.root;

    const primary = new CanvasLayer(
      {
        injectInto: this.id,
        idSuffix: "-canvas",
        width,
        height,
      },
      {
        plot: () => this.viz.fx.plot(),
        resize: () => this.viz.refresh(),
      },
      ownerDocument,
    );
    this.canvases = [primary];

    for (const definition of options.layers ?? []) {
      const layer = new CanvasLayer(
        {
          injectInto: this.id,
          idSuffix: definition.idSuffix,
          width,
          height,
        },
        definition,
        ownerDocument,
      );
      this.canvases.push(layer);
    }

    for (let index = this.canvases.length - 1; index >= 0; index -= 1) {
      const layer = this.canvases[index] as CanvasLayer;
      this.element.appendChild(layer.canvas);
      if (index > 0) {
        layer.plot();
      }
    }
    this.element.appendChild(this.labelContainer);
    host.appendChild(this.element);

    if (environment.window) {
      this.observeScroll(environment.window);
    }
  }

  getCtx(index = 0): CanvasRenderingContext2D {
    return this.getLayer(index).getCtx();
  }

  getConfig(): Readonly<CanvasOptions> {
    return this.opt;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  /** The direct parent for labels (`div` for HTML, inner `g` for SVG). */
  getLabelRoot(): CanvasLabelRoot {
    return this.labelRoot;
  }

  getSize(index = 0): CanvasSize {
    return this.getLayer(index).getSize();
  }

  resize(width: number, height: number): void {
    this.getPos(true);
    this.translateOffsetX = 0;
    this.translateOffsetY = 0;
    this.scaleOffsetX = 1;
    this.scaleOffsetY = 1;
    for (const layer of this.canvases) {
      layer.resize(width, height);
    }
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.labelContainer.style.width = `${width}px`;
    if (this.labelContainer.namespaceURI === SVG_NAMESPACE) {
      this.labelContainer.setAttribute("width", String(width));
      this.labelContainer.setAttribute("height", String(height));
    }
  }

  translate(x: number, y: number, disablePlot = false): void {
    this.translateOffsetX += x * this.scaleOffsetX;
    this.translateOffsetY += y * this.scaleOffsetY;
    for (const layer of this.canvases) {
      layer.translate(x, y, disablePlot);
    }
  }

  scale(x: number, y: number, _disablePlot = false): void {
    const scaleX = this.scaleOffsetX * x;
    const scaleY = this.scaleOffsetY * y;
    const translateX = (this.translateOffsetX * (x - 1)) / scaleX;
    const translateY = (this.translateOffsetY * (y - 1)) / scaleY;
    this.scaleOffsetX = scaleX;
    this.scaleOffsetY = scaleY;
    for (const layer of this.canvases) {
      layer.scale(x, y, true);
    }

    // JIT 2.0.1 always plots after scale; retain that observable behavior.
    this.translate(translateX, translateY, false);
  }

  getPos(force = false): CanvasPosition {
    if (force || !this.position) {
      this.position = this.getPosition(this.element);
    }
    return this.position;
  }

  clear(index = 0): void {
    this.getLayer(index).clear();
  }

  path(
    type: CanvasPathType,
    action: (context: CanvasRenderingContext2D) => void,
  ): void {
    const context = this.getCtx();
    context.beginPath();
    action(context);
    context[type]();
    context.closePath();
  }

  /** Remove the optional scroll observer installed through the environment. */
  dispose(): void {
    if (this.scrollWindow && this.scrollListener) {
      this.scrollWindow.removeEventListener("scroll", this.scrollListener);
    }
    if (this.scrollWindow && this.scrollTimer !== undefined) {
      this.scrollWindow.clearTimeout(this.scrollTimer);
    }
    this.scrollWindow = undefined;
    this.scrollListener = undefined;
    this.scrollTimer = undefined;
  }

  private getLayer(index: number): CanvasLayer {
    const layer = this.canvases[index];
    if (!layer) {
      throw new RangeError(`Canvas layer index is out of range: ${index}`);
    }
    return layer;
  }

  private createLabelContainer(
    type: NonNullable<CanvasLabelOptions["type"]>,
    id: string,
    size: CanvasSize,
    ownerDocument: CanvasDocument,
  ): { container: CanvasLabelElement; root: CanvasLabelRoot } {
    if (type === "HTML" || type === "Native") {
      const container = ownerDocument.createElement("div");
      container.id = id;
      container.style.overflow = "visible";
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = `${size.width}px`;
      container.style.height = "0";
      return { container, root: container };
    }

    const svg = ownerDocument.createElementNS(
      SVG_NAMESPACE,
      "svg",
    ) as SVGSVGElement;
    svg.setAttribute("width", String(size.width));
    svg.setAttribute("height", String(size.height));
    svg.style.position = "absolute";
    svg.style.left = "0px";
    svg.style.top = "0px";

    const group = ownerDocument.createElementNS(
      SVG_NAMESPACE,
      "g",
    ) as SVGGElement;
    group.setAttribute("width", String(size.width));
    group.setAttribute("height", String(size.height));
    group.setAttribute("x", "0");
    group.setAttribute("y", "0");
    group.setAttribute("id", id);
    svg.appendChild(group);
    return { container: svg, root: group };
  }

  private observeScroll(targetWindow: CanvasWindow): void {
    this.scrollWindow = targetWindow;
    this.scrollListener = (() => {
      if (this.scrollTimer !== undefined) {
        targetWindow.clearTimeout(this.scrollTimer);
      }
      this.scrollTimer = targetWindow.setTimeout(() => {
        this.getPos(true);
        this.scrollTimer = undefined;
      }, 500);
    }) as EventListener;
    targetWindow.addEventListener("scroll", this.scrollListener);
  }
}

/** Named constructor alias for consumers migrating from the old Base concept. */
export { CanvasLayer as CanvasBase };
