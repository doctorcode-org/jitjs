import { merge } from "../core/util.js";

export interface IcicleWorkflowNode {
  id: string;
  _depth?: number;
  _level?: number;
  drawn: boolean;
  setData(
    property: string,
    value: unknown,
    phase?: "current" | "end",
  ): void;
  eachSubgraph(visit: (node: this) => void, flags?: unknown): void;
  eachLevel(
    begin: number,
    end: number | false,
    visit: (node: this) => void,
  ): void;
  anySubnode(condition?: unknown): boolean;
  getParents(): this[];
}

export interface IcicleWorkflowController<
  TNode extends IcicleWorkflowNode,
> extends Record<string, unknown> {
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

export interface IcicleWorkflowConfig extends Record<string, unknown> {
  animate?: boolean;
  constrained?: boolean;
  levelsToShow?: number;
  request?: unknown;
}

export interface IcicleWorkflowGraph<TNode extends IcicleWorkflowNode> {
  getNode(id: string): TNode | undefined;
  nodeList: {
    setDataset(
      phases: readonly ("current" | "end")[],
      data: Record<string, readonly unknown[]>,
    ): void;
  };
}

export interface IcicleWorkflowVisualization<
  TNode extends IcicleWorkflowNode,
  TGraph extends IcicleWorkflowGraph<TNode>,
> {
  root: string;
  clickedNode: TNode | null;
  busy: boolean;
  config: IcicleWorkflowConfig;
  graph: TGraph;
  compute(phase?: "current" | "end"): void;
  plot(): void;
  refresh(): void;
  animate(options: Record<string, unknown> & { modes: string[] }): unknown;
}

export interface IcicleWorkflowGroup<
  TNode extends IcicleWorkflowNode,
  TController extends IcicleWorkflowController<TNode>,
> {
  requestNodes(nodes: readonly TNode[], controller: TController): void;
}

export interface IcicleWorkflowDependencies<
  TNode extends IcicleWorkflowNode,
  TGraph extends IcicleWorkflowGraph<TNode>,
  TController extends IcicleWorkflowController<TNode>,
> {
  visualization: IcicleWorkflowVisualization<TNode, TGraph>;
  group: IcicleWorkflowGroup<TNode, TController>;
  controller: TController;
  clearHoveredNode?(): void;
}

/** Optional lazy-loading entry/out pipeline for the Icicle façade. */
export class IcicleWorkflow<
  TNode extends IcicleWorkflowNode,
  TGraph extends IcicleWorkflowGraph<TNode>,
  TController extends IcicleWorkflowController<TNode>,
> {
  readonly visualization: IcicleWorkflowVisualization<TNode, TGraph>;
  readonly group: IcicleWorkflowGroup<TNode, TController>;
  readonly controller: TController;
  private readonly clearHoveredNode: (() => void) | undefined;

  constructor(
    dependencies: IcicleWorkflowDependencies<TNode, TGraph, TController>,
  ) {
    this.visualization = dependencies.visualization;
    this.group = dependencies.group;
    this.controller = dependencies.controller;
    this.clearHoveredNode = dependencies.clearHoveredNode;
  }

  requestNodes(
    node: TNode,
    requested: Partial<TController> = {},
  ): void {
    const handler = merge(this.controller, requested) as TController;
    const constrained = Boolean(this.visualization.config.constrained);
    const levelsToShow = constrained
      ? (this.visualization.config.levelsToShow as number)
      : Number.MAX_VALUE;
    if (handler.request) {
      const leaves: TNode[] = [];
      const depth = node._depth as number;
      node.eachLevel(0, levelsToShow, (candidate) => {
        if (candidate.drawn && !candidate.anySubnode()) {
          leaves.push(candidate as TNode);
          candidate._level = (candidate._depth as number) - depth;
          if (constrained) {
            candidate._level = levelsToShow - candidate._level;
          }
        }
      });
      this.group.requestNodes(leaves, handler);
    } else {
      handler.onComplete();
    }
  }

  enter(node: TNode): boolean {
    const visualization = this.visualization;
    if (visualization.busy) return false;
    visualization.busy = true;
    const complete = (): void => {
      if (visualization.config.request) visualization.compute();
      if (visualization.config.animate) {
        visualization.graph.nodeList.setDataset(["current", "end"], {
          alpha: [1, 0],
        });
        node.eachSubgraph((candidate) => {
          candidate.setData("alpha", 1, "end");
        }, "ignore");
        visualization.animate({
          duration: 500,
          modes: ["node-property:alpha"],
          onComplete: () => {
            visualization.clickedNode = node;
            visualization.compute("end");
            visualization.animate({
              modes: ["linear", "node-property:width:height"],
              duration: 1000,
              onComplete: () => {
                visualization.busy = false;
                visualization.clickedNode = node;
              },
            });
          },
        });
      } else {
        visualization.clickedNode = node;
        visualization.busy = false;
        visualization.refresh();
      }
    };
    if (visualization.config.request) {
      // The 2.0.1 source references an undefined local here. Passing the
      // selected node restores its clearly intended lazy-loading behavior.
      this.requestNodes(node, { onComplete: complete } as Partial<TController>);
    } else {
      complete();
    }
    return true;
  }

  out(): boolean {
    const visualization = this.visualization;
    if (visualization.busy) return false;
    const current =
      visualization.graph.getNode(
        visualization.clickedNode?.id ?? visualization.root,
      ) as TNode;
    const parent = current.getParents()[0] as TNode | undefined;
    const previousClickedNode = visualization.clickedNode;
    visualization.busy = true;
    this.clearHoveredNode?.();
    if (!parent) {
      visualization.busy = false;
      return false;
    }
    const complete = (): void => {
      visualization.clickedNode = parent;
      if (visualization.config.request) {
        this.requestNodes(parent, {
          onComplete: () => {
            visualization.compute();
            visualization.plot();
            visualization.busy = false;
          },
        } as Partial<TController>);
      } else {
        visualization.compute();
        visualization.plot();
        visualization.busy = false;
      }
    };
    if (visualization.config.animate) {
      visualization.clickedNode = parent;
      visualization.compute("end");
      visualization.clickedNode = previousClickedNode;
      visualization.animate({
        modes: ["linear", "node-property:width:height"],
        duration: 1000,
        onComplete: () => {
          visualization.clickedNode = parent;
          visualization.graph.nodeList.setDataset(["current", "end"], {
            alpha: [0, 1],
          });
          previousClickedNode?.eachSubgraph((node) => {
            node.setData("alpha", 1);
          }, "ignore");
          visualization.animate({
            duration: 500,
            modes: ["node-property:alpha"],
            onComplete: complete,
          });
        },
      });
    } else {
      complete();
    }
    return true;
  }
}
