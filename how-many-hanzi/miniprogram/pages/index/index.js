const chars = require("../../lib/chars");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const { pickOne } = require("../../lib/utils");

Page({
  data: {
    scopes: [],
    scopeIndex: 4,
    sampleSizes: [10, 20, 30],
    sampleSize: 20,
    charInput: "",
    lastResult: null,
    totalChars: 0,
    polyOnly: false,
  },

    onReady() {
    nav.ready();
  },

onLoad() {
    const settings = storage.getSettings();
    const scopes = chars.listScopes();
    this.setData({
      scopes: scopes,
      scopeIndex: settings.scope,
      sampleSize: settings.sampleSize,
      totalChars: chars.allChars.length,
    });
    this.refreshLast();
  },

  onShow() {
    this.refreshLast();
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
            avgValue: "等 " + (Number(last.avgLevel) || 0).toFixed(1),
            avgLevelRound: Math.min(Math.round(Number(last.avgLevel) || 0), 6),
            rank: levels.rankOf(last.mastery),
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
        wx.showToast({ title: "该档位没有多音字", icon: "none" });
        return;
      }
      this.setData({ charInput: pickOne(poly) });
      return;
    }
    this.setData({ charInput: pickOne(pool) });
  },

  startSingle() {
    let ch = (this.data.charInput || "").trim();
    if (!ch) {
      ch = pickOne(chars.getCharsByScope(this.data.scopeIndex));
      this.setData({ charInput: ch });
    }
    if (Array.from(ch).length !== 1) {
      wx.showToast({ title: "请输入一个汉字", icon: "none" });
      return;
    }
    nav.go(
      "/pages/quiz/quiz?mode=single&char=" +
        encodeURIComponent(ch) +
        "&scope=" +
        this.data.scopeIndex,
      "正在准备题目"
    );
  },

  startTest() {
    nav.go(
      "/pages/quiz/quiz?mode=test&scope=" +
        this.data.scopeIndex +
        "&size=" +
        this.data.sampleSize,
      "正在抽题"
    );
  },

  goIntro() {
    nav.go("/pages/intro/intro");
  },

  goHistory() {
    nav.go("/pages/history/history");
  },

  goChars() {
    nav.go("/pages/chars/chars");
  },
});
