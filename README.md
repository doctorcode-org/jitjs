# JIT TypeScript rewrite

This repository is an incremental, strict TypeScript rewrite of JavaScript
InfoVis Toolkit 2.0.1. The original `jit.js` stays frozen as a behavioral
oracle while modules are replaced one at a time.

## Tree-shaking contract

- The package is ESM-only and declares `sideEffects: false`.
- Runtime APIs use named exports; there is no default namespace export.
- Importing a module never writes to `window`, `globalThis`, or a shared
  registry.
- Each core capability and visualization gets a dedicated package subpath.
- The legacy `window.$jit` installer is intentionally outside the modern
  entry graph.

Prefer the narrowest import:

```ts
import { Complex } from "jitjs-typescript/core/geometry";

const point = new Complex(3, 4);
console.log(point.norm());
```

Larger capabilities are deliberately separate entry points:

```ts
import { Graph } from "jitjs-typescript/graph";
import { containsCircle } from "jitjs-typescript/graph/hit-testing";
import { transformGraphMoebius } from "jitjs-typescript/graph/moebius";
import { plot3DElement } from "jitjs-typescript/graph/plot3d";
import { interpolateNumber } from "jitjs-typescript/graph/interpolation";
import { prepareGraphForAnimation } from "jitjs-typescript/graph/plot-preparation";
import { animatePlot } from "jitjs-typescript/graph/plot-animation";
import { plotGraph } from "jitjs-typescript/graph/plotting";
import { plotTree } from "jitjs-typescript/graph/plot-tree";
import { runNodeFx } from "jitjs-typescript/graph/node-fx";
import { sumIntoGraph } from "jitjs-typescript/graph/operations/sum";
import { morphIntoGraph } from "jitjs-typescript/graph/operations/morph";
import { runNodeRemoval } from "jitjs-typescript/graph/operations/remove";
import { contractSubtree } from "jitjs-typescript/graph/operations/subtree";
import { runGraphMorph, runGraphSum } from "jitjs-typescript/graph/operations/transform";
import { createEventInfo } from "jitjs-typescript/extras/event-info";
import { InteractionEventsController } from "jitjs-typescript/extras/events";
import { NavigationController } from "jitjs-typescript/extras/navigation";
import { NodeStyleController } from "jitjs-typescript/extras/node-styles";
import { TooltipController } from "jitjs-typescript/extras/tooltip";
import { InputManager } from "jitjs-typescript/extras/input-manager";
import { renderNodeElement } from "jitjs-typescript/graph/rendering/elements";
import { renderCircle } from "jitjs-typescript/graph/rendering/node-shapes";
import { NativeLabels } from "jitjs-typescript/graph/labels/native";
import { HTMLLabels } from "jitjs-typescript/graph/labels/html";
import { constructGraph } from "jitjs-typescript/loader";
import { GridLayout } from "jitjs-typescript/layouts/grid";
import { RadialLayout } from "jitjs-typescript/layouts/radial";
import { ForceDirectedLayout } from "jitjs-typescript/layouts/force-directed";
import { ForceDirected3DLayout } from "jitjs-typescript/layouts/force-directed3d";
import { ForceDirectedVisualization } from "jitjs-typescript/visualizations/force-directed";
import { ForceDirected3DVisualization } from "jitjs-typescript/visualizations/force-directed3d";
import { HeatMapVisualization } from "jitjs-typescript/visualizations/heat-map";
import { TimeGraphVisualization } from "jitjs-typescript/visualizations/time-graph";
import { renderGridChartRectangleNode } from "jitjs-typescript/visualizations/grid-chart-renderers";
import { renderForceDirectedCircleNode } from "jitjs-typescript/visualizations/force-directed-node-renderers";
import { ForceDirectedHTMLLabels } from "jitjs-typescript/visualizations/force-directed-html-labels";
import { TreeLayout } from "jitjs-typescript/layouts/tree";
import { IcicleLayout } from "jitjs-typescript/layouts/icicle";
import { IcicleVisualization } from "jitjs-typescript/visualizations/icicle";
import { IcicleWorkflow } from "jitjs-typescript/visualizations/icicle-workflow";
import { renderIcicleRectangleNode } from "jitjs-typescript/visualizations/icicle-node-renderers";
import { IcicleHTMLLabels } from "jitjs-typescript/visualizations/icicle-html-labels";
import { RGraphVisualization } from "jitjs-typescript/visualizations/rgraph";
import { renderRGraphCircleNode } from "jitjs-typescript/visualizations/rgraph-node-renderers";
import { RGraphHTMLLabels } from "jitjs-typescript/visualizations/rgraph-html-labels";
import { HypertreeVisualization } from "jitjs-typescript/visualizations/hypertree";
import { renderHypertreeCircleNode } from "jitjs-typescript/visualizations/hypertree-node-renderers";
import { HypertreeHTMLLabels } from "jitjs-typescript/visualizations/hypertree-html-labels";
import { SunburstVisualization } from "jitjs-typescript/visualizations/sunburst";
import { renderSunburstMultipieNode } from "jitjs-typescript/visualizations/sunburst-node-renderers";
import { SunburstHTMLLabels } from "jitjs-typescript/visualizations/sunburst-html-labels";
import { SquarifiedTreemapVisualization } from "jitjs-typescript/visualizations/treemap-squarified";
import { renderTreemapRectangleNode } from "jitjs-typescript/visualizations/treemap-node-renderers";
import { TreemapHTMLLabels } from "jitjs-typescript/visualizations/treemap-html-labels";
import { VoronoiTreemapVisualization } from "jitjs-typescript/visualizations/treemap-voronoi";
import { renderVoronoiPolygonNode } from "jitjs-typescript/visualizations/voronoi-node-renderers";
import { SpaceTreeVisualization } from "jitjs-typescript/visualizations/space-tree";
import { SpaceTreeGroup } from "jitjs-typescript/visualizations/space-tree-group";
import { SpaceTreeGeometry } from "jitjs-typescript/visualizations/space-tree-geometry";
import { SpaceTreeWorkflow } from "jitjs-typescript/visualizations/space-tree-workflow";
import { renderSpaceTreeRectangleNode } from "jitjs-typescript/visualizations/space-tree-node-renderers";
import { SpaceTreeHTMLLabels } from "jitjs-typescript/visualizations/space-tree-html-labels";
import { AreaChart } from "jitjs-typescript/charts/area-chart";
import { StreamChart } from "jitjs-typescript/charts/stream-chart";
import { streamChartSmoothNodeType } from "jitjs-typescript/charts/stream-chart-renderers";
import { BarChart } from "jitjs-typescript/charts/bar-chart";
import { renderBarChartStackedNode } from "jitjs-typescript/charts/bar-chart-renderers";
import { PieChart } from "jitjs-typescript/charts/pie-chart";
import { SquarifiedTreemapLayout } from "jitjs-typescript/layouts/treemap/squarified";
import { VoronoiTreemapLayout } from "jitjs-typescript/layouts/treemap/voronoi";
import { createNodeDimensionComputer } from "jitjs-typescript/layouts/node-dimensions";
import { createNodeOptions } from "jitjs-typescript/options/node";
import { Quart } from "jitjs-typescript/core/easing";
import { runSequence } from "jitjs-typescript/core/sequence";
import { Matrix4 } from "jitjs-typescript/geometry/matrix4";
import { voronoi } from "jitjs-typescript/geometry/computational";
import { createO3DGeometry } from "jitjs-typescript/geometry/o3d";
import { Camera } from "jitjs-typescript/geometry/camera";
import { Canvas } from "jitjs-typescript/canvas";
import { WebGLCanvasLayer } from "jitjs-typescript/canvas/canvas3d";
import { CirclesBackground } from "jitjs-typescript/canvas/circles-background";
```

The root entry does not re-export the graph or browser helpers. This keeps a
small geometry or utility import from pulling those modules into an
application bundle.

## Market heatmap demo

The interactive stock-market heatmap is based on the original JIT Treemap
example while using only narrow ESM imports from the rewritten package.

```sh
npm run demo:market
```

Then open `http://localhost:4173/examples/market-heatmap/`. The demo supports
sector drill-down, tooltips, simulated market updates, responsive resizing,
and Squarified, Strip, and Slice-and-Dice layouts. Its sample market data lives
in `examples/market-heatmap/market-data.js` and can be replaced with live data.
The checked-in browser bundle also lets you open
`examples/market-heatmap/index.html` directly without running a local server.

## Current status

The package scaffold, shared JSON data contracts, pure utilities,
`Complex`/`Polar` geometry, optional computational and `Vector3`/`Matrix4`/`O3D` geometry, JSON tree
traversal, transitions/animation, graph model, JSON loader/serializer, graph
interpolation, animation preparation/orchestration, plotting traversal,
node effects, hit-testing and rendering primitives, graph sum/morph and
node/edge-removal and subtree contract/expand operations,
grid, radial, tree, icicle, force-directed 2D/3D, all three rectangular treemap layouts,
and the optional Voronoi treemap layout,
isolated label backends, option factories, the dependency-injected 2D Canvas,
browser-independent DOM helpers, and the input, event-info, event-state,
navigation, node-style, and tooltip interaction kernels are migrated. Differential tests
run the new code and the frozen legacy bundle with identical inputs. The first
three full composition façades, `ForceDirectedVisualization`,
`ForceDirected3DVisualization`, `IcicleVisualization`, and `RGraphVisualization`, are also available with
explicit renderer, label, Canvas, and interpolation dependencies. Force-directed shape adapters are
independently importable named exports rather than a shared registry.
The dependency-injected `HypertreeVisualization` façade and its explicit,
side-effect-free Möbius graph transform are migrated as well.
`SunburstVisualization`, including rotation plus its pie, multipie, gradient,
and edge renderer adapters, is available through isolated subpaths.
The complete shared treemap workflow—including selection, level pruning, lazy
requests, and two-stage animation—is exposed through separate SliceAndDice,
Squarified, Strip, and Voronoi façade entries with isolated rectangle or polygon renderers.
The legacy WebGL path is exposed through isolated `Canvas3D`, `O3D`, and injected `Plot3D` modules. The
`AreaChart`, `StreamChart`, `BarChart`, and `PieChart` façades—including stacked/grouped,
gradient, selection, label, and update behavior—are available as isolated
chart subpaths. Radial Canvas circles and the request/contract/expand
`SpaceTreeGroup` are separately importable so they remain optional.
The shared grid family now includes isolated `HeatMap` and `TimeGraph`
façades, rectangle/edge adapters, and independently selectable native,
HTML, and SVG labels.
The `SpaceTree` family now covers layout, scaled subtree plotting, geometry,
lazy requests, group contraction/expansion, animated centering, orientation
and alignment changes, root switching, and subtree operation routing. Its
advanced workflow remains outside the core façade's static import graph.
The full animated graph sum/morph policies and every `RGraph` node, edge, and
label adapter are available through dedicated entries rather than a shared
runtime registry.
Every visualization label family is split into native, HTML, and SVG backend
entries, while lazy-loading workflows are opt-in modules.

The next slices are the remaining plot/operation helpers and one
independently exported module per visualization.

## Commands

```sh
npm install
npm run check
```

`npm run check` performs strict type checking, emits ESM plus declarations,
and runs characterization tests against `jit.js`.
