import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../../types.js";
import {
  AreaTreemapLayout,
  averageAspectRatio,
} from "./area.js";
import type {
  TreemapAreaNode,
  TreemapCoordinates,
  TreemapPosition,
} from "./types.js";

/** Order-preserving strip treemap. */
export class StripTreemapLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> extends AreaTreemapLayout<TNodeData, TEdgeData, TPosition> {
  computePositions(
    node: TreemapAreaNode<TNodeData, TEdgeData, TPosition>,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void {
    const children = node.getSubnodes([1, 1], "ignore") as Array<
      TreemapAreaNode<TNodeData, TEdgeData, TPosition>
    >;
    if (children.length === 0) {
      return;
    }

    this.processChildrenLayout(node, children, coordinates, property);
    for (const child of children) {
      const height = Math.max(
        child.getData<number>("height", property) -
          this.config.offset -
          this.config.titleHeight,
        0,
      );
      const width = Math.max(
        child.getData<number>("width", property) - this.config.offset,
        0,
      );
      const position = child.getPos(property) as TPosition;

      this.computePositions(
        child,
        {
          width,
          height,
          top: position.y + this.config.titleHeight,
          left: position.x,
        },
        property,
      );
    }
  }

  processChildrenLayout(
    _parent: TreemapAreaNode<TNodeData, TEdgeData, TPosition>,
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void {
    const parentArea = coordinates.width * coordinates.height;
    const childAreas: number[] = [];
    let totalChildArea = 0;

    for (let index = 0; index < children.length; index += 1) {
      // Preserve unary-plus coercion from Layouts.TM.Strip.
      const area = +(
        children[index]?.getData("area", property) as number
      );
      childAreas[index] = area;
      totalChildArea += area;
    }

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index] as TreemapAreaNode<
        TNodeData,
        TEdgeData,
        TPosition
      >;
      child._area =
        (parentArea * (childAreas[index] as number)) / totalChildArea;
    }

    const side = this.horizontal()
      ? coordinates.width
      : coordinates.height;
    this.stripify(
      children.slice(1),
      [children[0] as TreemapAreaNode<
        TNodeData,
        TEdgeData,
        TPosition
      >],
      side,
      coordinates,
      property,
    );
  }

  stripify(
    tail: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    initialElements: Array<
      TreemapAreaNode<TNodeData, TEdgeData, TPosition>
    >,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void {
    this.computeDimension(
      tail,
      initialElements,
      fixedDimension,
      coordinates,
      averageAspectRatio,
      property,
    );
  }

  layoutRow(
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): TreemapCoordinates {
    return this.horizontal()
      ? this.layoutHorizontal(
          children,
          fixedDimension,
          coordinates,
          property,
        )
      : this.layoutVertical(
          children,
          fixedDimension,
          coordinates,
          property,
        );
  }

  layoutVertical(
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): TreemapCoordinates {
    let totalArea = 0;
    for (const child of children) {
      totalArea += child._area as number;
    }

    const width = totalArea / fixedDimension;
    let top = 0;
    for (const child of children) {
      const height = (child._area as number) / width;
      (child.getPos(property) as TPosition).setc(
        coordinates.left,
        coordinates.top + (fixedDimension - height - top),
      );
      child.setData("width", width, property);
      child.setData("height", height, property);
      top += height;
    }

    return {
      height: coordinates.height,
      width: coordinates.width - width,
      top: coordinates.top,
      left: coordinates.left + width,
      dim: fixedDimension,
    };
  }

  layoutHorizontal(
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): TreemapCoordinates {
    let totalArea = 0;
    for (const child of children) {
      totalArea += child._area as number;
    }

    const height = totalArea / fixedDimension;
    const top = coordinates.height - height;
    let left = 0;
    for (const child of children) {
      const width = (child._area as number) / height;
      (child.getPos(property) as TPosition).setc(
        coordinates.left + left,
        coordinates.top + top,
      );
      child.setData("width", width, property);
      child.setData("height", height, property);
      left += width;
    }

    return {
      height: coordinates.height - height,
      width: coordinates.width,
      top: coordinates.top,
      left: coordinates.left,
      dim: fixedDimension,
    };
  }
}
