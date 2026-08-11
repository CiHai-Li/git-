export type Offer = { platform: string; price: number; weight: number };
export type Product = {
  id: string; brand: string; series: string; stage: string; spec: string; name: string;
  currentPrice: number; cost: number; sales30d: number; conversion: number; stock: number;
  role: string; minMarginRate: number; offers: Offer[];
};

const offers = (base: number, drift = 0): Offer[] => [
  { platform: "京东", price: base + drift, weight: 32 },
  { platform: "天猫", price: base - 4 + drift, weight: 27 },
  { platform: "拼多多", price: base - 10 + drift, weight: 19 },
  { platform: "即时零售", price: base + 8 + drift, weight: 12 },
];

export const demoProducts: Product[] = [
  { id: "P001", brand: "伊利", series: "金领冠珍护", stage: "1段", spec: "750g", name: "金领冠珍护婴儿配方奶粉 1段 750g", currentPrice: 299, cost: 216, sales30d: 128, conversion: 3.8, stock: 420, role: "转化型", minMarginRate: 0.2, offers: offers(263) },
  { id: "P002", brand: "伊利", series: "金领冠珍护", stage: "2段", spec: "750g", name: "金领冠珍护较大婴儿配方奶粉 2段 750g", currentPrice: 289, cost: 209, sales30d: 156, conversion: 4.2, stock: 360, role: "转化型", minMarginRate: 0.2, offers: offers(263, -2) },
  { id: "P003", brand: "伊利", series: "金领冠珍护", stage: "3段", spec: "750g", name: "金领冠珍护幼儿配方奶粉 3段 750g", currentPrice: 248, cost: 195, sales30d: 214, conversion: 5.1, stock: 318, role: "引流型", minMarginRate: 0.18, offers: offers(260, -3) },
  { id: "P004", brand: "伊利", series: "金领冠菁护", stage: "1段", spec: "800g", name: "金领冠菁护婴儿配方奶粉 1段 800g", currentPrice: 223, cost: 172, sales30d: 246, conversion: 5.6, stock: 510, role: "防御型", minMarginRate: 0.18, offers: offers(175) },
  { id: "P005", brand: "a2", series: "至初", stage: "1段", spec: "850g", name: "a2至初婴儿配方奶粉 1段 850g", currentPrice: 345, cost: 268, sales30d: 88, conversion: 2.9, stock: 190, role: "形象型", minMarginRate: 0.2, offers: offers(345) },
  { id: "P006", brand: "a2", series: "至初", stage: "2段", spec: "850g", name: "a2至初较大婴儿配方奶粉 2段 850g", currentPrice: 330, cost: 250, sales30d: 112, conversion: 3.5, stock: 236, role: "利润型", minMarginRate: 0.2, offers: offers(330) },
  { id: "P007", brand: "合生元", series: "派星", stage: "3段", spec: "800g", name: "合生元派星幼儿配方奶粉 3段 800g", currentPrice: 321, cost: 218, sales30d: 75, conversion: 2.7, stock: 140, role: "利润型", minMarginRate: 0.24, offers: offers(290) },
  { id: "P008", brand: "飞鹤", series: "星飞帆卓睿", stage: "1段", spec: "750g", name: "飞鹤星飞帆卓睿婴儿配方奶粉 1段 750g", currentPrice: 315, cost: 232, sales30d: 136, conversion: 4.1, stock: 298, role: "转化型", minMarginRate: 0.2, offers: offers(292) },
  { id: "P009", brand: "美素佳儿", series: "源悦", stage: "2段", spec: "800g", name: "美素佳儿源悦较大婴儿配方奶粉 2段 800g", currentPrice: 246, cost: 174, sales30d: 193, conversion: 4.8, stock: 270, role: "防御型", minMarginRate: 0.18, offers: offers(215) },
  { id: "P010", brand: "君乐宝", series: "乐铂", stage: "3段", spec: "800g", name: "君乐宝乐铂幼儿配方奶粉 3段 800g", currentPrice: 148.8, cost: 112, sales30d: 286, conversion: 6.2, stock: 620, role: "引流型", minMarginRate: 0.18, offers: offers(130) },
  { id: "P011", brand: "雀巢", series: "超启能恩", stage: "1段", spec: "800g", name: "雀巢超启能恩婴儿配方食品 1段 800g", currentPrice: 370, cost: 290, sales30d: 54, conversion: 2.2, stock: 96, role: "形象型", minMarginRate: 0.19, offers: offers(370) },
  { id: "P012", brand: "惠氏", series: "启赋蕴淳", stage: "2段", spec: "850g", name: "惠氏启赋蕴淳较大婴儿配方奶粉 2段 850g", currentPrice: 330, cost: 260, sales30d: 69, conversion: 2.5, stock: 124, role: "清仓型", minMarginRate: 0.18, offers: offers(338) },
];

export const weeklyTrend = [
  { day: "周一", market: 268, store: 289 }, { day: "周二", market: 266, store: 289 },
  { day: "周三", market: 263, store: 289 }, { day: "周四", market: 260, store: 289 },
  { day: "周五", market: 262, store: 279 }, { day: "周六", market: 259, store: 279 },
  { day: "周日", market: 261, store: 279 },
];
