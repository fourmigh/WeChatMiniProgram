const strokes = require("../../lib/strokes");
const svgpath = require("../../lib/svgpath");
const letter = require("../../lib/letter");
const storage = require("../../lib/storage");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const MIN_DURATION = 300;
const MAX_DURATION = 3000;
const DEFAULT_DURATION = 800;
const MAX_CANVAS_RETRY = 5;
const CONTENT_RPX = 686; // 750 - 页面左右各 32rpx（信纸/预览同宽）
const MAX_LEN = 300;

// 字号（字面墨迹宽度，rpx）与字距（rpx）：两者共同决定每行字数
const MIN_SIZE_RPX = 45;
const MAX_SIZE_RPX = 200;
const DEFAULT_SIZE_RPX = 95;
const MIN_GAP_RPX = -12;
const MAX_GAP_RPX = 24;
const DEFAULT_GAP_RPX = 8;
const MIN_COLS = 2;
const MAX_COLS = 14;

// 笔顺数据的字面墨迹约占坐标框的比例
const INK_RATIO = 0.88;

// 笔顺字形在坐标框内偏上（底部自带留白），整体略下移，让字底贴近横线
const INK_Y_NUDGE = 0.07;

// 预览示例：马致远《天净沙·秋思》全文（28 字，正好两行 × 最大 14 格）
const PREVIEW_CHARS = "枯藤老树昏鸦小桥流水人家古道西风瘦马夕阳西下断肠人在天涯";

const PAPER_BG = "#FBF7EF";
const PAPER_RULE = "#EDE5D8";
const INK = strokes.COLORS.done;

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

// 字号 + 字距 → 每行字数（格子不超出纸宽）
function colsOf(size, gap) {
  const cell = size + gap;
  if (!(cell > 0)) return 6;
  return clamp(Math.floor(CONTENT_RPX / cell), MIN_COLS, MAX_COLS);
}

// 字号档位：0 小 1 中 2 大 3 特大 4 超大
function sizeLevel(size) {
  if (size <= 70) return 0;
  if (size <= 100) return 1;
  if (size <= 130) return 2;
  if (size <= 165) return 3;
  return 4;
}

// 字距档位：0 极紧 1 紧 2 无 3 窄 4 适中 5 宽
function gapLevel(gap) {
  if (gap <= -6) return 0;
  if (gap < 0) return 1;
  if (gap === 0) return 2;
  if (gap <= 8) return 3;
  if (gap <= 16) return 4;
  return 5;
}

// 1rpx 对应的 px 数：canvas 逻辑坐标是 px，字号要换算后再画。
function rpxFactor() {
  try {
    const info =
      typeof wx !== "undefined" && wx.getWindowInfo
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    const w = (info && info.windowWidth) || 375;
    return w / 750;
  } catch (e) {
    return 0.5;
  }
}

// 整页信纸的舞台高度（rpx）：整屏减去上下留白，底部多留出收起栏的位置。
function paperViewportRpx() {
  try {
    const info =
      typeof wx !== "undefined" && wx.getWindowInfo
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    const w = (info && info.windowWidth) || 375;
    const h = (info && info.windowHeight) || 667;
    return Math.max(800, Math.round((h * 750) / w) - 210);
  } catch (e) {
    return 1200;
  }
}

definePage({
  page: "letter",
  titleKey: "pages.letter.title",
  data: {
    text: "",
    cols: colsOf(DEFAULT_SIZE_RPX, DEFAULT_GAP_RPX),
    duration: DEFAULT_DURATION,
    durationText: "0.8s",
    expanded: true,
    started: false,
    writing: false,
    statusText: "",
    paperHeightRpx: 0,
    scrollTop: 0,
    placeholder: "",
    maxLen: MAX_LEN,
    letterSize: DEFAULT_SIZE_RPX,
    letterGap: DEFAULT_GAP_RPX,
    letterSizeText: "",
    letterGapText: "",
    colsText: "",
  },

  onLoad() {
    const settings = storage.getSettings();
    const rawDuration = Number(settings.letterDuration);
    const duration =
      rawDuration > 0 ? clamp(rawDuration, MIN_DURATION, MAX_DURATION) : DEFAULT_DURATION;
    const rawSize = Number(settings.letterSize);
    const size = rawSize > 0 ? clamp(rawSize, MIN_SIZE_RPX, MAX_SIZE_RPX) : DEFAULT_SIZE_RPX;
    const rawGap = Number(settings.letterGap);
    const gap = isFinite(rawGap) ? clamp(rawGap, MIN_GAP_RPX, MAX_GAP_RPX) : DEFAULT_GAP_RPX;
    const cols = colsOf(size, gap);
    this.setData({
      duration: duration,
      durationText: formatDuration(duration),
      cols: cols,
      colsText: i18n.t("pages.letter.colsValue", { n: cols }),
      letterSize: size,
      letterGap: gap,
      letterSizeText: this.sizeText(size),
      letterGapText: this.gapText(gap),
      placeholder: i18n.t("pages.letter.placeholder"),
    });
  },

  // 信纸常驻：先量好整页高度，画好纸底与预览内容。
  onReady() {
    this.token = this.token || 0;
    this.needWrite = false;
    const self = this;
    const heightRpx = this.paperHeightForRows(this.previewLines().length);
    this.setData({ paperHeightRpx: heightRpx }, function () {
      self.initCanvas(self.token, 0);
    });
  },

  onHide() {
    this.token = (this.token || 0) + 1;
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.stopAnim();
  },

  onUnload() {
    this.token = (this.token || 0) + 1;
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.stopAnim();
  },

  stopAnim() {
    if (this.anim && this.anim.cancel) this.anim.cancel();
    this.anim = null;
  },

  onInput(e) {
    // 保持用户输入原样：改写内容（比如半角空转全角）会让 textarea 重设 value，光标跳到末尾。
    // 空格/制表符在信纸上本来就占一格（letter.isBlank 会识别），无需转换。
    const text = (e && e.detail && e.detail.value) || "";
    if (text !== this.data.text) this.setData({ text: text });
    // 输入内容变化：预览跟着换，不用等滑杆
    this.schedulePreviewDraw();
    return text;
  },

  sizeText(size) {
    const levels = (this.data.T && this.data.T.sizeLevels) || [];
    return levels[sizeLevel(size)] || "";
  },

  gapText(gap) {
    const levels = (this.data.T && this.data.T.gapLevels) || [];
    return levels[gapLevel(gap)] || "";
  },

  // 拖动字号/字距：实时推导每行字数并刷新预览，松手后保存。
  onSizeChanging(e) {
    this.applyStyle(clamp(e.detail.value, MIN_SIZE_RPX, MAX_SIZE_RPX), this.data.letterGap);
  },

  onSizeChange(e) {
    const size = clamp(e.detail.value, MIN_SIZE_RPX, MAX_SIZE_RPX);
    storage.saveSettings({ letterSize: size });
    this.applyStyle(size, this.data.letterGap);
  },

  onGapChanging(e) {
    this.applyStyle(this.data.letterSize, clamp(e.detail.value, MIN_GAP_RPX, MAX_GAP_RPX));
  },

  onGapChange(e) {
    const gap = clamp(e.detail.value, MIN_GAP_RPX, MAX_GAP_RPX);
    storage.saveSettings({ letterGap: gap });
    this.applyStyle(this.data.letterSize, gap);
  },

  // 字号 + 字距决定每行字数，同时决定信纸排版。
  applyStyle(size, gap) {
    const cols = colsOf(size, gap);
    this.setData({
      letterSize: size,
      letterGap: gap,
      letterSizeText: this.sizeText(size),
      letterGapText: this.gapText(gap),
      cols: cols,
      colsText: i18n.t("pages.letter.colsValue", { n: cols }),
    });
    this.refreshPaperPreview();
  },

  onDurationChanging(e) {
    const value = clamp(e.detail.value, MIN_DURATION, MAX_DURATION);
    this.setData({ duration: value, durationText: formatDuration(value) });
  },

  onDurationChange(e) {
    const value = clamp(e.detail.value, MIN_DURATION, MAX_DURATION);
    storage.saveSettings({ letterDuration: value });
    this.setData({ duration: value, durationText: formatDuration(value) });
  },

  toggleControls() {
    // 展开/收起只是把配置面板盖在信纸上或收起，信纸内容保持不动
    this.setData({ expanded: !this.data.expanded });
  },

  // 开始（或重写）：按当前输入与设置重新排版整张信纸。
  startWrite() {
    const lines = letter.parseLines(this.data.text, this.data.cols);
    const total = letter.countWritable(lines);
    if (!total) {
      if (typeof wx !== "undefined" && wx.showToast) {
        wx.showToast({ title: i18n.t("pages.letter.emptyTip"), icon: "none" });
      }
      return;
    }

    this.stopAnim();
    const token = (this.token = (this.token || 0) + 1);
    // 作废尚未完成的预览回调，避免预览字覆盖书写
    this.previewToken = (this.previewToken || 0) + 1;
    this.lines = lines;
    this.total = total;
    this.written = 0;
    this.layer = null;
    this.parsedCache = {};
    // 开始书写：清空纸面后逐字写
    this.needWrite = true;

    // 整页大信纸：内容少时也撑满一屏；顶部留白让首行不贴边
    const paperHeightRpx = this.paperHeightForRows(lines.length);
    this.setData(
      {
        expanded: false,
        started: true,
        writing: true,
        paperHeightRpx: paperHeightRpx,
        scrollTop: 0,
        statusText: i18n.t("pages.letter.writingStatus", { n: 0, m: total }),
      },
      () => {
        if (token === this.token) this.initCanvas(token, 0);
      }
    );
  },

  initCanvas(token, retry) {
    const self = this;
    const attempt = retry || 0;
    if (typeof wx === "undefined" || !wx.createSelectorQuery) return;
    wx.createSelectorQuery()
      .in(this)
      .select("#letterCanvas")
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (token !== self.token) return;
        const info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          if (attempt < MAX_CANVAS_RETRY) {
            setTimeout(function () {
              if (token === self.token) self.initCanvas(token, attempt + 1);
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

        const cellW = self.cellWidthPx();
        self.layer = {
          canvas: canvas,
          ctx: ctx,
          width: info.width,
          height: info.height,
        };
        self.layout = {
          cellW: cellW,
          rowH: self.rowHeightPx(),
          // 整行格子按「最多字数」水平居中：未写满的行也从这个位置起排
          offsetX: self.offsetXFor(info.width),
          // 信纸顶部留白，首行不贴纸上边缘
          padTopPx: self.padTopRpx() * rpxFactor(),
        };
        // 开始书写：清空纸面后逐字写；否则（编辑态）把预览内容铺在纸上
        if (self.needWrite) {
          self.needWrite = false;
          self.drawPaper();
          if (self.lines && self.lines.length) self.writeLoop(token);
        } else {
          self.drawPaperPreview();
        }
      });
  },

  drawPaper() {
    const layer = this.layer;
    if (!layer) return;
    const ctx = layer.ctx;
    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(0, 0, layer.width, layer.height);
    const rowH = this.layout.rowH;
    const padTop = this.layout.padTopPx || 0;
    // 顶部留白区不画横线，首行从 padTop 之后开始
    for (let y = padTop + rowH; y <= layer.height + 0.5; y += rowH) {
      ctx.fillStyle = PAPER_RULE;
      ctx.fillRect(0, Math.round(y) - 1, layer.width, 1);
    }
  },

  // 逐行逐字写字；空白格跳过，写完一个字才写下一个。
  writeLoop(token) {
    const self = this;
    const lines = this.lines;
    let row = 0;
    let col = 0;

    function step() {
      if (token !== self.token) return;
      if (row >= lines.length) {
        self.finishWriting(token);
        return;
      }
      if (col >= lines[row].length) {
        self.scrollToRow(row);
        row++;
        col = 0;
        setTimeout(step, 0);
        return;
      }
      const ch = lines[row][col];
      const r = row;
      const c = col;
      col++;
      if (letter.isBlank(ch)) {
        step();
        return;
      }
      self.writeChar(ch, r, c, token).then(step, step);
    }

    step();
  },

  writeChar(ch, row, col, token) {
    const self = this;
    return strokes.load(ch).then(
      function (data) {
        if (token !== self.token) return;
        const parsed = data.strokes.map(function (d) {
          return svgpath.parsePath(d);
        });
        self.cacheGlyph(row, col, parsed);
        return new Promise(function (resolve) {
          self.writeStrokes(
            parsed,
            data.medians || [],
            row,
            col,
            token,
            0,
            resolve
          );
        }).then(function () {
          if (token !== self.token) return;
          self.redrawCell(row, col, parsed);
          self.markProgress();
        });
      },
      function () {
        if (token !== self.token) return;
        // 没有笔顺数据（生僻字、标点等）：直接用字体写上
        self.cacheGlyph(row, col, ch);
        self.drawFallbackChar(ch, row, col);
        self.markProgress();
      }
    );
  },

  writeStrokes(parsed, medians, row, col, token, index, done) {
    const self = this;
    if (token !== this.token) return done();
    if (index >= parsed.length) return done();
    this.anim = strokes.animateStroke({
      canvas: this.layer.canvas,
      ctx: this.layer.ctx,
      medians: medians,
      index: index,
      parsed: parsed,
      mapPoint: this.cellMap(row, col),
      box: this.cellBox(),
      duration: this.data.duration,
      color: INK,
      finishColor: INK,
      onDone: function () {
        if (token !== self.token) return;
        self.writeStrokes(parsed, medians, row, col, token, index + 1, done);
      },
    });
  },

  markProgress() {
    this.written = (this.written || 0) + 1;
    this.setData({
      statusText: i18n.t("pages.letter.writingStatus", {
        n: this.written,
        m: this.total,
      }),
    });
  },

  finishWriting(token) {
    if (token !== this.token) return;
    this.anim = null;
    this.setData({
      writing: false,
      statusText: i18n.t("pages.letter.doneStatus", { m: this.total }),
    });
  },

  scrollToRow(row) {
    if (!this.layout || this.data.expanded) return;
    const padTop = this.layout.padTopPx || 0;
    const top = Math.max(0, padTop + row * this.layout.rowH - this.layout.rowH * 0.5);
    this.setData({ scrollTop: Math.round(top) });
  },

  cellArea(row, col) {
    const cellW = this.layout.cellW;
    return {
      x: col * cellW + (this.layout.offsetX || 0),
      y: row * this.layout.rowH + (this.layout.padTopPx || 0),
      cellW: cellW,
    };
  },

  cellBox() {
    // 用户设置的「字号」是字面墨迹宽度（rpx）；canvas 用 px，按笔顺数据占比反推坐标框
    const sizeRpx = clamp(this.data.letterSize, MIN_SIZE_RPX, MAX_SIZE_RPX);
    return (sizeRpx * rpxFactor()) / INK_RATIO;
  },

  // 横向格子宽 = 字号 + 字距（px），保证调字距时字距精确变化
  cellWidthPx() {
    const cellRpx =
      clamp(this.data.letterSize, MIN_SIZE_RPX, MAX_SIZE_RPX) +
      clamp(this.data.letterGap, MIN_GAP_RPX, MAX_GAP_RPX);
    return cellRpx * rpxFactor();
  },

  // 行高与字距无关，固定为字号的 1.2 倍（px）
  rowHeightPx() {
    const sizeRpx = clamp(this.data.letterSize, MIN_SIZE_RPX, MAX_SIZE_RPX);
    return sizeRpx * 1.2 * rpxFactor();
  },

  // 整行格子在纸内水平居中的左起偏移（px）。按最多字数算，与各行实际字数无关。
  offsetXFor(widthPx) {
    const used = this.data.cols * this.cellWidthPx();
    return Math.max(0, (widthPx - used) / 2);
  },

  // 信纸顶部留白（rpx）：随字号缩放，首行不贴纸边
  padTopRpx() {
    const sizeRpx = clamp(this.data.letterSize, MIN_SIZE_RPX, MAX_SIZE_RPX);
    return Math.round(sizeRpx * 0.8);
  },

  cellMap(row, col) {
    const area = this.cellArea(row, col);
    const box = this.cellBox();
    const origin = this.glyphOrigin(area, box);
    return strokes.cellMapPoint(origin.x, origin.y, box);
  },

  // 墨迹框在格内的左上角（px）：横向居中，纵向居中后略下移贴近横线
  glyphOrigin(area, box) {
    return {
      x: area.x + (area.cellW - box) / 2,
      y: area.y + (this.layout.rowH - box) / 2 + box * INK_Y_NUDGE,
    };
  },

  // ---------- 单格重画 ----------

  cacheKey(row, col) {
    return row + ":" + col;
  },

  // 缓存已写好的字，供负字距时补画被清格擦到的左邻
  cacheGlyph(row, col, glyph) {
    if (!this.parsedCache) this.parsedCache = {};
    this.parsedCache[this.cacheKey(row, col)] = glyph;
  },

  cachedGlyph(row, col) {
    return this.parsedCache && this.parsedCache[this.cacheKey(row, col)];
  },

  // 单格重画：清掉书写动画的红色残留，再画整字墨迹。
  // 负字距时墨迹会侵入邻格，所以只清「本字墨迹范围」，并补回被擦到的左邻。
  redrawCell(row, col, parsed) {
    const layer = this.layer;
    if (!layer || !parsed) return;
    const area = this.cellArea(row, col);
    const ctx = layer.ctx;
    const box = this.cellBox();
    const pad = (area.cellW - box) / 2;
    const inkX0 = area.x + pad;
    const rowH = this.layout.rowH;

    // 清本字墨迹范围（左右各 2px 余量，清掉描边圆头）
    const clearX0 = inkX0 - 2;
    const clearW = box + 4;
    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(clearX0, area.y, clearW, rowH);
    ctx.fillStyle = PAPER_RULE;
    ctx.fillRect(clearX0, Math.round(area.y + rowH) - 1, clearW, 1);

    this.paintGlyph(row, col, parsed);

    // 左邻墨迹右端 = inkX0 + box - cellW，若伸进清格范围就补画回来
    if (col > 0) {
      const leftInkX1 = inkX0 + box - area.cellW;
      const left = this.cachedGlyph(row, col - 1);
      if (left && leftInkX1 > clearX0) {
        if (typeof left === "string") this.drawFallbackChar(left, row, col - 1);
        else this.paintGlyph(row, col - 1, left);
      }
    }
  },

  paintGlyph(row, col, parsed) {
    const layer = this.layer;
    if (!layer || !parsed) return;
    const ctx = layer.ctx;
    const mapPoint = this.cellMap(row, col);
    for (let i = 0; i < parsed.length; i++) {
      ctx.beginPath();
      svgpath.tracePath(ctx, parsed[i], mapPoint);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  },

  drawFallbackChar(ch, row, col) {
    const layer = this.layer;
    if (!layer) return;
    const area = this.cellArea(row, col);
    const ctx = layer.ctx;
    ctx.fillStyle = INK;
    ctx.font = Math.round(this.cellBox()) + 'px "Kaiti SC", "STKaiti", "KaiTi", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, area.x + area.cellW / 2, area.y + this.layout.rowH / 2);
  },

  // ---------- 编辑态：把内容直接画在信纸上（静态墨迹，不做逐笔动画） ----------

  // 预览排版用的行：输入框有内容时用输入内容，空时用示例词。
  previewLines() {
    const cols = this.data.cols;
    const raw = String(this.data.text || "").trim() ? this.data.text : PREVIEW_CHARS;
    return letter.parseLines(raw, cols);
  },

  // 预览有多少字就排多少格（空行/空格占格但不画字）
  paperGlyphs() {
    const cols = this.data.cols;
    const lines = this.previewLines();
    const glyphs = [];
    for (let r = 0; r < lines.length; r++) {
      const line = lines[r] || [];
      for (let c = 0; c < cols; c++) {
        const ch = line[c];
        // 空位/空白格留纸底，不画字
        glyphs.push(ch && !letter.isBlank(ch) ? ch : null);
      }
    }
    return glyphs;
  },

  // 信纸高度：内容多少行就多高，至少一整页
  paperHeightForRows(rows) {
    const rowRpx = this.data.letterSize * 1.2;
    return Math.max(Math.max(1, rows) * rowRpx + this.padTopRpx(), paperViewportRpx());
  },

  // 输入内容变化：重排信纸预览（防抖）
  schedulePreviewDraw() {
    const self = this;
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(function () {
      self.previewTimer = null;
      self.renderPaperPreview(false);
    }, 60);
  },

  // 字号/字距变化：排版整体变了，重建画布后重画预览（防抖）
  refreshPaperPreview() {
    const self = this;
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(function () {
      self.previewTimer = null;
      self.renderPaperPreview(true);
    }, 60);
  },

  // 按当前内容重排信纸：高度变了或强制重建时重设画布，否则直接覆盖重画
  renderPaperPreview(forceRebuild) {
    if (this.data.writing) return;
    const heightRpx = this.paperHeightForRows(this.previewLines().length);
    this.needWrite = false;
    const self = this;
    const token = this.token || 0;
    if (forceRebuild || heightRpx !== this.data.paperHeightRpx) {
      this.setData({ paperHeightRpx: heightRpx }, function () {
        self.initCanvas(token, 0);
      });
      return;
    }
    this.drawPaperPreview();
  },

  // 在信纸上铺整字墨迹：清空纸面 → 逐格画（笔顺数据/楷体兜底）
  drawPaperPreview() {
    const layer = this.layer;
    if (!layer || this.data.writing) return;
    const token = (this.previewToken = (this.previewToken || 0) + 1);
    this.drawPaper();
    const self = this;
    const glyphs = this.paperGlyphs();
    for (let i = 0; i < glyphs.length; i++) {
      (function (index, ch) {
        if (!ch) return;
        strokes.load(ch).then(
          function (data) {
            if (self.previewToken !== token) return;
            const parsed = data.strokes.map(function (d) {
              return svgpath.parsePath(d);
            });
            self.paintPaperCell(index, parsed);
          },
          function () {
            if (self.previewToken !== token) return;
            self.paintPaperCell(index, null, ch);
          }
        );
      })(i, glyphs[i]);
    }
  },

  // 画一格整字（笔顺墨迹，没有数据时用楷体）
  paintPaperCell(index, parsed, fallbackCh) {
    const layer = this.layer;
    if (!layer) return;
    const cols = this.data.cols;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const area = this.cellArea(row, col);
    const ctx = layer.ctx;
    if (parsed) {
      const box = this.cellBox();
      const origin = this.glyphOrigin(area, box);
      const mapPoint = strokes.cellMapPoint(origin.x, origin.y, box);
      for (let i = 0; i < parsed.length; i++) {
        ctx.beginPath();
        svgpath.tracePath(ctx, parsed[i], mapPoint);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = INK;
    ctx.font = Math.round(this.cellBox()) + 'px "Kaiti SC", "STKaiti", "KaiTi", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fallbackCh, area.x + area.cellW / 2, area.y + this.layout.rowH / 2);
  },
});
