const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const demoPriceOffers = [
  { platform: "京东", listPrice: 319, salePrice: 289, shippingFee: 0, confidence: 96, promotions: [
    { id: "jd-store", name: "店铺满 280 减 20", kind: "fixed", value: 20, threshold: 280, stackGroup: "merchant", status: "claimable" },
    { id: "jd-platform", name: "平台品类券 10 元", kind: "fixed", value: 10, stackGroup: "platform", status: "held" },
  ] },
  { platform: "天猫", listPrice: 319, salePrice: 285, shippingFee: 0, confidence: 94, promotions: [
    { id: "tm-store", name: "店铺券 15 元", kind: "fixed", value: 15, threshold: 280, stackGroup: "merchant", status: "claimable" },
    { id: "tm-member", name: "会员 95 折", kind: "percent", value: .05, stackGroup: "member", status: "claimable", memberOnly: true, accountSpecific: true },
  ] },
  { platform: "拼多多", listPrice: 299, salePrice: 279, shippingFee: 0, confidence: 89, promotions: [
    { id: "pdd-platform", name: "百亿补贴券 8 元", kind: "fixed", value: 8, stackGroup: "platform", status: "claimable" },
  ] },
];

export function optimizeOffer(offer, includeClaimable = true) {
  const allowed = new Set(["held", "auto", ...(includeClaimable ? ["claimable"] : [])]);
  const promotions = (offer.promotions || []).filter((item) => allowed.has(item.status));
  let best = { finalPrice: Number(offer.salePrice) + Number(offer.shippingFee || 0), discount: 0, applied: [] };
  for (let mask = 0; mask < 2 ** promotions.length; mask += 1) {
    const applied = promotions.filter((_, index) => mask & (1 << index));
    const groups = applied.map((item) => item.stackGroup).filter(Boolean);
    if (new Set(groups).size !== groups.length) continue;
    const discount = applied.reduce((sum, item) => {
      if (Number(offer.salePrice) < Number(item.threshold || 0)) return sum;
      return sum + (item.kind === "percent" ? Number(offer.salePrice) * Number(item.value) : Number(item.value));
    }, 0);
    const finalPrice = Math.max(0, Number(offer.salePrice) - discount) + Number(offer.shippingFee || 0);
    if (finalPrice < best.finalPrice) best = { finalPrice, discount, applied };
  }
  const personalized = best.applied.some((item) => item.memberOnly || item.accountSpecific);
  const allHeld = best.applied.length > 0 && best.applied.every((item) => ["held", "auto"].includes(item.status));
  return { ...offer, finalPrice: roundMoney(best.finalPrice), discount: roundMoney(best.discount), applied: best.applied,
    priceBasis: best.applied.length ? (allHeld ? "held" : "claimable") : "public", comparable: !personalized };
}

export function inspectPromotionLink(value) {
  try {
    const url = new globalThis.URL(value);
    if (url.protocol !== "https:") return { valid: false, reason: "仅接受 HTTPS 链接" };
    const hosts = [
      ["京东", ["jd.com", "3.cn"]], ["淘宝/天猫", ["taobao.com", "tmall.com", "tb.cn"]],
      ["拼多多", ["pinduoduo.com", "yangkeduo.com"]], ["苏宁易购", ["suning.com"]], ["唯品会", ["vip.com"]],
    ];
    const platform = hosts.find(([, domains]) => domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)))?.[0];
    return platform ? { valid: true, platform, host: url.hostname } : { valid: false, reason: "链接不属于已适配平台" };
  } catch { return { valid: false, reason: "链接格式不正确" }; }
}
