import assert from "node:assert/strict";
import test from "node:test";

import {
  containsStreamChartSmoothNode,
  containsStreamChartStackedNode,
  renderStreamChartSmoothNode,
  renderStreamChartStackedNode,
  setStreamChartPositions,
  streamChartSmoothNodeType,
  streamChartStackedNodeType,
} from "../dist/charts/stream-chart-renderers.js";

function nodeFixture(overrides = {}) {
  const data = {
    width: 100,
    height: 60,
    dimArray: [[20, 10], [30, 40]],
    valueArray: [[1, 2], [3, 4]],
    colorArray: ["#416D9C", "#70A35E"],
    stringArray: ["first", "second"],
    prev: false,
    next: "next",
    ...overrides,
  };
  return {
    id: "node",
    name: "node",
    pos: { getc: () => ({ x: 0, y: 0 }) },
    getData(name) { return data[name]; },
    setData(name, value) { data[name] = value; },
    data,
  };
}

function fixture() {
  const events = [];
  const pixels = new Uint8ClampedArray(200 * 100 * 4);
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    save: () => events.push(["save"]),
    restore: () => events.push(["restore"]),
    beginPath: () => events.push(["beginPath"]),
    moveTo: (...args) => events.push(["moveTo", ...args]),
    lineTo: (...args) => events.push(["lineTo", ...args]),
    bezierCurveTo: (...args) => events.push(["bezier", ...args]),
    closePath: () => events.push(["closePath"]),
    stroke: () => events.push(["stroke"]),
    fill: () => events.push(["fill"]),
    getImageData: () => ({ data: pixels }),
  };
  const canvas = {
    getCtx: () => context,
    getSize: () => ({ width: 200, height: 100 }),
  };
  const host = {
    canvas,
    graph: { getByName: () => false },
    getAlignedPos: (position) => position,
  };
  return { events, pixels, canvas, host };
}

test("stream position calculation vertically centers unequal endpoint totals", () => {
  const node = nodeFixture({ dimArray: [[20, 10], [30, 20]] });
  const { host } = fixture();
  setStreamChartPositions.call(host, node);
  assert.deepEqual(node.data["left-pos"], [[0, 60], [0, 40], [0, 40], [0, 10]]);
  assert.deepEqual(node.data["right-pos"], [[100, 50], [100, 40], [100, 40], [100, 20]]);
});

test("stacked stream rendering and hit testing preserve the first-series quirk", () => {
  const node = nodeFixture();
  const { host, canvas, events } = fixture();
  renderStreamChartStackedNode.call(host, node, canvas);
  assert.deepEqual(events.slice(0, 7), [
    ["save"],
    ["beginPath"],
    ["moveTo", -0.8, 60],
    ["lineTo", 100, 60],
    ["lineTo", 100, 50],
    ["lineTo", -0.8, 40],
    ["lineTo", -0.8, 60],
  ]);
  assert.equal(containsStreamChartStackedNode.call(host, node, { x: 25, y: 55 }), false);
  assert.deepEqual(containsStreamChartStackedNode.call(host, node, { x: 25, y: 30 }), {
    name: "second",
    color: "#70A35E",
    value: 3,
    index: 0,
  });
});

test("smooth stream rendering uses cubic boundaries and color-buffer picking", () => {
  const node = nodeFixture({ width: 100, height: 60 });
  node.pos.getc = () => ({ x: -50, y: -20 });
  const { host, canvas, events, pixels } = fixture();
  renderStreamChartSmoothNode.call(host, node, canvas);
  assert.equal(events.filter(([kind]) => kind === "bezier").length, 4);

  const index = (100 + 50 * 200) * 4;
  pixels[index] = 65;
  pixels[index + 1] = 109;
  pixels[index + 2] = 156;
  assert.deepEqual(containsStreamChartSmoothNode.call(host, node, { x: 0, y: 0 }), {
    name: "first",
    color: "#416D9C",
    value: 1,
    index: 0,
  });
  assert.equal(containsStreamChartSmoothNode.call(host, node, { x: 60, y: 0 }), false);
});

test("stream node type exports keep smooth and stacked methods isolated", () => {
  assert.equal(streamChartSmoothNodeType.render, renderStreamChartSmoothNode);
  assert.equal(streamChartSmoothNodeType.contains, containsStreamChartSmoothNode);
  assert.equal(streamChartStackedNodeType.render, renderStreamChartStackedNode);
  assert.equal(streamChartStackedNodeType.contains, containsStreamChartStackedNode);
});
