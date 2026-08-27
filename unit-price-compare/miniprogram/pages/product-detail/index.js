const { t, getLocale } = require("../../shared/i18n/index");
const { formatUnitPrice, PLATFORM_CATEGORIES } = require("../../shared/constants");

Page({
  data: {
    _t: getLocale(),
    product: null,
    specs: [],
    loading: true,
    productId: "",
  },
  onLoad(options) {
    wx.setNavigationBarTitle({ title: t("detail.navTitle") });
    if (options.id) this.setData({ productId: options.id });
  },
  onShow() {
    if (this.data.productId) this.loadDetail(this.data.productId);
  },
  goToAddRecord() {
    wx.navigateTo({ url: `/pages/add-record/index?id=${this.data.productId}` });
  },
  goToHistory(e) {
    const specId = e.currentTarget.dataset.specid;
    const spec = e.currentTarget.dataset.spec;
    wx.navigateTo({ url: `/pages/price-history/index?specId=${specId}&spec=${encodeURIComponent(spec)}` });
  },
  onPriceTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/add-record/index?priceId=${id}` });
  },
  async loadDetail(productId) {
    const db = wx.cloud.database();
    try {
      const productRes = await db.collection("products").doc(productId).get();
      const specRes = await db.collection("specs")
        .where({ productId })
        .orderBy("createTime", "desc")
        .get();

      const specs = [];
      const allPrices = [];
      for (const spec of specRes.data) {
        const priceRes = await db.collection("prices")
          .where({ specId: spec._id })
          .orderBy("unitPrice", "asc")
          .get();
        const prices = priceRes.data.map((p) => {
          const cat = PLATFORM_CATEGORIES.find(c => c.key === p.platformCategory);
          const item = {
            ...p,
            unitPriceText: formatUnitPrice(p.unitPrice),
            categoryLabel: cat ? cat.label : "",
          };
          if (spec.pieceCount) {
            item.perPiece = p.price / spec.pieceCount;
            item.perPieceText = formatUnitPrice(item.perPiece);
            item.pieceUnit = spec.pieceUnit;
          }
          return item;
        });
        specs.push({
          ...spec,
          prices,
        });
        allPrices.push(...prices);
      }

      allPrices.sort((a, b) => a.unitPrice - b.unitPrice);
      allPrices.forEach((p, i) => { p.rank = i + 1; });

      this.setData({
        product: productRes.data,
        specs,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: t("detail.loadFail"), icon: "none" });
      this.setData({ loading: false });
    }
  },
});
