import { each, lambda, map, merge, reduce, splat } from "../core/util.js";
import {
  createBarChartOptions,
  type BarChartOptions,
  type BarChartValueFormatter,
} from "../options/bar-chart.js";
import { createCanvasOptions } from "../options/canvas.js";
import { createLabelOptions, type LabelOptions } from "../options/label.js";
import { createMarginOptions, type MarginOptions } from "../options/margin.js";
import type { PositionPhase } from "../types.js";

export interface BarChartSize {
  width: number;
  height: number;
}

export interface BarChartCanvas {
  getSize(): BarChartSize;
}

export interface BarChartAdjacency<TNode extends BarChartNode = BarChartNode> {
  nodeTo: TNode;
}

export interface BarChartNode {
  id: string;
  name: string;
  getData<TValue = unknown>(
    property: string,
    phase?: PositionPhase,
  ): TValue;
  setData(property: string, value: unknown, phase?: PositionPhase): void;
  eachAdjacency(
    callback: (adjacency: BarChartAdjacency<this>) => void,
  ): void;
}

export interface BarChartGraph<TNode extends BarChartNode = BarChartNode> {
  eachNode(callback: (node: TNode) => void): void;
  getNode(id: string): TNode;
  getByName(name: string): TNode | false | null | undefined;
}

export interface BarChartAnimationOptions {
  modes: string[];
  duration: number;
  onComplete(): void;
}

export interface BarChartDelegateConfig {
  offsetX?: number;
  offsetY?: number;
  Node: {
    type: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BarChartDelegate<TNode extends BarChartNode = BarChartNode> {
  canvas: BarChartCanvas;
  config: BarChartDelegateConfig;
  graph: BarChartGraph<TNode>;
  root: string;
  fx: {
    animate(options: BarChartAnimationOptions): void;
  };
  loadJSON(json: BarChartDelegateJsonNode): void;
  compute(): void;
  select(id: string): void;
  plot(): void;
}

export interface BarChartEventInfo {
  getContains(): BarChartContainedElement;
}

export interface BarChartContainedElement {
  name: unknown;
  index?: unknown;
  [key: string]: unknown;
}

export interface BarChartDelegateOptions<TNode extends BarChartNode = BarChartNode>
  extends Record<string, unknown> {
  injectInto: unknown;
  width: number | false;
  height: number | false;
  orientation: "left" | "bottom";
  levelDistance: number;
  siblingOffset: number;
  subtreeOffset: number;
  withLabels: boolean;
  useCanvas: unknown | false;
  Label: { type: string };
  Node: {
    overridable: boolean;
    type: string;
    align: "left";
    width: number;
    height: number;
  };
  Edge: { type: "none" };
  Tips: {
    enable: boolean;
    type: "Native";
    force: true;
    onShow(tip: unknown, node: TNode, contains: BarChartContainedElement): void;
  };
  Events: {
    enable: true;
    type: "Native";
    onClick(node: TNode, eventInfo: BarChartEventInfo, event: unknown): void;
    onMouseMove(
      node: TNode | false | null,
      eventInfo: BarChartEventInfo,
      event: unknown,
    ): void;
  };
  onCreateLabel(domElement: HTMLElement, node: TNode): void;
  onPlaceLabel(domElement: HTMLElement, node: TNode): void;
}

export interface BarChartDocument {
  createElement(tagName: string): HTMLElement;
}

export interface BarChartDependencies<
  TNode extends BarChartNode = BarChartNode,
  TDelegate extends BarChartDelegate<TNode> = BarChartDelegate<TNode>,
> {
  createDelegate(options: BarChartDelegateOptions<TNode>): TDelegate;
  now?: () => number;
  document?: BarChartDocument;
}

export interface BarChartConstructorOptions extends Record<string, unknown> {
  injectInto?: unknown;
  width?: number | false;
  height?: number | false;
  useCanvas?: unknown | false;
  animate?: boolean;
  type?: string;
  labelOffset?: number;
  barsOffset?: number;
  hoveredColor?: false | string;
  orientation?: "horizontal" | "vertical";
  showAggregates?: boolean | BarChartValueFormatter;
  showLabels?: boolean | BarChartValueFormatter;
  Margin?: Partial<MarginOptions>;
  Label?: Partial<LabelOptions>;
  Tips?: Partial<BarChartOptions["Tips"]>;
  Events?: Partial<BarChartOptions["Events"]>;
}

export type BarChartDisplayCallback<TNode extends BarChartNode> = (
  name: string,
  value: number,
  node: TNode,
) => boolean | string;

export interface BarChartConfig<TNode extends BarChartNode = BarChartNode>
  extends Record<string, unknown> {
  injectInto: unknown;
  width: number | false;
  height: number | false;
  useCanvas: unknown | false;
  animate: boolean;
  type: string;
  labelOffset: number;
  barsOffset: number;
  hoveredColor: false | string;
  orientation: "horizontal" | "vertical";
  showAggregates: BarChartDisplayCallback<TNode>;
  showLabels: BarChartDisplayCallback<TNode>;
  Margin: MarginOptions;
  Label: LabelOptions;
  Tips: BarChartOptions["Tips"];
  Events: BarChartOptions["Events"];
}

export interface BarChartValueGroup {
  label: string;
  values: number | number[];
}

export interface BarChartJson {
  label: string | string[];
  color?: string | string[];
  values: BarChartValueGroup[];
}

export interface BarChartDelegateJsonNode {
  id: string;
  name: string;
  data: Record<string, unknown>;
  children: BarChartDelegateJsonNode[];
}

export interface BarChartSelection {
  id?: string | false;
  name?: unknown | false;
  color?: string;
}

export interface BarChartUpdateCallbacks {
  onComplete(): void;
}

interface BarChartDomLabels {
  wrapper: HTMLElement;
  aggregate: HTMLElement;
  label: HTMLElement;
}

const DEFAULT_COLORS = [
  "#416D9C",
  "#70A35E",
  "#EBB056",
  "#C74243",
  "#83548B",
  "#909291",
  "#557EAA",
];

type LegacyIterable =
  | ArrayLike<unknown>
  | Record<string, unknown>;

/**
 * JIT 2.0.1 BarChart rewritten as an explicitly composed façade.
 *
 * The space-tree delegate is supplied by the caller, so importing this module
 * neither mutates a namespace nor installs node types into a renderer registry.
 */
export class BarChart<
  TNode extends BarChartNode = BarChartNode,
  TDelegate extends BarChartDelegate<TNode> = BarChartDelegate<TNode>,
> {
  st: null = null;
  colors = [...DEFAULT_COLORS];
  selected: BarChartSelection = {};
  busy = false;

  controller!: BarChartConfig<TNode>;
  config!: BarChartConfig<TNode>;
  delegate!: TDelegate;
  canvas!: TDelegate["canvas"];

  private readonly dependencies: BarChartDependencies<TNode, TDelegate>;

  constructor(
    options: BarChartConstructorOptions = {},
    dependencies: BarChartDependencies<TNode, TDelegate>,
  ) {
    this.dependencies = dependencies;
    this.initialize(options);
  }

  /** Reinitialize the instance with the same injected dependencies. */
  initialize(options: BarChartConstructorOptions = {}): void {
    const defaults = {
      ...createCanvasOptions(),
      Margin: createMarginOptions(),
      Label: createLabelOptions(),
      ...createBarChartOptions(),
    };
    const config = merge(
      defaults,
      { Label: { type: "Native" } },
      options,
    ) as unknown as BarChartConfig<TNode>;

    const showLabels = config.showLabels as unknown;
    const showAggregates = config.showAggregates as unknown;
    config.showLabels =
      typeof showLabels === "function"
        ? (showLabels as BarChartDisplayCallback<TNode>)
        : (lambda(showLabels) as BarChartDisplayCallback<TNode>);
    config.showAggregates =
      typeof showAggregates === "function"
        ? (showAggregates as BarChartDisplayCallback<TNode>)
        : (lambda(showAggregates) as BarChartDisplayCallback<TNode>);

    this.controller = this.config = config;
    this.initializeViz();
  }

  initializeViz(): void {
    const config = this.config;
    const horizontal = config.orientation == "horizontal";
    const nodeType = config.type.split(":")[0] as string;
    const nodeLabels: Record<string, BarChartDomLabels> = {};

    const delegate = this.dependencies.createDelegate({
      injectInto: config.injectInto,
      width: config.width,
      height: config.height,
      orientation: horizontal ? "left" : "bottom",
      levelDistance: 0,
      siblingOffset: config.barsOffset,
      subtreeOffset: 0,
      withLabels: config.Label.type != "Native",
      useCanvas: config.useCanvas,
      Label: { type: config.Label.type },
      Node: {
        overridable: true,
        type: `barchart-${nodeType}`,
        align: "left",
        width: 1,
        height: 1,
      },
      Edge: { type: "none" },
      Tips: {
        enable: config.Tips.enable,
        type: "Native",
        force: true,
        onShow: (tip, node, contains) => {
          config.Tips.onShow(tip, contains, node);
        },
      },
      Events: {
        enable: true,
        type: "Native",
        onClick: (_node, eventInfo, event) => {
          if (!config.Events.enable) {
            return;
          }
          const element = eventInfo.getContains();
          config.Events.onClick(element, eventInfo, event);
        },
        onMouseMove: (node, eventInfo, _event) => {
          if (!config.hoveredColor) {
            return;
          }
          if (node) {
            const element = eventInfo.getContains();
            this.select(node.id, element.name, element.index);
          } else {
            this.select(false, false, false);
          }
        },
      },
      onCreateLabel: (domElement, node) => {
        const labelConfig = config.Label;
        const values = node.getData<number[]>("valueArray");
        const accumulated = reduce(
          values,
          (left, right) => left + right,
          0,
        );
        const ownerDocument =
          this.dependencies.document ?? domElement.ownerDocument;
        if (!ownerDocument) {
          throw new Error(
            "BarChart DOM labels require an injected document or an ownerDocument",
          );
        }

        const labels: BarChartDomLabels = {
          wrapper: ownerDocument.createElement("div"),
          aggregate: ownerDocument.createElement("div"),
          label: ownerDocument.createElement("div"),
        };
        const wrapperStyle = labels.wrapper.style;
        const labelStyle = labels.label.style;
        const aggregateStyle = labels.aggregate.style;
        nodeLabels[node.id] = labels;

        labels.wrapper.appendChild(labels.label);
        labels.wrapper.appendChild(labels.aggregate);
        if (!config.showLabels(node.name, accumulated, node)) {
          labelStyle.display = "none";
        }
        if (!config.showAggregates(node.name, accumulated, node)) {
          aggregateStyle.display = "none";
        }
        wrapperStyle.position = "relative";
        wrapperStyle.overflow = "visible";
        wrapperStyle.fontSize = `${labelConfig.size}px`;
        wrapperStyle.fontFamily = labelConfig.family;
        wrapperStyle.color = labelConfig.color;
        wrapperStyle.textAlign = "center";
        aggregateStyle.position = labelStyle.position = "absolute";

        domElement.style.width = `${node.getData<number>("width")}px`;
        domElement.style.height = `${node.getData<number>("height")}px`;
        aggregateStyle.left = labelStyle.left = "0px";
        labels.label.innerHTML = node.name;
        domElement.appendChild(labels.wrapper);
      },
      onPlaceLabel: (domElement, node) => {
        const labels = nodeLabels[node.id];
        if (!labels) {
          return;
        }
        const wrapperStyle = labels.wrapper.style;
        const labelStyle = labels.label.style;
        const aggregateStyle = labels.aggregate.style;
        const grouped = config.type.split(":")[0] == "grouped";
        const horizontalLabels = config.orientation == "horizontal";
        const dimensions = node.getData<number[]>("dimArray");
        const values = node.getData<number[]>("valueArray");
        const width =
          grouped && horizontalLabels
            ? Math.max.apply(null, dimensions)
            : node.getData<number>("width");
        const height =
          grouped && !horizontalLabels
            ? Math.max.apply(null, dimensions)
            : node.getData<number>("height");
        const font = Number.parseInt(wrapperStyle.fontSize, 10);
        const domStyle = domElement.style;

        if (dimensions && values) {
          wrapperStyle.width =
            aggregateStyle.width =
            labelStyle.width =
            domStyle.width =
              `${width}px`;
          let accumulated = 0;
          for (let index = 0; index < values.length; index += 1) {
            if ((dimensions[index] as number) > 0) {
              accumulated += values[index] as number;
            }
          }

          labelStyle.display = config.showLabels(
            node.name,
            accumulated,
            node,
          )
            ? ""
            : "none";
          const aggregateValue = config.showAggregates(
            node.name,
            accumulated,
            node,
          );
          aggregateStyle.display = aggregateValue !== false ? "" : "none";

          if (config.orientation == "horizontal") {
            aggregateStyle.textAlign = "right";
            labelStyle.textAlign = "left";
            (
              labelStyle as CSSStyleDeclaration & { textIndex: string }
            ).textIndex = aggregateStyle.textIndent = `${config.labelOffset}px`;
            aggregateStyle.top = labelStyle.top = `${(height - font) / 2}px`;
            domStyle.height = wrapperStyle.height = `${height}px`;
          } else {
            aggregateStyle.top = `${-font - config.labelOffset}px`;
            labelStyle.top = `${config.labelOffset + height}px`;
            domStyle.top = `${Number.parseInt(domStyle.top, 10) - height}px`;
            domStyle.height = wrapperStyle.height = `${height}px`;
          }
          labels.aggregate.innerHTML = (aggregateValue !== true
            ? aggregateValue
            : accumulated) as string;
        }
      },
    });

    const size = delegate.canvas.getSize();
    const margin = config.Margin;
    if (horizontal) {
      delegate.config.offsetX =
        size.width / 2 -
        margin.left -
        (Boolean(config.showLabels as unknown)
          ? config.labelOffset + config.Label.size
          : 0);
      delegate.config.offsetY = (margin.bottom - margin.top) / 2;
    } else {
      delegate.config.offsetY =
        -size.height / 2 +
        margin.bottom +
        (Boolean(config.showLabels as unknown)
          ? config.labelOffset + config.Label.size
          : 0);
      delegate.config.offsetX = (margin.right - margin.left) / 2;
    }
    this.delegate = delegate;
    this.canvas = delegate.canvas;
  }

  loadJSON(json: BarChartJson): void {
    if (this.busy) {
      return;
    }
    this.busy = true;

    const prefix = (this.dependencies.now ?? Date.now)();
    const children: BarChartDelegateJsonNode[] = [];
    const names = splat(json.label);
    const colors = splat(json.color || this.colors);
    const config = this.config;
    const gradient = !!config.type.split(":")[1];
    const animate = config.animate;
    const horizontal = config.orientation == "horizontal";

    for (const value of json.values) {
      const valueArray = splat(value.values);
      children.push({
        id: prefix + value.label,
        name: value.label,
        data: {
          value: valueArray,
          $valueArray: valueArray,
          $colorArray: colors,
          $stringArray: names,
          $gradient: gradient,
          $config: config,
        },
        children: [],
      });
    }
    const root: BarChartDelegateJsonNode = {
      id: `${prefix}$root`,
      name: "",
      data: {
        $type: "none",
        $width: 1,
        $height: 1,
      },
      children,
    };
    this.delegate.loadJSON(root);

    this.normalizeDims();
    this.delegate.compute();
    this.delegate.select(this.delegate.root);
    if (animate) {
      this.delegate.fx.animate({
        modes: [
          horizontal
            ? "node-property:width:dimArray"
            : "node-property:height:dimArray",
        ],
        duration: 1500,
        onComplete: () => {
          this.busy = false;
        },
      });
    } else {
      this.busy = false;
    }
  }

  updateJSON(
    json: BarChartJson,
    onComplete?: BarChartUpdateCallbacks,
  ): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.select(false, false, false);
    const graph = this.delegate.graph;
    const animate = this.config.animate;
    const horizontal = this.config.orientation == "horizontal";

    for (const value of json.values) {
      const node = graph.getByName(value.label);
      if (node) {
        node.setData("valueArray", splat(value.values));
        if (json.label) {
          node.setData("stringArray", splat(json.label));
        }
      }
    }
    this.normalizeDims();
    this.delegate.compute();
    this.delegate.select(this.delegate.root);
    if (animate) {
      this.delegate.fx.animate({
        modes: [
          horizontal
            ? "node-property:width:dimArray"
            : "node-property:height:dimArray",
        ],
        duration: 1500,
        onComplete: () => {
          this.busy = false;
          if (onComplete) {
            onComplete.onComplete();
          }
        },
      });
    }
    // JIT 2.0.1 intentionally has no non-animated completion branch here.
  }

  select(id: string | false, name: unknown | false, _index?: unknown): void {
    if (!this.config.hoveredColor) {
      return;
    }
    const selection = this.selected;
    if (selection.id != id || selection.name != name) {
      selection.id = id;
      selection.name = name;
      selection.color = this.config.hoveredColor;
      this.delegate.graph.eachNode((node) => {
        if (id == node.id) {
          node.setData("border", selection);
        } else {
          node.setData("border", false);
        }
      });
      this.delegate.plot();
    }
  }

  getLegend(): Record<string, string> {
    const legend: Record<string, string> = {};
    let node: TNode | undefined;
    const root = this.delegate.graph.getNode(this.delegate.root);
    root.eachAdjacency((adjacency) => {
      node = adjacency.nodeTo as TNode;
    });
    const colors = (node as TNode).getData<string[]>("colorArray");
    const colorLength = colors.length;
    each((node as TNode).getData<unknown[]>("stringArray"), (name, index) => {
      legend[name as string] = colors[(index as number) % colorLength] as string;
    });
    return legend;
  }

  getMaxValue(): number {
    let maximum = 0;
    const stacked = this.config.type.split(":")[0] == "stacked";
    this.delegate.graph.eachNode((node) => {
      const values = node.getData<number[] | 0>("valueArray");
      let accumulated = 0;
      if (!values) {
        return;
      }
      if (stacked) {
        each(values, (value) => {
          accumulated += +(value as number);
        });
      } else {
        accumulated = Math.max.apply(null, values);
      }
      maximum = maximum > accumulated ? maximum : accumulated;
    });
    return maximum;
  }

  setBarType(type: string): void {
    this.config.type = type;
    this.delegate.config.Node.type = `barchart-${type.split(":")[0] as string}`;
  }

  normalizeDims(): void {
    const root = this.delegate.graph.getNode(this.delegate.root);
    let length = 0;
    root.eachAdjacency(() => {
      length += 1;
    });
    const maximum = this.getMaxValue() || 1;
    const size = this.delegate.canvas.getSize();
    const config = this.config;
    const margin = config.Margin;
    const marginWidth = margin.left + margin.right;
    const marginHeight = margin.top + margin.bottom;
    const horizontal = config.orientation == "horizontal";
    const fixedDimension =
      (size[horizontal ? "height" : "width"] -
        (horizontal ? marginHeight : marginWidth) -
        (length - 1) * config.barsOffset) /
      length;
    const aggregateSpace =
      !horizontal && Boolean(config.showAggregates as unknown)
        ? config.Label.size + config.labelOffset
        : 0;
    const labelSpace = Boolean(config.showLabels as unknown)
      ? config.Label.size + config.labelOffset
      : 0;
    const extent =
      size[horizontal ? "width" : "height"] -
      (horizontal ? marginWidth : marginHeight) -
      aggregateSpace -
      labelSpace;
    const fixedProperty = horizontal ? "height" : "width";
    const extentProperty = horizontal ? "width" : "height";

    this.delegate.graph.eachNode((node) => {
      let accumulated = 0;
      const animateValue: number[] = [];
      const values = node.getData<unknown>("valueArray") as LegacyIterable;
      each(values, (value) => {
        accumulated += +(value as number);
        animateValue.push(0);
      });
      node.setData(fixedProperty, fixedDimension);
      if (config.animate) {
        node.setData(
          extentProperty,
          (accumulated * extent) / maximum,
          "end",
        );
        node.setData(
          "dimArray",
          map(values, (value) => (+(value as number) * extent) / maximum),
          "end",
        );
        const dimensions = node.getData<unknown>("dimArray");
        if (!dimensions) {
          node.setData("dimArray", animateValue);
        }
      } else {
        node.setData(extentProperty, (accumulated * extent) / maximum);
        node.setData(
          "dimArray",
          map(values, (value) => (+(value as number) * extent) / maximum),
        );
      }
    });
  }
}
