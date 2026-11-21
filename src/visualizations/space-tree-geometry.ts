import { Complex } from "../core/geometry.js";
import { merge, splat } from "../core/util.js";
import type { PositionPhase } from "../types.js";

export type SpaceTreeGeometryOrientation = "top" | "right" | "bottom" | "left";
export type SpaceTreeGeometryAlignment = "left" | "center" | "right";

export interface SpaceTreeGeometryNode {
  data: Record<string, unknown>;
  _depth?: number;
  drawn: boolean;
  exist: boolean;
  pos: Complex;
  getData<TValue = unknown>(property: string): TValue;
  getPos(phase: PositionPhase): Complex | undefined;
  eachSubnode(visit: (node: this) => void): void;
  anySubnode(condition?: unknown): boolean;
  eachLevel(
    begin: number,
    end: number | false,
    visit: (node: this) => void,
  ): void;
}

export interface SpaceTreeGeometryGraph<TNode extends SpaceTreeGeometryNode> {
  eachNode(visit: (node: TNode) => void): void;
}

export interface SpaceTreeGeometryCanvas {
  getSize(): { width: number; height: number };
}

export interface SpaceTreeGeometryLabels<TNode extends SpaceTreeGeometryNode> {
  hideLabel(node: TNode, show: boolean): void;
}

export interface SpaceTreeGeometryConfig extends Record<string, unknown> {
  orientation: SpaceTreeGeometryOrientation;
  siblingOffset: number;
  subtreeOffset: number;
  multitree: boolean;
  levelsToShow: number;
  constrained: boolean;
  Node: { align: SpaceTreeGeometryAlignment } & Record<string, unknown>;
}

export interface SpaceTreeLevelVisibilityOptions<
  TNode extends SpaceTreeGeometryNode,
> {
  execShow?: boolean;
  execHide?: boolean;
  onHide?(node: TNode): void;
  onShow?(node: TNode): void;
}

export interface SpaceTreeGeometryDependencies<
  TNode extends SpaceTreeGeometryNode,
> {
  graph: SpaceTreeGeometryGraph<TNode>;
  config: SpaceTreeGeometryConfig;
  labels: SpaceTreeGeometryLabels<TNode>;
}

/** Low-level SpaceTree geometry, kept separate from layout and rendering. */
export class SpaceTreeGeometry<TNode extends SpaceTreeGeometryNode> {
  readonly graph: SpaceTreeGeometryGraph<TNode>;
  readonly config: SpaceTreeGeometryConfig;
  readonly labels: SpaceTreeGeometryLabels<TNode>;
  readonly node: SpaceTreeGeometryConfig["Node"];

  constructor(dependencies: SpaceTreeGeometryDependencies<TNode>) {
    this.graph = dependencies.graph;
    this.config = dependencies.config;
    this.labels = dependencies.labels;
    this.node = dependencies.config.Node;
  }

  switchOrientation(orientation: SpaceTreeGeometryOrientation): void {
    this.config.orientation = orientation;
  }

  dispatch<TValue>(
    orientation: SpaceTreeGeometryOrientation,
    vertical: TValue | (() => TValue),
    horizontal: TValue | (() => TValue),
  ): TValue;
  dispatch<TValue>(
    orientation: SpaceTreeGeometryOrientation,
    top: TValue | (() => TValue),
    right: TValue | (() => TValue),
    bottom: TValue | (() => TValue),
    left: TValue | (() => TValue),
  ): TValue;
  dispatch<TValue>(
    orientation: SpaceTreeGeometryOrientation,
    ...values: Array<TValue | (() => TValue)>
  ): TValue {
    const resolve = (value: TValue | (() => TValue)): TValue =>
      typeof value === "function" ? (value as () => TValue)() : value;
    if (values.length === 2) {
      return resolve(
        orientation === "top" || orientation === "bottom"
          ? (values[0] as TValue | (() => TValue))
          : (values[1] as TValue | (() => TValue)),
      );
    }
    const index = { top: 0, right: 1, bottom: 2, left: 3 }[orientation];
    return resolve(values[index] as TValue | (() => TValue));
  }

  getSize(node: TNode, invert?: boolean): number {
    const orientation = this.nodeOrientation(node);
    const width = node.getData<number>("width") + this.config.siblingOffset;
    const height = node.getData<number>("height") + this.config.siblingOffset;
    return invert
      ? this.dispatch(orientation, width, height)
      : this.dispatch(orientation, height, width);
  }

  getTreeBaseSize(
    node: TNode,
    level: number,
    leaf: (level: number, node: TNode) => unknown,
  ): number {
    const size = this.getSize(node, true);
    let baseHeight = 0;
    if (leaf(level, node)) return size;
    if (level === 0) return 0;
    node.eachSubnode((child) => {
      baseHeight += this.getTreeBaseSize(child as TNode, level - 1, leaf);
    });
    return Math.max(size, baseHeight) + this.config.subtreeOffset;
  }

  getEdge(
    node: TNode,
    type: "begin" | "end",
    orientation: SpaceTreeGeometryOrientation,
  ): Complex | undefined {
    const position = (x: number, y: number) => (): Complex =>
      node.pos.add(new Complex(x, y));
    const width = node.getData<number>("width");
    const height = node.getData<number>("height");
    if (type === "begin") {
      if (this.node.align === "center") {
        return this.dispatch(
          orientation,
          position(0, height / 2),
          position(-width / 2, 0),
          position(0, -height / 2),
          position(width / 2, 0),
        );
      }
      if (this.node.align === "left") {
        return this.dispatch(
          orientation,
          position(0, height),
          position(0, 0),
          position(0, 0),
          position(width, 0),
        );
      }
      if (this.node.align === "right") {
        return this.dispatch(
          orientation,
          position(0, 0),
          position(-width, 0),
          position(0, -height),
          position(0, 0),
        );
      }
      throw "align: not implemented";
    }
    if (type === "end") {
      if (this.node.align === "center") {
        return this.dispatch(
          orientation,
          position(0, -height / 2),
          position(width / 2, 0),
          position(0, height / 2),
          position(-width / 2, 0),
        );
      }
      if (this.node.align === "left") {
        return this.dispatch(
          orientation,
          position(0, 0),
          position(width, 0),
          position(0, height),
          position(0, 0),
        );
      }
      if (this.node.align === "right") {
        return this.dispatch(
          orientation,
          position(0, -height),
          position(0, 0),
          position(0, 0),
          position(-width, 0),
        );
      }
      throw "align: not implemented";
    }
    return undefined;
  }

  getScaledTreePosition(node: TNode, scale: number): Complex {
    const width = node.getData<number>("width");
    const height = node.getData<number>("height");
    const orientation = this.nodeOrientation(node);
    const position = (x: number, y: number) => (): Complex =>
      node.pos.add(new Complex(x, y)).$scale(1 - scale);
    if (this.node.align === "left") {
      return this.dispatch(
        orientation,
        position(0, height),
        position(0, 0),
        position(0, 0),
        position(width, 0),
      );
    }
    if (this.node.align === "center") {
      return this.dispatch(
        orientation,
        position(0, height / 2),
        position(-width / 2, 0),
        position(0, -height / 2),
        position(width / 2, 0),
      );
    }
    if (this.node.align === "right") {
      return this.dispatch(
        orientation,
        position(0, 0),
        position(-width, 0),
        position(0, -height),
        position(0, 0),
      );
    }
    throw "align: not implemented";
  }

  treeFitsInCanvas(
    node: TNode,
    canvas: SpaceTreeGeometryCanvas,
    level: number,
  ): boolean {
    const canvasSize = canvas.getSize();
    const size = this.dispatch(
      this.nodeOrientation(node),
      canvasSize.width,
      canvasSize.height,
    );
    const baseSize = this.getTreeBaseSize(
      node,
      level,
      (depth, candidate) => depth === 0 || !candidate.anySubnode(),
    );
    return baseSize < size;
  }

  translate(
    position: Complex,
    phases: PositionPhase | readonly PositionPhase[],
  ): void {
    const properties = splat(phases) as PositionPhase[];
    this.graph.eachNode((node) => {
      for (const property of properties) {
        (node.getPos(property) as Complex).$add(position);
      }
    });
  }

  setRightLevelToShow(
    node: TNode,
    canvas: SpaceTreeGeometryCanvas,
    requested: SpaceTreeLevelVisibilityOptions<TNode> | false = {},
  ): void {
    const level = this.getRightLevelToShow(node, canvas);
    const options = merge(
      {
        execShow: true,
        execHide: true,
        onHide() {},
        onShow() {},
      },
      requested || {},
    ) as Required<SpaceTreeLevelVisibilityOptions<TNode>>;
    node.eachLevel(0, this.config.levelsToShow, (candidate) => {
      const relativeDepth = (candidate._depth as number) - (node._depth as number);
      if (relativeDepth > level) {
        options.onHide(candidate as TNode);
        if (options.execHide) {
          candidate.drawn = false;
          candidate.exist = false;
          this.labels.hideLabel(candidate as TNode, false);
        }
      } else {
        options.onShow(candidate as TNode);
        if (options.execShow) candidate.exist = true;
      }
    });
    node.drawn = true;
  }

  getRightLevelToShow(
    node: TNode,
    canvas: SpaceTreeGeometryCanvas,
  ): number {
    let level = this.config.levelsToShow;
    if (!this.config.constrained) return level;
    while (!this.treeFitsInCanvas(node, canvas, level) && level > 1) {
      level -= 1;
    }
    return level;
  }

  private nodeOrientation(node: TNode): SpaceTreeGeometryOrientation {
    return ((this.config.multitree && "$orn" in node.data && node.data.$orn) ||
      this.config.orientation) as SpaceTreeGeometryOrientation;
  }
}
