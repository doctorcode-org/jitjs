import {
  merge,
  each,
  indexOf,
  map,
  reduce,
  splat,
  time,
  zip,
} from "../core/util.js";
import type { CartesianCoordinates } from "../core/geometry.js";
import {
  createAreaChartOptions,
  type ChartValueFormatter,
} from "../options/area-chart.js";
import { createCanvasOptions } from "../options/canvas.js";
import {
  createLabelOptions,
  type LabelOptions,
} from "../options/label.js";
import {
  createMarginOptions,
  type MarginOptions,
} from "../options/margin.js";
import type { PositionPhase } from "../types.js";

export type AreaChartValuePair = [left: number, right: number];

export interface AreaChartJsonValue {
  label: string;
  values: number | number[];
}

export interface AreaChartJson {
  label: string | string[];
  color?: string | string[];
  values: AreaChartJsonValue[];
}

export interface AreaChartContainedValue {
  name: string;
  color: string;
  value: number;
  index: number;
}

export interface AreaChartPosition {
  getc(simple: true): CartesianCoordinates;
}

export interface AreaChartAdjacency<TNode extends AreaChartNode = AreaChartNode> {
  nodeTo: TNode;
}

export interface AreaChartNode {
  id: string;
  name: string;
  pos: AreaChartPosition;
  getData<TValue = unknown>(
    property: string,
    phase?: PositionPhase,
  ): TValue;
  setData(property: string, value: unknown, phase?: PositionPhase): void;
  eachAdjacency(
    callback: (adjacency: AreaChartAdjacency<this>) => void,
  ): void;
}

export interface AreaChartGraph<TNode extends AreaChartNode = AreaChartNode> {
  eachNode(callback: (node: TNode) => void): void;
  getNode(id: string): TNode;
  getByName(name: string): TNode | false | null | undefined;
}

export interface AreaChartCanvas {
  getSize(): { width: number; height: number };
}

export interface AreaChartAnimationOptions {
  modes: string[];
  duration: number;
  onComplete?: () => void;
}

export interface AreaChartDelegate<TNode extends AreaChartNode = AreaChartNode> {
  canvas: AreaChartCanvas;
  config: Record<string, unknown> & {
    offsetX?: number;
    offsetY?: number | false;
  };
  graph: AreaChartGraph<TNode>;
  root: string;
  fx: {
    animate(options: AreaChartAnimationOptions): void;
  };
  tips: {
    hide(): void;
  };
  loadJSON(json: AreaChartDelegateJson): void;
  compute(): void;
  select(id: string): void;
  plot(): void;
}

export interface AreaChartEventInfo {
  getContains(): AreaChartContainedValue | false;
}

export interface AreaChartTipsConfig {
  enable: boolean;
  onShow(
    tip: unknown,
    element: AreaChartContainedValue,
    node: AreaChartNode,
  ): void;
  onHide(...arguments_: unknown[]): void;
}

export interface AreaChartEventsConfig {
  enable: boolean;
  onClick(
    element: AreaChartContainedValue | false,
    eventInfo: AreaChartEventInfo,
    event: unknown,
  ): void;
}

export type AreaChartFormatter = (
  name: string,
  valueLeft: number,
  valueRight: number,
  node: AreaChartNode,
  accumulatedValue?: number,
) => boolean | string;

export interface AreaChartConfig extends Record<string, unknown> {
  injectInto: string | HTMLElement;
  width: number | false;
  height: number | false;
  useCanvas: unknown | false;
  type: string;
  animate: boolean;
  labelOffset: number;
  selectOnHover: boolean;
  showAggregates: AreaChartFormatter;
  showLabels: AreaChartFormatter;
  filterOnClick: boolean;
  restoreOnRightClick: boolean;
  Margin: MarginOptions;
  Label: LabelOptions;
  Tips: AreaChartTipsConfig;
  Events: AreaChartEventsConfig;
}

export interface AreaChartOptions extends Record<string, unknown> {
  injectInto?: string | HTMLElement;
  width?: number | false;
  height?: number | false;
  useCanvas?: unknown | false;
  type?: string;
  animate?: boolean;
  labelOffset?: number;
  selectOnHover?: boolean;
  showAggregates?: boolean | ChartValueFormatter;
  showLabels?: boolean | ChartValueFormatter;
  filterOnClick?: boolean;
  restoreOnRightClick?: boolean;
  Margin?: Partial<MarginOptions>;
  Label?: Partial<LabelOptions>;
  Tips?: Partial<AreaChartTipsConfig>;
  Events?: Partial<AreaChartEventsConfig>;
}

export interface AreaChartDelegateOptions<
  TNode extends AreaChartNode = AreaChartNode,
> extends Record<string, unknown> {
  injectInto: string | HTMLElement;
  width: number | false;
  height: number | false;
  orientation: "bottom";
  levelDistance: 0;
  siblingOffset: 0;
  subtreeOffset: 0;
  withLabels: boolean;
  useCanvas: unknown | false;
  Label: { type: LabelOptions["type"] };
  Node: {
    overridable: true;
    type: string;
    align: "left" | "center";
    width: 1;
    height: 1;
  };
  Edge: { type: "none" };
  Tips: {
    enable: boolean;
    type: "Native";
    force: true;
    onShow(tip: unknown, node: TNode, contains: AreaChartContainedValue): void;
  };
  Events: {
    enable: true;
    type: "Native";
    onClick(node: TNode | false, eventInfo: AreaChartEventInfo, event: unknown): void;
    onRightClick(
      node: TNode | false,
      eventInfo: AreaChartEventInfo,
      event: unknown,
    ): void;
    onMouseMove(
      node: TNode | false,
      eventInfo: AreaChartEventInfo,
      event: unknown,
    ): void;
    onMouseEnter?(): void;
    onMouseLeave?(): void;
  };
  onCreateLabel(domElement: HTMLElement, node: TNode): void;
  onPlaceLabel(domElement: HTMLElement, node: TNode): void;
}

export interface AreaChartDocument {
  createElement(tagName: "div"): HTMLElement;
}

export interface AreaChartDependencies<
  TNode extends AreaChartNode = AreaChartNode,
  TDelegate extends AreaChartDelegate<TNode> = AreaChartDelegate<TNode>,
> {
  createDelegate(options: AreaChartDelegateOptions<TNode>): TDelegate;
  now?: () => number;
  document?: AreaChartDocument;
}

export interface AreaChartCallback {
  onComplete(): void;
}

export interface AreaChartDelegateJson {
  id: string;
  name: string;
  data: Record<string, unknown>;
  children: AreaChartDelegateJson[];
}

interface AreaChartLabels {
  wrapper: HTMLElement;
  aggregate: HTMLElement;
  label: HTMLElement;
}

interface AreaChartSelection {
  id?: string | false;
  name?: string | false;
  index?: number | false;
}

interface UnresolvedAreaChartConfig
  extends Omit<AreaChartConfig, "showAggregates" | "showLabels"> {
  showAggregates: boolean | ChartValueFormatter;
  showLabels: boolean | ChartValueFormatter;
}

function resolveFormatter(
  value: boolean | ChartValueFormatter,
): AreaChartFormatter {
  return (typeof value === "function" ? value : () => value) as AreaChartFormatter;
}

/** Merge the same option groups, in the same order, as JIT 2.0.1. */
export function createAreaChartConfig(
  options: AreaChartOptions = {},
): AreaChartConfig {
  const unresolved = merge(
    createCanvasOptions(),
    {
      Margin: createMarginOptions(),
      Label: createLabelOptions(),
    },
    createAreaChartOptions(),
    { Label: { type: "Native" as const } },
    options,
  ) as unknown as UnresolvedAreaChartConfig;

  return Object.assign(unresolved, {
    showLabels: resolveFormatter(unresolved.showLabels),
    showAggregates: resolveFormatter(unresolved.showAggregates),
  }) as unknown as AreaChartConfig;
}

/**
 * A dependency-injected, ESM-native rewrite of JIT 2.0.1's AreaChart.
 * The injected delegate replaces the old implicit global SpaceTree registry.
 */
export class AreaChart<
  TNode extends AreaChartNode = AreaChartNode,
  TDelegate extends AreaChartDelegate<TNode> = AreaChartDelegate<TNode>,
> {
  st: null = null;
  colors = [
    "#416D9C",
    "#70A35E",
    "#EBB056",
    "#C74243",
    "#83548B",
    "#909291",
    "#557EAA",
  ];
  selected: AreaChartSelection = {};
  busy = false;

  controller!: AreaChartConfig;
  config!: AreaChartConfig;
  delegate!: TDelegate;
  canvas!: TDelegate["canvas"];

  protected readonly dependencies: AreaChartDependencies<TNode, TDelegate>;

  constructor(
    options: AreaChartOptions = {},
    dependencies: AreaChartDependencies<TNode, TDelegate>,
  ) {
    this.dependencies = dependencies;
    this.initialize(options);
  }

  initialize(options: AreaChartOptions = {}): void {
    this.controller = this.config = createAreaChartConfig(options);
    this.initializeViz();
  }

  initializeViz(): void {
    const config = this.config;
    const nodeLabels: Record<string, AreaChartLabels> = {};

    const delegate = this.dependencies.createDelegate({
      injectInto: config.injectInto,
      width: config.width,
      height: config.height,
      orientation: "bottom",
      levelDistance: 0,
      siblingOffset: 0,
      subtreeOffset: 0,
      withLabels: config.Label.type != "Native",
      useCanvas: config.useCanvas,
      Label: {
        type: config.Label.type,
      },
      Node: {
        overridable: true,
        type: `areachart-${config.type.split(":")[0]}`,
        align: "left",
        width: 1,
        height: 1,
      },
      Edge: {
        type: "none",
      },
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
          if (!config.filterOnClick && !config.Events.enable) {
            return;
          }
          const element = eventInfo.getContains();
          if (element && config.filterOnClick) {
            this.filter(element.name);
          }
          if (config.Events.enable) {
            config.Events.onClick(element, eventInfo, event);
          }
        },
        onRightClick: (_node, _eventInfo, _event) => {
          if (!config.restoreOnRightClick) {
            return;
          }
          this.restore();
        },
        onMouseMove: (node, eventInfo, _event) => {
          if (!config.selectOnHover) {
            return;
          }
          if (node) {
            const element = eventInfo.getContains() as AreaChartContainedValue;
            this.select(node.id, element.name, element.index);
          } else {
            this.select(false, false, false);
          }
        },
      },
      onCreateLabel: (domElement, node) => {
        const labelConfig = config.Label;
        const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
        const accumulatedLeft = this.sumSide(valueArray, 0);
        const accumulatedRight = this.sumSide(valueArray, 1);

        if (node.getData<string | false>("prev")) {
          const ownerDocument =
            this.dependencies.document ??
            (domElement.ownerDocument as AreaChartDocument | null);
          if (!ownerDocument) {
            throw new Error(
              "AreaChart DOM labels require an injected document or an ownerDocument",
            );
          }
          const labels: AreaChartLabels = {
            wrapper: ownerDocument.createElement("div"),
            aggregate: ownerDocument.createElement("div"),
            label: ownerDocument.createElement("div"),
          };
          const wrapper = labels.wrapper;
          const label = labels.label;
          const aggregate = labels.aggregate;
          const wrapperStyle = wrapper.style;
          const labelStyle = label.style;
          const aggregateStyle = aggregate.style;

          nodeLabels[node.id] = labels;
          wrapper.appendChild(label);
          wrapper.appendChild(aggregate);
          if (
            !config.showLabels(
              node.name,
              accumulatedLeft,
              accumulatedRight,
              node,
            )
          ) {
            labelStyle.display = "none";
          }
          if (
            !config.showAggregates(
              node.name,
              accumulatedLeft,
              accumulatedRight,
              node,
            )
          ) {
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
          label.innerHTML = node.name;
          domElement.appendChild(wrapper);
        }
      },
      onPlaceLabel: (domElement, node) => {
        if (!node.getData<string | false>("prev")) {
          return;
        }
        const labels = nodeLabels[node.id]!;
        const wrapperStyle = labels.wrapper.style;
        const labelStyle = labels.label.style;
        const aggregateStyle = labels.aggregate.style;
        const width = node.getData<number>("width");
        const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray");
        const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
        const accumulatedLeft = this.sumSide(valueArray, 0);
        const accumulatedRight = this.sumSide(valueArray, 1);
        const fontSize = Number.parseInt(wrapperStyle.fontSize, 10);
        const domStyle = domElement.style;

        if (dimensionArray && valueArray) {
          labelStyle.display = config.showLabels(
            node.name,
            accumulatedLeft,
            accumulatedRight,
            node,
          )
            ? ""
            : "none";
          const aggregateValue = config.showAggregates(
            node.name,
            accumulatedLeft,
            accumulatedRight,
            node,
          );
          aggregateStyle.display = aggregateValue !== false ? "" : "none";
          wrapperStyle.width =
            aggregateStyle.width =
            labelStyle.width =
            domElement.style.width =
              `${width}px`;
          aggregateStyle.left = labelStyle.left = `${-width / 2}px`;

          let accumulatedValue = 0;
          let accumulatedHeight = 0;
          for (let index = 0; index < valueArray.length; index += 1) {
            if (dimensionArray[index]![0] > 0) {
              accumulatedValue += valueArray[index]![0];
              accumulatedHeight += dimensionArray[index]![0];
            }
          }
          aggregateStyle.top = `${-fontSize - config.labelOffset}px`;
          labelStyle.top = `${config.labelOffset + accumulatedHeight}px`;
          domStyle.top = `${Number.parseInt(domStyle.top, 10) - accumulatedHeight}px`;
          domElement.style.height = wrapperStyle.height = `${accumulatedHeight}px`;
          labels.aggregate.innerHTML = (aggregateValue !== true
            ? aggregateValue
            : accumulatedValue) as string;
        }
      },
    });

    const size = delegate.canvas.getSize();
    const margin = config.Margin;
    const showLabels = config.showLabels as AreaChartFormatter | false;
    delegate.config.offsetY =
      -size.height / 2 +
      margin.bottom +
      Number(showLabels && config.labelOffset + config.Label.size);
    delegate.config.offsetX = (margin.right - margin.left) / 2;
    this.delegate = delegate;
    this.canvas = delegate.canvas;
  }

  loadJSON(json: AreaChartJson): void {
    const prefix = (this.dependencies.now ?? time)();
    const children: AreaChartDelegateJson[] = [];
    const names = splat(json.label);
    const colors = splat(json.color || this.colors);
    const config = this.config;
    const gradient = Boolean(config.type.split(":")[1]);
    const values = json.values;

    for (let index = 0; index < values.length - 1; index += 1) {
      const value = values[index]!;
      const previous = values[index - 1];
      const next = values[index + 1]!;
      const valueLeft = splat(value.values);
      const valueRight = splat(next.values);
      const valueArray = zip(valueLeft, valueRight) as AreaChartValuePair[];
      children.push({
        id: `${prefix}${value.label}`,
        name: value.label,
        data: {
          value: valueArray,
          $valueArray: valueArray,
          $colorArray: colors,
          $stringArray: names,
          $next: next.label,
          $prev: previous ? previous.label : false,
          $config: config,
          $gradient: gradient,
        },
        children: [],
      });
    }

    const root: AreaChartDelegateJson = {
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
    if (config.animate) {
      this.delegate.fx.animate({
        modes: ["node-property:height:dimArray"],
        duration: 1500,
      });
    }
  }

  updateJSON(json: AreaChartJson, onComplete?: AreaChartCallback): void {
    if (this.busy) {
      return;
    }
    this.busy = true;

    const graph = this.delegate.graph;
    const labels = json.label && splat(json.label);
    const values = json.values;
    const animate = this.config.animate;
    const hashValues: Record<string, AreaChartJsonValue> = {};
    for (let index = 0; index < values.length; index += 1) {
      hashValues[values[index]!.label] = values[index]!;
    }

    graph.eachNode((node) => {
      let value = hashValues[node.name];
      const stringArray = node.getData<string[]>("stringArray");
      const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
      const next = node.getData<string | false>("next");

      if (value) {
        value.values = splat(value.values);
        each(valueArray, (pair, index) => {
          pair[0] = (value!.values as number[])[index as number]!;
          if (labels) {
            stringArray[index as number] = labels[index as number]!;
          }
        });
        node.setData("valueArray", valueArray);
      }

      if (next) {
        value = hashValues[next];
        if (value) {
          each(valueArray, (pair, index) => {
            pair[1] = (value!.values as number[])[index as number]!;
          });
        }
      }
    });
    this.normalizeDims();
    this.delegate.compute();
    this.delegate.select(this.delegate.root);
    if (animate) {
      this.delegate.fx.animate({
        modes: ["node-property:height:dimArray"],
        duration: 1500,
        onComplete: () => {
          this.busy = false;
          if (onComplete) {
            onComplete.onComplete();
          }
        },
      });
    }
  }

  filter(filters: string | string[], callback?: AreaChartCallback): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    if (this.config.Tips.enable) {
      this.delegate.tips.hide();
    }
    this.select(false, false, false);
    const arguments_ = splat(filters);
    const root = this.delegate.graph.getNode(this.delegate.root);
    this.normalizeDims();
    root.eachAdjacency((adjacency) => {
      const node = adjacency.nodeTo as TNode;
      const dimensionArray = node.getData<AreaChartValuePair[]>(
        "dimArray",
        "end",
      );
      const stringArray = node.getData<string[]>("stringArray");
      node.setData(
        "dimArray",
        map(dimensionArray, (dimensions, index) =>
          indexOf(arguments_, stringArray[index as number]!) > -1
            ? dimensions
            : [0, 0],
        ),
        "end",
      );
    });
    this.delegate.fx.animate({
      modes: ["node-property:dimArray"],
      duration: 1500,
      onComplete: () => {
        this.busy = false;
        if (callback) {
          callback.onComplete();
        }
      },
    });
  }

  restore(callback?: AreaChartCallback): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    if (this.config.Tips.enable) {
      this.delegate.tips.hide();
    }
    this.select(false, false, false);
    this.normalizeDims();
    this.delegate.fx.animate({
      modes: ["node-property:height:dimArray"],
      duration: 1500,
      onComplete: () => {
        this.busy = false;
        if (callback) {
          callback.onComplete();
        }
      },
    });
  }

  select(
    id: string | false,
    name: string | false,
    index: number | false,
  ): void {
    if (!this.config.selectOnHover) {
      return;
    }
    const selected = this.selected;
    if (
      selected.id != id ||
      selected.name != name ||
      selected.index != index
    ) {
      selected.id = id;
      selected.name = name;
      selected.index = index;
      this.delegate.graph.eachNode((node) => {
        node.setData("border", false);
      });
      if (id) {
        let node = this.delegate.graph.getNode(id);
        node.setData("border", selected);
        const property = index === 0 ? "prev" : "next";
        const linkedName = node.getData<string | false>(property);
        if (linkedName) {
          const linkedNode = this.delegate.graph.getByName(linkedName);
          if (linkedNode) {
            linkedNode.setData("border", {
              name,
              index: 1 - (index as number),
            });
          }
        }
      }
      this.delegate.plot();
    }
  }

  getLegend(): Record<string, string> {
    const legend: Record<string, string> = {};
    let node: TNode | undefined;
    this.delegate.graph
      .getNode(this.delegate.root)
      .eachAdjacency((adjacency) => {
        node = adjacency.nodeTo as TNode;
      });
    const colors = node!.getData<string[]>("colorArray");
    const length = colors.length;
    each(node!.getData<string[]>("stringArray"), (name, index) => {
      legend[name] = colors[(index as number) % length]!;
    });
    return legend;
  }

  getMaxValue(): number {
    let maximumValue = 0;
    this.delegate.graph.eachNode((node) => {
      const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
      let accumulatedLeft = 0;
      let accumulatedRight = 0;
      each(valueArray, (value) => {
        accumulatedLeft += +value[0];
        accumulatedRight += +value[1];
      });
      const accumulated =
        accumulatedRight > accumulatedLeft
          ? accumulatedRight
          : accumulatedLeft;
      maximumValue = maximumValue > accumulated ? maximumValue : accumulated;
    });
    return maximumValue;
  }

  normalizeDims(): void {
    const root = this.delegate.graph.getNode(this.delegate.root);
    let count = 0;
    root.eachAdjacency(() => {
      count += 1;
    });
    const maximumValue = this.getMaxValue() || 1;
    const size = this.delegate.canvas.getSize();
    const config = this.config;
    const margin = config.Margin;
    const labelOffset = config.labelOffset + config.Label.size;
    const fixedDimension =
      (size.width - (margin.left + margin.right)) / count;
    const showAggregates = config.showAggregates as AreaChartFormatter | false;
    const showLabels = config.showLabels as AreaChartFormatter | false;
    const availableHeight =
      size.height -
      (margin.top + margin.bottom) -
      Number(showAggregates && labelOffset) -
      Number(showLabels && labelOffset);

    this.delegate.graph.eachNode((node) => {
      let accumulatedLeft = 0;
      let accumulatedRight = 0;
      const animatedValues: AreaChartValuePair[] = [];
      const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
      each(valueArray, (value) => {
        accumulatedLeft += +value[0];
        accumulatedRight += +value[1];
        animatedValues.push([0, 0]);
      });
      const accumulated =
        accumulatedRight > accumulatedLeft
          ? accumulatedRight
          : accumulatedLeft;
      node.setData("width", fixedDimension);
      if (config.animate) {
        node.setData(
          "height",
          (accumulated * availableHeight) / maximumValue,
          "end",
        );
        node.setData(
          "dimArray",
          map(valueArray, (value) => [
            (value[0] * availableHeight) / maximumValue,
            (value[1] * availableHeight) / maximumValue,
          ]),
          "end",
        );
        const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray");
        if (!dimensionArray) {
          node.setData("dimArray", animatedValues);
        }
      } else {
        node.setData(
          "height",
          (accumulated * availableHeight) / maximumValue,
        );
        node.setData(
          "dimArray",
          map(valueArray, (value) => [
            (value[0] * availableHeight) / maximumValue,
            (value[1] * availableHeight) / maximumValue,
          ]),
        );
      }
    });
  }

  private sumSide(values: AreaChartValuePair[], side: 0 | 1): number {
    return reduce(values, (total, value) => total + value[side], 0);
  }
}
