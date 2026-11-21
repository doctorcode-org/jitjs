import { merge } from "../core/util.js";
import type { PositionPhase, TreeNodeJson } from "../types.js";
import type {
  SpaceTreeGeometryAlignment,
  SpaceTreeGeometryOrientation,
} from "./space-tree-geometry.js";

export interface SpaceTreeWorkflowPosition {
  x: number;
  y: number;
  add(position: { x: number; y: number }): this;
  $scale(factor: number): this;
  setc(x: number, y: number): void;
}

export interface SpaceTreeWorkflowNode<
  TPosition extends SpaceTreeWorkflowPosition = SpaceTreeWorkflowPosition,
> {
  id: string;
  data: Record<string, unknown>;
  _depth?: number;
  drawn: boolean;
  exist: boolean;
  selected: boolean;
  visited?: boolean;
  pos: TPosition;
  startPos: TPosition;
  endPos: TPosition;
  getData<TValue = unknown>(property: string): TValue;
  setData(
    property: string,
    value: unknown,
    phase?: "current" | "end",
  ): void;
  eachLevel(
    begin: number,
    end: number | false,
    visit: (node: this) => void,
  ): void;
  eachSubnode(visit: (node: this) => void): void;
  anySubnode(
    condition?: string | false | null | ((node: this) => unknown),
  ): boolean;
  isDescendantOf(id: string): boolean;
}

export interface SpaceTreeWorkflowGraph<TNode extends SpaceTreeWorkflowNode> {
  getNode(id: string): TNode | undefined;
  eachNode(visit: (node: TNode) => void): void;
  computeLevels(rootId: string, startDepth?: number, flags?: unknown): void;
}

export interface SpaceTreeWorkflowCanvas {
  getSize(): { width: number; height: number };
}

export interface SpaceTreeWorkflowConfig<
  TNode extends SpaceTreeWorkflowNode,
> extends Record<string, unknown> {
  levelsToShow: number;
  constrained: boolean;
  multitree: boolean;
  orientation: SpaceTreeGeometryOrientation;
  align: SpaceTreeGeometryAlignment;
  offsetX?: number;
  offsetY?: number;
  onBeforeCompute(node: TNode): void;
  onAfterCompute(node: TNode | string): void;
  onComplete(): void;
}

export interface SpaceTreeWorkflowController<
  TNode extends SpaceTreeWorkflowNode,
> extends Record<string, unknown> {
  offsetX?: number;
  offsetY?: number;
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
  onBeforeCompute(node: TNode): void;
  onAfterCompute(node: TNode | string): void;
  onComplete(): void;
  onBeforeRequest?(node: TNode): void;
  onBeforeContract?(node: TNode): void;
  onBeforeMove?(node: TNode): void;
  onBeforeExpand?(node: TNode): void;
  Move?: { enable: boolean; offsetX: number; offsetY: number };
  setRightLevelToShowConfig?:
    | SpaceTreeWorkflowLevelVisibilityOptions<TNode>
    | false;
}

export interface SpaceTreeWorkflowLevelVisibilityOptions<
  TNode extends SpaceTreeWorkflowNode,
> {
  execShow?: boolean;
  execHide?: boolean;
  onHide?(node: TNode): void;
  onShow?(node: TNode): void;
}

export interface SpaceTreeWorkflowVisualization<
  TNode extends SpaceTreeWorkflowNode,
  TGraph extends SpaceTreeWorkflowGraph<TNode>,
  TCanvas extends SpaceTreeWorkflowCanvas,
  TConfig extends SpaceTreeWorkflowConfig<TNode>,
> {
  root: string;
  clickedNode: TNode | null;
  graph: TGraph;
  canvas: TCanvas;
  config: TConfig;
  compute(phase?: PositionPhase, recomputeLevels?: boolean): void;
  plot(options?: TConfig, animating?: boolean): void;
  animate(options?: Record<string, unknown>): unknown;
  selectPath(node: TNode, pinnedIds?: readonly string[]): void;
}

export interface SpaceTreeWorkflowGeometry<
  TNode extends SpaceTreeWorkflowNode,
  TCanvas extends SpaceTreeWorkflowCanvas,
  TPosition extends SpaceTreeWorkflowPosition,
> {
  switchOrientation(orientation: SpaceTreeGeometryOrientation): void;
  getRightLevelToShow(node: TNode, canvas: TCanvas): number;
  setRightLevelToShow(
    node: TNode,
    canvas: TCanvas,
    options?: SpaceTreeWorkflowLevelVisibilityOptions<TNode> | false,
  ): void;
  translate(
    position: TPosition,
    phases: PositionPhase | readonly PositionPhase[],
  ): void;
}

export interface SpaceTreeWorkflowGroup<
  TNode extends SpaceTreeWorkflowNode,
  TController extends SpaceTreeWorkflowController<TNode>,
> {
  requestNodes(nodes: readonly TNode[], controller: TController): void;
  contract(nodes: TNode[], controller: TController): void;
  expand(nodes: TNode[], controller: TController): void;
  prepare(nodes: TNode[]): TNode[];
  hide(nodes: readonly TNode[], controller: TController): void;
  show(nodes: TNode[]): void;
}

export interface SpaceTreeWorkflowOperations<
  TNodeData extends Record<string, unknown>,
> {
  sumSubtree?(
    subtree: TreeNodeJson<TNodeData>,
    options: Record<string, unknown>,
  ): void;
  removeNodes?(ids: readonly string[], options: Record<string, unknown>): void;
}

export interface SpaceTreeWorkflowDependencies<
  TNode extends SpaceTreeWorkflowNode<TPosition>,
  TGraph extends SpaceTreeWorkflowGraph<TNode>,
  TCanvas extends SpaceTreeWorkflowCanvas,
  TConfig extends SpaceTreeWorkflowConfig<TNode>,
  TController extends SpaceTreeWorkflowController<TNode>,
  TPosition extends SpaceTreeWorkflowPosition,
  TNodeData extends Record<string, unknown>,
> extends SpaceTreeWorkflowOperations<TNodeData> {
  visualization: SpaceTreeWorkflowVisualization<TNode, TGraph, TCanvas, TConfig>;
  geometry: SpaceTreeWorkflowGeometry<TNode, TCanvas, TPosition>;
  group: SpaceTreeWorkflowGroup<TNode, TController>;
  controller: TController;
  isPlotBusy?(): boolean;
  setPlotBusy?(busy: boolean): void;
}

export type SpaceTreeWorkflowMethod = "animate" | "replot" | string;

/**
 * Optional legacy SpaceTree interaction pipeline. It is a separate entry so
 * applications that only need layout and plotting do not retain request,
 * contraction, expansion, or root-switching code.
 */
export class SpaceTreeWorkflow<
  TNode extends SpaceTreeWorkflowNode<TPosition>,
  TGraph extends SpaceTreeWorkflowGraph<TNode>,
  TCanvas extends SpaceTreeWorkflowCanvas,
  TConfig extends SpaceTreeWorkflowConfig<TNode>,
  TController extends SpaceTreeWorkflowController<TNode>,
  TPosition extends SpaceTreeWorkflowPosition,
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly visualization: SpaceTreeWorkflowVisualization<
    TNode,
    TGraph,
    TCanvas,
    TConfig
  >;
  readonly geometry: SpaceTreeWorkflowGeometry<TNode, TCanvas, TPosition>;
  readonly group: SpaceTreeWorkflowGroup<TNode, TController>;
  readonly controller: TController;
  readonly nodesInPath: string[] = [];
  busy = false;

  private plotBusy = false;
  private readonly dependencies: SpaceTreeWorkflowDependencies<
    TNode,
    TGraph,
    TCanvas,
    TConfig,
    TController,
    TPosition,
    TNodeData
  >;

  constructor(
    dependencies: SpaceTreeWorkflowDependencies<
      TNode,
      TGraph,
      TCanvas,
      TConfig,
      TController,
      TPosition,
      TNodeData
    >,
  ) {
    this.dependencies = dependencies;
    this.visualization = dependencies.visualization;
    this.geometry = dependencies.geometry;
    this.group = dependencies.group;
    this.controller = dependencies.controller;
  }

  getNodesToHide(node = this.requireClickedNode()): TNode[] {
    if (!this.visualization.config.constrained) return [];
    const level = node._depth as number;
    const result: TNode[] = [];
    this.visualization.graph.eachNode((candidate) => {
      if (candidate.exist && !candidate.selected) {
        if (candidate.isDescendantOf(node.id)) {
          if ((candidate._depth as number) <= level) result.push(candidate);
        } else {
          result.push(candidate);
        }
      }
    });
    const leafLevel = this.geometry.getRightLevelToShow(
      node,
      this.visualization.canvas,
    );
    node.eachLevel(leafLevel, leafLevel, (candidate) => {
      if (candidate.exist && !candidate.selected) result.push(candidate as TNode);
    });
    for (const id of this.nodesInPath) {
      const pinned = this.requireNode(id);
      if (!pinned.isDescendantOf(node.id)) result.push(pinned);
    }
    return result;
  }

  getNodesToShow(node = this.requireClickedNode()): TNode[] {
    const result: TNode[] = [];
    const clicked = this.requireClickedNode();
    clicked.eachLevel(
      0,
      this.visualization.config.levelsToShow,
      (candidate) => {
        if (
          this.visualization.config.multitree &&
          !("$orn" in candidate.data) &&
          candidate.anySubnode((child) => child.exist && !child.drawn)
        ) {
          result.push(candidate as TNode);
        } else if (candidate.drawn && !candidate.anySubnode("drawn")) {
          result.push(candidate as TNode);
        }
      },
    );
    void node;
    return result;
  }

  requestNodes(
    node: TNode,
    requested: Partial<TController> = {},
  ): void {
    const handler = this.resolveController(requested);
    const levels = this.visualization.config.levelsToShow;
    if (handler.request) {
      const leaves: TNode[] = [];
      const depth = node._depth as number;
      node.eachLevel(0, levels, (candidate) => {
        if (candidate.drawn && !candidate.anySubnode()) {
          leaves.push(candidate as TNode);
          (candidate as TNode & { _level: number })._level =
            levels - ((candidate._depth as number) - depth);
        }
      });
      this.group.requestNodes(leaves, handler);
    } else {
      handler.onComplete();
    }
  }

  contract(
    requested: Partial<TController> = {},
    switched?: SpaceTreeGeometryOrientation,
  ): void {
    const orientation = this.visualization.config.orientation;
    if (switched) this.geometry.switchOrientation(switched);
    const nodes = this.getNodesToHide();
    if (switched) this.geometry.switchOrientation(orientation);
    this.group.contract(nodes, this.resolveController(requested));
  }

  move(node: TNode, requested: Partial<TController>): void {
    this.visualization.compute("end", false);
    const complete = this.resolveController(requested);
    const move = complete.Move as {
      enable: boolean;
      offsetX: number;
      offsetY: number;
    };
    if (move.enable) {
      this.geometry.translate(
        node.endPos
          .add({ x: move.offsetX, y: move.offsetY })
          .$scale(-1) as TPosition,
        "end",
      );
    }
    this.visualization.animate(
      merge(this.controller, { modes: ["linear"] }, complete) as unknown as Record<
        string,
        unknown
      >,
    );
  }

  expand(node: TNode, requested: Partial<TController> = {}): void {
    this.group.expand(
      this.getNodesToShow(node),
      this.resolveController(requested),
    );
  }

  switchPosition(
    orientation: SpaceTreeGeometryOrientation,
    method: SpaceTreeWorkflowMethod,
    requested: Partial<TController> = {},
  ): void {
    if (this.isPlotBusy()) return;
    this.setPlotBusy(true);
    this.contract(
      {
        onComplete: () => {
          this.geometry.switchOrientation(orientation);
          this.visualization.compute("end", false);
          this.setPlotBusy(false);
          const clicked = this.requireClickedNode();
          if (method === "animate") {
            this.onClick(clicked.id, requested);
          } else if (method === "replot") {
            this.select(clicked.id, requested);
          }
        },
      } as Partial<TController>,
      orientation,
    );
  }

  switchAlignment(
    alignment: SpaceTreeGeometryAlignment,
    method: SpaceTreeWorkflowMethod,
    requested: Partial<TController> = {},
  ): void {
    this.visualization.config.align = alignment;
    const clicked = this.requireClickedNode();
    if (method === "animate") {
      this.select(clicked.id, requested);
    } else if (method === "replot") {
      this.onClick(clicked.id, requested);
    }
  }

  addNodeInPath(id: string): void {
    this.nodesInPath.push(id);
    this.select(this.visualization.clickedNode?.id ?? this.visualization.root);
  }

  clearNodesInPath(_id?: string): void {
    this.nodesInPath.length = 0;
    this.select(this.visualization.clickedNode?.id ?? this.visualization.root);
  }

  refresh(): void {
    this.reposition();
    this.select(this.visualization.clickedNode?.id ?? this.visualization.root);
  }

  reposition(): void {
    this.visualization.graph.computeLevels(
      this.visualization.root,
      0,
      "ignore",
    );
    this.geometry.setRightLevelToShow(
      this.requireClickedNode(),
      this.visualization.canvas,
    );
    this.visualization.graph.eachNode((node) => {
      if (node.exist) node.drawn = true;
    });
    this.visualization.compute("end");
  }

  select(id: string, requested: Partial<TController> = {}): void {
    const node = this.requireNode(id);
    const complete = this.resolveController(requested);
    complete.onBeforeCompute(node);
    this.visualization.selectPath(node, this.nodesInPath);
    this.visualization.clickedNode = node;
    this.requestNodes(node, {
      onComplete: () => {
        this.group.hide(
          this.group.prepare(this.getNodesToHide()),
          complete,
        );
        this.geometry.setRightLevelToShow(
          node,
          this.visualization.canvas,
        );
        this.visualization.compute("current");
        this.visualization.graph.eachNode((candidate) => {
          const position = candidate.pos;
          candidate.startPos.setc(position.x, position.y);
          candidate.endPos.setc(position.x, position.y);
          candidate.visited = false;
        });
        this.geometry.translate(
          node.endPos
            .add({
              x: complete.offsetX as number,
              y: complete.offsetY as number,
            })
            .$scale(-1) as TPosition,
          ["start", "current", "end"],
        );
        this.group.show(this.getNodesToShow());
        this.visualization.plot();
        complete.onAfterCompute(this.requireClickedNode());
        complete.onComplete();
      },
    } as Partial<TController>);
  }

  onClick(id: string, requested: Partial<TController> = {}): void {
    const config = this.visualization.config;
    const complete = this.resolveController(
      merge(
        {
          Move: {
            enable: true,
            offsetX: config.offsetX || 0,
            offsetY: config.offsetY || 0,
          },
          setRightLevelToShowConfig: false,
          onBeforeRequest() {},
          onBeforeContract() {},
          onBeforeMove() {},
          onBeforeExpand() {},
        },
        requested,
      ) as Partial<TController>,
    );
    if (this.busy) return;
    this.busy = true;
    const node = this.requireNode(id);
    this.visualization.selectPath(node, this.nodesInPath);
    this.visualization.clickedNode = node;
    complete.onBeforeCompute(node);
    complete.onBeforeRequest?.(node);
    this.requestNodes(node, {
      onComplete: () => {
        complete.onBeforeContract?.(node);
        this.contract({
          onComplete: () => {
            this.geometry.setRightLevelToShow(
              node,
              this.visualization.canvas,
              complete.setRightLevelToShowConfig,
            );
            complete.onBeforeMove?.(node);
            this.move(node, {
              Move: complete.Move,
              onComplete: () => {
                complete.onBeforeExpand?.(node);
                this.expand(node, {
                  onComplete: () => {
                    this.busy = false;
                    complete.onAfterCompute(id);
                    complete.onComplete();
                  },
                } as Partial<TController>);
              },
            } as Partial<TController>);
          },
        } as Partial<TController>);
      },
    } as Partial<TController>);
  }

  setRoot(
    id: string,
    method: SpaceTreeWorkflowMethod,
    requested?: { onComplete?(): void },
  ): void {
    if (this.busy) return;
    this.busy = true;
    const rootNode = this.requireNode(this.visualization.root);
    const clickedNode = this.requireNode(id);
    const applyRoot = (): void => {
      if (
        this.visualization.config.multitree &&
        clickedNode.data.$orn
      ) {
        const orientation = clickedNode.data
          .$orn as SpaceTreeGeometryOrientation;
        const opposite = {
          left: "right",
          right: "left",
          top: "bottom",
          bottom: "top",
        }[orientation] as SpaceTreeGeometryOrientation;
        rootNode.data.$orn = opposite;
        const tag = (node: TNode): void => {
          node.eachSubnode((child) => {
            if (child.id !== id) {
              child.data.$orn = opposite;
              tag(child as TNode);
            }
          });
        };
        tag(rootNode);
        delete clickedNode.data.$orn;
      }
      this.visualization.root = id;
      this.visualization.clickedNode = clickedNode;
      this.visualization.graph.computeLevels(id, 0, "ignore");
      this.geometry.setRightLevelToShow(
        clickedNode,
        this.visualization.canvas,
        {
          execHide: false,
          onShow: (node) => {
            if (!node.drawn) {
              node.drawn = true;
              node.setData("alpha", 1, "end");
              node.setData("alpha", 0);
              node.pos.setc(clickedNode.pos.x, clickedNode.pos.y);
            }
          },
        },
      );
      this.visualization.compute("end");
      this.busy = true;
      this.visualization.animate({
        modes: ["linear", "node-property:alpha"],
        onComplete: () => {
          this.busy = false;
          this.onClick(id, {
            onComplete: () => requested?.onComplete?.(),
          } as Partial<TController>);
        },
      });
    };

    delete rootNode.data.$orns;
    if (method === "animate") {
      applyRoot();
      this.visualization.selectPath(clickedNode, this.nodesInPath);
    } else if (method === "replot") {
      applyRoot();
      this.select(this.visualization.root);
    }
  }

  addSubtree(
    subtree: TreeNodeJson<TNodeData>,
    method: SpaceTreeWorkflowMethod,
    requested: Record<string, unknown> = {},
  ): void {
    const sum = this.dependencies.sumSubtree;
    if (!sum) throw new TypeError("No SpaceTree subtree-sum operation supplied");
    if (method === "replot") {
      sum(subtree, { type: "replot", ...requested });
    } else if (method === "animate") {
      sum(subtree, { type: "fade:seq", ...requested });
    }
  }

  removeSubtree(
    id: string,
    removeRoot: boolean,
    method: SpaceTreeWorkflowMethod,
    requested: Record<string, unknown> = {},
  ): void {
    const remove = this.dependencies.removeNodes;
    if (!remove) throw new TypeError("No SpaceTree node-removal operation supplied");
    const node = this.requireNode(id);
    const ids: string[] = [];
    node.eachLevel(removeRoot ? 0 : 1, false, (candidate) => {
      ids.push(candidate.id);
    });
    if (method === "replot") {
      remove(ids, { type: "replot", ...requested });
    } else if (method === "animate") {
      remove(ids, { type: "fade:seq", ...requested });
    }
  }

  private resolveController(requested: Partial<TController>): TController {
    return merge(this.controller, requested) as TController;
  }

  private requireNode(id: string): TNode {
    const node = this.visualization.graph.getNode(id);
    if (!node) throw new Error(`Unknown graph node: ${id}`);
    return node;
  }

  private requireClickedNode(): TNode {
    if (!this.visualization.clickedNode) {
      throw new Error("No SpaceTree node has been selected");
    }
    return this.visualization.clickedNode;
  }

  private isPlotBusy(): boolean {
    return this.dependencies.isPlotBusy?.() ?? this.plotBusy;
  }

  private setPlotBusy(busy: boolean): void {
    this.plotBusy = busy;
    this.dependencies.setPlotBusy?.(busy);
  }
}
