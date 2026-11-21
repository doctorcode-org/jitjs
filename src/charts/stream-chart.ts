import { indexOf, map, splat } from "../core/util.js";
import type {
  AreaChartCallback,
  AreaChartContainedValue,
  AreaChartDelegate,
  AreaChartDelegateOptions,
  AreaChartDependencies,
  AreaChartEventInfo,
  AreaChartNode,
  AreaChartOptions,
  AreaChartValuePair,
} from "./area-chart.js";
import { AreaChart } from "./area-chart.js";

export interface StreamChartCanvasSurface {
  getSize(): { width: number; height: number };
  getCtx(): CanvasRenderingContext2D;
  getElement?(): { style: { cursor: string } };
}

export interface StreamChartDelegate<TNode extends AreaChartNode = AreaChartNode>
  extends AreaChartDelegate<TNode> {
  canvas: StreamChartCanvasSurface;
  config: AreaChartDelegate<TNode>["config"] & { levelDistance: number };
  refresh(): void;
}

export interface StreamChartDependencies<
  TNode extends AreaChartNode = AreaChartNode,
  TDelegate extends StreamChartDelegate<TNode> = StreamChartDelegate<TNode>,
> extends AreaChartDependencies<TNode, TDelegate> {
  /** Replaces the source's global DOM lookup for the displayed short name. */
  getLabelName?: (key: string) => string;
}

export class StreamChart<
  TNode extends AreaChartNode = AreaChartNode,
  TDelegate extends StreamChartDelegate<TNode> = StreamChartDelegate<TNode>,
> extends AreaChart<TNode, TDelegate> {
  filterArray: string[] = [];

  constructor(
    options: AreaChartOptions = {},
    dependencies: StreamChartDependencies<TNode, TDelegate>,
  ) {
    super(options, dependencies);
  }

  override initializeViz(): void {
    const config = this.config;
    const dependencies = this.dependencies as StreamChartDependencies<
      TNode,
      TDelegate
    >;
    let delegate!: TDelegate;
    const options: AreaChartDelegateOptions<TNode> = {
      injectInto: config.injectInto,
      width: config.width,
      height: config.height,
      orientation: "bottom",
      levelDistance: 0,
      siblingOffset: 0,
      subtreeOffset: 0,
      withLabels: config.Label.type != "Native",
      useCanvas: config.useCanvas,
      Label: { type: config.Label.type },
      Node: {
        overridable: true,
        type: `streamchart-${config.type.split(":")[0]}`,
        align: "center",
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
          if (!config.filterOnClick && !config.Events.enable) return;
          const element = eventInfo.getContains();
          if (element && config.filterOnClick) this.filter([element.name]);
          if (config.Events.enable) {
            config.Events.onClick(element, eventInfo, event);
          }
        },
        onRightClick: () => {
          if (config.restoreOnRightClick) this.restore();
        },
        onMouseMove: (node, eventInfo) => {
          if (!config.selectOnHover) return;
          if (node) {
            const element = eventInfo.getContains() as AreaChartContainedValue;
            this.select(node.id, element.name, element.index);
          } else {
            this.select(false, false, false);
          }
          this.setupLabels();
        },
        onMouseEnter: () => {
          const element = delegate.canvas.getElement?.();
          if (element) element.style.cursor = "pointer";
        },
        onMouseLeave: () => {
          const element = delegate.canvas.getElement?.();
          if (element) element.style.cursor = "default";
        },
      },
      onCreateLabel: () => {},
      onPlaceLabel: () => {},
    };
    delegate = dependencies.createDelegate(options);
    const size = delegate.canvas.getSize();
    const margin = config.Margin;
    delegate.config.offsetY =
      -size.height / 2 +
      margin.bottom +
      config.labelOffset +
      config.Label.size;
    delegate.config.offsetX = (margin.right - margin.left) / 2;
    this.delegate = delegate;
    this.canvas = delegate.canvas;
  }

  setupLabels(): void {
    const graph = this.delegate.graph;
    const root = graph.getNode(this.delegate.root);
    const dimensions: Record<string, number> = {};
    const positions: Record<string, [number, number]> = {};
    root.eachAdjacency((adjacency) => {
      const node = adjacency.nodeTo as TNode;
      const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray");
      const names = node.getData<string[]>("stringArray");
      if (
        !node.getData<string | false>("prev") ||
        !graph.getByName(node.getData<string>("next"))
      ) {
        return;
      }
      for (let index = 0; index < names.length; index += 1) {
        const key = names[index]!.trim();
        const leftDimension = dimensionArray[index]![0];
        const rightDimension = dimensionArray[index]![1];
        if (
          !(key in dimensions) ||
          dimensions[key]! < leftDimension ||
          dimensions[key]! < rightDimension
        ) {
          const side = leftDimension > rightDimension ? "left-pos" : "right-pos";
          const points = node.getData<[number, number][]>(side);
          const pointIndex = index * 2;
          dimensions[key] = Math.max(leftDimension, rightDimension);
          positions[key] = [
            (points[pointIndex]![0] + points[pointIndex + 1]![0]) / 2,
            (points[pointIndex]![1] + points[pointIndex + 1]![1]) / 2,
          ];
        }
      }
    });

    const context = this.canvas.getCtx();
    const getLabelName = (
      this.dependencies as StreamChartDependencies<TNode, TDelegate>
    ).getLabelName ?? ((key: string) => key);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "80px Helvetica";
    for (const filter of this.filterArray) {
      const position = positions[filter];
      if (!position) continue;
      context.fillStyle = context.strokeStyle = "white";
      context.fillText(getLabelName(filter).split(" ")[0]!, position[0], position[1]);
    }
  }

  override filter(filters: string[], callback?: AreaChartCallback): void {
    if (this.busy) return;
    this.busy = true;
    this.filterArray = filters.slice();
    if (this.config.Tips.enable) this.delegate.tips.hide();
    this.select(false, false, false);
    const arguments_ = splat(filters);
    const root = this.delegate.graph.getNode(this.delegate.root);
    const margin = this.config.Margin;
    const totalHeight =
      this.canvas.getSize().height - margin.top - margin.bottom;
    let maximumHeight = -1;

    this.normalizeDims();
    root.eachAdjacency((adjacency) => {
      const node = adjacency.nodeTo as TNode;
      const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray", "end");
      const names = node.getData<string[]>("stringArray");
      let accumulatedLeft = 0;
      let accumulatedRight = 0;
      const filtered = map(dimensionArray, (dimension, index) => {
        if (indexOf(arguments_, names[index as number]!.trim()) > -1) {
          accumulatedLeft += dimension[0];
          accumulatedRight += dimension[1];
          return dimension;
        }
        return [0, 0] as AreaChartValuePair;
      });
      node.setData("dimArray", filtered, "end");
      const accumulated = Math.max(accumulatedLeft, accumulatedRight);
      maximumHeight = Math.max(maximumHeight, accumulated);
      node.setData("height", accumulated, "end");
    });

    root.eachAdjacency((adjacency) => {
      const node = adjacency.nodeTo as TNode;
      const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray", "end");
      const height = node.getData<number>("height", "end");
      node.setData("height", (height * totalHeight) / maximumHeight, "end");
      for (const dimension of dimensionArray) {
        dimension[0] = (totalHeight / maximumHeight) * dimension[0];
        dimension[1] = (totalHeight / maximumHeight) * dimension[1];
      }
    });

    const complete = () => {
      this.busy = false;
      callback?.onComplete();
    };
    if (this.config.animate) {
      this.delegate.fx.animate({
        modes: ["node-property:height:dimArray"],
        duration: 300,
        onComplete: complete,
      });
    } else {
      this.delegate.refresh();
      complete();
    }
  }

  override normalizeDims(): void {
    super.normalizeDims();
    const size = this.canvas.getSize();
    const margin = this.config.Margin;
    const labelOffset = this.config.labelOffset + this.config.Label.size;
    const availableHeight =
      size.height -
      margin.top -
      margin.bottom -
      labelOffset -
      labelOffset;
    this.delegate.config.levelDistance = availableHeight / 2;
  }
}
