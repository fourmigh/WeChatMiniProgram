function createState() {
  return { showBar: false, barTop: 0, barHeight: 8 };
}

function measure(page) {
  if (typeof wx === "undefined" || typeof wx.createSelectorQuery !== "function") {
    return;
  }
  wx.createSelectorQuery()
    .in(page)
    .select(".body-wrap")
    .boundingClientRect((rect) => {
      if (rect) page.viewportH = rect.height;
    })
    .exec();
}

function onScroll(page, e) {
  const d = (e && e.detail) || {};
  const contentH = Number(d.scrollHeight) || 0;
  const top = Number(d.scrollTop) || 0;
  const vh = page.viewportH || 0;
  if (!contentH || !vh || contentH <= vh + 4) {
    if (page.data.showBar) page.setData({ showBar: false });
    return;
  }
  const thumbPct = Math.max((vh / contentH) * 100, 6);
  const maxTopPct = 100 - thumbPct;
  const denom = contentH - vh;
  const posPct = denom > 0 ? Math.min((top / denom) * maxTopPct, maxTopPct) : 0;
  page.setData({
    showBar: true,
    barTop: Number(posPct.toFixed(2)),
    barHeight: Number(thumbPct.toFixed(2)),
  });
}

module.exports = {
  createState,
  measure,
  onScroll,
};
