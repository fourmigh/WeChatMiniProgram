const strokes = require("../../lib/strokes");
const hanzi = require("../../lib/hanzi");
const storage = require("../../lib/storage");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const STAGE_RPX = 638;
const MIN_DURATION = 300;
const MAX_DURATION = 3000;
const DEFAULT_DURATION = 2000;
const MAX_CANVAS_RETRY = 5;
const PAUSE_MS = 600; // 逐笔播放时每笔之间的停顿

function clamp(v, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function formatDuration(ms) {
  return (Number(ms) / 1000).toFixed(1) + "s";
}

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
  page: "strokePlay",
  titleKey: "pages.strokePlay.title",
  data: {
    char: "",
    status: "loading",
    strokeNames: [],
    total: 0,
    cursor: 0,
    duration: DEFAULT_DURATION,
    durationText: "2.0s",
    pause: true,
    caption: "",
    stageRpx: STAGE_RPX,
  },

  onLoad(options) {
    const ch = decodeURIComponent((options && options.char) || "");
    const settings = storage.getSettings();
    const duration = clamp(
      settings.strokeDuration,
      MIN_DURATION,
      MAX_DURATION
    );
    this.pauseMs = PAUSE_MS;
    this.pauseOn = settings.strokePause !== false;
    this.startIndex = Math.max(0, Number(options && options.start) || 0);
    this.setData({
      char: ch,
      duration: duration,
      durationText: formatDuration(duration),
      pause: this.pauseOn,
    });
    this.loadChar(ch);
  },

  onHide() {
    this.token = (this.token || 0) + 1;
    this.stopAnim();
  },

  onUnload() {
    this.token = (this.token || 0) + 1;
    this.stopAnim();
  },

  ready() {
    return this.data.status === "ready" && !!this.layer;
  },

  loadChar(ch) {
    if (!ch) {
      this.setData({ status: "error" });
      return;
    }
    const self = this;
    const seq = (this.seq = (this.seq || 0) + 1);
    this.setData({ status: "loading" });

    strokes.load(ch).then(
      function (data) {
        if (seq !== self.seq) return;
        self.strokeData = data;
        const rawNames = hanzi.getStrokeNames(ch);
        const list = [];
        for (let i = 0; i < data.strokes.length; i++) {
          const raw = rawNames[i] == null ? "" : String(rawNames[i]);
          list.push({
            no: i + 1,
            name: raw.split("|")[0].replace(/\d+$/, ""),
          });
        }
        self.setData(
          {
            status: "ready",
            total: data.strokes.length,
            strokeNames: list,
            cursor: 0,
          },
          function () {
            if (seq === self.seq) self.initCanvas(0);
          }
        );
      },
      function (err) {
        if (seq !== self.seq) return;
        self.setData({
          status: err && err.missing ? "missing" : "error",
        });
      }
    );
  },

  retry() {
    this.loadChar(this.data.char);
  },

  initCanvas(attempt) {
    const self = this;
    if (typeof wx === "undefined" || !wx.createSelectorQuery) return;
    wx.createSelectorQuery()
      .in(this)
      .select("#playCanvas")
      .fields({ node: true, size: true })
      .exec(function (res) {
        const info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          if (attempt < MAX_CANVAS_RETRY) {
            setTimeout(function () {
              self.initCanvas(attempt + 1);
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

        self.layer = {
          canvas: canvas,
          ctx: ctx,
          width: info.width,
          height: info.height,
        };
        self.parsed = strokes.parseStrokes(self.strokeData);
        self.writeAt(self.startIndex || 0);
      });
  },

  stopAnim() {
    if (this.anim && this.anim.cancel) this.anim.cancel();
    this.anim = null;
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  },

  renderStatic(outlineCurrent, doneCount) {
    const layer = this.layer;
    if (!layer) return;
    const box = Math.min(layer.width, layer.height);
    const done = typeof doneCount === "number" ? doneCount : this.data.cursor;
    this.mapPoint = strokes.drawCell({
      ctx: layer.ctx,
      x: 0,
      y: 0,
      w: layer.width,
      h: layer.height,
      box: box,
      k: layer.width / strokes.DESIGN_W,
      parsed: this.parsed,
      current: done,
      outlineCurrent: outlineCurrent,
    });
    this.updateCaption();
  },

  updateCaption() {
    const index = this.data.cursor;
    const item = this.data.strokeNames[index];
    const name = item ? item.name : "";
    const prefix = i18n.t("pages.strokePlay.strokePrefix", { n: index + 1 });
    this.setData({ caption: name ? prefix + " · " + name : prefix });
  },

  // 只写第 index 笔，写完即停（进入页面、点选、重写、下一笔共用）。
  writeAt(index) {
    if (!this.parsed || !this.layer) return;
    const total = this.parsed.length;
    const i = clamp(index, 0, total - 1);
    this.stopAnim();
    const token = (this.token = (this.token || 0) + 1);
    const self = this;
    this.setData({ cursor: i }, function () {
      if (token !== self.token) return;
      self.renderStatic(false);
      self.writeCurrent(token, false);
    });
  },

  writeCurrent(token, continueAfter) {
    const layer = this.layer;
    const index = this.data.cursor;
    if (!layer || !this.parsed || !this.parsed[index]) return;
    const self = this;
    this.anim = strokes.animateStroke({
      canvas: layer.canvas,
      ctx: layer.ctx,
      medians: this.strokeData.medians || [],
      index: index,
      parsed: this.parsed,
      mapPoint: function (px, py) {
        return self.mapPoint(px, py);
      },
      box: Math.min(layer.width, layer.height),
      duration: this.data.duration,
      color: strokes.COLORS.current,
      finishColor: strokes.COLORS.done,
      onDone: function () {
        if (token !== self.token) return;
        self.anim = null;
        // 整格重画：刚写完的笔按已完成墨迹渲染，同时清除书写轨迹
        self.renderStatic(false, index + 1);
        if (!continueAfter) return;
        const next = index + 1;
        if (next >= self.parsed.length) return;
        const go = function () {
          if (token !== self.token) return;
          self.pauseTimer = null;
          self.setData({ cursor: next }, function () {
            if (token !== self.token) return;
            self.renderStatic(false);
            self.writeCurrent(token, true);
          });
        };
        const pause = Number(self.pauseMs) || 0;
        if (self.pauseOn && pause > 0) {
          self.pauseTimer = setTimeout(go, pause);
        } else {
          go();
        }
      },
    });
  },

  // 重播整字：从第 1 笔开始，按「笔间停顿」开关的节奏播放。
  replay() {
    if (!this.parsed || !this.layer) return;
    this.stopAnim();
    const token = (this.token = (this.token || 0) + 1);
    const self = this;
    this.setData({ cursor: 0 }, function () {
      if (token !== self.token) return;
      self.renderStatic(false);
      self.writeCurrent(token, true);
    });
  },

  // 重写此笔：只写当前一笔，写完停下。
  rewriteStroke() {
    if (!this.ready()) return;
    this.writeAt(this.data.cursor);
  },

  nextStroke() {
    if (!this.ready()) return;
    const total = this.data.total;
    if (this.data.cursor >= total - 1) return;
    this.writeAt(this.data.cursor + 1);
  },

  prevStroke() {
    if (!this.ready()) return;
    this.stopAnim();
    const token = (this.token = (this.token || 0) + 1);
    const self = this;
    this.setData({ cursor: Math.max(0, this.data.cursor - 1) }, function () {
      if (token !== self.token) return;
      self.renderStatic(true);
    });
  },

  selectStroke(e) {
    if (!this.ready()) return;
    const index = Number(e.currentTarget.dataset.index);
    this.writeAt(index);
  },

  onCanvasTouchEnd(e) {
    if (!this.ready() || !this.mapPoint) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch || touch.x == null || touch.y == null) return;
    const box = Math.min(this.layer.width, this.layer.height);
    const hit = strokes.hitTest(
      this.strokeData.medians || [],
      this.mapPoint,
      touch.x,
      touch.y,
      box * 0.12
    );
    if (hit >= 0) this.writeAt(hit);
  },

  onPauseChange(e) {
    const on = !!(e && e.detail && e.detail.value);
    this.pauseOn = on;
    storage.saveSettings({ strokePause: on });
    this.setData({ pause: on });
  },

  onDurationChanging(e) {
    const value = clamp(e.detail.value, MIN_DURATION, MAX_DURATION);
    this.setData({ duration: value, durationText: formatDuration(value) });
  },

  onDurationChange(e) {
    const value = clamp(e.detail.value, MIN_DURATION, MAX_DURATION);
    storage.saveSettings({ strokeDuration: value });
    this.setData({ duration: value, durationText: formatDuration(value) });
  },
});
