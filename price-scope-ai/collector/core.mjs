const PLATFORM_HOSTS = [
  { platform: "京东", pattern: /(^|\.)jd\.com$/i },
  { platform: "天猫", pattern: /(^|\.)tmall\.com$/i },
  { platform: "淘宝", pattern: /(^|\.)taobao\.com$/i },
  { platform: "拼多多", pattern: /(^|\.)(?:pinduoduo|yangkeduo)\.com$/i },
  { platform: "苏宁易购", pattern: /(^|\.)suning\.com$/i },
  { platform: "唯品会", pattern: /(^|\.)vip\.com$/i },
];

const PRICE_KEYS = new Set(["price", "lowPrice", "highPrice", "salePrice", "currentPrice"]);

export function platformFromUrl(input) {
  const hostname = new URL(input).hostname;
  return PLATFORM_HOSTS.find((item) => item.pattern.test(hostname))?.platform || null;
}

function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function validPrice(value) {
  const price = Number(String(value).replace(/[¥￥,\s]/g, ""));
  return Number.isFinite(price) && price > 0 && price < 10_000_000 ? price : null;
}

function findJsonPrice(value) {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (PRICE_KEYS.has(key)) {
      const price = validPrice(child);
      if (price) return price;
    }
    const nested = findJsonPrice(child);
    if (nested) return nested;
  }
  return null;
}

export function extractPriceFromHtml(html) {
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(jsonLdPattern)) {
    try {
      const price = findJsonPrice(JSON.parse(decodeHtml(match[1]).trim()));
      if (price) return { price, method: "json-ld" };
    } catch { /* malformed JSON-LD is ignored */ }
  }

  const metaPatterns = [
    /<meta[^>]+(?:property|itemprop)=["'](?:product:price:amount|price)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|itemprop)=["'](?:product:price:amount|price)["']/i,
  ];
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    const price = match ? validPrice(match[1]) : null;
    if (price) return { price, method: "price-meta" };
  }

  const scriptPatterns = [
    /["'](?:salePrice|currentPrice|finalPrice|price)["']\s*:\s*["']?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /(?:到手价|售价|销售价|price)[^0-9]{0,24}[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  ];
  for (const pattern of scriptPatterns) {
    const match = html.match(pattern);
    const price = match ? validPrice(match[1]) : null;
    if (price) return { price, method: "page-data" };
  }
  return null;
}

export function extractTitleFromHtml(html) {
  const match = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).replace(/\s+/g, " ").trim() : "未识别商品";
}

export function isPathAllowedByRobots(robotsText, pathname, agent = "PriceScopeBot") {
  let active = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key?.toLowerCase() === "user-agent") active = value === "*" || value.toLowerCase() === agent.toLowerCase();
    if (active && key?.toLowerCase() === "disallow" && value && pathname.startsWith(value)) return false;
  }
  return true;
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function collectOne(target, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const url = new URL(target.url);
  const platform = platformFromUrl(url.href);
  if (url.protocol !== "https:" || !platform) throw new Error("仅允许采集已支持平台的 HTTPS 公开商品页");

  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const robotsResponse = await fetchWithTimeout(fetchImpl, robotsUrl, {}, options.timeoutMs);
    if (robotsResponse.ok && !isPathAllowedByRobots(await robotsResponse.text(), url.pathname)) {
      throw new Error("robots.txt 不允许采集该页面");
    }
  } catch (error) {
    if (String(error?.message).includes("robots.txt")) throw error;
  }

  const response = await fetchWithTimeout(fetchImpl, url.href, {
    redirect: "follow",
    headers: {
      "accept-language": "zh-CN,zh;q=0.9",
      "user-agent": "PriceScopeBot/1.0 (+merchant-owned price research; contact: local-user)",
    },
  }, options.timeoutMs);
  if (!response.ok) throw new Error(`页面请求失败：HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("页面内容超过 5MB 安全限制");
  const extracted = extractPriceFromHtml(html);
  if (!extracted) throw new Error("页面未提供可公开解析的价格，请改用平台开放 API 或 CSV");
  return {
    id: target.id || crypto.randomUUID(),
    platform,
    sku: target.sku || "待匹配",
    title: target.title || extractTitleFromHtml(html),
    price: extracted.price,
    method: extracted.method,
    sourceUrl: url.href,
    collectedAt: new Date().toISOString(),
    status: "success",
  };
}

export async function collectTargets(targets, options = {}) {
  const results = [];
  const delayMs = Math.max(500, options.delayMs ?? 1200);
  for (const target of targets.slice(0, 20)) {
    try { results.push(await collectOne(target, options)); }
    catch (error) {
      results.push({
        id: target.id || crypto.randomUUID(), platform: (() => { try { return platformFromUrl(target.url) || "未知平台"; } catch { return "未知平台"; } })(),
        sku: target.sku || "待匹配", title: target.title || "采集失败", sourceUrl: target.url,
        collectedAt: new Date().toISOString(), status: "failed", error: error.message,
      });
    }
    if (targets.length > 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}
