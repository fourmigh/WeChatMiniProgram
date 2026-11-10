const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const charsLib = require("../../lib/chars");
const progress = require("../../lib/progress");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const LEVEL_NAMES = levels.LEVEL_NAMES;

definePage({
  page: "chars",
  titleKey: "pages.chars.title",
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
    rareCount: 0,
    subtitle: "",
    emptyRare: "",
  },

  onShow() {
    this.load();
  },

  load() {
    const charLevels = storage.getCharLevels();
    const list = Object.keys(charLevels)
      .filter((ch) => charsLib.getTierOf(ch) >= 0)
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
    const validLevels = {};
    list.forEach((c) => {
      validLevels[c.char] = c.level;
    });
    const prog = progress.calcProgress(validLevels, totalChars);
    const rareCount = storage.getRareChars().length;

    this.setData({
      count: list.length,
      dist: dist,
      groups: groups,
      hasData: list.length > 0,
      totalChars: prog.total,
      coverage: prog.coverage,
      mastery: prog.mastery,
      rank: prog.rank,
      rareCount: rareCount,
      subtitle: i18n.t("pages.chars.subtitle", { n: list.length }),
      emptyRare: rareCount
        ? i18n.t("pages.chars.emptyRare", { n: rareCount })
        : "",
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
      i18n.t("common.navPreparing")
    );
  },

  deleteChar(e) {
    const ch = e.currentTarget.dataset.char;
    const self = this;
    wx.showModal({
      title: i18n.t("pages.chars.modalDeleteTitle"),
      content: i18n.t("pages.chars.modalDeleteContent", { char: ch }),
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
      title: i18n.t("pages.chars.modalClearTitle"),
      content: i18n.t("pages.chars.modalClearContent"),
      success(res) {
        if (res.confirm) {
          storage.clearAll();
          self.setData({ manage: false });
          self.load();
        }
      },
    });
  },

  goRare() {
    nav.go("/pages/chars-list/chars-list?scope=hidden");
  },
});
