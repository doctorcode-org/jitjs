export type SubtreeOperationType = "animate" | "replot" | "nothing" | string;

export interface SubtreePosition {
  set(value: never): void;
}

export interface SubtreeNode<TPosition extends SubtreePosition> {
  id: string;
  collapsed?: unknown;
  ignore?: unknown;
  anySubnode(condition: (node: this) => unknown): boolean;
  eachSubnode(visit: (node: this) => void): void;
  getPos(phase: "end"): TPosition | undefined;
  setPos(position: TPosition, phase: "end"): void;
  setData(property: string, value: unknown, phase?: "current" | "end"): void;
}

export interface SubtreeOperationOptions extends Record<string, unknown> {
  type?: SubtreeOperationType;
  duration?: number;
  hideLabels?: boolean;
  fps?: number;
  modes?: string[];
}

export interface ResolvedSubtreeOperationOptions
  extends SubtreeOperationOptions {
  type: SubtreeOperationType;
  duration: number;
  hideLabels: boolean;
  fps: number;
  modes: string[];
}

export interface SubtreeOperationDependencies<
  TNode extends SubtreeNode<TPosition>,
  TPosition extends SubtreePosition,
> {
  config?: Readonly<Record<string, unknown>>;
  rotated?: TNode | false | null;
  computeEnd(): void;
  rotate(
    node: TNode,
    method: "none",
    options: { property: "end" },
  ): void;
  animate(options: ResolvedSubtreeOperationOptions): void;
  refresh(): void;
}

export function resolveSubtreeOperationOptions(
  config: Readonly<Record<string, unknown>> = {},
  requested: SubtreeOperationOptions = {},
): ResolvedSubtreeOperationOptions {
  return {
    type: "nothing",
    duration: 2000,
    hideLabels: true,
    fps: 30,
    ...config,
    ...requested,
    modes: ["node-property:alpha:span", "linear"],
  } as ResolvedSubtreeOperationOptions;
}

/** Collapse every descendant using Graph.Op.contract ordering and phases. */
export function contractSubtree<
  TPosition extends SubtreePosition,
  TNode extends SubtreeNode<TPosition>,
>(
  node: TNode,
  dependencies: SubtreeOperationDependencies<TNode, TPosition>,
  requested: SubtreeOperationOptions = {},
): boolean {
  if (node.collapsed || !node.anySubnode(() => true)) {
    return false;
  }

  const options = resolveSubtreeOperationOptions(
    dependencies.config,
    requested,
  );
  node.collapsed = true;
  visitDescendants(node, (child) => {
    child.ignore = true;
    child.setData(
      "alpha",
      0,
      options.type == "animate" ? "end" : "current",
    );
  });

  if (options.type == "animate") {
    dependencies.computeEnd();
    if (dependencies.rotated) {
      dependencies.rotate(dependencies.rotated, "none", { property: "end" });
    }
    const endPosition = node.getPos("end") as TPosition;
    visitDescendants(node, (child) => {
      child.setPos(endPosition, "end");
    });
    dependencies.animate(options);
  } else if (options.type == "replot") {
    dependencies.refresh();
  }
  return true;
}

/** Expand descendants previously hidden by Graph.Op.contract. */
export function expandSubtree<
  TPosition extends SubtreePosition,
  TNode extends SubtreeNode<TPosition>,
>(
  node: TNode,
  dependencies: SubtreeOperationDependencies<TNode, TPosition>,
  requested: SubtreeOperationOptions = {},
): boolean {
  if (!("collapsed" in node)) {
    return false;
  }

  const options = resolveSubtreeOperationOptions(
    dependencies.config,
    requested,
  );
  delete node.collapsed;
  visitDescendants(node, (child) => {
    delete child.ignore;
    child.setData(
      "alpha",
      1,
      options.type == "animate" ? "end" : "current",
    );
  });

  if (options.type == "animate") {
    dependencies.computeEnd();
    if (dependencies.rotated) {
      dependencies.rotate(dependencies.rotated, "none", { property: "end" });
    }
    dependencies.animate(options);
  } else if (options.type == "replot") {
    dependencies.refresh();
  }
  return true;
}

function visitDescendants<
  TPosition extends SubtreePosition,
  TNode extends SubtreeNode<TPosition>,
>(node: TNode, visit: (node: TNode) => void): void {
  node.eachSubnode((child) => {
    visit(child as TNode);
    visitDescendants(child as TNode, visit);
  });
}
