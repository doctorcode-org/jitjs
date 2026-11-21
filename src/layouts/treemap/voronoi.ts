import { Complex } from "../../core/geometry.js";
import {
  area,
  centroid as polygonCentroid,
  dist,
  dist2,
  offsetConvex,
  randPointInPolygon,
  voronoi,
  type ComputationalPoint,
  type ComputationalPolygon,
} from "../../geometry/computational.js";
import type { GraphNode } from "../../graph/graph.js";
import type { EdgeData, NodeData, PositionPhase } from "../../types.js";
import type {
  TreemapLayoutDependencies,
  TreemapOrientation,
} from "./types.js";

export type VoronoiCentroidType = "centroid" | "weightedCentroid" | "byArea";

export interface VoronoiTreemapLayoutConfig extends Record<string, unknown> {
  offset?: number;
  centroidType?: VoronoiCentroidType;
}

export type VoronoiTreemapNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex> & {
  histoPos?: Complex[];
  offset?: number;
};

export type VoronoiTreemapLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = Omit<
  TreemapLayoutDependencies<TNodeData, TEdgeData, Complex>,
  "config"
> & { config?: VoronoiTreemapLayoutConfig };

function requirePolygon(
  value: ComputationalPoint[] | ComputationalPoint,
): ComputationalPoint[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Voronoi offset collapsed to a point");
  }
  return value;
}

/** Optional upstream Voronoi treemap layout without a runtime registry. */
export class VoronoiTreemapLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> {
  readonly graph: VoronoiTreemapLayoutDependencies<TNodeData, TEdgeData>["graph"];
  readonly root: string;
  readonly getSize: () => { width: number; height: number };
  readonly config: Required<Pick<VoronoiTreemapLayoutConfig, "offset" | "centroidType">> &
    VoronoiTreemapLayoutConfig;
  readonly controller: NonNullable<
    VoronoiTreemapLayoutDependencies<TNodeData, TEdgeData>["controller"]
  >;
  clickedNode: VoronoiTreemapNode<TNodeData, TEdgeData> | null;
  orientation: TreemapOrientation = "h";

  constructor(
    dependencies: VoronoiTreemapLayoutDependencies<TNodeData, TEdgeData>,
  ) {
    this.graph = dependencies.graph;
    this.root = dependencies.root;
    this.getSize = dependencies.getSize;
    this.config = {
      ...dependencies.config,
      offset: dependencies.config?.offset ?? 2,
      centroidType: dependencies.config?.centroidType ?? "weightedCentroid",
    };
    this.controller =
      dependencies.controller ??
      ({ onBeforeCompute() {}, onAfterCompute() {} } as typeof this.controller);
    this.clickedNode =
      (dependencies.clickedNode as VoronoiTreemapNode<TNodeData, TEdgeData> | null | undefined) ??
      null;
  }

  compute(property: PositionPhase = "current"): void {
    const root = this.graph.getNode(
      this.clickedNode?.id || this.root,
    ) as VoronoiTreemapNode<TNodeData, TEdgeData> | undefined;
    if (!root) throw new Error(`Unknown graph root: ${this.root}`);
    this.controller.onBeforeCompute(root);
    const { width, height } = this.getSize();
    const offset = this.config.offset;
    this.graph.computeLevels(this.root, 0, 0);
    root.getPos(property)!.setc(-5, -5);
    root.histoPos ||= [];
    root.histoPos[0] = new Complex(0, 0);
    let boundary: ComputationalPoint[] = [
      new Complex(-width * 0.5, -height * 0.5),
      new Complex(width * 0.5, -height * 0.5),
      new Complex(width * 0.5, height * 0.5),
      new Complex(-width * 0.5, height * 0.5),
    ];
    boundary = requirePolygon(offsetConvex(boundary, -offset * 0.5));
    root.setData("vertices", boundary, property);
    root.setData("width", 0, property);
    root.setData("height", 0, property);
    boundary = requirePolygon(offsetConvex(boundary, -offset * 1.5));
    this.computePositions(root, boundary, property, 0);
    this.controller.onAfterCompute(root);
  }

  computePositions(
    node: VoronoiTreemapNode<TNodeData, TEdgeData>,
    boundary: ComputationalPoint[],
    property: PositionPhase,
    level: number,
  ): void {
    const children = node.getSubnodes([1, 1], "ignore") as Array<
      VoronoiTreemapNode<TNodeData, TEdgeData>
    >;
    const historyPosition = node.histoPos?.[level] ?? new Complex(0, 0);
    node.setData("width", 0, property);
    node.setData("height", 0, property);
    node.getPos(property)!.setc(historyPosition.x, historyPosition.y);
    if (children.length === 0) return;

    if (!children[0]?.histoPos?.[level + 1]) {
      let sites = children.map((child) => {
        const site = randPointInPolygon(boundary) as ComputationalPoint;
        const rawArea = (child.data as Record<string, unknown>).$area;
        if (rawArea) site.area = rawArea;
        return site;
      });
      sites = this.resolveCentroids(sites, boundary);
      sites.forEach((site, index) => {
        const child = children[index] as VoronoiTreemapNode<TNodeData, TEdgeData>;
        child.histoPos ||= [];
        child.histoPos[level + 1] = site as Complex;
      });
    }

    const sites = children.map(
      (child) => child.histoPos?.[level + 1] as Complex & { area?: unknown },
    );
    const polygons = voronoi(sites, boundary);
    children.forEach((child, index) => {
      let vertices = polygons[index] as ComputationalPoint[];
      let newBoundary = vertices.slice();
      if (area(vertices) < 0) vertices.reverse();
      if (this.config.offset) {
        newBoundary = requirePolygon(
          offsetConvex(vertices, -this.config.offset * 2),
        );
        vertices = requirePolygon(
          offsetConvex(vertices, -this.config.offset * 0.5),
        );
        child.offset = this.config.offset;
      }
      child.setData("vertices", vertices, property);
      this.computePositions(child, newBoundary, property, level + 1);
    });
  }

  centroid(
    originalSites: ComputationalPoint[],
    boundary: ComputationalPoint[],
  ): ComputationalPoint[] {
    let sites = originalSites;
    let totalDistance = 2;
    while (totalDistance > 1e-3) {
      const polygons = voronoi(sites, boundary);
      totalDistance = 0;
      sites = polygons.map((polygon, index) => {
        const center = polygonCentroid(polygon) as ComputationalPoint;
        totalDistance += dist2(center, sites[index] as ComputationalPoint);
        return center;
      });
    }
    return sites;
  }

  /** Retained as the intentionally empty experimental hook from the source. */
  doLayoutPressure(): void {}

  weightedCentroid(
    sites: ComputationalPoint[],
    boundary: ComputationalPoint[],
  ): ComputationalPoint[] {
    const weights: number[] = [];
    const totalArea = area(boundary);
    const totalWeight = sites.reduce(
      (sum, site) => sum + Number(site.area),
      0,
    );
    const adjustment = totalArea / totalWeight;
    let polygons = voronoi(sites, boundary);
    polygons.forEach((polygon, index) => {
      weights[index] =
        (Number((sites[index] as ComputationalPoint).area) * adjustment) /
        area(polygon);
    });
    let totalDistance = 2;
    while (totalDistance > 1e-3) {
      polygons = voronoi(sites, boundary);
      polygons.forEach((polygon, index) => {
        weights[index] =
          (Number((sites[index] as ComputationalPoint).area) * adjustment) /
          area(polygon);
      });
      totalDistance = 0;
      sites = polygons.map((polygon, siteIndex) => {
        const center = new Complex(0, 0) as Complex & { area?: unknown };
        let total = 0;
        polygon.forEach((vertex, vertexIndex) => {
          const next = polygon[vertexIndex + 1] || polygon[0]!;
          const triangle = [sites[siteIndex]!, vertex, next] as const;
          const attached = vertex.attached as number[] | undefined;
          const target = attached ? weights[attached[0]!]! : 1;
          const weight =
            area(triangle) *
            Math.exp(((weights[siteIndex] as number) - target) * 2);
          total += weight;
          center.x += ((vertex.x + next.x) * 0.5) * weight;
          center.y += ((vertex.y + next.y) * 0.5) * weight;
        });
        center.$scale(1 / total);
        center.area = sites[siteIndex]!.area;
        totalDistance += dist(center, sites[siteIndex]!);
        return center;
      });
    }
    return sites;
  }

  byArea(
    originalSites: ComputationalPoint[],
    boundary: ComputationalPoint[],
  ): ComputationalPoint[] {
    let sites = this.centroid(originalSites, boundary);
    const totalWeight = sites.reduce(
      (sum, site) => sum + Number(site.area),
      0,
    );
    const adjustment = area(boundary) / totalWeight;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let polygons = voronoi(sites, boundary);
      if (polygons.some((polygon) => polygon.length === 0)) {
        sites = polygons.map(
          (polygon) => polygonCentroid(polygon) as ComputationalPoint,
        );
      }
      const pressure = polygons.map(
        (polygon) =>
          (Number((polygon as ComputationalPolygon).area) * adjustment) /
          (area(polygon) + 1e-10),
      );
      polygons = voronoi(sites, boundary);
      sites = polygons.map((polygon, siteIndex) => {
        const current = sites[siteIndex] as ComputationalPoint;
        const moved = new Complex(current.x, current.y) as Complex & {
          area?: unknown;
          tp?: Complex;
        };
        moved.area = current.area;
        const totalPressure = new Complex(0, 0);
        polygon.forEach((vertex, vertexIndex) => {
          const next = polygon[vertexIndex + 1] || polygon[0]!;
          const attached = vertex.attached as number[] | undefined;
          const targetPressure = attached
            ? pressure[attached[0]!]!
            : 1;
          const difference = pressure[siteIndex]! - targetPressure;
          totalPressure.x += (next.y - vertex.y) * difference;
          totalPressure.y -= (next.x - vertex.x) * difference;
        });
        moved.x += totalPressure.x / 10;
        moved.y += totalPressure.y / 10;
        moved.tp = totalPressure;
        return moved;
      });
    }
    return sites;
  }

  private resolveCentroids(
    sites: ComputationalPoint[],
    boundary: ComputationalPoint[],
  ): ComputationalPoint[] {
    switch (this.config.centroidType) {
      case "centroid":
        return this.centroid(sites, boundary);
      case "byArea":
        return this.byArea(sites, boundary);
      case "weightedCentroid":
        return this.weightedCentroid(sites, boundary);
    }
  }
}
