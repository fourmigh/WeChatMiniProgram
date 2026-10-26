const chars = require("../../lib/chars");
const storage = require("../../lib/storage");
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
    this.setData({ lastResult: history[0] || null });
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

  randomChar() {
    const pool = chars.getCharsByScope(this.data.scopeIndex);
    const ch = pickOne(pool);
    this.setData({ charInput: ch });
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
    wx.navigateTo({
      url:
        "/pages/quiz/quiz?mode=single&char=" +
        encodeURIComponent(ch) +
        "&scope=" +
        this.data.scopeIndex,
    });
  },

  startTest() {
    wx.navigateTo({
      url:
        "/pages/quiz/quiz?mode=test&scope=" +
        this.data.scopeIndex +
        "&size=" +
        this.data.sampleSize,
    });
  },

  goIntro() {
    wx.navigateTo({ url: "/pages/intro/intro" });
  },

  goHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
});
