export function filterCatalog(products, filters = {}) {
  return (products || []).filter((product) =>
    (!filters.brand || product.brand === filters.brand)
    && (!filters.series || product.series === filters.series)
    && (!filters.spec || product.spec === filters.spec)
    && (!filters.query || `${product.name}${product.id}${product.series}${product.spec}`.toLowerCase().includes(filters.query.toLowerCase()))
  );
}

export function buildCollectionPlan(products, selectedIds, platforms, priceScope = "public") {
  const ids = new Set(selectedIds || []);
  return (products || []).filter((product) => ids.has(product.id)).flatMap((product) =>
    (platforms || []).map((platform) => ({
      id: `${product.id}-${platform}`,
      sku: product.id,
      brand: product.brand,
      title: product.name,
      platform,
      priceScope,
      matchKey: [product.brand, product.series, product.stage, product.spec].filter(Boolean).join("/"),
    }))
  );
}
