const storage = require("../../lib/storage");
const nav = require("../../lib/nav");

Page({
  data: {
    list: [],
    hasData: false,
    recent: [],
    hasRecent: false,
  },

    onReady() {
    nav.ready();
  },

onShow() {
    this.load();
  },

  load() {
    const list = storage.getHistory();
    const recent = storage.getRecentChars();
    this.setData({
      list: list,
      hasData: list.length > 0,
      recent: recent,
      hasRecent: recent.length > 0,
    });
  },

  retryChar(e) {
    const ch = e.currentTarget.dataset.char;
    nav.go(
      "/pages/quiz/quiz?mode=single&char=" + encodeURIComponent(ch) + "&scope=4",
      "正在准备题目"
    );
  },

  goChars() {
    nav.go("/pages/chars/chars");
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },

  deleteRecord(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const self = this;
    wx.showModal({
      title: "删除记录",
      content: "确定删除这条自测记录吗？（不影响已测字库）",
      success(res) {
        if (res.confirm) {
          storage.removeHistoryAt(idx);
          self.load();
        }
      },
    });
  },

  clearAll() {
    const self = this;
    wx.showModal({
      title: "清空全部",
      content: "将清空自测历史、最近测过的字与全部字库记录，确定吗？",
      success(res) {
        if (res.confirm) {
          storage.clearAll();
          self.load();
        }
      },
    });
  },
});
