import test from "node:test";
import assert from "node:assert/strict";
import { buildBrandHeadSkuReport, buildCollectionPlan, filterCatalog } from "../src/lib/selection.mjs";

const products = [
  { id: "A1", brand: "甲", series: "一系", stage: "2段", spec: "800g", name: "甲一系2段" },
  { id: "A2", brand: "甲", series: "二系", stage: "3段", spec: "700g", name: "甲二系3段" },
  { id: "B1", brand: "乙", series: "一系", stage: "2段", spec: "800g", name: "乙一系2段" },
];

test("品牌、系列和规格可以联合筛选", () => {
  assert.deepEqual(filterCatalog(products, { brand: "甲", series: "一系", spec: "800g" }).map((item) => item.id), ["A1"]);
});

test("选中的 SKU 按平台生成采集计划", () => {
  const plan = buildCollectionPlan(products, ["A1", "B1"], ["京东", "天猫"], "claimable");
  assert.equal(plan.length, 4);
  assert.equal(plan[0].matchKey, "甲/一系/2段/800g");
  assert.ok(plan.every((item) => item.priceScope === "claimable"));
});

test("同品牌头部 SKU 按销量排名并计算跨平台价差", () => {
  const report = buildBrandHeadSkuReport([
    { ...products[0], sales30d: 80, offers: [{ platform: "京东", price: 110 }, { platform: "天猫", price: 100 }] },
    { ...products[1], sales30d: 120, offers: [{ platform: "京东", price: 95 }, { platform: "天猫", price: 100 }] },
    { ...products[2], sales30d: 999, offers: [{ platform: "京东", price: 50 }] },
  ], "甲", 2);
  assert.deepEqual(report.map((item) => item.id), ["A2", "A1"]);
  assert.equal(report[1].cheapest, "天猫");
  assert.equal(report[1].spread, 10);
});
