let locked = false;

function go(url) {
  if (locked) return;
  locked = true;
  wx.navigateTo({
    url: url,
    complete() {
      locked = false;
    },
    fail(err) {
      console.warn("[nav] navigateTo failed:", err && err.errMsg);
    },
  });
}

function relaunch(url) {
  const pages =
    typeof getCurrentPages === "function" ? getCurrentPages() : [];
  let homeIdx = -1;
  for (let i = 0; i < pages.length; i++) {
    if (pages[i] && pages[i].route === "pages/index/index") {
      homeIdx = i;
      break;
    }
  }
  if (homeIdx > -1) {
    wx.navigateBack({
      delta: Math.max(1, pages.length - 1 - homeIdx),
      fail(err) {
        console.warn("[nav] navigateBack failed:", err && err.errMsg);
      },
    });
    return;
  }
  wx.reLaunch({
    url: url,
    fail(err) {
      console.warn("[nav] reLaunch failed:", err && err.errMsg);
    },
  });
}

// 兜底：清除当前页可能残留的导航栏 loading（跳转时不再主动显示）。
function reset() {
  if (typeof wx !== "undefined" && wx.hideNavigationBarLoading) {
    wx.hideNavigationBarLoading();
  }
}

function ready() {
  reset();
}

module.exports = {
  go,
  relaunch,
  ready,
  reset,
};
