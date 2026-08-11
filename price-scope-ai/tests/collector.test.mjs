import test from "node:test";
import assert from "node:assert/strict";
import { extractPriceFromHtml, extractTitleFromHtml, isPathAllowedByRobots, platformFromUrl } from "../collector/core.mjs";

test("recognizes supported domestic commerce platforms", () => {
  assert.equal(platformFromUrl("https://item.jd.com/10001.html"), "京东");
  assert.equal(platformFromUrl("https://detail.tmall.com/item.htm?id=1"), "天猫");
  assert.equal(platformFromUrl("https://mobile.yangkeduo.com/goods.html"), "拼多多");
  assert.equal(platformFromUrl("https://example.com/item"), null);
});

test("extracts structured product price and title", () => {
  const html = `<html><head><meta property="og:title" content="示例奶粉 2段"><script type="application/ld+json">{"@type":"Product","offers":{"price":"269.00"}}</script></head></html>`;
  assert.deepEqual(extractPriceFromHtml(html), { price: 269, method: "json-ld" });
  assert.equal(extractTitleFromHtml(html), "示例奶粉 2段");
});

test("falls back to product price metadata", () => {
  assert.deepEqual(extractPriceFromHtml('<meta property="product:price:amount" content="199.90">'), { price: 199.9, method: "price-meta" });
});

test("honors robots disallow rules", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /";
  assert.equal(isPathAllowedByRobots(robots, "/private/item"), false);
  assert.equal(isPathAllowedByRobots(robots, "/item/100"), true);
});
