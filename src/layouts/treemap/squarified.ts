import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../../types.js";
import {
  AreaTreemapLayout,
  worstAspectRatio,
} from "./area.js";
import type {
  TreemapAreaNode,
  TreemapCoordinates,
  TreemapPosition,
} from "./types.js";

/** Bruls/Huizing/van Wijk style squarified treemap. */
export class SquarifiedTreemapLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> extends AreaTreemapLayout<TNodeData, TEdgeData, TPosition> {
  computePositions(
    node: TreemapAreaNode<TNodeData, TEdgeData, TPosition>,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void {
    this.orientation = coordinates.width >= coordinates.height ? "h" : "v";

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
      const area = parseFloat(
        children[index]?.getData("area", property) as string,
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

    const minimumSide = this.horizontal()
      ? coordinates.height
      : coordinates.width;
    children.sort((left, right) => {
      const difference = (right._area as number) - (left._area as number);
      return difference
        ? difference
        : right.id == left.id
          ? 0
          : right.id < left.id
            ? 1
            : -1;
    });

    this.squarify(
      children.slice(1),
      [children[0] as TreemapAreaNode<
        TNodeData,
        TEdgeData,
        TPosition
      >],
      minimumSide,
      coordinates,
      property,
    );
  }

  squarify(
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
      worstAspectRatio,
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
      ? this.layoutVertical(
          children,
          fixedDimension,
          coordinates,
          property,
        )
      : this.layoutHorizontal(
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
        coordinates.top + top,
      );
      child.setData("width", width, property);
      child.setData("height", height, property);
      top += height;
    }

    const answer: TreemapCoordinates = {
      height: coordinates.height,
      width: coordinates.width - width,
      top: coordinates.top,
      left: coordinates.left + width,
      dim: Math.min(coordinates.width - width, coordinates.height),
    };
    if (answer.dim != answer.height) {
      this.changeOrientation();
    }
    return answer;
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
    const top = coordinates.top;
    let left = 0;
    for (const child of children) {
      const width = (child._area as number) / height;
      (child.getPos(property) as TPosition).setc(
        coordinates.left + left,
        top,
      );
      child.setData("width", width, property);
      child.setData("height", height, property);
      left += width;
    }

    const answer: TreemapCoordinates = {
      height: coordinates.height - height,
      width: coordinates.width,
      top: coordinates.top + height,
      left: coordinates.left,
      dim: Math.min(coordinates.width, coordinates.height - height),
    };
    if (answer.dim != answer.width) {
      this.changeOrientation();
    }
    return answer;
  }
}
