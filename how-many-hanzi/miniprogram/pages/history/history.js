const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const scrollbar = require("../../lib/scrollbar");
const levels = require("../../lib/levels");

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function dayKey(dateText) {
  const s = String(dateText || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  return "";
}

function dayLabel(key) {
  const now = new Date();
  const today = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
  const y = new Date(now.getTime() - 86400000);
  const yesterday = y.getFullYear() + "-" + pad2(y.getMonth() + 1) + "-" + pad2(y.getDate());
  const parts = key.split("-");
  const md = parts.length === 3 ? Number(parts[1]) + "月" + Number(parts[2]) + "日" : key;
  if (key === today) return "今天 · " + md;
  if (key === yesterday) return "昨天 · " + md;
  if (!key) return "未知日期";
  return md;
}

Page({
  data: {
    list: [],
    hasData: false,
    days: [],
    hasDays: false,
  },

  onReady() {
    nav.ready();
    this.setData(scrollbar.createState());
    scrollbar.measure(this);
  },

  onShow() {
    this.load();
  },

  load() {
    const list = storage.getHistory().map((h) => {
      const avg = Number(h.avgLevel) || 0;
      return Object.assign({}, h, {
        avgText: levels.avgText(avg),
        avgMark: levels.markOf(Math.min(Math.round(avg), 6)),
        avgLevelRound: Math.min(Math.round(avg), 6),
        avgValue: "等 " + avg.toFixed(1),
      });
    });
    const recent = storage.getRecentChars();

    const dayMap = {};
    const dayOrder = [];
    recent.forEach((r) => {
      const key = dayKey(r.dateText);
      if (!dayMap[key]) {
        dayMap[key] = { day: key, label: dayLabel(key), chars: [] };
        dayOrder.push(key);
      }
      dayMap[key].chars.push(
        Object.assign({}, r, { mark: levels.markOf(r.level) })
      );
    });

    this.setData({
      list: list,
      hasData: list.length > 0,
      days: dayOrder.map((k) => dayMap[k]),
      hasDays: dayOrder.length > 0,
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

  onScroll(e) {
    scrollbar.onScroll(this, e);
  },
});
