import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BASE_MARKET,
  buildMarketTree,
  formatChange,
  formatMarketCap,
  heatColor,
  marketSummary,
  simulateMarket,
} from "../examples/market-heatmap/market-data.js";

test("market demo builds a complete sector and stock treemap", () => {
  const tree = buildMarketTree();
  const stockCount = BASE_MARKET.reduce((sum, sector) => sum + sector.stocks.length, 0);
  assert.equal(tree.children.length, BASE_MARKET.length);
  assert.equal(tree.children.flatMap((sector) => sector.children).length, stockCount);
  assert.equal(tree.data.$area, tree.children.reduce((sum, sector) => sum + sector.data.$area, 0));
  assert.equal(tree.children[0].children[0].data.ticker, "NVDA");
});

test("market colors, summaries, and display formatting have stable boundaries", () => {
  assert.equal(heatColor(0), "#344052");
  assert.equal(heatColor(5), "#0eb464");
  assert.equal(heatColor(-5), "#ce1c25");
  assert.equal(formatChange(1.234), "+1.23%");
  assert.equal(formatChange(-1.234), "-1.23%");
  assert.equal(formatMarketCap(2500), "$2.50T");
  assert.equal(formatMarketCap(245), "$245B");
  const summary = marketSummary();
  assert.equal(summary.advances + summary.declines + summary.unchanged, 30);
  assert.ok(Number.isFinite(summary.weightedChange));
});

test("market simulation is injectable, bounded, and leaves the fixture untouched", () => {
  const original = structuredClone(BASE_MARKET);
  const values = [0.9, 0.8, 0.7, 0.5, 0.5];
  let index = 0;
  const result = simulateMarket(BASE_MARKET, 2, () => values[index++ % values.length]);
  assert.deepEqual(BASE_MARKET, original);
  assert.notEqual(result[0].stocks[0][4], BASE_MARKET[0].stocks[0][4]);
  assert.equal(result.every((sector) => sector.stocks.every((stock) => stock[4] >= -7.5 && stock[4] <= 7.5)), true);
});

test("market demo imports narrowly and supports server and direct-file launches", async () => {
  const [main, html, bundle, packageJson] = await Promise.all([
    readFile(new URL("../examples/market-heatmap/main.js", import.meta.url), "utf8"),
    readFile(new URL("../examples/market-heatmap/index.html", import.meta.url), "utf8"),
    readFile(new URL("../examples/market-heatmap/market-heatmap.bundle.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.match(main, /dist\/visualizations\/treemap-squarified\.js/);
  assert.match(main, /dist\/visualizations\/treemap-strip\.js/);
  assert.match(main, /dist\/visualizations\/treemap-slice-and-dice\.js/);
  assert.doesNotMatch(main, /dist\/index\.js|\$jit|globalThis/);
  assert.match(main, /const MARKET_TICK_MS = 250;/);
  assert.match(main, /window\.setInterval\([\s\S]*MARKET_TICK_MS\);/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<script src="\.\/market-heatmap\.bundle\.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+type="module"/);
  assert.ok(bundle.length > 10_000);
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\s/m);
  assert.match(packageJson.scripts["build:demo:market"], /esbuild .*--bundle .*--format=iife/);
  assert.equal(packageJson.scripts["demo:market"], "npm run build:demo:market && node ./scripts/serve-market-heatmap.mjs");
});
