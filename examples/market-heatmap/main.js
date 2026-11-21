import { Canvas } from "../../dist/canvas/canvas.js";
import {
  linearPlotInterpolator,
  nodePropertyPlotInterpolator,
} from "../../dist/graph/plot-interpolators.js";
import { NativeLabels } from "../../dist/graph/labels/native.js";
import { SliceAndDiceTreemapVisualization } from "../../dist/visualizations/treemap-slice-and-dice.js";
import { SquarifiedTreemapVisualization } from "../../dist/visualizations/treemap-squarified.js";
import { StripTreemapVisualization } from "../../dist/visualizations/treemap-strip.js";
import { renderTreemapNoneEdge } from "../../dist/visualizations/treemap-edge-renderers.js";
import {
  containsTreemapRectangleNode,
  renderTreemapRectangleNode,
} from "../../dist/visualizations/treemap-node-renderers.js";
import {
  BASE_MARKET,
  buildMarketTree,
  formatChange,
  formatMarketCap,
  marketSummary,
  simulateMarket,
} from "./market-data.js";

const layouts = {
  squarified: SquarifiedTreemapVisualization,
  strip: StripTreemapVisualization,
  slice: SliceAndDiceTreemapVisualization,
};

const MARKET_TICK_MS = 250;
const MARKET_TICK_ANIMATION_MS = 180;

const host = document.querySelector("#heatmap");
const tooltip = document.querySelector("#tooltip");
const detail = document.querySelector("#selection-detail");
const breadcrumb = document.querySelector("#breadcrumb");
const parentButton = document.querySelector("#go-parent");
const updateButton = document.querySelector("#simulate");
const resetButton = document.querySelector("#reset-market");
const layoutSelect = document.querySelector("#layout");
const timeframeSelect = document.querySelector("#timeframe");

let visualization;
let hoveredNode = null;
let currentMarket = structuredClone(BASE_MARKET);
let updating = false;

const bridge = {
  fx: { plot: () => visualization?.plot() },
  refresh: () => visualization?.refresh(),
};

const initialSize = () => ({
  width: Math.max(320, Math.floor(host.clientWidth)),
  height: Math.max(420, Math.floor(host.clientHeight)),
});

const size = initialSize();
const canvas = new Canvas(bridge, {
  injectInto: host,
  width: size.width,
  height: size.height,
  Label: { type: "Native" },
});

function config() {
  return {
    orientation: "h",
    titleHeight: 27,
    offset: 3,
    levelsToShow: 0,
    constrained: false,
    animate: false,
    duration: 900,
    fps: 45,
    cushion: true,
    clearCanvas: true,
    withLabels: true,
    Node: {
      type: "rectangle",
      overridable: true,
      alpha: 1,
      color: "#344052",
      lineWidth: 2,
      width: 1,
      height: 1,
      border: false,
      CanvasStyles: {},
    },
    Edge: {
      type: "none",
      overridable: true,
      alpha: 1,
      color: "#0b1120",
      lineWidth: 1,
      CanvasStyles: {},
    },
    Label: {
      type: "Native",
      size: 11,
      style: "600",
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      textAlign: "center",
      textBaseline: "middle",
      color: "#f8fafc",
    },
    onBeforeCompute() {},
    onAfterCompute() {},
    onBeforePlotLine() {},
    onAfterPlotLine() {},
    onBeforePlotNode() {},
    onAfterPlotNode() {},
    onComplete() {},
  };
}

function interpolator(mode, node, properties, delta) {
  if (mode === "linear") {
    linearPlotInterpolator(node, properties, delta);
    return;
  }
  if (mode === "node-property") {
    nodePropertyPlotInterpolator(node, properties, delta);
    return;
  }
  throw new TypeError(`Unsupported demo interpolation mode: ${mode}`);
}

function createVisualization(layoutName = layoutSelect.value) {
  hoveredNode = null;
  const Visualization = layouts[layoutName] ?? layouts.squarified;
  const options = config();
  const labels = new NativeLabels((surface, node) => {
    const position = node.pos.getc(true);
    const width = node.getData("width");
    const height = node.getData("height");
    const isLeaf = visualization?.leaf(node) ?? false;
    const y = isLeaf
      ? position.y + height / 2
      : position.y + options.titleHeight / 2;

    surface.getCtx().fillText(
      node.name,
      position.x + width / 2,
      y,
      Math.max(0, width - 8),
    );
  });
  visualization = new Visualization({
    canvas,
    config: options,
    labels,
    renderNode: renderTreemapRectangleNode,
    renderEdge: renderTreemapNoneEdge,
    interpolate: interpolator,
  });
  visualization.loadJSON(buildMarketTree(currentMarket));
  visualization.refresh();
  options.animate = true;
  updateSummary();
  updateBreadcrumb();
}

function currentRoot() {
  return visualization.clickedNode ?? visualization.graph.getNode(visualization.root);
}

function updateBreadcrumb(pendingName) {
  const root = currentRoot();
  const name = pendingName ?? root?.name ?? "بازار";
  breadcrumb.textContent = name === "بازار" ? "کل بازار" : `کل بازار / ${name}`;
  parentButton.disabled = !visualization.clickedNode;
}

function updateSummary() {
  const summary = marketSummary(currentMarket);
  const move = document.querySelector("#market-move");
  move.textContent = formatChange(summary.weightedChange);
  move.dataset.direction = summary.weightedChange >= 0 ? "up" : "down";
  document.querySelector("#market-cap").textContent = formatMarketCap(summary.totalCap);
  document.querySelector("#advances").textContent = String(summary.advances);
  document.querySelector("#declines").textContent = String(summary.declines);
  document.querySelector("#unchanged").textContent = String(summary.unchanged);
  document.querySelector("#last-update").textContent = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function canvasPoint(event) {
  const rect = canvas.canvases[0].canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left - rect.width / 2,
    y: event.clientY - rect.top - rect.height / 2,
  };
}

function nodeAt(point) {
  const nodes = Object.values(visualization.graph.nodes)
    .filter((node) => node.drawn && node.getData("alpha") >= 0.95)
    .sort((left, right) => (right._depth ?? 0) - (left._depth ?? 0));
  for (const node of nodes) {
    if (node.id === currentRoot()?.id) continue;
    if (
      containsTreemapRectangleNode(
        node,
        point,
        visualization.config,
        (candidate) => visualization.leaf(candidate),
        visualization.clickedNode,
      )
    ) return node;
  }
  return null;
}

function showTooltip(event, node) {
  const data = node.data;
  if (!data.ticker) {
    tooltip.innerHTML = `<strong>${node.name}</strong><span>برای ورود به این بخش کلیک کنید</span>`;
  } else {
    tooltip.innerHTML = `
      <div class="tooltip-head"><strong dir="ltr">${data.ticker}</strong><b data-direction="${data.change >= 0 ? "up" : "down"}">${formatChange(data.change)}</b></div>
      <span>${data.company}</span>
      <dl><dt>قیمت</dt><dd dir="ltr">$${data.price.toFixed(2)}</dd><dt>ارزش بازار</dt><dd dir="ltr">${formatMarketCap(data.marketCap)}</dd><dt>حجم</dt><dd dir="ltr">${new Intl.NumberFormat("en-US", { notation: "compact" }).format(data.volume)}</dd></dl>`;
  }
  tooltip.hidden = false;
  const margin = 16;
  const left = Math.min(event.clientX + 18, window.innerWidth - tooltip.offsetWidth - margin);
  const top = Math.min(event.clientY + 18, window.innerHeight - tooltip.offsetHeight - margin);
  tooltip.style.transform = `translate(${Math.max(margin, left)}px, ${Math.max(margin, top)}px)`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function setHovered(node) {
  if (hoveredNode === node) return;
  hoveredNode?.removeData("border");
  hoveredNode = node;
  hoveredNode?.setData("border", "#f8fafc");
  visualization.plot();
}

function showStock(node) {
  const data = node.data;
  detail.innerHTML = `
    <span class="detail-symbol" dir="ltr">${data.ticker}</span>
    <span>${data.company}</span>
    <strong data-direction="${data.change >= 0 ? "up" : "down"}">${formatChange(data.change)}</strong>
    <span dir="ltr">$${data.price.toFixed(2)} · ${formatMarketCap(data.marketCap)}</span>`;
}

function afterIdle(callback) {
  const timer = window.setInterval(() => {
    if (!visualization.busy) {
      window.clearInterval(timer);
      callback();
    }
  }, 40);
}

canvas.canvases[0].canvas.addEventListener("pointermove", (event) => {
  if (visualization.busy || updating) return;
  const node = nodeAt(canvasPoint(event));
  setHovered(node);
  if (node) showTooltip(event, node);
  else hideTooltip();
});

canvas.canvases[0].canvas.addEventListener("pointerleave", () => {
  setHovered(null);
  hideTooltip();
});

canvas.canvases[0].canvas.addEventListener("click", (event) => {
  if (visualization.busy || updating) return;
  const node = nodeAt(canvasPoint(event));
  if (!node) return;
  if (visualization.leaf(node)) {
    showStock(node);
    return;
  }
  hideTooltip();
  setHovered(null);
  if (visualization.enter(node)) {
    updateBreadcrumb(node.name);
    afterIdle(updateBreadcrumb);
  }
});

canvas.canvases[0].canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  parentButton.click();
});

parentButton.addEventListener("click", () => {
  if (visualization.busy || updating || !visualization.clickedNode) return;
  setHovered(null);
  hideTooltip();
  if (visualization.out()) {
    updateBreadcrumb("در حال بازگشت…");
    afterIdle(updateBreadcrumb);
  }
});

function marketIndex(market) {
  const index = new Map();
  for (const sector of market) {
    index.set(`sector-${sector.id}`, {
      area: sector.stocks.reduce((sum, stock) => sum + stock[2], 0),
      color: sector.color,
    });
    for (const stock of sector.stocks) {
      index.set(`stock-${stock[0].replace(".", "-").toLowerCase()}`, {
        area: stock[2], color: buildMarketTree([{ ...sector, stocks: [stock] }]).children[0].children[0].data.$color,
        stock,
      });
    }
  }
  return index;
}

function animateMarket(nextMarket, duration = 720) {
  if (updating || visualization.busy) return;
  updating = true;
  updateButton.disabled = true;
  resetButton.disabled = true;
  const targets = marketIndex(nextMarket);
  let rootArea = 0;
  for (const [id, target] of targets) {
    const node = visualization.graph.getNode(id);
    if (!node) continue;
    node.setData("area", target.area, "end");
    node.setData("color", target.color, "end");
    if (target.stock) {
      node.name = `${target.stock[0]}  ${formatChange(target.stock[4])}`;
      Object.assign(node.data, {
        marketCap: target.stock[2],
        price: target.stock[3],
        change: target.stock[4],
        volume: target.stock[5],
      });
    } else {
      rootArea += target.area;
    }
  }
  const root = visualization.graph.getNode("market");
  root?.setData("area", rootArea, "end");
  visualization.compute("end");
  visualization.animate({
    duration,
    modes: ["linear", "node-property:width:height:color"],
    onComplete: () => {
      currentMarket = nextMarket;
      for (const [id, target] of targets) {
        const node = visualization.graph.getNode(id);
        node?.setData("area", target.area);
        node?.setData("color", target.color);
      }
      root?.setData("area", rootArea);
      updating = false;
      updateButton.disabled = false;
      resetButton.disabled = false;
      updateSummary();
    },
  });
}

updateButton.addEventListener("click", () => {
  const volatility = { day: 1.8, week: 3.2, month: 5.4 }[timeframeSelect.value] ?? 1.8;
  animateMarket(simulateMarket(currentMarket, volatility));
});

resetButton.addEventListener("click", () => animateMarket(structuredClone(BASE_MARKET)));

layoutSelect.addEventListener("change", () => {
  if (visualization.busy || updating) return;
  createVisualization(layoutSelect.value);
});

const observer = new ResizeObserver((entries) => {
  const rect = entries[0]?.contentRect;
  if (!rect) return;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(420, Math.floor(rect.height));
  const current = canvas.getSize();
  if (width !== current.width || height !== current.height) canvas.resize(width, height);
});
observer.observe(host);

createVisualization();

window.setInterval(() => {
  if (document.hidden || updating || visualization.busy) return;
  const volatility = { day: 1.8, week: 3.2, month: 5.4 }[timeframeSelect.value] ?? 1.8;
  const tickVolatility = volatility * 0.18;
  animateMarket(
    simulateMarket(currentMarket, tickVolatility),
    MARKET_TICK_ANIMATION_MS,
  );
}, MARKET_TICK_MS);
