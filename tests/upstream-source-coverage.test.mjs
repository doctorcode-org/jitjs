import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const coverage = {
  "Source/Core/Canvas.js": ["src/canvas/canvas.ts", "src/canvas/circles-background.ts"],
  "Source/Core/Canvas3D.js": ["src/canvas/canvas3d.ts"],
  "Source/Core/Core.js": ["src/core/util.ts", "src/core/json.ts", "src/browser/dom.ts"],
  "Source/Core/Fx.js": ["src/core/animation.ts", "src/core/easing.ts", "src/core/transitions.ts", "src/core/sequence.ts"],
  "Source/Extras/Extras.js": ["src/extras/event-info.ts", "src/extras/events.ts", "src/extras/input-manager.ts", "src/extras/navigation.ts", "src/extras/node-styles.ts", "src/extras/tooltip.ts"],
  "Source/Geometry/Camera.js": ["src/geometry/camera.ts"],
  "Source/Geometry/Complex.js": ["src/core/geometry.ts"],
  "Source/Geometry/Geometry.js": ["src/geometry/computational.ts"],
  "Source/Geometry/Matrix4.js": ["src/geometry/matrix4.ts"],
  "Source/Geometry/O3D.js": ["src/geometry/o3d.ts"],
  "Source/Geometry/Polar.js": ["src/core/geometry.ts"],
  "Source/Geometry/Vector3.js": ["src/geometry/vector3.ts"],
  "Source/Graph/Graph.Geom.js": ["src/graph/geometry.ts", "src/graph/moebius.ts"],
  "Source/Graph/Graph.js": ["src/graph/graph.ts"],
  "Source/Graph/Graph.Label.js": ["src/graph/labels/native.ts", "src/graph/labels/html.ts", "src/graph/labels/svg.ts"],
  "Source/Graph/Graph.Op.js": ["src/graph/operations/sum.ts", "src/graph/operations/morph.ts", "src/graph/operations/remove.ts", "src/graph/operations/subtree.ts", "src/graph/operations/transform.ts"],
  "Source/Graph/Graph.Plot.js": ["src/graph/interpolation.ts", "src/graph/plot-preparation.ts", "src/graph/plot-animation.ts", "src/graph/plotting.ts", "src/graph/plot-tree.ts", "src/graph/node-fx.ts", "src/graph/plot3d.ts"],
  "Source/Graph/Helpers.js": ["src/graph/rendering/node-shapes.ts", "src/graph/rendering/edge-shapes.ts", "src/graph/hit-testing.ts"],
  "Source/Layouts/Layouts.ForceDirected.js": ["src/layouts/force-directed.ts"],
  "Source/Layouts/Layouts.ForceDirected3D.js": ["src/layouts/force-directed3d.ts"],
  "Source/Layouts/Layouts.Grid.js": ["src/layouts/grid.ts"],
  "Source/Layouts/Layouts.Icicle.js": ["src/layouts/icicle.ts"],
  "Source/Layouts/Layouts.js": ["src/layouts/node-dimensions.ts"],
  "Source/Layouts/Layouts.Radial.js": ["src/layouts/radial.ts"],
  "Source/Layouts/Layouts.TM.js": ["src/layouts/treemap/slice-and-dice.ts", "src/layouts/treemap/squarified.ts", "src/layouts/treemap/strip.ts", "src/layouts/treemap/voronoi.ts"],
  "Source/Layouts/Layouts.Tree.js": ["src/layouts/tree.ts"],
  "Source/Loader/Loader.js": ["src/loader/loader.ts"],
  "Source/Options/Options.AreaChart.js": ["src/options/area-chart.ts"],
  "Source/Options/Options.BarChart.js": ["src/options/bar-chart.ts"],
  "Source/Options/Options.Canvas.js": ["src/options/canvas.ts"],
  "Source/Options/Options.Controller.js": ["src/options/controller.ts"],
  "Source/Options/Options.Edge.js": ["src/options/edge.ts"],
  "Source/Options/Options.Events.js": ["src/options/events.ts"],
  "Source/Options/Options.Fx.js": ["src/options/fx.ts"],
  "Source/Options/Options.js": ["src/options/node.ts", "src/options/edge.ts", "src/options/label.ts"],
  "Source/Options/Options.Label.js": ["src/options/label.ts"],
  "Source/Options/Options.Margin.js": ["src/options/margin.ts"],
  "Source/Options/Options.Navigation.js": ["src/options/navigation.ts"],
  "Source/Options/Options.Node.js": ["src/options/node.ts"],
  "Source/Options/Options.NodeStyles.js": ["src/options/node-styles.ts"],
  "Source/Options/Options.PieChart.js": ["src/options/pie-chart.ts"],
  "Source/Options/Options.Tips.js": ["src/options/tips.ts"],
  "Source/Options/Options.Tree.js": ["src/options/tree.ts"],
  "Source/Visualizations/AreaChart.js": ["src/charts/area-chart.ts", "src/charts/area-chart-renderers.ts"],
  "Source/Visualizations/BarChart.js": ["src/charts/bar-chart.ts", "src/charts/bar-chart-renderers.ts"],
  "Source/Visualizations/ForceDirected.js": ["src/visualizations/force-directed.ts"],
  "Source/Visualizations/ForceDirected3D.js": ["src/visualizations/force-directed3d.ts"],
  "Source/Visualizations/HeatMap.js": ["src/visualizations/heat-map.ts"],
  "Source/Visualizations/Hypertree.js": ["src/visualizations/hypertree.ts"],
  "Source/Visualizations/Icicle.js": ["src/visualizations/icicle.ts", "src/visualizations/icicle-workflow.ts"],
  "Source/Visualizations/PieChart.js": ["src/charts/pie-chart.ts", "src/charts/pie-chart-renderers.ts"],
  "Source/Visualizations/RGraph.js": ["src/visualizations/rgraph.ts"],
  "Source/Visualizations/Spacetree.js": ["src/visualizations/space-tree.ts", "src/visualizations/space-tree-workflow.ts"],
  "Source/Visualizations/StreamChart.js": ["src/charts/stream-chart.ts", "src/charts/stream-chart-renderers.ts"],
  "Source/Visualizations/Sunburst.js": ["src/visualizations/sunburst.ts"],
  "Source/Visualizations/TimeGraph.js": ["src/visualizations/time-graph.ts"],
  "Source/Visualizations/Treemap.js": ["src/visualizations/treemap.ts", "src/visualizations/treemap-node-renderers.ts"],
  "Source/Visualizations/Voronoi.js": ["src/visualizations/treemap-voronoi.ts", "src/visualizations/voronoi-node-renderers.ts"],
};

test("every official upstream Source file has an existing TypeScript owner", async () => {
  assert.equal(Object.keys(coverage).length, 58);
  for (const [upstream, owners] of Object.entries(coverage)) {
    assert.equal(owners.length > 0, true, upstream);
    for (const owner of owners) await access(new URL(owner, root));
  }
});
