import { Animation, type AnimationOptionsInput } from "../core/animation.js";
import { merge } from "../core/util.js";

export interface SpaceTreeGroupNode {
  id: string;
  data: Record<string, unknown>;
  _depth?: number;
  drawn: boolean;
  exist: boolean;
  eachLevel(
    begin: number,
    end: number | false,
    visit: (node: this) => void,
  ): void;
  eachSubgraph(visit: (node: this) => void): void;
  eachSubnode(visit: (node: this) => void): void;
  anySubnode(
    condition?: string | false | null | ((node: this) => unknown),
  ): boolean;
  getParents(): this[];
  isDescendantOf(id: string): boolean;
}

export interface SpaceTreeGroupContext {
  save(): void;
  restore(): void;
}

export interface SpaceTreeGroupCanvas<TContext extends SpaceTreeGroupContext> {
  getCtx(): TContext;
}

export interface SpaceTreeGroupGraph<TNode extends SpaceTreeGroupNode> {
  computeLevels(rootId: string, startDepth?: number): void;
}

export interface SpaceTreeGroupConfig extends Record<string, unknown> {
  levelsToShow: number;
  multitree: boolean;
}

export interface SpaceTreeGroupController<TNode extends SpaceTreeGroupNode>
  extends Record<string, unknown> {
  onComplete(): void;
  request?(
    nodeId: string,
    level: number,
    callbacks: {
      onComplete(
        nodeId: string,
        data?: { children?: unknown } & Record<string, unknown>,
      ): void;
    },
  ): void;
}

export interface SpaceTreeGroupAnimation {
  setOptions(options?: AnimationOptionsInput | null): this;
  start(): this;
}

export interface SpaceTreeGroupDependencies<
  TNode extends SpaceTreeGroupNode,
  TContext extends SpaceTreeGroupContext,
  TCanvas extends SpaceTreeGroupCanvas<TContext>,
  TController extends SpaceTreeGroupController<TNode>,
> {
  root(): string;
  canvas: TCanvas;
  graph: SpaceTreeGroupGraph<TNode>;
  config: SpaceTreeGroupConfig;
  plot(): void;
  plotScaledSubtree(
    node: TNode,
    controller: TController,
    scale: number | undefined,
    animating: false | "contract" | "expand",
  ): void;
  mergeSubtree(
    nodeId: string,
    data: { children?: unknown } & Record<string, unknown>,
  ): void;
  animation?: SpaceTreeGroupAnimation;
}

/**
 * The contraction/expansion group used by SpaceTree, isolated so importing
 * the core façade does not pull request handling or another animation in.
 */
export class SpaceTreeGroup<
  TNode extends SpaceTreeGroupNode,
  TContext extends SpaceTreeGroupContext,
  TCanvas extends SpaceTreeGroupCanvas<TContext>,
  TController extends SpaceTreeGroupController<TNode>,
> {
  readonly canvas: TCanvas;
  readonly config: SpaceTreeGroupConfig;
  readonly animation: SpaceTreeGroupAnimation;
  nodes: TNode[] | null = null;

  private readonly dependencies: SpaceTreeGroupDependencies<
    TNode,
    TContext,
    TCanvas,
    TController
  >;

  constructor(
    dependencies: SpaceTreeGroupDependencies<
      TNode,
      TContext,
      TCanvas,
      TController
    >,
  ) {
    this.dependencies = dependencies;
    this.canvas = dependencies.canvas;
    this.config = dependencies.config;
    this.animation = dependencies.animation ?? new Animation();
  }

  requestNodes(nodes: readonly TNode[], controller: TController): void {
    let counter = 0;
    const length = nodes.length;
    const complete = (): void => controller.onComplete();
    if (length === 0) {
      complete();
    }
    for (const node of nodes) {
      controller.request?.(node.id, (node as TNode & { _level: number })._level, {
        onComplete: (nodeId, data) => {
          if (data && data.children) {
            data.id = nodeId;
            this.dependencies.mergeSubtree(nodeId, data);
          }
          if (++counter === length) {
            this.dependencies.graph.computeLevels(this.dependencies.root(), 0);
            complete();
          }
        },
      });
    }
  }

  contract(nodes: TNode[], controller: TController): void {
    const prepared = this.prepare(nodes);
    const group = this;
    this.animation
      .setOptions(
        merge(controller, {
          $animating: false,
          compute: function (this: { $animating: false | "contract" }, delta: number) {
            if (delta === 1) delta = 0.99;
            group.plotStep(1 - delta, controller, this.$animating);
            this.$animating = "contract";
          },
          complete() {
            group.hide(prepared, controller);
          },
        }) as AnimationOptionsInput,
      )
      .start();
  }

  hide(nodes: readonly TNode[], controller: TController): void {
    for (const node of nodes) {
      node.eachLevel(1, false, (element) => {
        if (element.exist) {
          element.drawn = false;
          element.exist = false;
        }
      });
    }
    controller.onComplete();
  }

  expand(nodes: TNode[], controller: TController): void {
    const group = this;
    this.show(nodes);
    this.animation
      .setOptions(
        merge(controller, {
          $animating: false,
          compute: function (this: { $animating: false | "expand" }, delta: number) {
            group.plotStep(delta, controller, this.$animating);
            this.$animating = "expand";
          },
          complete() {
            group.plotStep(undefined, controller, false);
            controller.onComplete();
          },
        }) as AnimationOptionsInput,
      )
      .start();
  }

  show(nodes: TNode[]): void {
    this.prepare(nodes);
    for (const node of nodes) {
      if (this.config.multitree && !("$orn" in node.data)) {
        delete node.data.$orns;
        let orientations = " ";
        node.eachSubnode((child) => {
          const orientation = child.data.$orn;
          if (
            "$orn" in child.data &&
            orientations.indexOf(String(orientation)) < 0 &&
            child.exist &&
            !child.drawn
          ) {
            orientations += `${String(orientation)} `;
          }
        });
        node.data.$orns = orientations;
      }
      node.eachLevel(0, this.config.levelsToShow, (candidate) => {
        if (candidate.exist) candidate.drawn = true;
      });
    }
  }

  prepare(nodes: TNode[]): TNode[] {
    this.nodes = this.getNodesWithChildren(nodes);
    return this.nodes;
  }

  getNodesWithChildren(nodes: TNode[]): TNode[] {
    const answer: TNode[] = [];
    nodes.sort(
      (left, right) =>
        Number((left._depth ?? 0) <= (right._depth ?? 0)) -
        Number((left._depth ?? 0) >= (right._depth ?? 0)),
    );
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index] as TNode;
      if (node.anySubnode("exist")) {
        let descendant = false;
        for (
          let otherIndex = index + 1;
          !descendant && otherIndex < nodes.length;
          otherIndex += 1
        ) {
          const other = nodes[otherIndex] as TNode;
          if (!this.config.multitree || "$orn" in other.data) {
            descendant = descendant || node.isDescendantOf(other.id);
          }
        }
        if (!descendant) answer.push(node);
      }
    }
    return answer;
  }

  plotStep(
    delta: number | undefined,
    controller: TController,
    animating: false | "contract" | "expand",
  ): void {
    const nodes = this.nodes ?? [];
    const hidden: Record<string, TNode[]> = {};
    for (const node of nodes) {
      hidden[node.id] = [];
      const root = this.config.multitree && !("$orn" in node.data);
      const orientations = root && node.data.$orns;
      node.eachSubgraph((candidate) => {
        if (
          root &&
          orientations &&
          String(orientations).indexOf(String(candidate.data.$orn)) > 0 &&
          candidate.drawn
        ) {
          candidate.drawn = false;
          (hidden[node.id] as TNode[]).push(candidate);
        } else if ((!root || !orientations) && candidate.drawn) {
          candidate.drawn = false;
          (hidden[node.id] as TNode[]).push(candidate);
        }
      });
      node.drawn = true;
    }
    if (nodes.length > 0) this.dependencies.plot();
    for (const candidates of Object.values(hidden)) {
      for (const candidate of candidates) candidate.drawn = true;
    }
    for (const node of nodes) {
      const context = this.canvas.getCtx();
      context.save();
      this.dependencies.plotScaledSubtree(
        node,
        controller,
        delta,
        animating,
      );
      context.restore();
    }
  }

  getSiblings(nodes: readonly TNode[]): Record<string, TNode[]> {
    const siblings: Record<string, TNode[]> = {};
    for (const node of nodes) {
      const parents = node.getParents();
      if (parents.length === 0) {
        siblings[node.id] = [node];
      } else {
        const result: TNode[] = [];
        (parents[0] as TNode).eachSubnode((sibling) => result.push(sibling));
        siblings[node.id] = result;
      }
    }
    return siblings;
  }
}
