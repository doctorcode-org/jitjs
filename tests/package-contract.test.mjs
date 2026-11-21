import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const optionModules = [
  "area-chart",
  "bar-chart",
  "canvas",
  "controller",
  "edge",
  "events",
  "fx",
  "label",
  "margin",
  "navigation",
  "node-styles",
  "node",
  "pie-chart",
  "tips",
  "tree",
];

test("package metadata makes the ESM tree-shaking contract explicit", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );

  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.sideEffects, false);
  assert.equal("main" in packageJson, false);
  assert.equal("require" in packageJson.exports["."], false);
  assert.equal(packageJson.exports["./core/geometry"].import, "./dist/core/geometry.js");
  assert.equal(packageJson.exports["./core/util"].import, "./dist/core/util.js");
  assert.equal(packageJson.exports["./core/json"].import, "./dist/core/json.js");
  assert.equal(packageJson.exports["./core/easing"].import, "./dist/core/easing.js");
  assert.equal(packageJson.exports["./core/animation"].import, "./dist/core/animation.js");
  assert.equal(packageJson.exports["./core/sequence"].import, "./dist/core/sequence.js");
  assert.equal(packageJson.exports["./graph"].import, "./dist/graph/graph.js");
  assert.equal(packageJson.exports["./graph/geometry"].import, "./dist/graph/geometry.js");
  assert.equal(packageJson.exports["./graph/hit-testing"].import, "./dist/graph/hit-testing.js");
  assert.equal(packageJson.exports["./graph/moebius"].import, "./dist/graph/moebius.js");
  assert.equal(packageJson.exports["./graph/plot3d"].import, "./dist/graph/plot3d.js");
  assert.equal(packageJson.exports["./graph/interpolation"].import, "./dist/graph/interpolation.js");
  assert.equal(packageJson.exports["./graph/plot-preparation"].import, "./dist/graph/plot-preparation.js");
  assert.equal(packageJson.exports["./graph/plot-tree"].import, "./dist/graph/plot-tree.js");
  assert.equal(packageJson.exports["./graph/node-fx"].import, "./dist/graph/node-fx.js");
  assert.equal(packageJson.exports["./graph/operations/remove"].import, "./dist/graph/operations/remove.js");
  assert.equal(packageJson.exports["./graph/operations/subtree"].import, "./dist/graph/operations/subtree.js");
  assert.equal(packageJson.exports["./graph/operations/transform"].import, "./dist/graph/operations/transform.js");
  assert.equal(packageJson.exports["./extras/input-manager"].import, "./dist/extras/input-manager.js");
  assert.equal(packageJson.exports["./graph/rendering/node-shapes"].import, "./dist/graph/rendering/node-shapes.js");
  assert.equal(packageJson.exports["./graph/rendering/edge-shapes"].import, "./dist/graph/rendering/edge-shapes.js");
  assert.equal(packageJson.exports["./graph/labels/native"].import, "./dist/graph/labels/native.js");
  assert.equal(packageJson.exports["./graph/labels/html"].import, "./dist/graph/labels/html.js");
  assert.equal(packageJson.exports["./graph/labels/svg"].import, "./dist/graph/labels/svg.js");
  assert.equal(packageJson.exports["./loader"].import, "./dist/loader/loader.js");
  assert.equal(packageJson.exports["./layouts/grid"].import, "./dist/layouts/grid.js");
  assert.equal(packageJson.exports["./layouts/radial"].import, "./dist/layouts/radial.js");
  assert.equal(packageJson.exports["./layouts/force-directed"].import, "./dist/layouts/force-directed.js");
  assert.equal(packageJson.exports["./layouts/force-directed3d"].import, "./dist/layouts/force-directed3d.js");
  assert.equal(packageJson.exports["./layouts/tree"].import, "./dist/layouts/tree.js");
  assert.equal(packageJson.exports["./layouts/icicle"].import, "./dist/layouts/icicle.js");
  assert.equal(packageJson.exports["./layouts/treemap/slice-and-dice"].import, "./dist/layouts/treemap/slice-and-dice.js");
  assert.equal(packageJson.exports["./layouts/treemap/squarified"].import, "./dist/layouts/treemap/squarified.js");
  assert.equal(packageJson.exports["./layouts/treemap/strip"].import, "./dist/layouts/treemap/strip.js");
  assert.equal(packageJson.exports["./layouts/treemap/voronoi"].import, "./dist/layouts/treemap/voronoi.js");
  assert.equal(packageJson.exports["./layouts/node-dimensions"].import, "./dist/layouts/node-dimensions.js");
  assert.equal(packageJson.exports["./visualizations/force-directed3d"].import, "./dist/visualizations/force-directed3d.js");
  assert.equal(packageJson.exports["./visualizations/grid-chart-renderers"].import, "./dist/visualizations/grid-chart-renderers.js");
  assert.equal(packageJson.exports["./visualizations/grid-chart-html-labels"].import, "./dist/visualizations/grid-chart-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/heat-map"].import, "./dist/visualizations/heat-map.js");
  assert.equal(packageJson.exports["./visualizations/heat-map-native-labels"].import, "./dist/visualizations/heat-map-native-labels.js");
  assert.equal(packageJson.exports["./visualizations/time-graph"].import, "./dist/visualizations/time-graph.js");
  assert.equal(packageJson.exports["./visualizations/time-graph-native-labels"].import, "./dist/visualizations/time-graph-native-labels.js");
  assert.equal(packageJson.exports["./visualizations/force-directed-node-renderers"].import, "./dist/visualizations/force-directed-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/force-directed-edge-renderers"].import, "./dist/visualizations/force-directed-edge-renderers.js");
  assert.equal(packageJson.exports["./visualizations/force-directed-html-labels"].import, "./dist/visualizations/force-directed-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/icicle"].import, "./dist/visualizations/icicle.js");
  assert.equal(packageJson.exports["./visualizations/icicle-group"].import, "./dist/visualizations/icicle-group.js");
  assert.equal(packageJson.exports["./visualizations/icicle-workflow"].import, "./dist/visualizations/icicle-workflow.js");
  assert.equal(packageJson.exports["./visualizations/icicle-node-renderers"].import, "./dist/visualizations/icicle-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/icicle-html-labels"].import, "./dist/visualizations/icicle-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/rgraph"].import, "./dist/visualizations/rgraph.js");
  assert.equal(packageJson.exports["./visualizations/rgraph-node-renderers"].import, "./dist/visualizations/rgraph-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/rgraph-edge-renderers"].import, "./dist/visualizations/rgraph-edge-renderers.js");
  assert.equal(packageJson.exports["./visualizations/rgraph-html-labels"].import, "./dist/visualizations/rgraph-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/rgraph-svg-labels"].import, "./dist/visualizations/rgraph-svg-labels.js");
  assert.equal(packageJson.exports["./visualizations/hypertree"].import, "./dist/visualizations/hypertree.js");
  assert.equal(packageJson.exports["./visualizations/hypertree-node-renderers"].import, "./dist/visualizations/hypertree-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/hypertree-edge-renderers"].import, "./dist/visualizations/hypertree-edge-renderers.js");
  assert.equal(packageJson.exports["./visualizations/hypertree-html-labels"].import, "./dist/visualizations/hypertree-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/sunburst"].import, "./dist/visualizations/sunburst.js");
  assert.equal(packageJson.exports["./visualizations/sunburst-node-renderers"].import, "./dist/visualizations/sunburst-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/sunburst-edge-renderers"].import, "./dist/visualizations/sunburst-edge-renderers.js");
  assert.equal(packageJson.exports["./visualizations/sunburst-html-labels"].import, "./dist/visualizations/sunburst-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/treemap"].import, "./dist/visualizations/treemap.js");
  assert.equal(packageJson.exports["./visualizations/treemap-slice-and-dice"].import, "./dist/visualizations/treemap-slice-and-dice.js");
  assert.equal(packageJson.exports["./visualizations/treemap-squarified"].import, "./dist/visualizations/treemap-squarified.js");
  assert.equal(packageJson.exports["./visualizations/treemap-strip"].import, "./dist/visualizations/treemap-strip.js");
  assert.equal(packageJson.exports["./visualizations/treemap-voronoi"].import, "./dist/visualizations/treemap-voronoi.js");
  assert.equal(packageJson.exports["./visualizations/treemap-node-renderers"].import, "./dist/visualizations/treemap-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/voronoi-node-renderers"].import, "./dist/visualizations/voronoi-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/treemap-html-labels"].import, "./dist/visualizations/treemap-html-labels.js");
  assert.equal(packageJson.exports["./visualizations/space-tree"].import, "./dist/visualizations/space-tree.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-group"].import, "./dist/visualizations/space-tree-group.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-geometry"].import, "./dist/visualizations/space-tree-geometry.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-workflow"].import, "./dist/visualizations/space-tree-workflow.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-node-renderers"].import, "./dist/visualizations/space-tree-node-renderers.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-edge-renderers"].import, "./dist/visualizations/space-tree-edge-renderers.js");
  assert.equal(packageJson.exports["./visualizations/space-tree-html-labels"].import, "./dist/visualizations/space-tree-html-labels.js");
  assert.equal(packageJson.exports["./charts/area-chart"].import, "./dist/charts/area-chart.js");
  assert.equal(packageJson.exports["./charts/area-chart-renderers"].import, "./dist/charts/area-chart-renderers.js");
  assert.equal(packageJson.exports["./charts/stream-chart"].import, "./dist/charts/stream-chart.js");
  assert.equal(packageJson.exports["./charts/stream-chart-renderers"].import, "./dist/charts/stream-chart-renderers.js");
  assert.equal(packageJson.exports["./charts/bar-chart"].import, "./dist/charts/bar-chart.js");
  assert.equal(packageJson.exports["./charts/bar-chart-renderers"].import, "./dist/charts/bar-chart-renderers.js");
  assert.equal(packageJson.exports["./charts/pie-chart"].import, "./dist/charts/pie-chart.js");
  assert.equal(packageJson.exports["./charts/pie-chart-renderers"].import, "./dist/charts/pie-chart-renderers.js");
  assert.equal(packageJson.exports["./options/*"].import, "./dist/options/*.js");
  assert.equal(packageJson.exports["./browser/dom"].import, "./dist/browser/dom.js");
  assert.equal(packageJson.exports["./canvas"].import, "./dist/canvas/canvas.js");
  assert.equal(packageJson.exports["./canvas/canvas3d"].import, "./dist/canvas/canvas3d.js");
  assert.equal(packageJson.exports["./canvas/circles-background"].import, "./dist/canvas/circles-background.js");
  assert.equal(packageJson.exports["./geometry/vector3"].import, "./dist/geometry/vector3.js");
  assert.equal(packageJson.exports["./geometry/computational"].import, "./dist/geometry/computational.js");
  assert.equal(packageJson.exports["./geometry/o3d"].import, "./dist/geometry/o3d.js");
  assert.equal(packageJson.exports["./geometry/matrix4"].import, "./dist/geometry/matrix4.js");
  assert.equal(packageJson.exports["./geometry/camera"].import, "./dist/geometry/camera.js");
});

test("the geometry subpath is standalone and browser-global free", async () => {
  const output = await readFile(new URL("dist/core/geometry.js", root), "utf8");

  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.doesNotMatch(output, /\b(?:document|window)\b|\$jit/);
  assert.match(output, /export\s+class\s+Complex\b/);
  assert.match(output, /export\s+class\s+Polar\b/);
});

test("loading the modern root entry does not install a global", async () => {
  const before = Object.hasOwn(globalThis, "$jit");
  await import("../dist/index.js");
  assert.equal(Object.hasOwn(globalThis, "$jit"), before);
});

test("the root entry stays independent from graph and browser modules", async () => {
  const output = await readFile(new URL("dist/index.js", root), "utf8");

  assert.doesNotMatch(output, /(?:browser\/dom|canvas\/(?:canvas|canvas3d)|graph\/(?:graph|hit-testing|interpolation|labels|rendering)|loader\/loader|layouts\/(?:force-directed|force-directed3d|grid|icicle|node-dimensions|radial|tree|treemap)|geometry\/(?:camera|computational|matrix4|o3d|vector3))/);
  assert.doesNotMatch(output, /\b(?:document|window)\b|\$jit/);
});

test("every public subpath resolves to emitted ESM and declarations", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );

  for (const [subpath, target] of Object.entries(packageJson.exports)) {
    const replacements = subpath.includes("*") ? optionModules : [null];
    for (const replacement of replacements) {
      const importTarget = replacement
        ? target.import.replace("*", replacement)
        : target.import;
      const typesTarget = replacement
        ? target.types.replace("*", replacement)
        : target.types;
      await readFile(new URL(importTarget, root), "utf8");
      await readFile(new URL(typesTarget, root), "utf8");
    }
    assert.equal("require" in target, false);
  }
});
