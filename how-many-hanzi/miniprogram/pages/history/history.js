const storage = require("../../lib/storage");

Page({
  data: {
    list: [],
    hasData: false,
  },

  onShow() {
    this.load();
  },

  load() {
    const list = storage.getHistory();
    this.setData({
      list: list,
      hasData: list.length > 0,
    });
  },

  clearAll() {
    const self = this;
    wx.showModal({
      title: "清空记录",
      content: "确定要清空全部自测历史吗？",
      success(res) {
        if (res.confirm) {
          storage.clearHistory();
          self.load();
        }
      },
    });
  },
});
