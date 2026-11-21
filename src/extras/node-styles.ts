import { Quart } from "../core/easing.js";
import { merge } from "../core/util.js";
import type {
  NodeStyleMap,
  NodeStylesOptions,
} from "../options/node-styles.js";
import type { PositionPhase } from "../types.js";

export interface StyleableNode {
  id: string;
  data: Record<string, unknown>;
  styles?: Record<string, unknown>;
  selected?: unknown;
  hovered?: unknown;
  getData<TValue = unknown>(property: string): TValue;
  setData(
    property: string,
    value: unknown,
    phase?: PositionPhase,
  ): void;
}

export interface StyleableGraph<TNode extends StyleableNode> {
  eachNode(visit: (node: TNode) => void): void;
}

export interface NodeStyleFxOptions extends Record<string, unknown> {
  elements: {
    id: string;
    properties: NodeStyleMap;
  };
  transition: typeof Quart.easeOut;
  duration: number;
  fps: number;
}

export interface NodeStyleDependencies<TNode extends StyleableNode> {
  graph: StyleableGraph<TNode>;
  nodeFx(options: NodeStyleFxOptions): void;
  stopNodeFx(): void;
}

export type NodeStyleControllerOptions = NodeStylesOptions &
  Record<string, unknown>;

/** Stateful, renderer-independent kernel for legacy NodeStyles effects. */
export class NodeStyleController<TNode extends StyleableNode> {
  readonly options: NodeStyleControllerOptions;
  readonly dependencies: NodeStyleDependencies<TNode>;
  hoveredNode: TNode | false = false;

  constructor(
    options: NodeStyleControllerOptions,
    dependencies: NodeStyleDependencies<TNode>,
  ) {
    this.options = options;
    this.dependencies = dependencies;
  }

  getRestoredStyles(node: TNode, type: "Hover" | "Click"): NodeStyleMap {
    const restored: NodeStyleMap = {};
    const styles = this.stylesFor(type);
    for (const property in styles) {
      restored[property] = (node.styles as Record<string, unknown>)[
        `$${property}`
      ];
    }
    return restored;
  }

  toggleStylesOnHover(node: TNode, set: boolean): void {
    if (this.options.stylesHover) {
      this.toggleStylesOn("Hover", node, set);
    }
  }

  toggleStylesOnClick(node: TNode, set: boolean): void {
    if (this.options.stylesClick) {
      this.toggleStylesOn("Click", node, set);
    }
  }

  toggleStylesOn(
    type: "Hover" | "Click",
    node: TNode,
    set: boolean,
  ): void {
    const properties = set
      ? this.stylesFor(type)
      : this.getRestoredStyles(node, type);

    if (set) {
      if (!node.styles) {
        node.styles = merge(node.data, {}) as Record<string, unknown>;
      }
      for (const property in this.stylesFor(type)) {
        const dataKey = `$${property}`;
        if (!(dataKey in node.styles)) {
          node.styles[dataKey] = node.getData(property);
        }
      }
    }

    const request = {
      elements: {
        id: node.id,
        properties,
      },
      transition: Quart.easeOut,
      duration: 300,
      fps: 40,
      ...this.options,
    } as NodeStyleFxOptions;
    this.dependencies.nodeFx(request);
  }

  /** Apply the click-selection state transition after hit testing. */
  click(node: TNode | false | null | undefined): void {
    if (!node || !this.options.stylesClick) {
      return;
    }

    if (node.selected) {
      this.toggleStylesOnClick(node, false);
      delete node.selected;
      return;
    }

    const clickStyles = this.options.stylesClick;
    this.dependencies.graph.eachNode((candidate) => {
      if (!candidate.selected) {
        return;
      }
      for (const property in clickStyles) {
        candidate.setData(
          property,
          (candidate.styles as Record<string, unknown>)[`$${property}`],
          "end",
        );
      }
      delete candidate.selected;
    });

    this.toggleStylesOnClick(node, true);
    node.selected = true;
    delete node.hovered;
    this.hoveredNode = false;
  }

  /** Apply native-canvas hover transitions after the caller resolves a hit. */
  hover(node: TNode | false | null | undefined): void {
    const hoverStyles = this.options.stylesHover;
    if (!hoverStyles || (node && node.hovered)) {
      return;
    }

    if (node && !node.selected) {
      this.dependencies.stopNodeFx();
      this.dependencies.graph.eachNode((candidate) => {
        if (candidate.hovered && !candidate.selected) {
          for (const property in hoverStyles) {
            candidate.setData(
              property,
              (candidate.styles as Record<string, unknown>)[`$${property}`],
              "end",
            );
          }
          delete candidate.hovered;
        }
      });
      node.hovered = true;
      this.hoveredNode = node;
      this.toggleStylesOnHover(node, true);
    } else if (this.hoveredNode && !this.hoveredNode.selected) {
      this.dependencies.stopNodeFx();
      this.toggleStylesOnHover(this.hoveredNode, false);
      delete this.hoveredNode.hovered;
      this.hoveredNode = false;
    }
  }

  /** Preserve the legacy mouseout behavior, including its hovered flag quirk. */
  leave(): void {
    if (!this.hoveredNode) {
      return;
    }
    this.toggleStylesOnHover(this.hoveredNode, false);
    this.hoveredNode = false;
  }

  private stylesFor(type: "Hover" | "Click"): NodeStyleMap {
    return this.options[`styles${type}`] as NodeStyleMap;
  }
}
