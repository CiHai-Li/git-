export function filterCatalog(products, filters = {}) {
  return (products || []).filter((product) =>
    (!filters.category || (product.category || "母婴奶粉") === filters.category)
    &&
    (!filters.brand || product.brand === filters.brand)
    && (!filters.series || product.series === filters.series)
    && (!filters.spec || product.spec === filters.spec)
    && (!filters.query || `${product.name}${product.id}${product.series}${product.spec}`.toLowerCase().includes(filters.query.toLowerCase()))
  );
}

export function buildCollectionPlan(products, selectedIds, platforms, accounts = {}) {
  const ids = new Set(selectedIds || []);
  return (products || []).filter((product) => ids.has(product.id)).flatMap((product) =>
    (platforms || []).map((platform) => ({
      id: `${product.id}-${platform}`,
      sku: product.id,
      brand: product.brand,
      title: product.name,
      platform,
      accountId: accounts[platform]?.id || null,
      accountAlias: accounts[platform]?.alias || null,
      priceScope: "checkout_preview",
      matchKey: [product.brand, product.series, product.stage, product.spec].filter(Boolean).join("/"),
    }))
  );
}

export function buildBrandHeadSkuReport(products, brand, limit = 5, category = "") {
  return (products || [])
    .filter((product) => product.brand === brand && (!category || (product.category || "母婴奶粉") === category))
    .sort((a, b) => Number(b.sales30d || 0) - Number(a.sales30d || 0))
    .slice(0, Math.max(1, Number(limit) || 5))
    .map((product, index) => {
      const prices = (product.offers || []).map((offer) => Number(offer.price)).filter(Number.isFinite);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const cheapest = (product.offers || []).find((offer) => Number(offer.price) === minPrice)?.platform || "—";
      return {
        rank: index + 1, ...product, minPrice, maxPrice, cheapest,
        spread: minPrice ? Math.round(((maxPrice - minPrice) / minPrice) * 1000) / 10 : 0,
      };
    });
}
