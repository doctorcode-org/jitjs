export interface IcicleGroupNode {
  id: string;
  _level?: number;
}

export interface IcicleGroupController extends Record<string, unknown> {
  onComplete(): void;
  request(
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

export interface IcicleGroupDependencies<TNode extends IcicleGroupNode> {
  root(): string;
  computeLevels(rootId: string, startDepth?: number): void;
  mergeSubtree(
    nodeId: string,
    data: { children?: unknown } & Record<string, unknown>,
  ): void;
}

/** Lazy Icicle subtree requests without retaining graph-operation policies. */
export class IcicleGroup<TNode extends IcicleGroupNode> {
  private readonly dependencies: IcicleGroupDependencies<TNode>;

  constructor(dependencies: IcicleGroupDependencies<TNode>) {
    this.dependencies = dependencies;
  }

  requestNodes(
    nodes: readonly TNode[],
    controller: IcicleGroupController,
  ): void {
    let counter = 0;
    const length = nodes.length;
    const complete = (): void => controller.onComplete();
    if (length === 0) complete();
    for (const node of nodes) {
      controller.request(node.id, node._level as number, {
        onComplete: (nodeId, data) => {
          if (data && data.children) {
            data.id = nodeId;
            this.dependencies.mergeSubtree(nodeId, data);
          }
          if (++counter === length) {
            this.dependencies.computeLevels(this.dependencies.root(), 0);
            complete();
          }
        },
      });
    }
  }
}
