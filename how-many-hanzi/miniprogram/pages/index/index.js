const chars = require("../../lib/chars");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const progress = require("../../lib/progress");
const { definePage } = require("../../lib/page-base");
const i18n = require("../../lib/i18n");
const { pickOne, isHanChar } = require("../../lib/utils");

definePage({
  page: "index",
  titleKey: "pages.index.title",
  home: false,
  data: {
    scopes: [],
    scopeIndex: 4,
    sampleSizes: [10, 20, 30],
    sampleSize: 20,
    charInput: "",
    lastResult: null,
    totalChars: 0,
    polyOnly: false,
    currentRank: "",
    currentMastery: 0,
    subtitle: "",
  },

  onLoad() {
    const settings = storage.getSettings();
    const scopes = chars.listScopes();
    this.setData({
      scopes: scopes,
      scopeIndex: settings.scope,
      sampleSize: settings.sampleSize,
      totalChars: chars.allChars.length,
      subtitle: i18n.t("pages.index.subtitle", { n: chars.allChars.length }),
    });
    this.refreshProgress();
    this.refreshLast();
  },

  onShow() {
    this.refreshProgress();
    this.refreshLast();
  },

  refreshProgress() {
    const prog = progress.calcProgress(
      storage.getCharLevels(),
      chars.allChars.length
    );
    this.setData({
      currentRank: prog.rank,
      currentMastery: prog.mastery,
    });
  },

  refreshLast() {
    const history = storage.getHistory();
    const last = history[0] || null;
    this.setData({
      lastResult: last
        ? Object.assign({}, last, {
            avgText: levels.avgText(last.avgLevel),
            avgMark: levels.markOf(
              Math.min(Math.round(Number(last.avgLevel) || 0), 6)
            ),
            avgValue: i18n.t("common.levelValue", {
              value: (Number(last.avgLevel) || 0).toFixed(1),
            }),
            avgLevelRound: Math.min(Math.round(Number(last.avgLevel) || 0), 6),
          })
        : null,
    });
  },

  selectScope(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ scopeIndex: index });
    storage.saveSettings({ scope: index });
  },

  selectSize(e) {
    const size = Number(e.currentTarget.dataset.size);
    this.setData({ sampleSize: size });
    storage.saveSettings({ sampleSize: size });
  },

  onCharInput(e) {
    this.setData({ charInput: e.detail.value });
  },

  onTogglePolyOnly() {
    this.setData({ polyOnly: !this.data.polyOnly });
  },

  randomChar() {
    const pool = chars.getCharsByScope(this.data.scopeIndex);
    if (this.data.polyOnly) {
      const poly = chars.getPolyChars(pool);
      if (!poly.length) {
        wx.showToast({
        title: i18n.t("pages.index.toastNoPoly"),
        icon: "none",
      });
        return;
      }
      this.setData({ charInput: pickOne(poly) });
      return;
    }
    this.setData({ charInput: pickOne(pool) });
  },

  startSingle() {
    const ch = (this.data.charInput || "").trim();
    if (!isHanChar(ch)) {
      wx.showToast({ title: i18n.t("pages.index.toastNeedChar"), icon: "none" });
      return;
    }
    if (chars.getTierOf(ch) < 0) {
      const added = storage.addRareChar(ch);
      if (!added) {
        wx.showToast({
          title: i18n.t("pages.index.toastAlreadyCollected"),
          icon: "none",
        });
        return;
      }
      wx.showModal({
        title: i18n.t("pages.index.modalRareTitle"),
        content: i18n.t("pages.index.modalRareContent", { char: ch }),
        confirmText: i18n.t("pages.index.modalRareConfirm"),
        cancelText: i18n.t("pages.index.modalRareCancel"),
        success(res) {
          if (res.confirm) {
            nav.go("/pages/chars-list/chars-list?scope=hidden");
          }
        },
      });
      return;
    }
    nav.go(
      "/pages/quiz/quiz?mode=single&char=" +
        encodeURIComponent(ch) +
        "&scope=" +
        this.data.scopeIndex,
      i18n.t("common.navPreparing")
    );
  },

  startTest() {
    nav.go(
      "/pages/quiz/quiz?mode=test&scope=" +
        this.data.scopeIndex +
        "&size=" +
        this.data.sampleSize,
      i18n.t("common.navSampling")
    );
  },

  goIntro() {
    nav.go("/pages/intro/intro");
  },

  goRankIntro() {
    nav.go("/pages/intro/intro?anchor=rank");
  },

  goHistory() {
    nav.go("/pages/history/history");
  },

  goChars() {
    nav.go("/pages/chars/chars");
  },
});
