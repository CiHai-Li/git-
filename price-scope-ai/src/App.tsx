import { useEffect, useMemo, useRef, useState } from "react";
import { demoProducts, weeklyTrend, type Product } from "./data/demo";
import { analyzePriceInflections, analyzeProduct, parseCsv, simulatePrice, summarizePortfolio } from "./lib/pricing.mjs";
import { demoPriceOffers, inspectPromotionLink, optimizeOffer } from "./lib/promotions.mjs";
import { buildBrandHeadSkuReport, buildCollectionPlan, filterCatalog } from "./lib/selection.mjs";

type Page = "overview" | "collector" | "promotions" | "diagnosis" | "inflection" | "simulator" | "reports" | "data" | "guide";
type AnalyzedProduct = Product & {
  marketMedian: number; weightedPrice: number; priceIndex: number; marginRate: number;
  profitFloor: number; suggestedLow: number; suggestedHigh: number; status: string;
  tone: string; potential: number; confidence: number;
};

const navItems: { id: Page; label: string; mark: string }[] = [
  { id: "overview", label: "经营驾驶舱", mark: "⌂" },
  { id: "collector", label: "价格采集中心", mark: "◉" },
  { id: "promotions", label: "优惠策略中心", mark: "券" },
  { id: "diagnosis", label: "价格诊断", mark: "◎" },
  { id: "inflection", label: "价格拐点分析", mark: "⌁" },
  { id: "simulator", label: "调价模拟器", mark: "↗" },
  { id: "reports", label: "报告中心", mark: "▤" },
  { id: "data", label: "数据中心", mark: "⇅" },
  { id: "guide", label: "使用指引", mark: "?" },
];

const money = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function KpiCard({ label, value, unit, change, tone = "blue" }: { label: string; value: string | number; unit?: string; change: string; tone?: string }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-head"><span>{label}</span><span className="kpi-dot" /></div>
      <div className="kpi-value">{value}<small>{unit}</small></div>
      <p>{change}</p>
    </article>
  );
}

function StatusBadge({ product }: { product: AnalyzedProduct }) {
  return <span className={`status status-${product.tone}`}><i />{product.status}</span>;
}

function ScatterChart({ products }: { products: AnalyzedProduct[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    const pad = { left: 48, right: 18, top: 20, bottom: 34 };
    const x = (index: number) => pad.left + ((index - 88) / 28) * (width - pad.left - pad.right);
    const maxSales = Math.max(...products.map((item) => item.sales30d), 1);
    const y = (sales: number) => height - pad.bottom - (sales / maxSales) * (height - pad.top - pad.bottom);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(x(97), pad.top, x(102) - x(97), height - pad.top - pad.bottom);
    ctx.strokeStyle = "#e5e9f2";
    ctx.lineWidth = 1;
    ctx.font = "11px Arial";
    ctx.fillStyle = "#8a94a6";
    [90, 95, 100, 105, 110, 115].forEach((tick) => {
      const px = x(tick);
      ctx.beginPath(); ctx.moveTo(px, pad.top); ctx.lineTo(px, height - pad.bottom); ctx.stroke();
      ctx.fillText(String(tick), px - 8, height - 12);
    });
    [0, 100, 200, 300].forEach((tick) => {
      const py = y(tick);
      ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke();
      ctx.fillText(String(tick), 10, py + 4);
    });
    products.forEach((product) => {
      const colors: Record<string, string> = { danger: "#ef6a6a", warning: "#e8a53a", success: "#38a878", healthy: "#4f76e8", purple: "#8e6bd8" };
      ctx.beginPath();
      ctx.fillStyle = `${colors[product.tone] || "#4f76e8"}cc`;
      ctx.arc(x(product.priceIndex), y(product.sales30d), Math.max(5, Math.min(11, product.marginRate / 3)), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#8a94a6";
    ctx.fillText("价格指数", width - 70, height - 12);
  }, [products]);
  return <canvas ref={canvasRef} className="chart-canvas" aria-label="价格竞争力矩阵" />;
}

function TrendChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.scale(ratio, ratio);
    const width = rect.width; const height = rect.height; const pad = 24;
    const values = weeklyTrend.flatMap((item) => [item.market, item.store]);
    const min = Math.min(...values) - 5; const max = Math.max(...values) + 5;
    const point = (value: number, index: number) => ({
      x: pad + (index / (weeklyTrend.length - 1)) * (width - pad * 2),
      y: height - pad - ((value - min) / (max - min)) * (height - pad * 2),
    });
    ctx.strokeStyle = "#edf0f6";
    [0.2, 0.5, 0.8].forEach((position) => { ctx.beginPath(); ctx.moveTo(pad, height * position); ctx.lineTo(width - pad, height * position); ctx.stroke(); });
    [["market", "#39a978"], ["store", "#4f76e8"]].forEach(([key, color]) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3;
      weeklyTrend.forEach((item, index) => {
        const p = point(item[key as "market" | "store"], index);
        if (index) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }, []);
  return <canvas ref={canvasRef} className="trend-canvas" aria-label="市场价格趋势" />;
}

function Overview({ products, onNavigate }: { products: AnalyzedProduct[]; onNavigate: (page: Page) => void }) {
  const summary = summarizePortfolio(products);
  const highProducts = products.filter((item) => item.status.includes("偏高")).sort((a, b) => b.priceIndex - a.priceIndex).slice(0, 4);
  const statusRows = [
    { label: "优势/健康", value: summary.healthy, color: "#4f76e8" },
    { label: "价格偏高", value: summary.high, color: "#ef6a6a" },
    { label: "低价风险", value: summary.risk, color: "#8e6bd8" },
  ];
  return (
    <>
      <section className="hero-strip">
        <div><span className="eyebrow">今日经营建议</span><h1>让每一次调价，都有数据依据</h1><p>已完成 {summary.total} 个商品诊断，发现 {summary.high} 个重点优化机会。</p></div>
        <button className="primary-button" onClick={() => onNavigate("diagnosis")}>查看调价建议 <span>→</span></button>
      </section>
      <section className="kpi-grid">
        <KpiCard label="近30天销售额" value={summary.revenue} unit="万元" change="较上期 +8.6%" />
        <KpiCard label="预计增量机会" value={summary.opportunity} unit="万元" change={`来自 ${summary.high} 个偏高商品`} tone="green" />
        <KpiCard label="综合毛利额" value={summary.profit} unit="万元" change="毛利安全线正常" tone="purple" />
        <KpiCard label="竞品覆盖率" value={summary.coverage} unit="%" change="每个商品 ≥ 3 个报价" tone="orange" />
      </section>
      <section className="dashboard-grid">
        <article className="panel scatter-panel">
          <div className="panel-head"><div><h2>价格竞争力矩阵</h2><p>气泡越大代表毛利空间越高</p></div><span className="live-pill">实时诊断</span></div>
          <ScatterChart products={products} />
          <div className="legend"><span><i className="blue" />健康</span><span><i className="red" />偏高</span><span><i className="purple" />低价风险</span></div>
        </article>
        <article className="panel health-panel">
          <div className="panel-head"><div><h2>价格健康度</h2><p>按商品数统计</p></div><strong>{Math.round((summary.healthy / summary.total) * 100)}<small>分</small></strong></div>
          <div className="health-donut" style={{ "--healthy": `${(summary.healthy / summary.total) * 360}deg` } as React.CSSProperties}><div><b>{summary.healthy}</b><span>健康商品</span></div></div>
          <div className="health-list">{statusRows.map((row) => <div key={row.label}><span><i style={{ background: row.color }} />{row.label}</span><b>{row.value} 个</b></div>)}</div>
        </article>
        <article className="panel opportunity-panel">
          <div className="panel-head"><div><h2>优先调价机会</h2><p>按价格偏离程度排序</p></div><button className="text-button" onClick={() => onNavigate("diagnosis")}>全部商品</button></div>
          <div className="opportunity-list">{highProducts.map((product, index) => <button key={product.id} onClick={() => onNavigate("diagnosis")}>
            <span className="rank">{index + 1}</span><span className="product-copy"><b>{product.brand} {product.series} {product.stage}</b><small>{product.spec} · {product.role}</small></span>
            <span className="price-copy"><b>¥{product.currentPrice}</b><small>建议 ¥{product.suggestedLow}-{product.suggestedHigh}</small></span>
          </button>)}</div>
        </article>
        <article className="panel trend-panel">
          <div className="panel-head"><div><h2>核心商品价格趋势</h2><p>金领冠珍护 2段 750g</p></div><div className="mini-legend"><span><i className="blue" />本店</span><span><i className="green" />市场</span></div></div>
          <TrendChart />
          <div className="trend-note"><span>本店价格已于周五调整</span><b>价格差缩小 47.6%</b></div>
        </article>
      </section>
    </>
  );
}

function Diagnosis({ products, onSelect }: { products: AnalyzedProduct[]; onSelect: (item: AnalyzedProduct) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");
  const filtered = products.filter((product) => (`${product.brand}${product.series}${product.name}`).toLowerCase().includes(query.toLowerCase()) && (status === "全部状态" || product.status === status));
  return (
    <section className="page-section">
      <div className="page-title"><div><span className="eyebrow">商品级诊断</span><h1>价格诊断</h1><p>市场价格、利润安全线与经营角色联合判断。</p></div><button className="secondary-button" onClick={() => window.print()}>打印诊断表</button></div>
      <div className="filter-bar"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索品牌、系列或商品" aria-label="搜索商品" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="价格状态"><option>全部状态</option><option>偏高价格</option><option>轻度偏高</option><option>有竞争力</option><option>优势价格</option><option>低价风险</option></select><span className="result-count">{filtered.length} 个商品</span></div>
      <div className="table-card"><div className="table-scroll"><table><thead><tr><th>商品</th><th>角色</th><th>当前到手价</th><th>市场中位价</th><th>价格指数</th><th>毛利率</th><th>诊断</th><th>建议区间</th><th /></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}>
        <td><div className="table-product"><span>{product.brand.slice(0, 1)}</span><div><b>{product.brand} {product.series} {product.stage}</b><small>{product.spec} · {product.id}</small></div></div></td>
        <td><span className="role-chip">{product.role}</span></td><td><b>¥{product.currentPrice}</b></td><td>¥{product.marketMedian}</td><td className={product.priceIndex > 106 ? "cell-danger" : ""}>{product.priceIndex}</td><td>{product.marginRate}%</td><td><StatusBadge product={product} /></td><td><b className="suggested">¥{product.suggestedLow}-{product.suggestedHigh}</b></td><td><button className="row-action" onClick={() => onSelect(product)} aria-label={`查看${product.name}详情`}>详情</button></td>
      </tr>)}</tbody></table></div></div>
    </section>
  );
}

function ProductDrawer({ product, onClose, onSimulate }: { product: AnalyzedProduct; onClose: () => void; onSimulate: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="商品诊断详情"><button className="drawer-close" onClick={onClose}>×</button><span className="eyebrow">AI 定价诊断</span><h2>{product.brand} {product.series} {product.stage}</h2><p className="drawer-sub">{product.name}</p>
    <div className="drawer-price"><div><span>当前到手价</span><b>¥{product.currentPrice}</b></div><span className="arrow">→</span><div className="recommended"><span>建议价格</span><b>¥{product.suggestedLow}-{product.suggestedHigh}</b></div></div>
    <div className="reason-card"><div className="reason-title"><span>✦</span><b>价策 AI 判断</b><StatusBadge product={product} /></div><p>当前价格指数为 <strong>{product.priceIndex}</strong>，市场主流成交价约为 <strong>¥{product.marketMedian}</strong>。结合“{product.role}”角色及 {product.minMarginRate * 100}% 毛利安全线，建议将价格控制在 ¥{product.suggestedLow}-{product.suggestedHigh}。</p></div>
    <h3>诊断依据</h3><div className="metric-pairs"><div><span>加权市场价</span><b>¥{product.weightedPrice}</b></div><div><span>利润底价</span><b>¥{product.profitFloor}</b></div><div><span>匹配可信度</span><b>{product.confidence}%</b></div><div><span>竞品样本</span><b>{product.offers.length} 个</b></div></div>
    <h3>竞品价格</h3><div className="offer-list">{product.offers.map((offer) => <div key={offer.platform}><span>{offer.platform}</span><b>¥{offer.price}</b><small>权重 {offer.weight}</small></div>)}</div>
    <button className="primary-button full" onClick={onSimulate}>进入调价模拟器</button>
  </aside></div>;
}

function Simulator({ products, initialId }: { products: AnalyzedProduct[]; initialId?: string }) {
  const [productId, setProductId] = useState(initialId || products[0].id);
  const product = products.find((item) => item.id === productId) || products[0];
  const [price, setPrice] = useState(product.suggestedLow);
  const selectProduct = (nextId: string) => {
    const nextProduct = products.find((item) => item.id === nextId) || products[0];
    setProductId(nextId);
    setPrice(nextProduct.suggestedLow);
  };
  const result = simulatePrice(product, price);
  const safe = result.marginRate >= product.minMarginRate * 100;
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow">策略沙盘</span><h1>调价模拟器</h1><p>在执行前预估销量、销售额和毛利变化。</p></div></div>
    <div className="simulator-grid"><article className="panel control-panel"><label>选择商品<select value={productId} onChange={(event) => selectProduct(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.series} {item.stage} {item.spec}</option>)}</select></label><div className="sim-product"><span>{product.brand.slice(0, 1)}</span><div><b>{product.name}</b><small>当前 ¥{product.currentPrice} · 市场 ¥{product.marketMedian}</small></div></div>
      <label className="price-control"><span>模拟价格</span><div><b>¥</b><input type="number" min={Math.floor(product.profitFloor)} max={Math.ceil(product.currentPrice * 1.15)} value={price} onChange={(event) => setPrice(Number(event.target.value))} /></div><input type="range" min={Math.floor(product.profitFloor * 0.95)} max={Math.ceil(product.currentPrice * 1.1)} value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
      <div className="quick-prices"><button onClick={() => setPrice(product.suggestedLow)}>进攻 ¥{product.suggestedLow}</button><button onClick={() => setPrice(Math.round((product.suggestedLow + product.suggestedHigh) / 2))}>平衡 ¥{Math.round((product.suggestedLow + product.suggestedHigh) / 2)}</button><button onClick={() => setPrice(product.suggestedHigh)}>保守 ¥{product.suggestedHigh}</button></div>
      <div className={`safety-note ${safe ? "safe" : "unsafe"}`}><span>{safe ? "✓" : "!"}</span><div><b>{safe ? "满足利润安全线" : "低于利润安全线"}</b><small>最低毛利率 {product.minMarginRate * 100}% · 利润底价 ¥{product.profitFloor}</small></div></div>
    </article><article className="panel result-panel"><div className="panel-head"><div><h2>模拟结果</h2><p>基于历史销量与价格弹性估算</p></div><span className="model-pill">弹性系数 -1.6</span></div><div className="result-price"><span>¥{product.currentPrice}</span><i>→</i><b>¥{price}</b><em>{percent(Number(((price - product.currentPrice) / product.currentPrice * 100).toFixed(1)))}</em></div>
      <div className="result-grid"><div><span>预计销量</span><b>{result.projectedSales}<small>件</small></b><em className={result.salesChange >= 0 ? "up" : "down"}>{percent(result.salesChange)}</em></div><div><span>预计销售额</span><b>¥{money(result.revenue)}</b><em className={result.revenueChange >= 0 ? "up" : "down"}>{percent(result.revenueChange)}</em></div><div><span>预计毛利额</span><b>¥{money(result.profit)}</b><em className={result.profitChange >= 0 ? "up" : "down"}>{percent(result.profitChange)}</em></div><div><span>预计毛利率</span><b>{result.marginRate}<small>%</small></b><em className={safe ? "up" : "down"}>{safe ? "安全" : "风险"}</em></div></div>
      <div className="ai-conclusion"><span>✦</span><div><b>AI 策略结论</b><p>{safe ? `价格调整至 ¥${price} 后预计销量${result.salesChange >= 0 ? "提升" : "变化"} ${Math.abs(result.salesChange)}%，同时保持 ${result.marginRate}% 毛利率。建议先进行 7 天小范围实验。` : `当前方案会使毛利率降至 ${result.marginRate}%，低于安全线，不建议直接执行。可提高模拟价格或调整商品角色。`}</p></div></div>
    </article></div></section>;
}

type HistoryPoint = { date: string; price: number; marketPrice: number; sales: number };
const inflectionHistories: Record<string, HistoryPoint[]> = Object.fromEntries(demoProducts.map((product, productIndex) => {
  const market = Math.round(product.offers.reduce((sum, offer) => sum + offer.price, 0) / product.offers.length);
  const pattern = productIndex % 3 === 0
    ? [1.08, 1.05, .96, .94, .98, 1.01, 1.0, .97, .99, 1.02]
    : productIndex % 3 === 1
      ? [1.02, 1.01, 1, 1.04, 1.08, 1.03, .99, .98, 1, 1.01]
      : [1.01, 1, .99, 1, 1.01, 1, .99, 1, 1.005, 1];
  return [product.id, pattern.map((ratio, index) => ({
    date: `8/${index + 2}`,
    price: Math.round(product.currentPrice * ratio),
    marketPrice: Math.round(market * (1 + Math.sin(index / 2) * .012)),
    sales: Math.max(8, Math.round(product.sales30d / 10 * (2.05 - ratio) * (1 + index * .01))),
  }))];
}));

function InflectionChart({ points, inflections }: { points: HistoryPoint[]; inflections: { index: number; type: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !points.length) return;
    const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.scale(ratio, ratio);
    const pad = { left: 43, right: 22, top: 28, bottom: 34 }; const width = rect.width; const height = rect.height;
    const values = points.flatMap((point) => [point.price, point.marketPrice]);
    const min = Math.min(...values) * .97; const max = Math.max(...values) * 1.03;
    const x = (index: number) => pad.left + index / Math.max(points.length - 1, 1) * (width - pad.left - pad.right);
    const y = (value: number) => height - pad.bottom - (value - min) / Math.max(max - min, 1) * (height - pad.top - pad.bottom);
    ctx.font = "10px Arial"; ctx.strokeStyle = "#edf0f5"; ctx.fillStyle = "#929bad"; ctx.lineWidth = 1;
    [0, .33, .66, 1].forEach((step) => { const py = pad.top + step * (height - pad.top - pad.bottom); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width-pad.right, py); ctx.stroke(); ctx.fillText(String(Math.round(max-(max-min)*step)), 5, py+3); });
    [["marketPrice", "#9ca6b8"], ["price", "#5273df"]].forEach(([key, color]) => { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = key === "price" ? 3 : 2; ctx.setLineDash(key === "price" ? [] : [5, 5]); points.forEach((point,index) => { const px=x(index); const py=y(point[key as "price" | "marketPrice"]); if (index) ctx.lineTo(px,py); else ctx.moveTo(px,py); }); ctx.stroke(); });
    ctx.setLineDash([]); points.forEach((point,index) => { ctx.fillStyle="#8791a3"; ctx.fillText(point.date,x(index)-9,height-11); });
    inflections.forEach((point) => { const px=x(point.index); const py=y(points[point.index].price); ctx.beginPath(); ctx.fillStyle=point.type === "valley" ? "#2fa675" : "#e46767"; ctx.arc(px,py,6,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke(); });
  }, [points, inflections]);
  return <canvas ref={canvasRef} className="inflection-canvas" aria-label="价格拐点趋势图" />;
}

function InflectionAnalysis({ products, onSimulate }: { products: AnalyzedProduct[]; onSimulate: (id: string) => void }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [threshold, setThreshold] = useState(1.8);
  const product = products.find((item) => item.id === productId) || products[0];
  const history = inflectionHistories[product?.id] || [];
  const analysis = analyzePriceInflections(history, { minChangeRate: threshold / 100 });
  const latest = analysis.inflections.at(-1);
  const exportResult = () => {
    const header = ["日期","类型","价格","变动幅度","销量变化","市场价差","可信度","策略建议"];
    const rows = analysis.inflections.map((item: { date: string; label: string; price: number; magnitude: number; salesChange: number; marketGap: number; confidence: number; recommendation: string }) => [item.date,item.label,item.price,item.magnitude,item.salesChange,item.marketGap,item.confidence,item.recommendation]);
    downloadText("价策AI-价格拐点分析.csv", `\uFEFF${[header,...rows].map(row=>row.join(",")).join("\n")}`);
  };
  return <section className="page-section inflection-page"><div className="page-title"><div><span className="eyebrow">趋势决策引擎</span><h1>价格拐点分析</h1><p>联合价格、市场基准与销量响应，识别值得行动的趋势反转。</p></div><div className="button-row"><button className="secondary-button" onClick={exportResult}>导出拐点报告</button><button className="primary-button" onClick={() => onSimulate(product.id)}>进入调价模拟</button></div></div>
    <div className="inflection-toolbar"><label>分析商品<select value={productId} onChange={(event)=>setProductId(event.target.value)}>{products.map(item=><option key={item.id} value={item.id}>{item.brand} {item.series} {item.stage} {item.spec}</option>)}</select></label><label>敏感度<select value={threshold} onChange={(event)=>setThreshold(Number(event.target.value))}><option value={1}>高（1%）</option><option value={1.8}>标准（1.8%）</option><option value={3}>稳健（3%）</option></select></label><div><span>识别结果</span><b>{analysis.inflections.length} 个有效拐点</b></div></div>
    <div className="inflection-kpis"><div><span>最新本店价</span><b>¥{analysis.latestPrice}</b><small>{analysis.latestTrend === "up" ? "短期上行" : analysis.latestTrend === "down" ? "短期下行" : "保持稳定"}</small></div><div><span>相对市场</span><b className={analysis.latestMarketGap > 3 ? "risk-copy" : "safe-copy"}>{percent(analysis.latestMarketGap)}</b><small>对比同款市场价</small></div><div><span>最近拐点</span><b>{latest?.label || "暂无显著拐点"}</b><small>{latest ? `${latest.date} · 可信度 ${latest.confidence}%` : "当前价格波动较平稳"}</small></div></div>
    <div className="inflection-layout"><article className="panel inflection-chart-panel"><div className="panel-head"><div><h2>价格与市场趋势</h2><p>实线为本店价，虚线为市场价；红色为峰值，绿色为谷值</p></div><span className="model-pill">阈值 {threshold}%</span></div><InflectionChart points={history} inflections={analysis.inflections} /></article>
      <article className="panel inflection-advice"><div className="panel-head"><div><h2>AI 决策建议</h2><p>最近有效信号</p></div></div>{latest ? <><span className={`turning-badge ${latest.type}`}>{latest.label}</span><h3>{latest.type === "valley" ? "观察销量是否持续回升" : "警惕价格上行后的转化走弱"}</h3><p>{latest.recommendation}</p><div className="signal-grid"><div><span>价格幅度</span><b>{latest.magnitude}%</b></div><div><span>销量变化</span><b>{percent(latest.salesChange)}</b></div><div><span>市场价差</span><b>{percent(latest.marketGap)}</b></div><div><span>可信度</span><b>{latest.confidence}%</b></div></div></> : <div className="empty-signal"><span>—</span><h3>价格处于稳定区间</h3><p>当前没有超过阈值的趋势反转，建议保持价格并持续采集。</p></div>}</article></div>
    <article className="table-card inflection-table"><div className="table-caption"><div><h2>拐点事件清单</h2><p>按时间记录触发信号及建议动作</p></div><span>{analysis.inflections.length} 条事件</span></div><div className="table-scroll"><table><thead><tr><th>日期</th><th>拐点类型</th><th>当日价格</th><th>价格幅度</th><th>销量响应</th><th>市场价差</th><th>可信度</th><th>策略动作</th></tr></thead><tbody>{analysis.inflections.map((item: { index:number; date:string; label:string; type:string; price:number; magnitude:number; salesChange:number; marketGap:number; confidence:number; recommendation:string })=><tr key={`${item.date}-${item.type}`}><td>{item.date}</td><td><span className={`turning-badge ${item.type}`}>{item.label}</span></td><td><b>¥{item.price}</b></td><td>{item.magnitude}%</td><td className={item.salesChange >= 0 ? "safe-copy" : "risk-copy"}>{percent(item.salesChange)}</td><td>{percent(item.marketGap)}</td><td>{item.confidence}%</td><td>{item.recommendation}</td></tr>)}</tbody></table></div></article>
    <div className="compliance-note"><b>分析口径</b><span>拐点是决策信号而非因果结论。系统仅在相邻价格斜率反转且变动超过阈值时标记，并结合销量响应和市场价差增强解释；执行前仍需排除大促、缺货、流量投放与竞品规格变化。</span></div>
  </section>;
}

function Reports({ products }: { products: AnalyzedProduct[] }) {
  const summary = summarizePortfolio(products);
  const reportCategories = [...new Set(products.map((item) => item.category || "母婴奶粉"))];
  const [reportView, setReportView] = useState<"executive" | "brand" | "action">("brand");
  const [reportCategory, setReportCategory] = useState(reportCategories[0] || "");
  const categoryProducts = products.filter((item) => (item.category || "母婴奶粉") === reportCategory);
  const reportBrands = [...new Set(categoryProducts.map((item) => item.brand))];
  const defaultBrand = reportBrands.slice().sort((a, b) => products.filter((item) => item.brand === b).length - products.filter((item) => item.brand === a).length)[0] || "";
  const [reportBrand, setReportBrand] = useState(defaultBrand);
  const [headCount, setHeadCount] = useState(5);
  const effectiveBrand = reportBrands.includes(reportBrand) ? reportBrand : reportBrands[0] || "";
  const headSkus = buildBrandHeadSkuReport(products, effectiveBrand, headCount, reportCategory) as (AnalyzedProduct & { rank: number; minPrice: number; maxPrice: number; cheapest: string; spread: number })[];
  const reportPlatforms = [...new Set(headSkus.flatMap((item) => item.offers.map((offer) => offer.platform)))];
  const platformAverages = reportPlatforms.map((platform) => ({ platform, price: headSkus.length ? headSkus.reduce((sum, item) => sum + (item.offers.find((offer) => offer.platform === platform)?.price || 0), 0) / headSkus.length : 0 }));
  const averageBase = platformAverages.length ? Math.min(...platformAverages.map((item) => item.price).filter((price) => price > 0)) : 1;
  const exportCsv = () => {
    const header = ["商品编码","品牌","系列","段位","规格","当前价","市场中位价","价格指数","价格状态","建议低价","建议高价","毛利率","匹配可信度"];
    const rows = products.map((item) => [item.id,item.brand,item.series,item.stage,item.spec,item.currentPrice,item.marketMedian,item.priceIndex,item.status,item.suggestedLow,item.suggestedHigh,item.marginRate,item.confidence]);
    downloadText("价策AI-调价诊断清单.csv", `\uFEFF${[header, ...rows].map((row) => row.join(",")).join("\n")}`);
  };
  const exportBrandReport = () => {
    const header = ["排名","品牌","商品编码","商品","规格","近30天销量",...reportPlatforms,"最低价平台","最低价","最高价","跨平台价差率"];
    const rows = headSkus.map((item) => [item.rank,item.brand,item.id,`${item.series}${item.stage}`,item.spec,item.sales30d,...reportPlatforms.map((platform) => item.offers.find((offer) => offer.platform === platform)?.price ?? ""),item.cheapest,item.minPrice,item.maxPrice,`${item.spread}%`]);
    downloadText(`价策AI-${reportCategory}-${effectiveBrand}-头部SKU跨平台价格报告.csv`, `\uFEFF${[header,...rows].map((row) => row.join(",")).join("\n")}`);
  };
  return <section className="page-section report-page"><div className="page-title"><div><span className="eyebrow">可视化输出</span><h1>报告中心</h1><p>管理摘要、品牌比价和执行清单分层展示，避免信息混杂。</p></div><div className="button-row"><button className="secondary-button" onClick={exportCsv}>导出调价清单</button><button className="primary-button" onClick={() => window.print()}>打印 / 保存 PDF</button></div></div>
    <div className="report-tabs"><button className={reportView === "executive" ? "active" : ""} onClick={() => setReportView("executive")}>管理摘要</button><button className={reportView === "brand" ? "active" : ""} onClick={() => setReportView("brand")}>品牌跨平台比价</button><button className={reportView === "action" ? "active" : ""} onClick={() => setReportView("action")}>运营执行清单</button></div>
    {reportView === "executive" && <><div className="report-cover"><div><span className="report-brand">PRICE SCOPE / 价策 AI</span><h2>多品类价格竞争力<br />经营诊断周报</h2><p>示例商家 · 全国渠道 · 数据周期：近30天</p></div><div className="report-score"><small>综合健康度</small><b>{Math.round(summary.healthy / summary.total * 100)}</b><span>/ 100</span></div></div>
    <div className="report-kpis"><div><span>覆盖品类</span><b>{reportCategories.length}</b><small>个</small></div><div><span>诊断商品</span><b>{summary.total}</b><small>个</small></div><div><span>重点优化</span><b>{summary.high}</b><small>个</small></div><div><span>数据覆盖</span><b>{summary.coverage}</b><small>%</small></div></div>
    <article className="panel report-summary"><h2>本周经营结论</h2><div className="summary-grid"><div><span>01</span><p><b>先按品类定位价格问题</b>不同品类的价格带、规格和弹性不同，避免跨品类混合判断。</p></div><div><span>02</span><p><b>再用品牌矩阵识别平台差</b>平台作为列、标准 SKU 作为行，快速识别系统性高价渠道。</p></div><div><span>03</span><p><b>最后进入执行清单</b>只把需要行动的商品交给运营，保留利润和实验护栏。</p></div></div></article></>}
    {reportView === "brand" && <article className="table-card brand-report"><div className="brand-report-head"><div><span className="eyebrow">品类 × 品牌价格雷达</span><h2>头部 SKU 跨平台价格矩阵</h2><p>一行一个标准 SKU，一个平台一列；热力颜色突出最低价和明显高价。</p></div><div className="brand-report-actions"><label>品类<select value={reportCategory} onChange={(event) => { setReportCategory(event.target.value); setReportBrand(""); }}>{reportCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>品牌<select value={effectiveBrand} onChange={(event) => setReportBrand(event.target.value)}>{reportBrands.map((brand) => <option key={brand}>{brand}</option>)}</select></label><label>头部范围<select value={headCount} onChange={(event) => setHeadCount(Number(event.target.value))}><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label><button className="secondary-button" onClick={exportBrandReport}>导出矩阵</button></div></div>
      <div className="brand-report-kpis"><div><span>目标品类</span><b>{reportCategory}</b></div><div><span>目标品牌</span><b>{effectiveBrand}</b></div><div><span>头部 SKU</span><b>{headSkus.length}<small>个</small></b></div><div><span>最大价差</span><b>{Math.max(0,...headSkus.map((item) => item.spread))}<small>%</small></b></div></div>
      <div className="visual-grid"><div className="panel mini-visual"><h3>平台价格指数</h3><p>以本报告最低平台均价为 100</p>{platformAverages.map((item) => { const index = Math.round(item.price / Math.max(averageBase, 1) * 100); return <div className="index-bar" key={item.platform}><span>{item.platform}</span><i><em style={{ width: `${Math.min(index - 80, 35) / 35 * 100}%` }} /></i><b>{index}</b></div>; })}</div><div className="panel mini-visual"><h3>SKU 跨平台价差</h3><p>价差率越高，越需要检查活动与优惠口径</p>{headSkus.map((item) => <div className="spread-bar" key={item.id}><span>{item.series} {item.stage}</span><i><em className={item.spread >= 8 ? "risk" : ""} style={{ width: `${Math.min(item.spread, 20) / 20 * 100}%` }} /></i><b>{item.spread}%</b></div>)}</div></div>
      <div className="table-scroll"><table><thead><tr><th>排名</th><th>头部 SKU</th><th>销量</th>{reportPlatforms.map((platform) => <th key={platform}>{platform}</th>)}<th>最低价</th><th>价差率</th><th>价格结论</th></tr></thead><tbody>{headSkus.map((item) => <tr key={item.id}><td><span className="rank small">{item.rank}</span></td><td><b>{item.series} {item.stage}</b><small className="cell-sub">{item.spec} · {item.id}</small></td><td><b>{item.sales30d}</b><small className="cell-sub">近30天</small></td>{reportPlatforms.map((platform) => { const price = item.offers.find((offer) => offer.platform === platform)?.price; return <td key={platform} className={price === item.minPrice ? "platform-low" : ""}>{price ? `¥${price}` : "—"}</td>; })}<td><b className="suggested">{item.cheapest} ¥{item.minPrice}</b></td><td className={item.spread >= 8 ? "cell-danger" : ""}>{item.spread}%</td><td>{item.spread >= 8 ? "平台价差明显，检查优惠口径" : item.spread >= 4 ? "存在跟价空间" : "价格带较稳定"}</td></tr>)}</tbody></table></div>
      <div className="report-account-scope"><b>本报告账号口径</b><span>京东：采购主账号（PLUS，北京朝阳）</span><span>天猫：天猫会员账号（88VIP，北京朝阳）</span><span>拼多多：多多采购账号（普通会员，北京朝阳）</span></div><div className="brand-report-note"><b>报告口径</b><span>头部 SKU 按近 30 天销量排序；每个平台列展示该平台所选账号在同一收货地区、同一数量条件下的结算预览价。不同账号报告应分开生成，不直接合并为无条件市场价。</span></div></article>}
    {reportView === "action" && <div className="table-card report-table"><div className="table-caption"><div><h2>运营执行清单</h2><p>只呈现商品诊断、建议价格与下一步动作</p></div><span>{products.length} 个 SKU</span></div><div className="table-scroll"><table><thead><tr><th>优先级</th><th>品类</th><th>商品</th><th>当前价</th><th>市场价</th><th>建议价格</th><th>诊断</th><th>建议动作</th></tr></thead><tbody>{products.slice().sort((a,b) => b.priceIndex-a.priceIndex).map((item,index) => <tr key={item.id}><td><span className="rank small">{index+1}</span></td><td>{item.category || "母婴奶粉"}</td><td><b>{item.brand} {item.series} {item.stage}</b><small className="cell-sub">{item.spec} · {item.role}</small></td><td>¥{item.currentPrice}</td><td>¥{item.marketMedian}</td><td><b className="suggested">¥{item.suggestedLow}-{item.suggestedHigh}</b></td><td><StatusBadge product={item} /></td><td>{item.status.includes("偏高") ? "7天调价实验" : "保持并监控"}</td></tr>)}</tbody></table></div></div>}
  </section>;
}

type CollectionResult = {
  id: string; platform: string; sku: string; title: string; price?: number;
  method?: string; status: "success" | "failed"; collectedAt: string; error?: string;
  accountAlias?: string; memberLevel?: string; region?: string; priceBasis?: "checkout_preview";
};

type AccountProfile = { id: string; platform: string; alias: string; memberLevel: string; region: string; couponScope: string; status: "ready" | "expired" };

const accountProfiles: AccountProfile[] = [
  { id: "jd-main", platform: "京东", alias: "采购主账号", memberLevel: "PLUS 正式会员", region: "北京市朝阳区", couponScope: "平台券 / 店铺券 / PLUS 券", status: "ready" },
  { id: "jd-alt", platform: "京东", alias: "普通会员对照号", memberLevel: "普通会员", region: "上海市浦东新区", couponScope: "平台券 / 店铺券", status: "ready" },
  { id: "tm-main", platform: "天猫", alias: "天猫会员账号", memberLevel: "88VIP", region: "北京市朝阳区", couponScope: "跨店满减 / 店铺券 / 会员折扣", status: "ready" },
  { id: "pdd-main", platform: "拼多多", alias: "多多采购账号", memberLevel: "普通会员", region: "北京市朝阳区", couponScope: "平台券 / 店铺券 / 补贴", status: "ready" },
];

const demoCollection: CollectionResult[] = [
  { id: "COL-001", platform: "京东", sku: "P001", title: "金领冠 珍护 2段 750g", price: 259, method: "购物车优惠核算 + 结算页复核", accountAlias: "采购主账号", memberLevel: "PLUS 正式会员", region: "北京市朝阳区", priceBasis: "checkout_preview", status: "success", collectedAt: "2026-08-11T13:42:00.000Z" },
  { id: "COL-002", platform: "天猫", sku: "P001", title: "金领冠 珍护 2段 750g", price: 256.75, method: "购物车优惠核算 + 结算页复核", accountAlias: "天猫会员账号", memberLevel: "88VIP", region: "北京市朝阳区", priceBasis: "checkout_preview", status: "success", collectedAt: "2026-08-11T13:41:00.000Z" },
  { id: "COL-003", platform: "拼多多", sku: "P001", title: "金领冠 珍护 2段 750g", price: 271, method: "订单确认页预览", accountAlias: "多多采购账号", memberLevel: "普通会员", region: "北京市朝阳区", priceBasis: "checkout_preview", status: "success", collectedAt: "2026-08-11T13:40:00.000Z" },
];

type ClaimMode = "inspect" | "confirm" | "rules";

function PromotionCenter() {
  const [claimMode, setClaimMode] = useState<ClaimMode>("confirm");
  const [link, setLink] = useState("");
  const [linkResult, setLinkResult] = useState<{ valid: boolean; platform?: string; reason?: string }>();
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({ 京东: true, 天猫: false, 拼多多: false });
  const offers = demoPriceOffers.map((offer) => optimizeOffer(offer, true));
  const best = [...offers].sort((a, b) => a.finalPrice - b.finalPrice)[0];
  const inspectLink = async () => {
    const local = inspectPromotionLink(link);
    setLinkResult({ ...local, platform: local.platform ? String(local.platform) : undefined });
    if (!local.valid) return;
    try {
      const response = await fetch("http://127.0.0.1:8790/api/promotions/inspect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link }) });
      setLinkResult(await response.json());
    } catch { /* 前端本地规则已完成初检，Python 服务可选。 */ }
  };
  return <section className="page-section promotion-page">
    <div className="page-title"><div><span className="eyebrow">真实到手价引擎</span><h1>优惠策略中心</h1><p>统一识别平台、店铺、品类、会员和运费优惠，并保留每一项价格条件。</p></div><span className="workflow-pill">工作流 MVP · 演示数据</span></div>
    <div className="promo-kpis"><div><span>结算页商品金额</span><b>¥{best.salePrice}</b><small>当前账号可见</small></div><div><span>结算预览价</span><b className="promo-best">¥{best.finalPrice}</b><small>含已验证优惠</small></div><div><span>优惠影响</span><b>-¥{best.discount}</b><small>{best.applied.length} 项叠加</small></div><div><span>核算可信度</span><b>{best.confidence}%</b><small>账号与条件已留痕</small></div></div>
    <div className="promotion-grid"><article className="panel"><div className="panel-head"><div><h2>一次授权，持续复用登录状态</h2><p>账号登录在平台官方页面完成，价策 AI 不收集密码</p></div></div>
      <div className="auth-list">{["京东", "天猫", "拼多多"].map((platform) => <div key={platform}><span>{platform.slice(0, 1)}</span><div><b>{platform}</b><small>{authorized[platform] ? "本机授权状态可用，可切换账号" : "未授权时不执行价格采集"}</small></div><em className={authorized[platform] ? "ready" : "waiting"}>{authorized[platform] ? "● 已授权" : "未授权"}</em><button onClick={() => setAuthorized((state) => ({ ...state, [platform]: !state[platform] }))}>{authorized[platform] ? "停用" : "首次授权"}</button></div>)}</div>
      <div className="auth-note">授权状态只登记在用户本机；遇到验证码、实名、付费会员或支付步骤立即暂停并交还用户。</div>
    </article><article className="panel"><div className="panel-head"><div><h2>优惠领取策略</h2><p>默认只在产生真实价格收益时触发</p></div></div>
      <div className="claim-modes">{([['inspect','仅识别','不触发领取'],['confirm','逐次确认','推荐，操作透明'],['rules','规则授权','按金额与品类自动领取']] as const).map(([id, label, note]) => <button key={id} className={claimMode === id ? "active" : ""} onClick={() => setClaimMode(id)}><b>{label}</b><small>{note}</small></button>)}</div>
      <div className="claim-rule"><b>当前规则</b><span>{claimMode === "inspect" ? "识别全部优惠并计算，但不领取。" : claimMode === "confirm" ? "领取前展示优惠、有效期和限制，由用户确认。" : "仅自动领取免费、无需实名且能降低目标商品价格的优惠。"}</span></div>
    </article></div>
    <article className="panel link-inspector"><div><h2>商家优惠策略与链接识别</h2><p>商家可提交优惠链接；系统先校验 HTTPS、平台域名和活动标识，再进入领取策略。</p></div><label><input value={link} onChange={(event) => setLink(event.target.value)} placeholder="粘贴京东、淘宝/天猫、拼多多等官方优惠链接" /><button className="primary-button" onClick={inspectLink}>识别优惠</button></label>{linkResult && <div className={`link-result ${linkResult.valid ? "valid" : "invalid"}`}>{linkResult.valid ? `✓ 已识别为${linkResult.platform}官方域名；下一步读取门槛、有效期与可叠加关系。` : `× ${linkResult.reason}`}</div>}</article>
    <article className="table-card real-price-table"><div className="table-caption"><div><h2>账号结算预览价拆解</h2><p>全部结果来自指定账号条件，报告同时展示会员、地区与优惠约束</p></div><span>{offers.length} 个平台</span></div><div className="table-scroll"><table><thead><tr><th>平台</th><th>结算页商品金额</th><th>优惠后预览价</th><th>优惠组成</th><th>账号口径</th><th>可信度</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.platform}><td><b>{offer.platform}</b></td><td>¥{offer.salePrice}</td><td><b className="suggested">¥{offer.finalPrice}</b></td><td>{offer.applied.map((item: { name: string }) => item.name).join(" + ") || "无可用优惠"}</td><td><span className="basis-pill personal">账号结算预览价</span></td><td>{offer.confidence}%</td></tr>)}</tbody></table></div></article>
    <div className="price-truth-note"><b>价格不失真原则</b><span>未登录不采集；优惠必须在购物车或结算页复核后才计入。所有结果绑定账号别名、会员等级、地区、数量、优惠条件与时间；产品在提交订单前停止，因此称为“结算预览价”，实际支付订单回传后才可称为“成交价”。</span></div>
  </section>;
}

function CollectorCenter({ products }: { products: Product[] }) {
  const [mode, setMode] = useState<"demo" | "catalog" | "live">("demo");
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<CollectionResult[]>(demoCollection);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("当前显示稳定的面试演示快照，不代表实时平台价格。");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [series, setSeries] = useState("");
  const [spec, setSpec] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["京东", "天猫", "拼多多"]);
  const [activeAccounts, setActiveAccounts] = useState<Record<string, string>>({ 京东: "jd-main", 天猫: "tm-main", 拼多多: "pdd-main" });
  const categories = [...new Set(products.map((item) => item.category || "母婴奶粉"))].sort();
  const brands = [...new Set(products.filter((item) => !category || (item.category || "母婴奶粉") === category).map((item) => item.brand))].sort();
  const seriesOptions = [...new Set(products.filter((item) => (!category || (item.category || "母婴奶粉") === category) && (!brand || item.brand === brand)).map((item) => item.series))].sort();
  const specOptions = [...new Set(products.filter((item) => (!category || (item.category || "母婴奶粉") === category) && (!brand || item.brand === brand) && (!series || item.series === series)).map((item) => item.spec))].sort();
  const catalog = filterCatalog(products, { category, brand, series, spec, query }) as Product[];
  const selectedAccountProfiles = Object.fromEntries(Object.entries(activeAccounts).map(([platform, id]) => {
    const account = accountProfiles.find((item) => item.id === id);
    return [platform, account ? { id: account.id, alias: account.alias } : null];
  }));
  const collectionPlan = buildCollectionPlan(products, selectedIds, selectedPlatforms, selectedAccountProfiles);
  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const runCollection = async () => {
    if (mode === "demo") {
      setRunning(true);
      window.setTimeout(() => {
        setResults(demoCollection.map((item) => ({ ...item, collectedAt: new Date().toISOString() })));
        setMessage("演示快照已刷新。切换到“本地采集服务”可采集已授权的公开商品页。");
        setRunning(false);
      }, 700);
      return;
    }
    if (mode === "catalog") {
      if (!selectedIds.length) { setMessage("请至少勾选一个需要监控的商品 SKU。"); return; }
      if (!selectedPlatforms.length) { setMessage("请至少选择一个目标平台。"); return; }
      const missingAccount = selectedPlatforms.find((platform) => !activeAccounts[platform]);
      if (missingAccount) { setMessage(`${missingAccount}尚未选择有效登录账号，请先授权或切换账号。`); return; }
      setRunning(true);
      window.setTimeout(() => {
        const generated = collectionPlan.map((task: { id: string; sku: string; title: string; platform: string; accountAlias: string }, index: number) => {
          const product = products.find((item) => item.id === task.sku)!;
          const offer = product.offers.find((item) => item.platform === task.platform);
          const account = accountProfiles.find((item) => item.id === activeAccounts[task.platform]);
          return { id: `PLAN-${index + 1}`, platform: task.platform, sku: task.sku, title: task.title,
            price: offer?.price, method: offer ? "登录态购物车核算 + 结算页复核" : "待平台同款搜索",
            accountAlias: task.accountAlias, memberLevel: account?.memberLevel, region: account?.region, priceBasis: "checkout_preview" as const,
            status: offer ? "success" as const : "failed" as const, collectedAt: new Date().toISOString(), error: offer ? undefined : "未找到高置信度同款，已进入人工复核队列" };
        });
        setResults(generated);
        setMessage(`已生成 ${collectionPlan.length} 个“SKU × 平台”采集任务；成功匹配 ${generated.filter((item: CollectionResult) => item.status === "success").length} 个，其余进入人工复核。`);
        setRunning(false);
      }, 700);
      return;
    }
    const targets = urls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url, index) => ({ id: `WEB-${index + 1}`, url }));
    if (!targets.length) { setMessage("请先粘贴至少一个商品页 HTTPS 链接，每行一个。"); return; }
    setRunning(true); setMessage("正在连接本地采集服务并按顺序限速采集……");
    try {
      const response = await fetch("http://127.0.0.1:8787/api/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targets, accounts: activeAccounts, priceBasis: "checkout_preview" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "采集服务返回异常");
      setResults(payload.results);
      setMessage(`采集完成：成功 ${payload.summary.success}/${payload.summary.total}。失败项可改用平台开放 API 或 CSV。`);
    } catch (error) {
      setMessage(`未连接到本地采集服务：${error instanceof Error ? error.message : "未知错误"}。请先运行 pnpm collector:serve。`);
    } finally { setRunning(false); }
  };
  const successful = results.filter((item) => item.status === "success");
  const platforms = new Set(successful.map((item) => item.platform)).size;
  return <section className="page-section collector-page">
    <div className="page-title"><div><span className="eyebrow">账号真实价格入口</span><h1>价格采集中心</h1><p>必须基于用户授权账号采集，自动核算优惠并在提交订单前复核结算预览价。</p></div><button className="primary-button" onClick={runCollection} disabled={running}>{running ? "采集中…" : mode === "demo" ? "刷新演示快照" : mode === "catalog" ? "生成采集任务" : "立即采集"}</button></div>
    <div className="collector-kpis"><div><span>成功报价</span><b>{successful.length}</b><small>条</small></div><div><span>覆盖平台</span><b>{platforms}</b><small>个</small></div><div><span>成功率</span><b>{results.length ? Math.round(successful.length / results.length * 100) : 0}</b><small>%</small></div><div><span>采集策略</span><b className="strategy-value">限速</b><small>≥ 1.2 秒/页</small></div></div>
    <article className="panel account-workbench"><div className="panel-head"><div><h2>采集账号与价格条件</h2><p>每个平台独立选择账号；更换账号后新任务使用新画像，历史报告不被覆盖</p></div><span className="workflow-pill">登录态必选</span></div><div className="account-grid">{["京东", "天猫", "拼多多"].map((platform) => { const options = accountProfiles.filter((item) => item.platform === platform); const selectedAccount = options.find((item) => item.id === activeAccounts[platform]); return <div className="account-card" key={platform}><div><span>{platform.slice(0,1)}</span><b>{platform}</b></div><label>当前采集账号<select value={activeAccounts[platform] || ""} onChange={(event) => setActiveAccounts((state) => ({ ...state, [platform]: event.target.value }))}><option value="">未授权</option>{options.map((item) => <option key={item.id} value={item.id}>{item.alias}</option>)}</select></label>{selectedAccount ? <ul><li>{selectedAccount.memberLevel}</li><li>{selectedAccount.region}</li><li>{selectedAccount.couponScope}</li></ul> : <p>请先在平台官方页面完成登录授权</p>}<button onClick={() => setMessage(`${platform}新增账号时会打开官方登录页；完成后保存为独立本机会话。当前为产品交互演示。`)}>＋ 新增登录账号</button></div>; })}</div><div className="auth-note">报告会显示账号别名、会员等级、收货地区、优惠范围和采集时间；不保存密码，不执行最终下单或支付。</div></article>
    <div className="collector-layout"><article className="panel collector-control"><div className="panel-head"><div><h2>采集任务</h2><p>演示、货盘选品与登录态链接采集明确隔离</p></div><span className={`mode-pill ${mode}`}>{mode === "demo" ? "DEMO" : mode === "catalog" ? "SKU" : "LOCAL"}</span></div>
      <div className="mode-switch three"><button className={mode === "demo" ? "active" : ""} onClick={() => { setMode("demo"); setMessage("当前显示稳定的面试演示快照，不代表实时平台价格。"); }}>演示快照</button><button className={mode === "catalog" ? "active" : ""} onClick={() => { setMode("catalog"); setMessage("先按品牌筛选并勾选 SKU，再选择目标平台和价格口径。"); }}>按品牌选品</button><button className={mode === "live" ? "active" : ""} onClick={() => { setMode("live"); setMessage("本地服务仅接受京东、天猫、淘宝、拼多多、苏宁和唯品会 HTTPS 链接。"); }}>按链接采集</button></div>
      {mode === "demo" && <div className="demo-board"><span>面试展示模式</span><h3>无需平台密钥，也能演示完整数据链路</h3><p>刷新后会生成新的采集时间，再进入价格诊断、调价模拟与报告输出。</p></div>}
      {mode === "catalog" && <div className="catalog-picker"><div className="catalog-filters"><label>品类<select value={category} onChange={(event) => { setCategory(event.target.value); setBrand(""); setSeries(""); setSpec(""); }}><option value="">全部品类</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>品牌<select value={brand} onChange={(event) => { setBrand(event.target.value); setSeries(""); setSpec(""); }}><option value="">全部品牌</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label><label>系列<select value={series} onChange={(event) => { setSeries(event.target.value); setSpec(""); }}><option value="">全部系列</option>{seriesOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>规格<select value={spec} onChange={(event) => setSpec(event.target.value)}><option value="">全部规格</option>{specOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <label className="catalog-search"><span>搜索商品</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="商品名称或 SKU" /></label>
        <div className="catalog-toolbar"><span>找到 {catalog.length} 个商品，已选 {selectedIds.length} 个</span><button onClick={() => setSelectedIds(catalog.map((item) => item.id))}>选择当前全部</button><button onClick={() => setSelectedIds([])}>清空</button></div>
        <div className="sku-list">{catalog.map((product) => <label key={product.id} className={selectedIds.includes(product.id) ? "selected" : ""}><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggle(product.id, selectedIds, setSelectedIds)} /><span>{product.brand.slice(0, 1)}</span><div><b>{product.brand} {product.series} {product.stage}</b><small>{product.spec} · {product.id} · {product.role}</small></div><em>{product.stock} 件库存</em></label>)}</div>
        <div className="task-options"><div><b>目标平台</b>{["京东", "天猫", "拼多多"].map((platform) => <button key={platform} className={selectedPlatforms.includes(platform) ? "active" : ""} onClick={() => toggle(platform, selectedPlatforms, setSelectedPlatforms)}>{platform}</button>)}</div><label><b>唯一价格口径</b><select value="checkout_preview" disabled><option value="checkout_preview">账号结算预览价</option></select></label></div>
        <div className="plan-summary"><b>{collectionPlan.length}</b><span>个待生成任务</span><small>{selectedIds.length} 个 SKU × {selectedPlatforms.length} 个平台</small></div></div>}
      {mode === "live" && <label className="url-input"><span>授权账号可访问的商品页链接</span><textarea value={urls} onChange={(event) => setUrls(event.target.value)} placeholder={"https://item.jd.com/商品编号.html\nhttps://detail.tmall.com/item.htm?id=商品编号"} /><small>系统复用所选账号会话，计算优惠后进入结算页复核，并在提交订单前停止。</small></label>}
      <div className="collector-message">{message}</div>
    </article><article className="panel platform-panel"><div className="panel-head"><div><h2>平台登录态矩阵</h2><p>按平台配置独立浏览器适配器</p></div></div>{[
        ["京东", "多账号会话 / 结算复核", "交互演示"], ["天猫 / 淘宝", "多账号会话 / 结算复核", "交互演示"], ["拼多多", "多账号会话 / 结算复核", "交互演示"], ["其他平台", "待配置浏览器适配器", "规划中"],
      ].map((item) => <div className="platform-row" key={item[0]}><span>{item[0].slice(0, 1)}</span><div><b>{item[0]}</b><small>{item[1]}</small></div><em>● {item[2]}</em></div>)}</article></div>
    <article className="table-card collection-table"><div className="table-caption"><div><h2>最近采集结果</h2><p>结算预览价与账号条件绑定保存，切换账号不会覆盖历史记录</p></div><span>{results.length} 条记录</span></div><div className="table-scroll"><table><thead><tr><th>平台</th><th>匹配商品</th><th>结算预览价</th><th>账号条件</th><th>验证方式</th><th>采集时间</th><th>状态</th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td><b>{item.platform}</b></td><td><b>{item.title}</b><small className="cell-sub">SKU：{item.sku}</small></td><td>{item.price ? <b className="suggested">¥{item.price}</b> : "—"}</td><td><b>{item.accountAlias || "未记录"}</b><small className="cell-sub">{item.memberLevel || "—"} · {item.region || "—"}</small></td><td>{item.method || "—"}</td><td>{new Date(item.collectedAt).toLocaleString("zh-CN", { hour12: false })}</td><td><span className={`collection-status ${item.status}`}>{item.status === "success" ? "采集成功" : "采集失败"}</span>{item.error && <small className="cell-sub error-copy">{item.error}</small>}</td></tr>)}</tbody></table></div></article>
    <div className="compliance-note"><b>合规边界</b><span>系统不会绕过登录、验证码、robots.txt 或平台访问控制。正式商业部署应申请对应平台开放 API 权限，并保留请求频率、授权范围和数据用途审计。</span></div>
  </section>;
}

function DataCenter({ products, onImport, onReset }: { products: AnalyzedProduct[]; onImport: (rows: Record<string,string>[]) => void; onReset: () => void }) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (file?: File) => { if (!file) return; const rows = parseCsv(await file.text()); onImport(rows); setMessage(`已读取 ${rows.length} 行数据，价格诊断已刷新。`); };
  const template = "商品编码,品类,品牌,系列,段位,规格,商品名称,当前价格,成本,近30天销量,转化率,库存,商品角色,京东价格,天猫价格,拼多多价格\nS001,食品饮料,示例品牌,成长系列,整箱,500ml×15,示例商品,69,48,120,4.5,300,转化型,65,67,62";
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow">数据工作台</span><h1>数据中心</h1><p>导入商家商品与竞品报价，自动刷新全部诊断。</p></div><button className="secondary-button" onClick={() => downloadText("价策AI-商品导入模板.csv", `\uFEFF${template}`)}>下载导入模板</button></div>
    <div className="data-grid"><article className="upload-card"><div className="upload-icon">⇧</div><h2>导入商品与竞品数据</h2><p>支持 UTF-8 CSV。请使用标准模板，系统将自动识别价格、成本和平台报价。</p><input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => handleFile(event.target.files?.[0])} /><button className="primary-button" onClick={() => inputRef.current?.click()}>选择 CSV 文件</button>{message && <div className="success-message">✓ {message}</div>}<small>数据仅保存在当前浏览器，不会上传到服务器。</small></article>
      <article className="panel source-card"><div className="panel-head"><div><h2>数据源状态</h2><p>当前演示环境</p></div><span className="live-pill">{products.length} 个 SKU</span></div>{[ ["商家商品数据","已就绪","刚刚"], ["京东竞品报价","已就绪","10分钟前"], ["天猫竞品报价","已就绪","18分钟前"], ["拼多多竞品报价","已就绪","22分钟前"] ].map((item) => <div className="source-row" key={item[0]}><span className="source-icon">{item[0].slice(0,1)}</span><div><b>{item[0]}</b><small>更新于 {item[2]}</small></div><em>● {item[1]}</em></div>)}<button className="text-button reset-button" onClick={onReset}>恢复演示数据</button></article></div>
    <article className="panel field-guide"><h2>必填字段说明</h2><div className="field-grid">{[["商品编码","每个SKU的唯一编号"],["品牌/系列/段位/规格","用于商品标准化与同款匹配"],["当前价格/成本","用于价格指数与利润安全线"],["近30天销量","用于市场权重与策略模拟"],["商品角色","引流型、利润型、转化型等"],["平台价格","京东、天猫、拼多多到手价"]].map((item) => <div key={item[0]}><b>{item[0]}</b><span>{item[1]}</span></div>)}</div></article>
  </section>;
}

function Guide({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const steps = [
    ["01","准备数据","下载模板，整理商品、成本、销量、库存和竞品报价。"],
    ["02","导入诊断","在数据中心导入 CSV，系统会自动计算价格指数和建议区间。"],
    ["03","审核匹配","在价格诊断中检查置信度、市场样本和商品经营角色。"],
    ["04","策略模拟","选择建议价格，评估销量、销售额、毛利和安全线。"],
    ["05","导出报告","下载调价清单，或打印管理层可视化报告。"],
    ["06","小范围实验","执行7天实验，记录效果后再扩大调价范围。"],
  ];
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow">快速上手</span><h1>使用指引</h1><p>从数据导入到调价复盘，建议按照以下流程操作。</p></div></div><div className="guide-grid">{steps.map((step) => <article key={step[0]}><span>{step[0]}</span><div><h2>{step[1]}</h2><p>{step[2]}</p></div></article>)}</div><div className="guide-callout"><div><span>✦</span><div><h2>先用演示数据体验完整流程</h2><p>系统已经内置12个母婴奶粉商品，可以直接查看价格诊断、运行模拟并生成报告。</p></div></div><button className="primary-button" onClick={() => onNavigate("overview")}>进入驾驶舱</button></div><article className="panel glossary"><h2>关键指标解释</h2><div><p><b>价格指数</b><span>本店到手价 ÷ 市场中位价 × 100，100表示与市场一致。</span></p><p><b>利润底价</b><span>在满足最低毛利率条件下允许设置的最低价格。</span></p><p><b>匹配可信度</b><span>根据品牌、系列、段位、规格和报价数量评估。</span></p><p><b>增量机会</b><span>偏高商品调至建议价格后可能获得的销售额增长估算。</span></p></div></article><article className="panel strategy-guide"><div className="panel-head"><div><h2>商品角色与定价策略</h2><p>同一个价格偏差，在不同商品角色下应采取不同动作</p></div></div><div className="strategy-grid">{[
    ["引流型", "获取访问与新客", "靠近市场低位，但不突破利润底价", "关注访客成本、连带率"],
    ["转化型", "提升下单效率", "保持市场中位价附近，优先做7天实验", "关注转化率、销量弹性"],
    ["利润型", "贡献毛利", "允许适度溢价，以价值表达替代直接降价", "关注毛利额、折扣深度"],
    ["形象型", "强化品牌定位", "跟随头部标杆，避免频繁价格波动", "关注价格稳定性、品牌搜索"],
  ].map((item) => <div key={item[0]}><span>{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p><small>{item[3]}</small></div>)}</div><div className="strategy-rule"><b>决策顺序</b><span>先确认同款匹配可信度 → 再看市场价格带 → 校验利润底价 → 结合商品角色 → 小流量实验 → 复盘后扩大。</span></div></article></section>;
}

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [products, setProducts] = useState<Product[]>(() => {
    try { const saved = localStorage.getItem("pricescope-products-v2"); return saved ? JSON.parse(saved) : demoProducts; } catch { return demoProducts; }
  });
  const [selected, setSelected] = useState<AnalyzedProduct | null>(null);
  const [simulatorId, setSimulatorId] = useState<string>();
  const analyzed = useMemo(() => products.map(analyzeProduct) as AnalyzedProduct[], [products]);
  useEffect(() => localStorage.setItem("pricescope-products-v2", JSON.stringify(products)), [products]);

  const importRows = (rows: Record<string,string>[]) => {
    const imported = rows.map((row, index): Product => ({
      id: row["商品编码"] || `IMP${index + 1}`, category: row["品类"] || "未分类", brand: row["品牌"] || "未识别品牌", series: row["系列"] || "未识别系列", stage: row["段位"] || "-", spec: row["规格"] || "-", name: row["商品名称"] || `${row["品牌"] || "导入"}商品`,
      currentPrice: Number(row["当前价格"]) || 0, cost: Number(row["成本"]) || 0, sales30d: Number(row["近30天销量"]) || 0, conversion: Number(row["转化率"]) || 0, stock: Number(row["库存"]) || 0, role: row["商品角色"] || "转化型", minMarginRate: 0.18,
      offers: [["京东",row["京东价格"]],["天猫",row["天猫价格"]],["拼多多",row["拼多多价格"]]].filter(([,price]) => Number(price) > 0).map(([platform,price], offerIndex) => ({ platform, price: Number(price), weight: 30 - offerIndex * 5 })),
    })).filter((item) => item.currentPrice > 0);
    if (imported.length) setProducts(imported);
  };

  const navigate = (next: Page) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span>价</span><div><b>价策 AI</b><small>PRICE SCOPE</small></div></div><nav>{navItems.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => navigate(item.id)}><span>{item.mark}</span>{item.label}{item.id === "diagnosis" && <em>{analyzed.filter((product) => product.status.includes("偏高")).length}</em>}</button>)}</nav><div className="sidebar-card"><span>AI</span><b>本周策略已更新</b><p>{analyzed.filter((product) => product.status.includes("偏高")).length} 个商品建议优先处理</p><button onClick={() => navigate("diagnosis")}>查看建议</button></div><div className="sidebar-user"><span>示</span><div><b>示例商家</b><small>管理员</small></div><button aria-label="更多账户选项">•••</button></div></aside>
    <main><header className="topbar"><div className="mobile-brand"><b>价策 AI</b></div><div className="store-switch"><span>示例商家 · 全国渠道</span><b>⌄</b></div><div className="top-actions"><span className="data-time">数据更新于 10 分钟前</span><button aria-label="消息通知">◌<i /></button><button className="avatar" aria-label="账户">示</button></div></header><div className="content">
      {page === "overview" && <Overview products={analyzed} onNavigate={navigate} />}
      {page === "collector" && <CollectorCenter products={products} />}
      {page === "promotions" && <PromotionCenter />}
      {page === "diagnosis" && <Diagnosis products={analyzed} onSelect={setSelected} />}
      {page === "inflection" && <InflectionAnalysis products={analyzed} onSimulate={(id) => { setSimulatorId(id); navigate("simulator"); }} />}
      {page === "simulator" && <Simulator products={analyzed} initialId={simulatorId} />}
      {page === "reports" && <Reports products={analyzed} />}
      {page === "data" && <DataCenter products={analyzed} onImport={importRows} onReset={() => setProducts(demoProducts)} />}
      {page === "guide" && <Guide onNavigate={navigate} />}
    </div></main>{selected && <ProductDrawer product={selected} onClose={() => setSelected(null)} onSimulate={() => { setSimulatorId(selected.id); setSelected(null); navigate("simulator"); }} />}</div>;
}

export default App;
