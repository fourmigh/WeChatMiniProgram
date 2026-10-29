const chars = require("../../lib/chars");
const hanzi = require("../../lib/hanzi");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const scrollbar = require("../../lib/scrollbar");

const LEVEL_NAMES = ["未识", "识形", "读音", "明义", "能写", "善用", "通源"];

Page({
  data: Object.assign(
    {
      char: "",
      scope: 0,
      index: 0,
      poolLen: 0,
      level: -1,
      mark: "",
      levelName: "",
      readings: [],
      isPoly: false,
      senses: [],
      explain: "",
      radical: "",
      strokes: 0,
      strokeNames: [],
      words: [],
      tierName: "",
      hasPrev: false,
      hasNext: false,
      intoView: "",
    },
    scrollbar.createState()
  ),

  onReady() {
    nav.ready();
    scrollbar.measure(this);
  },

  onScroll(e) {
    scrollbar.onScroll(this, e);
  },

  onLoad(options) {
    const raw = Number((options && options.scope) || 0);
    this.scope = Math.min(Math.max(raw, 0), 4);
    this.pool = chars.getCharsByScope(this.scope);
    const ch = decodeURIComponent((options && options.char) || "");
    const idx = Number(options && options.i);
    this.build(ch, isNaN(idx) ? 0 : idx);
  },

  build(ch, index) {
    const lvMap = storage.getCharLevels();
    const lv = lvMap[ch];
    const readings = chars.getReadings(ch);
    const senses = chars.getSenses(ch) || [];
    const strokeNames = hanzi
      .getStrokeNames(ch)
      .map((n) => String(n).split("|")[0].replace(/\d+$/, ""))
      .filter(Boolean)
      .map((name, i) => ({ no: i + 1, name: name }));
    const tierIndex = chars.getTierOf(ch);
    this.viewChar = ch;
    this.setData(
      {
        char: ch,
        scope: this.scope,
        index: index,
        poolLen: this.pool.length,
        level: lv === undefined ? -1 : lv,
        mark: lv === undefined ? "" : levels.markOf(lv),
        levelName: lv === undefined ? "" : LEVEL_NAMES[lv] || "",
        readings: readings,
        isPoly: readings.length > 1,
        senses: senses,
        explain: chars.getExplain(ch),
        radical: chars.getRadical(ch),
        strokes: chars.getStrokeCount(ch),
        strokeNames: strokeNames,
        words: hanzi.getWords(ch).slice(0, 12),
        tierName: tierIndex >= 0 ? chars.tierNames[tierIndex] : "",
        hasPrev: index > 0,
        hasNext: index < this.pool.length - 1,
      },
      () => {
        this.setData({ intoView: "detail-top" });
      }
    );
  },

  goPrev() {
    if (!this.data.hasPrev) return;
    const next = this.data.index - 1;
    this.build(this.pool[next], next);
  },

  goNext() {
    if (!this.data.hasNext) return;
    const next = this.data.index + 1;
    this.build(this.pool[next], next);
  },

  onUnload() {
    if (!this.viewChar) return;
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && typeof prev.setPendingChar === "function") {
      prev.setPendingChar(this.viewChar);
    }
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },
});
