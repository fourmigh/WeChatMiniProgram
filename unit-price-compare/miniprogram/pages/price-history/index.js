const { t, getLocale } = require("../../shared/i18n/index");
const { formatUnitPrice, PLATFORM_CATEGORIES, formatDate } = require("../../shared/constants");

Page({
  data: {
    _t: getLocale(),
    specId: "",
    spec: "",
    loading: true,
    sources: [],
    activeSource: "all",
    timeline: [],
    trend: [],
    minUnitPrice: null,
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: t("history.navTitle") });
    this.setData({
      specId: options.specId || "",
      spec: options.spec || "",
    });
    if (this.data.specId) {
      this.loadHistory();
    } else {
      this.setData({ loading: false });
    }
  },

  async loadHistory() {
    const db = wx.cloud.database();
    try {
      const [priceRes, histRes] = await Promise.all([
        db.collection("prices").where({ specId: this.data.specId }).orderBy("recordDate", "asc").get(),
        db.collection("priceHistory").where({ specId: this.data.specId }).orderBy("recordDate", "asc").get(),
      ]);

      const sourceMap = new Map();
      const list = [];

      const normalize = (p, isCurrent) => {
        const cat = PLATFORM_CATEGORIES.find((c) => c.key === p.platformCategory);
        const sourceKey = `${p.platformCategory}|${p.platform}|${p.shopName}`;
        const sourceLabel = `${cat ? cat.label : ""}·${p.platform}·${p.shopName}`;
        if (!sourceMap.has(sourceKey)) {
          sourceMap.set(sourceKey, { key: sourceKey, label: sourceLabel });
        }
        return {
          _id: p._id,
          sourceKey,
          dateText: formatDate(p.recordDate),
          platformCategory: p.platformCategory,
          categoryLabel: cat ? cat.label : "",
          platform: p.platform,
          shopName: p.shopName,
          price: p.price,
          unitPrice: p.unitPrice,
          unitPriceText: formatUnitPrice(p.unitPrice),
          isCurrent,
        };
      };

      priceRes.data.forEach((p) => list.push(normalize(p, true)));
      histRes.data.forEach((p) => list.push(normalize(p, false)));

      const sources = [{ key: "all", label: t("history.filterAll") }, ...Array.from(sourceMap.values())];
      this._allPrices = list;
      this.setData({ sources, loading: false });
      this.applyFilter("all");
    } catch (e) {
      wx.showToast({ title: t("detail.loadFail"), icon: "none" });
      this.setData({ loading: false });
    }
  },

  onSourceTap(e) {
    this.applyFilter(e.currentTarget.dataset.key);
  },

  applyFilter(key) {
    const all = this._allPrices || [];
    const filtered = key === "all" ? all.slice() : all.filter((p) => p.sourceKey === key);

    const timeline = filtered.slice().sort((a, b) => (a.dateText < b.dateText ? 1 : -1));

    const trendRaw = filtered.slice().sort((a, b) => (a.dateText < b.dateText ? -1 : 1));
    const minU = trendRaw.length ? Math.min.apply(null, trendRaw.map((p) => p.unitPrice)) : null;
    const maxU = trendRaw.length ? Math.max.apply(null, trendRaw.map((p) => p.unitPrice)) : null;
    const span = (maxU - minU) || 1;
    const trend = trendRaw.map((p) => ({
      ...p,
      isBest: p.unitPrice === minU,
      heightPct: 25 + Math.round(((p.unitPrice - minU) / span) * 75),
    }));

    this.setData({ activeSource: key, timeline, trend, minUnitPrice: minU });
  },

  goBack() {
    wx.navigateBack();
  },
});
