import test from "node:test";
import assert from "node:assert/strict";
import { inspectPromotionLink, optimizeOffer } from "../src/lib/promotions.mjs";

test("优惠组合遵守互斥组并选择最低可实现价", () => {
  const result = optimizeOffer({ salePrice: 300, shippingFee: 5, promotions: [
    { id: "a", name: "满减", kind: "fixed", value: 30, threshold: 300, stackGroup: "merchant", status: "claimable" },
    { id: "b", name: "平台券", kind: "fixed", value: 20, stackGroup: "platform", status: "held" },
    { id: "c", name: "另一平台券", kind: "fixed", value: 10, stackGroup: "platform", status: "claimable" },
  ] });
  assert.equal(result.finalPrice, 255);
  assert.deepEqual(result.applied.map((item) => item.id), ["a", "b"]);
});

test("账户专属价不进入公开市场中位价", () => {
  const result = optimizeOffer({ salePrice: 100, promotions: [{ name: "会员折扣", kind: "percent", value: .1, stackGroup: "member", status: "claimable", memberOnly: true }] });
  assert.equal(result.comparable, false);
});

test("优惠链接严格校验平台域名", () => {
  assert.equal(inspectPromotionLink("https://coupon.jd.com/abc").valid, true);
  assert.equal(inspectPromotionLink("https://jd.com.evil.example/abc").valid, false);
});
