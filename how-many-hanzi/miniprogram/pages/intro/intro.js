const chars = require("../../lib/chars");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const LEVEL_LIST = levels.INTRO_DESC.map((desc, n) => ({
  n: n,
  name: levels.LEVEL_NAMES[n],
  desc: desc,
}));

function buildRanks() {
  const asc = levels.RANKS.slice().reverse();
  const list = asc.map((r, i) => {
    const next = asc[i + 1];
    let range;
    if (!next) range = i18n.t("pages.intro.rangeAtLeast", { n: r.min });
    else if (r.min === 0) range = i18n.t("pages.intro.rangeUnder", { n: next.min });
    else
      range = i18n.t("pages.intro.rangeBetween", {
        a: r.min,
        b: next.min - 1,
      });
    return { name: r.name, desc: r.desc, range: range };
  });
  list.unshift({
    name: levels.RANK_ZERO,
    range: i18n.t("pages.intro.rangeZero", { n: levels.RANK_MIN_CHARS }),
    desc: i18n.t("levels.zero.desc"),
  });
  return list;
}

definePage({
  page: "intro",
  titleKey: "pages.intro.title",
  data: {
    levels: [],
    ranks: [],
    scopes: [],
    total: 0,
    intoView: "",
    subtitle: "",
    scopeNoteAll: "",
    zeroRule: "",
  },

  onReady() {
    if (this.anchor === "rank") {
      this.setData({ intoView: "rank-card" });
    }
  },

  onLoad(options) {
    this.anchor = (options && options.anchor) || "";
    const total = chars.allChars.length;
    this.setData({
      levels: LEVEL_LIST.map((x) =>
        Object.assign({}, x, { mark: levels.markOf(x.n) })
      ),
      ranks: buildRanks(),
      scopes: chars.listScopes(),
      total: total,
      subtitle: i18n.t("pages.intro.subtitle", { n: total }),
      scopeNoteAll: i18n.t("pages.intro.scopeNoteAll", { n: total }),
      zeroRule: i18n.t("pages.intro.rankRuleZero", {
        n: levels.RANK_MIN_CHARS,
        name: levels.RANK_ZERO,
      }),
    });
  },

  openScope(e) {
    const index = Number(e.currentTarget.dataset.index);
    nav.go("/pages/chars-list/chars-list?scope=" + index);
  },
});
