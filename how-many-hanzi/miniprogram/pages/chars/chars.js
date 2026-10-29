const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const charsLib = require("../../lib/chars");

const LEVEL_NAMES = ["未识", "识形", "读音", "明义", "能写", "善用", "通源"];

Page({
  data: {
    count: 0,
    dist: [],
    groups: [],
    hasData: false,
    manage: false,
    totalChars: 0,
    coverage: 0,
    mastery: 0,
    rank: "",
  },

  onReady() {
    nav.ready();
  },

  onShow() {
    this.load();
  },

  load() {
    const charLevels = storage.getCharLevels();
    const list = Object.keys(charLevels)
      .map((ch) => ({
        char: ch,
        level: charLevels[ch],
        mark: levels.markOf(charLevels[ch]),
      }))
      .sort((a, b) => (a.char < b.char ? -1 : a.char > b.char ? 1 : 0));

    const counts = [0, 0, 0, 0, 0, 0, 0];
    list.forEach((c) => {
      if (counts[c.level] !== undefined) counts[c.level]++;
    });
    const max = Math.max.apply(null, counts.concat([1]));
    const dist = counts.map((c, lv) => ({
      level: lv,
      mark: levels.markOf(lv),
      count: c,
      pct: Math.round((c / max) * 100),
    }));

    const groups = [];
    for (let lv = 6; lv >= 0; lv--) {
      const g = list.filter((c) => c.level === lv);
      if (!g.length) continue;
      groups.push({ level: lv, mark: levels.markOf(lv), name: LEVEL_NAMES[lv], chars: g });
    }

    const totalChars = charsLib.allChars.length;
    let sum = 0;
    list.forEach((c) => {
      sum += c.level;
    });
    const coverage = list.length
      ? Math.round((list.length / totalChars) * 10000) / 100
      : 0;
    const depth = list.length ? sum / (list.length * 6) : 0;
    const confidence = list.length ? Math.sqrt(list.length / totalChars) : 0;
    const mastery = Math.round(depth * confidence * 100);
    const rank = levels.rankOf(mastery);

    this.setData({
      count: list.length,
      dist: dist,
      groups: groups,
      hasData: list.length > 0,
      totalChars: totalChars,
      coverage: coverage,
      mastery: mastery,
      rank: rank,
    });
  },

  toggleManage() {
    this.setData({ manage: !this.data.manage });
  },

  onMiniTap(e) {
    if (this.data.manage) {
      this.deleteChar(e);
      return;
    }
    const ch = e.currentTarget.dataset.char;
    nav.go(
      "/pages/quiz/quiz?mode=single&char=" + encodeURIComponent(ch) + "&scope=4",
      "正在准备题目"
    );
  },

  deleteChar(e) {
    const ch = e.currentTarget.dataset.char;
    const self = this;
    wx.showModal({
      title: "删除记录",
      content: '确定删除「' + ch + '」的记录吗？',
      success(res) {
        if (res.confirm) {
          storage.removeChar(ch);
          self.load();
          if (self.data.count === 0 && self.data.manage) {
            self.setData({ manage: false });
          }
        }
      },
    });
  },

  clearChars() {
    const self = this;
    wx.showModal({
      title: "清空全部",
      content: "将清空自测历史、最近测过的字与全部字库记录，确定吗？",
      success(res) {
        if (res.confirm) {
          storage.clearAll();
          self.setData({ manage: false });
          self.load();
        }
      },
    });
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },
});
