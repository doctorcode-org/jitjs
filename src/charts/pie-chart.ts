import { each, map, merge, reduce, splat, time } from "../core/util.js";
import type { PolarCoordinates } from "../core/geometry.js";
import { createCanvasOptions } from "../options/canvas.js";
import { createLabelOptions, type LabelOptions } from "../options/label.js";
import {
  createPieChartOptions,
  type PieChartOptions as PieChartOptionDefaults,
} from "../options/pie-chart.js";
import type { PositionPhase } from "../types.js";

export interface PieChartSize {
  width: number;
  height: number;
}

export interface PieChartCanvasContext {
  globalCompositeOperation: string;
}

export interface PieChartCanvas {
  getSize(): PieChartSize;
  getCtx(): PieChartCanvasContext;
}

export interface PieChartPosition {
  theta: number;
  getp(simple: true): PolarCoordinates;
}

export interface PieChartAdjacency<TNode extends PieChartNode = PieChartNode> {
  nodeTo: TNode;
}

export interface PieChartNode {
  id: string;
  name: string;
  pos: PieChartPosition;
  getData<TValue = unknown>(
    property: string,
    phase?: PositionPhase,
  ): TValue;
  setData(property: string, value: unknown, phase?: PositionPhase): void;
  eachAdjacency(
    callback: (adjacency: PieChartAdjacency<this>) => void,
  ): void;
}

export interface PieChartGraph<TNode extends PieChartNode = PieChartNode> {
  eachNode(callback: (node: TNode) => void): void;
  getNode(id: string): TNode;
  getByName(name: string): TNode | false | null | undefined;
}

export interface PieChartAnimationOptions {
  modes: string[];
  duration: number;
  onComplete?: () => void;
}

export interface PieChartDelegateConfig extends Record<string, unknown> {
  levelDistance: number;
}

export interface PieChartDelegate<TNode extends PieChartNode = PieChartNode> {
  canvas: PieChartCanvas;
  config: PieChartDelegateConfig;
  graph: PieChartGraph<TNode>;
  root: string;
  fx: {
    animate(options: PieChartAnimationOptions): void;
  };
  loadJSON(json: PieChartDelegateJsonNode): void;
  refresh(): void;
  compute(phase?: PositionPhase): void;
  plot(): void;
}

export interface PieChartContainedElement {
  name: string;
  color: string;
  value: number;
  label: string;
  index?: unknown;
}

export interface PieChartEventInfo {
  getContains(): PieChartContainedElement;
}

export interface PieChartTipsConfig {
  enable: boolean;
  onShow(
    tip: unknown,
    element: PieChartContainedElement,
    node: PieChartNode,
  ): void;
  onHide(...arguments_: unknown[]): void;
}

export interface PieChartEventsConfig {
  enable: boolean;
  onClick(
    element: PieChartContainedElement,
    eventInfo: PieChartEventInfo,
    event: unknown,
  ): void;
}

export interface PieChartConfig extends Record<string, unknown> {
  injectInto: string | HTMLElement;
  width: number | false;
  height: number | false;
  useCanvas: unknown | false;
  animate: boolean;
  offset: number;
  sliceOffset: number;
  labelOffset: number;
  type: string;
  hoveredColor: false | string;
  showLabels: boolean;
  resizeLabels: boolean | number;
  updateHeights: boolean;
  Label: LabelOptions;
  Tips: PieChartTipsConfig;
  Events: PieChartEventsConfig;
}

export interface PieChartConstructorOptions extends Record<string, unknown> {
  injectInto?: string | HTMLElement;
  width?: number | false;
  height?: number | false;
  useCanvas?: unknown | false;
  animate?: boolean;
  offset?: number;
  sliceOffset?: number;
  labelOffset?: number;
  type?: string;
  hoveredColor?: false | string;
  showLabels?: boolean;
  resizeLabels?: boolean | number;
  updateHeights?: boolean;
  Label?: Partial<LabelOptions>;
  Tips?: Partial<PieChartOptionDefaults["Tips"]>;
  Events?: Partial<PieChartOptionDefaults["Events"]>;
}

export interface PieChartDelegateOptions<
  TNode extends PieChartNode = PieChartNode,
> extends Record<string, unknown> {
  injectInto: string | HTMLElement;
  width: number | false;
  height: number | false;
  useCanvas: unknown | false;
  withLabels: boolean;
  Label: { type: LabelOptions["type"] };
  Node: {
    overridable: true;
    type: string;
    width: 1;
    height: 1;
  };
  Edge: { type: "none" };
  Tips: {
    enable: boolean;
    type: "Native";
    force: true;
    onShow(tip: unknown, node: TNode, contains: PieChartContainedElement): void;
  };
  Events: {
    enable: true;
    type: "Native";
    onClick(node: TNode, eventInfo: PieChartEventInfo, event: unknown): void;
    onMouseMove(
      node: TNode | false | null,
      eventInfo: PieChartEventInfo,
      event: unknown,
    ): void;
  };
  onCreateLabel(domElement: HTMLElement, node: TNode): void;
  onPlaceLabel(domElement: HTMLElement, node: TNode): void;
}

export interface PieChartDependencies<
  TNode extends PieChartNode = PieChartNode,
  TDelegate extends PieChartDelegate<TNode> = PieChartDelegate<TNode>,
> {
  createDelegate(options: PieChartDelegateOptions<TNode>): TDelegate;
  now?: () => number;
}

export interface PieChartValueGroup {
  label: string;
  values: number | number[];
}

export interface PieChartJson {
  label: string | string[];
  color?: string | string[];
  values: PieChartValueGroup[];
}

export interface PieChartDelegateJsonNode {
  id: string;
  name: string;
  data: Record<string, unknown>;
  children: PieChartDelegateJsonNode[];
}

export interface PieChartSelection {
  id?: string | false;
  name?: string | false;
  color?: string;
}

export interface PieChartUpdateCallbacks {
  onComplete(): void;
}

type LegacyIterable = ArrayLike<unknown> | Record<string, unknown>;

const DEFAULT_COLORS = [
  "#416D9C",
  "#70A35E",
  "#EBB056",
  "#C74243",
  "#83548B",
  "#909291",
  "#557EAA",
];

/**
 * JIT 2.0.1 PieChart as an explicitly composed, side-effect-free facade.
 * The Sunburst delegate is supplied by the caller instead of read from a
 * global namespace.
 */
export class PieChart<
  TNode extends PieChartNode = PieChartNode,
  TDelegate extends PieChartDelegate<TNode> = PieChartDelegate<TNode>,
> {
  sb: null = null;
  colors = [...DEFAULT_COLORS];
  selected: PieChartSelection = {};
  busy = false;

  controller: PieChartConfig;
  config: PieChartConfig;
  delegate: TDelegate;
  canvas: TDelegate["canvas"];

  private readonly dependencies: PieChartDependencies<TNode, TDelegate>;

  constructor(
    options: PieChartConstructorOptions = {},
    dependencies: PieChartDependencies<TNode, TDelegate>,
  ) {
    this.dependencies = dependencies;
    this.controller = this.config = merge(
      createCanvasOptions(),
      createPieChartOptions(),
      { Label: createLabelOptions() },
      { Label: { type: "Native" as const } },
      options,
    ) as unknown as PieChartConfig;

    const config = this.config;
    const nodeType = config.type.split(":")[0] as string;
    const delegate = dependencies.createDelegate({
      injectInto: config.injectInto,
      width: config.width,
      height: config.height,
      useCanvas: config.useCanvas,
      withLabels: config.Label.type != "Native",
      Label: { type: config.Label.type },
      Node: {
        overridable: true,
        type: `piechart-${nodeType}`,
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
        if (!config.showLabels) {
          return;
        }
        const label = config.Label;
        const style = domElement.style;
        style.fontSize = `${label.size}px`;
        style.fontFamily = label.family;
        style.color = label.color;
        style.textAlign = "center";
        domElement.innerHTML = node.name;
      },
      onPlaceLabel: (domElement, node) => {
        if (!config.showLabels) {
          return;
        }
        // The legacy implementation reads the position even though it uses
        // theta directly afterwards. Preserve that observable call.
        node.pos.getp(true);
        const dimensions = node.getData<number[]>("dimArray");
        const span = node.getData<number>("span") / 2;
        const begin = node.pos.theta - span;
        const end = node.pos.theta + span;
        let accumulated = 0;
        if (dimensions) {
          for (let index = 0; index < dimensions.length; index += 1) {
            accumulated += dimensions[index] as number;
          }
          const scale = config.resizeLabels
            ? node.getData<number>("normalizedDim")
            : 1;
          let fontSize = (config.Label.size * scale) >> 0;
          fontSize =
            fontSize < +config.resizeLabels ? +config.resizeLabels : fontSize;
          domElement.style.fontSize = `${fontSize}px`;

          const radius =
            accumulated + config.labelOffset + config.sliceOffset;
          const theta = (begin + end) / 2;
          const position = {
            x: Math.cos(theta) * radius,
            y: Math.sin(theta) * radius,
          };
          const size = this.canvas.getSize();
          domElement.style.left = `${Math.round(position.x + size.width / 2)}px`;
          domElement.style.top = `${Math.round(position.y + size.height / 2)}px`;
        }
      },
    });

    const size = delegate.canvas.getSize();
    delegate.config.levelDistance =
      Math.min(size.width, size.height) / 2 -
      config.offset -
      config.sliceOffset;
    this.delegate = delegate;
    this.canvas = delegate.canvas;
    this.canvas.getCtx().globalCompositeOperation = "lighter";
  }

  loadJSON(json: PieChartJson): void {
    const prefix = (this.dependencies.now ?? time)();
    const children: PieChartDelegateJsonNode[] = [];
    const names = splat(json.label);
    const colors = splat(json.color || this.colors);
    const colorLength = colors.length;
    const config = this.config;
    const gradient = Boolean(config.type.split(":")[1]);
    const mono = names.length == 1;

    for (let index = 0; index < json.values.length; index += 1) {
      const value = json.values[index] as PieChartValueGroup;
      const valueArray = splat(value.values);
      children.push({
        id: `${prefix}${value.label}`,
        name: value.label,
        data: {
          value: valueArray,
          $valueArray: valueArray,
          $colorArray: mono
            ? splat(colors[index % colorLength] as string)
            : colors,
          $stringArray: names,
          $gradient: gradient,
          $config: config,
          $angularWidth: reduce(valueArray, (left, right) => left + right),
        },
        children: [],
      });
    }

    const root: PieChartDelegateJsonNode = {
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
    this.delegate.refresh();
    if (config.animate) {
      this.delegate.fx.animate({
        modes: ["node-property:dimArray"],
        duration: 1500,
      });
    }
  }

  updateJSON(
    json: PieChartJson,
    onComplete?: PieChartUpdateCallbacks,
  ): void {
    if (this.busy) {
      return;
    }
    this.busy = true;

    each(json.values, (value) => {
      const node = this.delegate.graph.getByName(value.label);
      const values = splat(value.values);
      if (node) {
        node.setData("valueArray", values);
        node.setData(
          "angularWidth",
          reduce(values, (left, right) => left + right),
        );
        if (json.label) {
          node.setData("stringArray", splat(json.label));
        }
      }
    });
    this.normalizeDims();
    if (this.config.animate) {
      this.delegate.compute("end");
      this.delegate.fx.animate({
        modes: ["node-property:dimArray:span", "linear"],
        duration: 1500,
        onComplete: () => {
          this.busy = false;
          if (onComplete) {
            onComplete.onComplete();
          }
        },
      });
    } else {
      this.delegate.refresh();
    }
  }

  select(
    id: string | false,
    name: string | false,
    _index?: unknown,
  ): void {
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
    this.delegate.graph
      .getNode(this.delegate.root)
      .eachAdjacency((adjacency) => {
        node = adjacency.nodeTo as TNode;
      });
    const colors = (node as TNode).getData<string[]>("colorArray");
    const colorLength = colors.length;
    each((node as TNode).getData<string[]>("stringArray"), (name, index) => {
      legend[name] = colors[(index as number) % colorLength] as string;
    });
    return legend;
  }

  getMaxValue(): number {
    let maximum = 0;
    this.delegate.graph.eachNode((node) => {
      const values = node.getData<unknown>("valueArray") as LegacyIterable;
      let accumulated = 0;
      each(values, (value) => {
        accumulated += +(value as number);
      });
      maximum = maximum > accumulated ? maximum : accumulated;
    });
    return maximum;
  }

  normalizeDims(): void {
    const root = this.delegate.graph.getNode(this.delegate.root);
    let length = 0;
    root.eachAdjacency(() => {
      length += 1;
    });
    void length;

    const maximum = this.getMaxValue() || 1;
    const config = this.config;
    const radius = this.delegate.config.levelDistance;
    this.delegate.graph.eachNode((node) => {
      let accumulated = 0;
      const animateValue: number[] = [];
      const values = node.getData<unknown>("valueArray") as LegacyIterable;
      each(values, (value) => {
        accumulated += +(value as number);
        animateValue.push(1);
      });
      const staticHeight = animateValue.length == 1 && !config.updateHeights;
      const dimensions = map(values, (value) =>
        staticHeight
          ? radius
          : ((value as number) * radius) / maximum,
      );
      if (config.animate) {
        node.setData("dimArray", dimensions, "end");
        if (!node.getData<unknown>("dimArray")) {
          node.setData("dimArray", animateValue);
        }
      } else {
        node.setData("dimArray", dimensions);
      }
      node.setData("normalizedDim", accumulated / maximum);
    });
  }
}
