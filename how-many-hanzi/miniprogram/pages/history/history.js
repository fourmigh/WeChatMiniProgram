const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

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
  const md =
    parts.length === 3
      ? i18n.t("pages.history.monthDay", {
          m: Number(parts[1]),
          d: Number(parts[2]),
        })
      : key;
  if (key === today) return i18n.t("pages.history.today", { md: md });
  if (key === yesterday) return i18n.t("pages.history.yesterday", { md: md });
  if (!key) return i18n.t("pages.history.unknownDate");
  return md;
}

definePage({
  page: "history",
  titleKey: "pages.history.title",
  data: {
    list: [],
    hasData: false,
    days: [],
    hasDays: false,
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
        avgValue: i18n.t("common.levelValue", { value: avg.toFixed(1) }),
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
      i18n.t("common.navPreparing")
    );
  },

  goChars() {
    nav.go("/pages/chars/chars");
  },

  deleteRecord(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const self = this;
    wx.showModal({
      title: i18n.t("pages.history.modalDeleteTitle"),
      content: i18n.t("pages.history.modalDeleteContent"),
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
      title: i18n.t("pages.history.modalClearTitle"),
      content: i18n.t("pages.history.modalClearContent"),
      success(res) {
        if (res.confirm) {
          storage.clearAll();
          self.load();
        }
      },
    });
  },
});
