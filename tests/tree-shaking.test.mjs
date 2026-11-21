import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const distPath = path.join(rootPath, "dist");
const modulePattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;

async function staticClosure(entry) {
  const pending = [entry];
  const visited = new Set();

  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);

    const source = await readFile(path.join(distPath, relativePath), "utf8");
    for (const match of source.matchAll(modulePattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const resolved = path
        .relative(distPath, path.resolve(distPath, path.dirname(relativePath), specifier))
        .replaceAll("\\", "/");
      pending.push(resolved);
    }
  }

  return [...visited].sort();
}

test("the root ESM graph reaches only the two intentionally public core modules", async () => {
  assert.deepEqual(await staticClosure("index.js"), [
    "core/geometry.js",
    "core/util.js",
    "index.js",
  ]);
});

test("narrow leaf subpaths have minimal static dependency closures", async () => {
  assert.deepEqual(await staticClosure("core/geometry.js"), ["core/geometry.js"]);
  assert.deepEqual(await staticClosure("core/sequence.js"), ["core/sequence.js"]);
  assert.deepEqual(await staticClosure("geometry/vector3.js"), ["geometry/vector3.js"]);
  assert.deepEqual(await staticClosure("geometry/computational.js"), [
    "core/geometry.js",
    "geometry/computational.js",
  ]);
  assert.deepEqual(await staticClosure("geometry/o3d.js"), [
    "geometry/matrix4.js",
    "geometry/o3d.js",
    "geometry/vector3.js",
  ]);
  assert.deepEqual(await staticClosure("geometry/matrix4.js"), [
    "geometry/matrix4.js",
    "geometry/vector3.js",
  ]);
  assert.deepEqual(await staticClosure("options/node.js"), ["options/node.js"]);
  assert.deepEqual(await staticClosure("canvas/canvas.js"), ["canvas/canvas.js"]);
  assert.deepEqual(await staticClosure("canvas/canvas3d.js"), [
    "canvas/canvas3d.js",
    "geometry/camera.js",
    "geometry/matrix4.js",
    "geometry/vector3.js",
  ]);
  assert.deepEqual(await staticClosure("canvas/circles-background.js"), [
    "canvas/circles-background.js",
    "core/util.js",
  ]);
  assert.deepEqual(await staticClosure("graph/geometry.js"), ["graph/geometry.js"]);
  assert.deepEqual(await staticClosure("graph/hit-testing.js"), [
    "graph/hit-testing.js",
  ]);
  assert.deepEqual(await staticClosure("graph/moebius.js"), [
    "graph/moebius.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plot3d.js"), [
    "core/util.js",
    "geometry/matrix4.js",
    "geometry/vector3.js",
    "graph/plot3d.js",
  ]);
  assert.deepEqual(await staticClosure("graph/interpolation.js"), [
    "core/util.js",
    "graph/interpolation.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plot-preparation.js"), [
    "graph/plot-preparation.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plot-animation.js"), [
    "graph/plot-animation.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plot-interpolators.js"), [
    "core/util.js",
    "graph/interpolation.js",
    "graph/plot-interpolators.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plotting.js"), [
    "graph/plotting.js",
  ]);
  assert.deepEqual(await staticClosure("graph/plot-tree.js"), [
    "graph/plot-tree.js",
  ]);
  assert.deepEqual(await staticClosure("graph/node-fx.js"), [
    "graph/node-fx.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/space-tree-group.js"), [
    "core/animation.js",
    "core/easing.js",
    "core/util.js",
    "visualizations/space-tree-group.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/space-tree-geometry.js"), [
    "core/geometry.js",
    "core/util.js",
    "visualizations/space-tree-geometry.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/space-tree-workflow.js"), [
    "core/util.js",
    "visualizations/space-tree-workflow.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/icicle-group.js"), [
    "visualizations/icicle-group.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/icicle-workflow.js"), [
    "core/util.js",
    "visualizations/icicle-workflow.js",
  ]);
  assert.deepEqual(await staticClosure("charts/area-chart.js"), [
    "charts/area-chart.js",
    "core/util.js",
    "options/area-chart.js",
    "options/canvas.js",
    "options/label.js",
    "options/margin.js",
  ]);
  assert.deepEqual(await staticClosure("charts/bar-chart.js"), [
    "charts/bar-chart.js",
    "core/util.js",
    "options/bar-chart.js",
    "options/canvas.js",
    "options/label.js",
    "options/margin.js",
  ]);
  assert.deepEqual(await staticClosure("charts/pie-chart.js"), [
    "charts/pie-chart.js",
    "core/util.js",
    "options/canvas.js",
    "options/label.js",
    "options/pie-chart.js",
  ]);
  assert.deepEqual(await staticClosure("graph/operations/sum.js"), [
    "graph/operations/sum.js",
  ]);
  assert.deepEqual(await staticClosure("graph/operations/morph.js"), [
    "graph/operations/morph.js",
  ]);
  assert.deepEqual(await staticClosure("graph/operations/remove.js"), [
    "graph/operations/remove.js",
  ]);
  assert.deepEqual(await staticClosure("graph/operations/subtree.js"), [
    "graph/operations/subtree.js",
  ]);
  assert.deepEqual(await staticClosure("graph/operations/transform.js"), [
    "core/geometry.js",
    "core/util.js",
    "graph/operations/transform.js",
  ]);
  assert.deepEqual(await staticClosure("extras/event-info.js"), [
    "extras/event-info.js",
  ]);
  assert.deepEqual(await staticClosure("extras/events.js"), [
    "extras/events.js",
  ]);
  assert.deepEqual(await staticClosure("extras/navigation.js"), [
    "extras/navigation.js",
  ]);
  assert.deepEqual(await staticClosure("extras/node-styles.js"), [
    "core/easing.js",
    "core/util.js",
    "extras/node-styles.js",
  ]);
  assert.deepEqual(await staticClosure("extras/tooltip.js"), [
    "extras/tooltip.js",
  ]);
  assert.deepEqual(await staticClosure("extras/input-manager.js"), [
    "extras/input-manager.js",
  ]);
  assert.deepEqual(await staticClosure("graph/rendering/node-shapes.js"), [
    "graph/rendering/node-shapes.js",
  ]);
  assert.deepEqual(await staticClosure("graph/rendering/elements.js"), [
    "graph/rendering/elements.js",
  ]);
  assert.deepEqual(await staticClosure("graph/rendering/edge-shapes.js"), [
    "graph/rendering/edge-shapes.js",
  ]);
  assert.deepEqual(
    await staticClosure("visualizations/force-directed-node-renderers.js"),
    [
      "graph/rendering/node-shapes.js",
      "visualizations/force-directed-node-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/force-directed-edge-renderers.js"),
    [
      "graph/rendering/edge-shapes.js",
      "visualizations/force-directed-edge-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/hypertree-node-renderers.js"),
    [
      "graph/rendering/node-shapes.js",
      "visualizations/hypertree-node-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/hypertree-edge-renderers.js"),
    [
      "graph/rendering/edge-shapes.js",
      "visualizations/hypertree-edge-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/sunburst-node-renderers.js"),
    [
      "core/geometry.js",
      "core/util.js",
      "visualizations/sunburst-node-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/sunburst-edge-renderers.js"),
    [
      "graph/rendering/edge-shapes.js",
      "visualizations/sunburst-edge-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/treemap-node-renderers.js"),
    [
      "core/util.js",
      "graph/rendering/node-shapes.js",
      "visualizations/treemap-node-renderers.js",
    ],
  );
  assert.deepEqual(
    await staticClosure("visualizations/treemap-edge-renderers.js"),
    ["visualizations/treemap-edge-renderers.js"],
  );
  assert.deepEqual(
    await staticClosure("layouts/treemap/slice-and-dice.js"),
    ["layouts/treemap/slice-and-dice.js"],
  );
  assert.deepEqual(await staticClosure("layouts/treemap/squarified.js"), [
    "layouts/treemap/area.js",
    "layouts/treemap/squarified.js",
  ]);
  assert.deepEqual(await staticClosure("layouts/treemap/strip.js"), [
    "layouts/treemap/area.js",
    "layouts/treemap/strip.js",
  ]);
  assert.deepEqual(await staticClosure("layouts/treemap/voronoi.js"), [
    "core/geometry.js",
    "geometry/computational.js",
    "layouts/treemap/voronoi.js",
  ]);
  assert.deepEqual(await staticClosure("visualizations/voronoi-node-renderers.js"), [
    "core/geometry.js",
    "core/util.js",
    "geometry/computational.js",
    "visualizations/voronoi-node-renderers.js",
  ]);
  assert.deepEqual(await staticClosure("graph/labels/native.js"), [
    "graph/labels/native.js",
  ]);
  assert.deepEqual(await staticClosure("graph/labels/dom.js"), [
    "graph/labels/dom.js",
  ]);
  assert.deepEqual(await staticClosure("graph/labels/html.js"), [
    "graph/labels/dom.js",
    "graph/labels/html.js",
  ]);
  assert.deepEqual(await staticClosure("graph/labels/svg.js"), [
    "graph/labels/dom.js",
    "graph/labels/svg.js",
  ]);
  assert.deepEqual(await staticClosure("graph/labels/placement.js"), [
    "graph/labels/placement.js",
  ]);
});

test("layout subpaths do not statically import the graph model or Canvas", async () => {
  for (const entry of [
    "layouts/grid.js",
    "layouts/radial.js",
    "layouts/force-directed.js",
    "layouts/force-directed3d.js",
    "layouts/icicle.js",
    "layouts/node-dimensions.js",
    "layouts/tree.js",
    "layouts/treemap/slice-and-dice.js",
    "layouts/treemap/squarified.js",
    "layouts/treemap/strip.js",
    "layouts/treemap/voronoi.js",
  ]) {
    const closure = await staticClosure(entry);
    assert.equal(closure.includes("graph/graph.js"), false, entry);
    assert.equal(closure.includes("canvas/canvas.js"), false, entry);
  }
});

test("ForceDirected façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/force-directed.js");
  for (const excluded of [
    "canvas/canvas.js",
    "canvas/circles-background.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("ForceDirected3D façade keeps WebGL, geometry registries, and browser code out", async () => {
  const closure = await staticClosure("visualizations/force-directed3d.js");
  for (const excluded of [
    "canvas/canvas3d.js",
    "geometry/o3d.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "extras/events.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("Icicle façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/icicle.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/input-manager.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("RGraph façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/rgraph.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/input-manager.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("Hypertree façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/hypertree.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/input-manager.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("Sunburst façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/sunburst.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/input-manager.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("Treemap façades keep optional code and unselected algorithms out", async () => {
  const base = await staticClosure("visualizations/treemap.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "layouts/treemap/slice-and-dice.js",
    "layouts/treemap/squarified.js",
    "layouts/treemap/strip.js",
    "extras/events.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(base.includes(excluded), false, excluded);
  }

  const slice = await staticClosure("visualizations/treemap-slice-and-dice.js");
  assert.equal(slice.includes("layouts/treemap/slice-and-dice.js"), true);
  assert.equal(slice.includes("layouts/treemap/squarified.js"), false);
  assert.equal(slice.includes("layouts/treemap/strip.js"), false);

  const squarified = await staticClosure("visualizations/treemap-squarified.js");
  assert.equal(squarified.includes("layouts/treemap/squarified.js"), true);
  assert.equal(squarified.includes("layouts/treemap/slice-and-dice.js"), false);
  assert.equal(squarified.includes("layouts/treemap/strip.js"), false);

  const strip = await staticClosure("visualizations/treemap-strip.js");
  assert.equal(strip.includes("layouts/treemap/strip.js"), true);
  assert.equal(strip.includes("layouts/treemap/slice-and-dice.js"), false);
  assert.equal(strip.includes("layouts/treemap/squarified.js"), false);
});

test("SpaceTree façade keeps optional browser and renderer code out", async () => {
  const closure = await staticClosure("visualizations/space-tree.js");
  for (const excluded of [
    "canvas/canvas.js",
    "browser/dom.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/native.js",
    "graph/labels/svg.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/input-manager.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
  ]) {
    assert.equal(closure.includes(excluded), false, excluded);
  }
});

test("emitted runtime modules remain ESM-only and legacy-global free", async () => {
  const entries = [
    "index.js",
    "core/geometry.js",
    "core/sequence.js",
    "geometry/vector3.js",
    "geometry/computational.js",
    "geometry/o3d.js",
    "options/node.js",
    "canvas/canvas.js",
    "canvas/canvas3d.js",
    "graph/geometry.js",
    "graph/hit-testing.js",
    "graph/moebius.js",
    "graph/plot3d.js",
    "graph/interpolation.js",
    "graph/plot-preparation.js",
    "graph/plot-animation.js",
    "graph/plot-interpolators.js",
    "graph/plotting.js",
    "graph/plot-tree.js",
    "graph/node-fx.js",
    "graph/operations/sum.js",
    "graph/operations/morph.js",
    "graph/operations/remove.js",
    "graph/operations/subtree.js",
    "graph/operations/transform.js",
    "extras/event-info.js",
    "extras/events.js",
    "extras/navigation.js",
    "extras/node-styles.js",
    "extras/tooltip.js",
    "extras/input-manager.js",
    "graph/rendering/node-shapes.js",
    "graph/rendering/edge-shapes.js",
    "graph/rendering/elements.js",
    "graph/labels/native.js",
    "graph/labels/dom.js",
    "graph/labels/html.js",
    "graph/labels/svg.js",
    "graph/labels/placement.js",
    "layouts/icicle.js",
    "layouts/force-directed3d.js",
    "layouts/treemap/slice-and-dice.js",
    "layouts/treemap/squarified.js",
    "layouts/treemap/strip.js",
    "visualizations/force-directed.js",
    "visualizations/force-directed3d.js",
    "visualizations/grid-chart.js",
    "visualizations/grid-chart-renderers.js",
    "visualizations/grid-chart-dom-labels.js",
    "visualizations/grid-chart-html-labels.js",
    "visualizations/grid-chart-svg-labels.js",
    "visualizations/heat-map.js",
    "visualizations/heat-map-native-labels.js",
    "visualizations/time-graph.js",
    "visualizations/time-graph-native-labels.js",
    "visualizations/force-directed-renderer-contracts.js",
    "visualizations/force-directed-node-renderers.js",
    "visualizations/force-directed-edge-renderers.js",
    "visualizations/force-directed-label-contracts.js",
    "visualizations/force-directed-dom-labels.js",
    "visualizations/force-directed-native-labels.js",
    "visualizations/force-directed-html-labels.js",
    "visualizations/force-directed-svg-labels.js",
    "visualizations/icicle.js",
    "visualizations/icicle-group.js",
    "visualizations/icicle-workflow.js",
    "visualizations/icicle-renderer-contracts.js",
    "visualizations/icicle-node-renderers.js",
    "visualizations/icicle-edge-renderers.js",
    "visualizations/icicle-dom-labels.js",
    "visualizations/icicle-native-labels.js",
    "visualizations/icicle-html-labels.js",
    "visualizations/icicle-svg-labels.js",
    "visualizations/rgraph.js",
    "visualizations/rgraph-renderer-contracts.js",
    "visualizations/rgraph-node-renderers.js",
    "visualizations/rgraph-edge-renderers.js",
    "visualizations/rgraph-dom-labels.js",
    "visualizations/rgraph-native-labels.js",
    "visualizations/rgraph-html-labels.js",
    "visualizations/rgraph-svg-labels.js",
    "visualizations/hypertree.js",
    "visualizations/hypertree-renderer-contracts.js",
    "visualizations/hypertree-node-renderers.js",
    "visualizations/hypertree-edge-renderers.js",
    "visualizations/hypertree-label-contracts.js",
    "visualizations/hypertree-dom-labels.js",
    "visualizations/hypertree-native-labels.js",
    "visualizations/hypertree-html-labels.js",
    "visualizations/hypertree-svg-labels.js",
    "visualizations/sunburst.js",
    "visualizations/sunburst-renderer-contracts.js",
    "visualizations/sunburst-node-renderers.js",
    "visualizations/sunburst-edge-renderers.js",
    "visualizations/sunburst-label-contracts.js",
    "visualizations/sunburst-dom-labels.js",
    "visualizations/sunburst-native-labels.js",
    "visualizations/sunburst-html-labels.js",
    "visualizations/sunburst-svg-labels.js",
    "visualizations/treemap.js",
    "visualizations/treemap-slice-and-dice.js",
    "visualizations/treemap-squarified.js",
    "visualizations/treemap-strip.js",
    "visualizations/treemap-voronoi.js",
    "visualizations/treemap-renderer-contracts.js",
    "visualizations/treemap-node-renderers.js",
    "visualizations/voronoi-node-renderers.js",
    "visualizations/treemap-edge-renderers.js",
    "visualizations/treemap-label-contracts.js",
    "visualizations/treemap-dom-labels.js",
    "visualizations/treemap-native-labels.js",
    "visualizations/treemap-html-labels.js",
    "visualizations/treemap-svg-labels.js",
    "visualizations/space-tree.js",
    "visualizations/space-tree-group.js",
    "visualizations/space-tree-geometry.js",
    "visualizations/space-tree-workflow.js",
    "visualizations/space-tree-renderer-contracts.js",
    "visualizations/space-tree-node-renderers.js",
    "visualizations/space-tree-edge-renderers.js",
    "visualizations/space-tree-label-contracts.js",
    "visualizations/space-tree-dom-labels.js",
    "visualizations/space-tree-native-labels.js",
    "visualizations/space-tree-html-labels.js",
    "visualizations/space-tree-svg-labels.js",
    "charts/area-chart.js",
    "charts/area-chart-renderers.js",
    "charts/stream-chart.js",
    "charts/stream-chart-renderers.js",
    "charts/bar-chart.js",
    "charts/bar-chart-renderers.js",
    "charts/pie-chart.js",
    "charts/pie-chart-renderers.js",
  ];
  for (const entry of entries) {
    const source = await readFile(path.join(distPath, entry), "utf8");
    assert.doesNotMatch(source, /\b(?:module\.exports|exports\.|require\s*\()/, entry);
    assert.doesNotMatch(source, /(?:window\.)?\$jit\b/, entry);
  }
});
