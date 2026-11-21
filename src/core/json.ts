/**
 * The recursive shape accepted by the JSON tree utilities.
 *
 * Keeping the concrete node as a type parameter preserves application-specific
 * fields in callbacks and return values without coupling this module to a
 * particular data payload.
 */
export type JsonTreeNode<TNode, TId = unknown> = {
  readonly id: TId;
  children?: TNode[];
};

export type TreeVisitor<TNode> = (node: TNode, level: number) => void;

/**
 * Replaces the children of every node at `maxLevel` with a fresh empty array.
 * The tree is mutated in place, matching the legacy JIT behavior.
 */
export function prune<TNode extends JsonTreeNode<TNode>>(
  tree: TNode,
  maxLevel: number,
): void {
  forEachNode(tree, (node, level) => {
    if (level === maxLevel && node.children) {
      delete node.children;
      node.children = [];
    }
  });
}

/** Finds the parent of the first depth-first node whose id matches `id`. */
export function findParent<TNode extends JsonTreeNode<TNode>>(
  tree: TNode,
  id: TNode["id"],
): TNode | false {
  // Deliberately retain the legacy coercive comparison at the JavaScript
  // boundary while the TypeScript signature keeps ids consistently typed.
  if (tree.id == id) {
    return false;
  }

  const children = tree.children;
  if (children && children.length > 0) {
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index] as TNode;
      if (child.id == id) {
        return tree;
      }

      const parent = findParent(child, id);
      if (parent) {
        return parent;
      }
    }
  }

  return false;
}

/** Finds the first depth-first subtree whose root id matches `id`. */
export function findSubtree<TNode extends JsonTreeNode<TNode>>(
  tree: TNode,
  id: TNode["id"],
): TNode | null {
  // See findParent: coercion here is intentional compatibility behavior.
  if (tree.id == id) {
    return tree;
  }

  const children = tree.children;
  for (let index = 0; children && index < children.length; index += 1) {
    const subtree = findSubtree(children[index] as TNode, id);
    if (subtree !== null) {
      return subtree;
    }
  }

  return null;
}

/**
 * Visits nodes depth-first in preorder while their relative level is at most
 * `toLevel`. The root is reported at `initialLevel`.
 */
export function forEachLevel<TNode extends JsonTreeNode<TNode>>(
  tree: TNode,
  initialLevel: number,
  toLevel: number,
  visitor: TreeVisitor<TNode>,
): void {
  if (initialLevel > toLevel) {
    return;
  }

  visitor(tree, initialLevel);

  const children = tree.children;
  if (!children) {
    return;
  }

  for (let index = 0; index < children.length; index += 1) {
    forEachLevel(children[index] as TNode, initialLevel + 1, toLevel, visitor);
  }
}

/** Visits every node depth-first in preorder. */
export function forEachNode<TNode extends JsonTreeNode<TNode>>(
  tree: TNode,
  visitor: TreeVisitor<TNode>,
): void {
  forEachLevel(tree, 0, Number.MAX_VALUE, visitor);
}
