let hideTimer = null;
let shown = false;
const SAFETY_TIMEOUT = 5000;

function show(title) {
  wx.showLoading({ title: title || "加载中", mask: true });
  shown = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, SAFETY_TIMEOUT);
}

function hide() {
  clearTimeout(hideTimer);
  hideTimer = null;
  if (!shown) return;
  shown = false;
  wx.hideLoading();
}

function go(url, title) {
  show(title);
  wx.navigateTo({
    url: url,
    fail(err) {
      console.warn("[nav] navigateTo failed:", err && err.errMsg);
      hide();
    },
  });
}

function relaunch(url, title) {
  show(title);
  wx.reLaunch({
    url: url,
    fail(err) {
      console.warn("[nav] reLaunch failed:", err && err.errMsg);
      hide();
    },
  });
}

function ready() {
  hide();
}

module.exports = {
  go,
  relaunch,
  ready,
};
