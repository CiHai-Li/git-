const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

export function median(values) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

export function weightedMean(offers) {
  const clean = offers.filter((offer) => Number.isFinite(Number(offer.price)));
  if (!clean.length) return 0;
  const totalWeight = clean.reduce((sum, offer) => sum + Math.max(Number(offer.weight) || 1, 1), 0);
  return clean.reduce((sum, offer) => sum + Number(offer.price) * Math.max(Number(offer.weight) || 1, 1), 0) / totalWeight;
}

const roleAdjustment = {
  "引流型": -0.025,
  "转化型": -0.01,
  "利润型": 0.025,
  "防御型": -0.015,
  "形象型": 0.035,
  "清仓型": -0.05,
};

export function analyzeProduct(product) {
  const offers = product.offers || [];
  const marketMedian = median(offers.map((offer) => offer.price));
  const weightedPrice = weightedMean(offers);
  const currentPrice = Number(product.currentPrice) || 0;
  const cost = Number(product.cost) || 0;
  const minMarginRate = Number(product.minMarginRate ?? 0.18);
  const profitFloor = cost / Math.max(1 - minMarginRate, 0.01);
  const priceIndex = marketMedian ? (currentPrice / marketMedian) * 100 : 100;
  const adjustment = roleAdjustment[product.role] ?? 0;
  const strategyCenter = Math.max(marketMedian * (1 + adjustment), profitFloor);
  const suggestedLow = Math.ceil(Math.max(strategyCenter * 0.985, profitFloor));
  const suggestedHigh = Math.ceil(Math.max(strategyCenter * 1.02, suggestedLow));
  const marginRate = currentPrice ? (currentPrice - cost) / currentPrice : 0;

  let status = "有竞争力";
  let tone = "healthy";
  if (priceIndex > 106) {
    status = "偏高价格";
    tone = "danger";
  } else if (priceIndex > 102) {
    status = "轻度偏高";
    tone = "warning";
  } else if (priceIndex < 92 || marginRate < minMarginRate) {
    status = "低价风险";
    tone = "purple";
  } else if (priceIndex < 97) {
    status = "优势价格";
    tone = "success";
  }

  const potential = status.includes("偏高")
    ? Math.max(0, round(Number(product.sales30d || 0) * Math.min((priceIndex - 100) / 100, 0.25)))
    : 0;

  return {
    ...product,
    marketMedian: round(marketMedian),
    weightedPrice: round(weightedPrice),
    priceIndex: round(priceIndex),
    marginRate: round(marginRate * 100),
    profitFloor: round(profitFloor),
    suggestedLow,
    suggestedHigh,
    status,
    tone,
    potential,
    confidence: Math.min(99, 78 + offers.length * 3),
  };
}

export function simulatePrice(product, newPrice, elasticity = -1.6) {
  const currentPrice = Number(product.currentPrice);
  const cost = Number(product.cost);
  const currentSales = Number(product.sales30d || 0);
  const safePrice = Math.max(Number(newPrice), 0.01);
  const ratio = safePrice / Math.max(currentPrice, 0.01);
  const projectedSales = Math.max(0, Math.round(currentSales * ratio ** elasticity));
  const currentRevenue = currentPrice * currentSales;
  const projectedRevenue = safePrice * projectedSales;
  const currentProfit = (currentPrice - cost) * currentSales;
  const projectedProfit = (safePrice - cost) * projectedSales;
  return {
    newPrice: round(safePrice),
    projectedSales,
    salesChange: currentSales ? round(((projectedSales - currentSales) / currentSales) * 100) : 0,
    revenue: round(projectedRevenue),
    revenueChange: currentRevenue ? round(((projectedRevenue - currentRevenue) / currentRevenue) * 100) : 0,
    profit: round(projectedProfit),
    profitChange: currentProfit ? round(((projectedProfit - currentProfit) / currentProfit) * 100) : 0,
    marginRate: round(((safePrice - cost) / safePrice) * 100),
  };
}

export function summarizePortfolio(products) {
  const analyzed = products.map(analyzeProduct);
  const high = analyzed.filter((product) => product.status.includes("偏高"));
  const risk = analyzed.filter((product) => product.status === "低价风险");
  const revenue = analyzed.reduce((sum, product) => sum + product.currentPrice * product.sales30d, 0);
  const profit = analyzed.reduce((sum, product) => sum + (product.currentPrice - product.cost) * product.sales30d, 0);
  const opportunity = high.reduce((sum, product) => sum + product.potential * product.suggestedLow, 0);
  return {
    total: analyzed.length,
    high: high.length,
    risk: risk.length,
    healthy: analyzed.length - high.length - risk.length,
    revenue: round(revenue / 10000, 2),
    profit: round(profit / 10000, 2),
    opportunity: round(opportunity / 10000, 2),
    coverage: analyzed.length ? round((analyzed.filter((item) => item.offers.length >= 3).length / analyzed.length) * 100) : 0,
  };
}

export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line) => {
    const fields = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        fields.push(value.trim());
        value = "";
      } else {
        value += char;
      }
    }
    fields.push(value.trim());
    return fields;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}
