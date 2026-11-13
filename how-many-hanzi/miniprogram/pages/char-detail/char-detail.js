const chars = require("../../lib/chars");
const hanzi = require("../../lib/hanzi");
const pinyin = require("../../lib/pinyin");
const storage = require("../../lib/storage");
const levels = require("../../lib/levels");
const i18n = require("../../lib/i18n");
const nav = require("../../lib/nav");
const strokes = require("../../lib/strokes");
const { definePage } = require("../../lib/page-base");

const LEVEL_NAMES = levels.LEVEL_NAMES;
const STROKE_MAX_RETRY = 5;

function deviceDpr() {
  try {
    if (typeof wx !== "undefined" && wx.getWindowInfo) {
      return wx.getWindowInfo().pixelRatio || 1;
    }
    if (typeof wx !== "undefined" && wx.getSystemInfoSync) {
      return wx.getSystemInfoSync().pixelRatio || 1;
    }
  } catch (e) {
    // ignore
  }
  return 1;
}

definePage({
  page: "charDetail",
  titleKey: "pages.charDetail.title",
  data: {
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
    rareDate: "",
    isHidden: false,
    hasPrev: false,
    hasNext: false,
    intoView: "",
    polyText: "",
    strokeStatus: "idle",
    canvasHeightRpx: 0,
  },

  onLoad(options) {
    const rawScope = (options && options.scope) || "";
    const isHidden = rawScope === "hidden";
    this.isHidden = isHidden;
    if (isHidden) {
      this.scope = "hidden";
      this.pool = storage.getRareChars().map((r) => r.char);
      this.rareMap = {};
      storage.getRareChars().forEach((r) => {
        this.rareMap[r.char] = r;
      });
    } else {
      const raw = Number(rawScope) || 0;
      this.scope = Math.min(Math.max(raw, 0), 4);
      this.pool = chars.getCharsByScope(this.scope);
    }
    const ch = decodeURIComponent((options && options.char) || "");
    const idx = Number(options && options.i);
    this.build(ch, isNaN(idx) ? 0 : idx);
  },

  build(ch, index) {
    const lvMap = storage.getCharLevels();
    const lv = lvMap[ch];
    let readings = chars.getReadings(ch);
    if (!readings.length) readings = pinyin.getPinyin(ch);
    const senses = chars.getSenses(ch) || [];
    const strokeNames = hanzi
      .getStrokeNames(ch)
      .map((n) => (n == null ? "" : String(n)))
      .map((s) => s.split("|")[0].replace(/\d+$/, ""))
      .filter((s) => s && s !== "null" && s !== "undefined")
      .map((name, i) => ({ no: i + 1, name: name }));
    const tierIndex = chars.getTierOf(ch);
    const rare = this.isHidden && this.rareMap ? this.rareMap[ch] : null;
    this.viewChar = ch;
    this.setData(
      {
        char: ch,
        scope: this.scope,
        isHidden: !!this.isHidden,
        index: index,
        poolLen: this.pool.length,
        level: lv === undefined ? -1 : lv,
        mark: lv === undefined ? "" : levels.markOf(lv),
        levelName: lv === undefined ? "" : LEVEL_NAMES[lv] || "",
        readings: readings,
        isPoly: readings.length > 1,
        polyText:
          readings.length > 1
            ? i18n.t("pages.charDetail.polyNote", { n: readings.length })
            : "",
        senses: senses,
        explain: chars.getExplain(ch),
        radical: chars.getRadical(ch),
        strokes: chars.getStrokeCount(ch),
        strokeNames: strokeNames,
        words: hanzi.getWords(ch).slice(0, 12),
        tierName: tierIndex >= 0 ? chars.tierNames[tierIndex] : "",
        rareDate: rare && rare.dateText ? rare.dateText : "",
        hasPrev: index > 0,
        hasNext: index < this.pool.length - 1,
      },
      () => {
        this.setData({ intoView: "detail-top" });
      }
    );
    this.loadStroke(ch);
  },

  onReady() {
    if (this.data.strokeStatus === "ready") this.drawStrokeCanvas(0);
  },

  loadStroke(ch) {
    if (!ch) return;
    const self = this;
    const seq = (this.strokeSeq = (this.strokeSeq || 0) + 1);
    this.strokeData = null;
    this.setData({ strokeStatus: "loading", canvasHeightRpx: 0 });

    strokes.load(ch).then(
      function (data) {
        if (seq !== self.strokeSeq) return;
        self.strokeData = data;
        self.setData(
          {
            strokeStatus: "ready",
            canvasHeightRpx: strokes.heightRpx(data.strokes.length),
          },
          function () {
            if (seq === self.strokeSeq) self.drawStrokeCanvas(0);
          }
        );
      },
      function (err) {
        if (seq !== self.strokeSeq) return;
        self.strokeData = null;
        self.setData({
          strokeStatus: err && err.missing ? "missing" : "error",
          canvasHeightRpx: 0,
        });
      }
    );
  },

  retryStrokes() {
    this.loadStroke(this.data.char);
  },

  goStrokePlay(start) {
    nav.go(
      "/pages/stroke-play/stroke-play?char=" +
        encodeURIComponent(this.data.char) +
        "&start=" +
        (Number(start) || 0)
    );
  },

  // 点任意字格 → 从该格笔画开始播放书写动画。
  onStrokeCellTap(e) {
    if (this.data.strokeStatus !== "ready" || !this.strokeLayout) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch || touch.x == null || touch.y == null) return;
    const index = strokes.hitCell(
      this.strokeLayout,
      touch.x,
      touch.y,
      this.strokeData ? this.strokeData.strokes.length : 0
    );
    if (index >= 0) this.goStrokePlay(index);
  },

  drawStrokeCanvas(retry) {
    const self = this;
    const attempt = retry || 0;
    if (!this.strokeData) return;
    if (typeof wx === "undefined" || !wx.createSelectorQuery) return;

    wx.createSelectorQuery()
      .in(this)
      .select("#strokeCanvas")
      .fields({ node: true, size: true })
      .exec(function (res) {
        const info = res && res[0];
        if (
          !info ||
          !info.node ||
          !info.width ||
          !info.height
        ) {
          if (attempt < STROKE_MAX_RETRY) {
            setTimeout(function () {
              self.drawStrokeCanvas(attempt + 1);
            }, 80);
          }
          return;
        }
        const canvas = info.node;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = deviceDpr();
        canvas.width = Math.round(info.width * dpr);
        canvas.height = Math.round(info.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        self.strokeLayout = strokes.cellLayout(info.width);
        strokes.draw({
          ctx: ctx,
          width: info.width,
          height: info.height,
          data: self.strokeData,
          names: (self.data.strokeNames || []).map(function (item) {
            return item.name;
          }),
        });
      });
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
});
