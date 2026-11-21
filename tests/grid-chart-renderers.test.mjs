import assert from "node:assert/strict";
import test from "node:test";

import {
  containsGridChartArrowEdge,
  containsGridChartLineEdge,
  containsGridChartRectangleNode,
  renderGridChartArrowEdge,
  renderGridChartLineEdge,
  renderGridChartRectangleNode,
} from "../dist/visualizations/grid-chart-renderers.js";

function node(id, x, y, width, height) {
  return {
    id,
    pos: { getc: () => ({ x, y }) },
    getData(property) { return { width, height }[property]; },
  };
}

function canvas(events) {
  return {
    getCtx() {
      return {
        fillRect: (...args) => events.push(["fillRect", ...args]),
        beginPath: () => events.push(["beginPath"]),
        moveTo: (...args) => events.push(["moveTo", ...args]),
        lineTo: (...args) => events.push(["lineTo", ...args]),
        stroke: () => events.push(["stroke"]),
        closePath: () => events.push(["closePath"]),
        fill: () => events.push(["fill"]),
      };
    },
  };
}

test("grid rectangle rendering uses visual offsets while hit testing uses the full cell", () => {
  const events = [];
  const value = node("a", 10, 20, 100, 50);
  renderGridChartRectangleNode(value, canvas(events), { nodeOffsetWidth: 10, nodeOffsetHeight: 6 });
  assert.deepEqual(events, [["fillRect", 15, 23, 90, 44]]);
  assert.equal(containsGridChartRectangleNode(value, { x: 10, y: 20 }), true);
  assert.equal(containsGridChartRectangleNode(value, { x: 9.9, y: 20 }), false);
});

test("grid line and arrow render from cell centers but preserve raw-position hit testing", () => {
  const events = [];
  const from = node("from", 0, 0, 20, 10);
  const to = node("to", 100, 40, 40, 20);
  const edge = {
    nodeFrom: from,
    nodeTo: to,
    data: { $direction: ["to", "from"] },
    getData(property) { return property === "dim" ? 8 : undefined; },
  };
  renderGridChartLineEdge(edge, canvas(events));
  assert.deepEqual(events.slice(0, 4), [
    ["beginPath"],
    ["moveTo", 10, 5],
    ["lineTo", 120, 50],
    ["stroke"],
  ]);
  assert.equal(containsGridChartLineEdge(edge, { x: 50, y: 20 }, 0.01), true);
  assert.equal(containsGridChartLineEdge(edge, { x: 65, y: 27.5 }, 0.01), false);

  events.length = 0;
  renderGridChartArrowEdge(edge, canvas(events));
  assert.deepEqual(events.slice(0, 4), [
    ["beginPath"],
    ["moveTo", 120, 50],
    ["lineTo", 10, 5],
    ["stroke"],
  ]);
  assert.equal(containsGridChartArrowEdge(edge, { x: 50, y: 20 }, 0.01), true);
});
