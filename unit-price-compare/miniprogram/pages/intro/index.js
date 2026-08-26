const { getLocale } = require("../../shared/i18n/index");

Page({
  data: {
    _t: getLocale(),
  },
  onAgree() {
    wx.navigateTo({ url: "/pages/index/index" });
  },
  onDisagree() {
    wx.exitMiniProgram({
      success() {},
      fail() {
        wx.showToast({ title: "请点击右上角退出小程序", icon: "none" });
      },
    });
  },
});
