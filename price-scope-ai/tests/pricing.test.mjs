import test from "node:test";
import assert from "node:assert/strict";
import { analyzePriceInflections, analyzeProduct, median, parseCsv, simulatePrice, summarizePortfolio, weightedMean } from "../src/lib/pricing.mjs";

const product = {
  id: "T001", brand: "测试", series: "标准", stage: "2段", spec: "800g", name: "测试商品",
  currentPrice: 300, cost: 200, sales30d: 100, role: "转化型", minMarginRate: 0.2,
  offers: [
    { platform: "A", price: 250, weight: 30 },
    { platform: "B", price: 260, weight: 20 },
    { platform: "C", price: 270, weight: 10 },
  ],
};

test("median handles odd and even arrays", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});

test("weighted mean respects offer weights", () => {
  assert.equal(weightedMean(product.offers), 256.6666666666667);
});

test("analysis identifies high prices and respects profit floor", () => {
  const result = analyzeProduct(product);
  assert.equal(result.status, "偏高价格");
  assert.equal(result.marketMedian, 260);
  assert.ok(result.suggestedLow >= 250);
  assert.ok(result.suggestedHigh >= result.suggestedLow);
  assert.equal(result.confidence, 87);
});

test("simulation estimates demand and margin", () => {
  const result = simulatePrice(product, 270);
  assert.ok(result.projectedSales > product.sales30d);
  assert.ok(result.marginRate > 20);
  assert.ok(Number.isFinite(result.profitChange));
});

test("portfolio summary reports actionable counts", () => {
  const second = { ...product, id: "T002", currentPrice: 255 };
  const summary = summarizePortfolio([product, second]);
  assert.equal(summary.total, 2);
  assert.equal(summary.high, 1);
  assert.ok(summary.coverage > 0);
});

test("CSV parser supports quoted commas and BOM", () => {
  const rows = parseCsv('\uFEFF商品编码,商品名称,当前价格\nP1,"奶粉, 2段",269');
  assert.deepEqual(rows, [{ 商品编码: "P1", 商品名称: "奶粉, 2段", 当前价格: "269" }]);
});

test("price inflection analysis detects valleys and peaks", () => {
  const result = analyzePriceInflections([
    { date: "8/1", price: 300, marketPrice: 290, sales: 20 },
    { date: "8/2", price: 280, marketPrice: 286, sales: 24 },
    { date: "8/3", price: 286, marketPrice: 285, sales: 30 },
    { date: "8/4", price: 302, marketPrice: 288, sales: 23 },
    { date: "8/5", price: 290, marketPrice: 289, sales: 21 },
  ]);
  assert.equal(result.inflections.length, 2);
  assert.equal(result.inflections[0].type, "valley");
  assert.equal(result.inflections[1].type, "peak");
  assert.equal(result.latestTrend, "down");
  assert.ok(result.inflections.every((point) => point.confidence >= 68));
});

test("price inflection analysis filters small daily noise", () => {
  const result = analyzePriceInflections([
    { date: "1", price: 100 }, { date: "2", price: 99.5 }, { date: "3", price: 100.2 },
  ]);
  assert.equal(result.inflections.length, 0);
});
