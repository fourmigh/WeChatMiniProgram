const storage = require("../../lib/storage");
const nav = require("../../lib/nav");

const LEVEL_NAMES = ["未识", "识形", "知音", "全音", "明义", "能写", "善用", "通源"];

Page({
  data: {
    count: 0,
    dist: [],
    groups: [],
    hasData: false,
    manage: false,
  },

  onReady() {
    nav.ready();
  },

  onShow() {
    this.load();
  },

  load() {
    const levels = storage.getCharLevels();
    const chars = Object.keys(levels)
      .map((ch) => ({ char: ch, level: levels[ch] }))
      .sort((a, b) => (a.char < b.char ? -1 : a.char > b.char ? 1 : 0));

    const counts = [0, 0, 0, 0, 0, 0, 0, 0];
    chars.forEach((c) => counts[c.level]++);
    const max = Math.max.apply(null, counts.concat([1]));
    const dist = counts.map((c, level) => ({
      level: level,
      count: c,
      pct: Math.round((c / max) * 100),
    }));

    const groups = [];
    for (let lv = 7; lv >= 0; lv--) {
      const list = chars.filter((c) => c.level === lv);
      if (!list.length) continue;
      groups.push({ level: lv, name: LEVEL_NAMES[lv], chars: list });
    }

    this.setData({
      count: chars.length,
      dist: dist,
      groups: groups,
      hasData: chars.length > 0,
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
