export type Offer = { platform: string; price: number; weight: number };
export type Product = {
  id: string; brand: string; series: string; stage: string; spec: string; name: string;
  category?: string;
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
  { id: "B001", category: "食品饮料", brand: "农夫山泉", series: "饮用天然水", stage: "整箱", spec: "550ml×24", name: "农夫山泉饮用天然水 550ml×24瓶", currentPrice: 34.9, cost: 24, sales30d: 860, conversion: 7.6, stock: 1300, role: "引流型", minMarginRate: 0.15, offers: offers(33.9) },
  { id: "B002", category: "食品饮料", brand: "农夫山泉", series: "东方树叶", stage: "整箱", spec: "500ml×15", name: "农夫山泉东方树叶乌龙茶 500ml×15瓶", currentPrice: 75, cost: 52, sales30d: 620, conversion: 6.9, stock: 880, role: "转化型", minMarginRate: 0.18, offers: offers(72) },
  { id: "B003", category: "食品饮料", brand: "农夫山泉", series: "尖叫", stage: "整箱", spec: "550ml×15", name: "农夫山泉尖叫运动饮料 550ml×15瓶", currentPrice: 69, cost: 48, sales30d: 410, conversion: 5.8, stock: 690, role: "利润型", minMarginRate: 0.2, offers: offers(66) },
  { id: "A001", category: "家用电器", brand: "美的", series: "小家电", stage: "电饭煲", spec: "4L", name: "美的智能电饭煲 4L", currentPrice: 259, cost: 188, sales30d: 380, conversion: 4.9, stock: 460, role: "转化型", minMarginRate: 0.2, offers: offers(245) },
  { id: "A002", category: "家用电器", brand: "美的", series: "小家电", stage: "电热水壶", spec: "1.7L", name: "美的不锈钢电热水壶 1.7L", currentPrice: 99, cost: 67, sales30d: 720, conversion: 7.2, stock: 900, role: "引流型", minMarginRate: 0.18, offers: offers(92) },
  { id: "A003", category: "家用电器", brand: "美的", series: "环境电器", stage: "循环扇", spec: "遥控款", name: "美的空气循环扇遥控款", currentPrice: 299, cost: 206, sales30d: 260, conversion: 4.1, stock: 340, role: "利润型", minMarginRate: 0.22, offers: offers(285) },
  { id: "C001", category: "个护清洁", brand: "蓝月亮", series: "深层洁净", stage: "洗衣液", spec: "3kg", name: "蓝月亮深层洁净护理洗衣液 3kg", currentPrice: 59.9, cost: 39, sales30d: 920, conversion: 8.1, stock: 1500, role: "引流型", minMarginRate: 0.16, offers: offers(55.9) },
  { id: "C002", category: "个护清洁", brand: "蓝月亮", series: "至尊", stage: "洗衣液", spec: "2.36kg", name: "蓝月亮至尊浓缩洗衣液 2.36kg", currentPrice: 89.9, cost: 58, sales30d: 560, conversion: 6.4, stock: 760, role: "转化型", minMarginRate: 0.19, offers: offers(83.9) },
  { id: "C003", category: "个护清洁", brand: "蓝月亮", series: "卫诺", stage: "洁厕液", spec: "500g×4", name: "蓝月亮卫诺洁厕液 500g×4", currentPrice: 49.9, cost: 31, sales30d: 470, conversion: 5.9, stock: 820, role: "利润型", minMarginRate: 0.2, offers: offers(45.9) },
];

export const weeklyTrend = [
  { day: "周一", market: 268, store: 289 }, { day: "周二", market: 266, store: 289 },
  { day: "周三", market: 263, store: 289 }, { day: "周四", market: 260, store: 289 },
  { day: "周五", market: 262, store: 279 }, { day: "周六", market: 259, store: 279 },
  { day: "周日", market: 261, store: 279 },
];
