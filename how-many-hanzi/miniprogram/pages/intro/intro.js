const chars = require("../../lib/chars");
const nav = require("../../lib/nav");
const scrollbar = require("../../lib/scrollbar");
const levels = require("../../lib/levels");

const LEVEL_LIST = [
  { n: 0, name: "未识", desc: "还不能稳定辨认这个字。" },
  { n: 1, name: "识形", desc: "能从形近字中认出目标字，对字形有印象。" },
  { n: 2, name: "读音", desc: "知道它的读音；多音字需选出全部常见读音。" },
  { n: 3, name: "明义", desc: "明白主要含义；多音字按读音对应不同意思。" },
  { n: 4, name: "能写", desc: "掌握笔顺，能够正确书写。" },
  { n: 5, name: "善用", desc: "能辨认包含它的词语，会组词运用。" },
  { n: 6, name: "通源", desc: "了解它的部首与构字来源。" },
];

function buildRanks() {
  const asc = levels.RANKS.slice().reverse();
  const list = asc.map((r, i) => {
    const next = asc[i + 1];
    let range;
    if (!next) range = "≥ " + r.min + "%";
    else if (r.min === 0) range = "< " + next.min + "%";
    else range = r.min + "–" + (next.min - 1) + "%";
    return { name: r.name, desc: r.desc, range: range };
  });
  list.unshift({
    name: levels.RANK_ZERO,
    range: "测字 < " + levels.RANK_MIN_CHARS,
    desc: "尚未启蒙",
  });
  return list;
}

Page({
  data: {
    levels: [],
    ranks: [],
    scopes: [],
    total: 0,
    intoView: "",
  },

  onReady() {
    nav.ready();
    this.setData(scrollbar.createState());
    scrollbar.measure(this);
    if (this.anchor === "rank") {
      this.setData({ intoView: "rank-card" });
    }
  },

  onLoad(options) {
    this.anchor = (options && options.anchor) || "";
    this.setData({
      levels: LEVEL_LIST.map((x) =>
        Object.assign({}, x, { mark: levels.markOf(x.n) })
      ),
      ranks: buildRanks(),
      scopes: chars.listScopes(),
      total: chars.allChars.length,
    });
  },

  openScope(e) {
    const index = Number(e.currentTarget.dataset.index);
    nav.go("/pages/chars-list/chars-list?scope=" + index);
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },

  onScroll(e) {
    scrollbar.onScroll(this, e);
  },
});
