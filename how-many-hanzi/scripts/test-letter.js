const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "miniprogram");
const letter = require(path.join(ROOT, "lib", "letter"));
const strokes = require(path.join(ROOT, "lib", "strokes"));
const svgpath = require(path.join(ROOT, "lib", "svgpath"));

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push("PASS " + name);
  } catch (e) {
    results.push("FAIL " + name + " :: " + (e && e.message));
  }
}

// ---------- 文本排版 ----------
check("parse keeps line breaks", () => {
  const lines = letter.parseLines("你好\n世界", 6);
  assert.deepStrictEqual(lines, [["你", "好"], ["世", "界"]]);
});

check("parse wraps long lines to cols", () => {
  const lines = letter.parseLines("一二三四五六七", 6);
  assert.deepStrictEqual(lines, [["一", "二", "三", "四", "五", "六"], ["七"]]);
});

check("parse keeps empty lines and spaces", () => {
  const lines = letter.parseLines("好\n\n你 好", 6);
  assert.deepStrictEqual(lines, [["好"], [], ["你", " ", "好"]]);
  assert.strictEqual(letter.countWritable(lines), 3);
});

check("blank covers full width space", () => {
  assert.strictEqual(letter.isBlank(" "), true);
  assert.strictEqual(letter.isBlank("\u3000"), true);
  assert.strictEqual(letter.isBlank("好"), false);
});

check("count ignores blanks", () => {
  assert.strictEqual(letter.countWritable(letter.parseLines(" 你 \n\t好 ", 6)), 2);
});

// ---------- 页面 ----------
const store = {};
let mode = "ok";
let requestCount = 0;

const FIXTURE = {
  strokes: [
    "M 100 500 L 900 500 L 900 560 L 100 560 Z",
    "M 450 900 L 520 900 L 520 100 L 450 100 Z",
  ],
  medians: [
    [
      [100, 530],
      [900, 530],
    ],
    [
      [485, 900],
      [485, 100],
    ],
  ],
};

global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  removeStorageSync: (k) => {
    delete store[k];
  },
  getWindowInfo: () => ({ pixelRatio: 2, windowWidth: 375, windowHeight: 667 }),
  setNavigationBarTitle: () => {},
  showToast: () => {},
  request: (opts) => {
    requestCount++;
    if (mode === "404") {
      opts.success({ statusCode: 404, data: {} });
      return;
    }
    opts.success({ statusCode: 200, data: FIXTURE });
  },
};

function fakeCtx() {
  const calls = {
    fill: 0,
    stroke: 0,
    fillRect: 0,
    rects: [],
    text: [],
    styles: [],
    fonts: [],
  };
  return {
    calls,
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    closePath() {},
    fill() {
      calls.fill++;
      calls.styles.push(this.fillStyle);
    },
    stroke() {
      calls.stroke++;
    },
    fillRect(x, y, w, h) {
      calls.fillRect++;
      calls.rects.push([x, y, w, h]);
    },
    fillText(t) {
      calls.text.push(String(t));
    },
    setTransform() {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
    get font() {
      return this._font || "";
    },
    set font(v) {
      this._font = v;
      calls.fonts.push(v);
    },
    textAlign: "",
    textBaseline: "",
  };
}

function queueCanvas() {
  const queue = [];
  return {
    queue,
    requestAnimationFrame(cb) {
      queue.push(cb);
      return queue.length;
    },
    cancelAnimationFrame() {},
    pump(limit) {
      let n = 0;
      const max = limit || 1000;
      while (queue.length && n < max) {
        const cb = queue.shift();
        cb();
        n++;
      }
      return n;
    },
  };
}

function fakeCanvas() {
  const ctx = fakeCtx();
  const q = queueCanvas();
  return {
    width: 0,
    height: 0,
    _ctx: ctx,
    _q: q,
    getContext: () => ctx,
    requestAnimationFrame: (cb) => q.requestAnimationFrame(cb),
    cancelAnimationFrame: (id) => q.cancelAnimationFrame(id),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function drain(canvas, page) {
  for (let i = 0; i < 80; i++) {
    canvas._q.pump(4000);
    if (!canvas._q.queue.length && page.data.writing === false) break;
    await sleep(2);
  }
}

async function testPage() {
  const canvas = fakeCanvas();
  let captured = null;
  let page = null;
  global.Page = (cfg) => {
    captured = cfg;
  };
  global.getCurrentPages = () => [];

  global.wx.createSelectorQuery = () => {
    let selector = "";
    let rect = null;
    const query = {
      in() {
        return query;
      },
      select(s) {
        selector = s;
        return query;
      },
      fields() {
        return query;
      },
      boundingClientRect(cb) {
        rect = cb;
        return query;
      },
      exec(cb) {
        if (rect) {
          rect({ height: 600 });
          rect = null;
          if (cb) cb([]);
          return;
        }
        cb([{ node: canvas, width: 311, height: 200 }]);
      },
    };
    return query;
  };

  mode = "ok";
  const file = path.join(ROOT, "pages", "letter", "letter.js");
  delete require.cache[require.resolve(file)];
  require(file);

  page = Object.create(captured);
  page.data = JSON.parse(JSON.stringify(captured.data || {}));
  page.setData = function (patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === "function") cb.call(this);
  };
  page.onLoad();

  check("letter defaults", () => {
    assert.strictEqual(page.data.letterSize, 95);
    assert.strictEqual(page.data.letterGap, 8);
    assert.strictEqual(page.data.cols, 6);
    assert.strictEqual(page.data.colsText, "每行 6 字");
    assert.strictEqual(page.data.letterSizeText, "中");
    assert.strictEqual(page.data.letterGapText, "窄");
    assert.strictEqual(page.data.duration, 800);
    assert.strictEqual(page.data.durationText, "0.8s");
    assert.strictEqual(page.data.expanded, true);
  });

  check("letter cell box follows font size", () => {
    const expected = (page.data.letterSize * (375 / 750)) / 0.88;
    assert.ok(
      Math.abs(page.cellBox() - expected) < 1e-6,
      "cell box: " + page.cellBox()
    );
  });

  page.onReady();
  await sleep(10);
  // 编辑态：预览内容直接画在信纸上，不再有单独的预览画布
  check("letter paper preview drawn", () => {
    assert.ok(page.layer, "paper layer");
    assert.strictEqual(page.previewLayer, undefined);
    assert.ok(page.previewToken > 0, "preview painted");
    assert.ok(page.layer.ctx.calls.fill > 0, "preview ink");
  });

  // 信纸常驻：onReady 就画好一张整页大纸（配置面板浮在它上面）
  check("letter paper ready before writing", () => {
    assert.ok(page.layer, "paper canvas ready");
    assert.strictEqual(page.data.paperHeightRpx, 1124); // 1334 - 210
    assert.strictEqual(page.data.started, false);
    assert.strictEqual(page.data.writing, false);
    assert.ok(page.layer.ctx.calls.fillRect > 0, "paper drawn");
  });

  // 字号滑杆：拖动时实时推导字数，松手保存
  page.onSizeChanging({ detail: { value: 130 } });
  check("letter size changing derives cols", () => {
    assert.strictEqual(page.data.letterSize, 130);
    assert.strictEqual(page.data.letterGap, 8);
    assert.strictEqual(page.data.cols, 4);
    assert.strictEqual(page.data.letterSizeText, "大");
  });
  page.onSizeChange({ detail: { value: 120 } });
  check("letter size saved", () => {
    assert.strictEqual(store["hmh:settings"].letterSize, 120);
    assert.strictEqual(page.data.letterSizeText, "大");
  });

  // 字距滑杆
  page.onGapChange({ detail: { value: 20 } });
  check("letter gap saved", () => {
    assert.strictEqual(store["hmh:settings"].letterGap, 20);
    assert.strictEqual(page.data.letterGapText, "宽");
    assert.strictEqual(page.data.cols, 4);
  });

  // 负字距：把字挤紧，格宽比墨迹窄
  page.onSizeChange({ detail: { value: 95 } });
  page.onGapChanging({ detail: { value: -12 } });
  check("letter negative gap tightens cells", () => {
    assert.strictEqual(page.data.letterSize, 95);
    assert.strictEqual(page.data.letterGap, -12);
    assert.strictEqual(page.data.letterGapText, "极紧");
    assert.strictEqual(page.data.cols, 8); // floor(686 / (95 - 12))
    assert.ok(page.cellWidthPx() < page.cellBox() * 0.88 * 1.001, "ink wider than cell");
  });
  page.onGapChanging({ detail: { value: -4 } });
  check("letter small negative gap labeled tight", () => {
    assert.strictEqual(page.data.letterGapText, "紧");
  });
  page.onGapChange({ detail: { value: -8 } });
  check("letter negative gap saved", () => {
    assert.strictEqual(store["hmh:settings"].letterGap, -8);
    assert.strictEqual(page.data.letterGap, -8);
  });

  // 回到默认组合：字号 95 + 字距 8 → 每行 6 字
  page.onSizeChange({ detail: { value: 95 } });
  page.onGapChange({ detail: { value: 8 } });
  check("letter cols note follows style", () => {
    assert.strictEqual(page.data.cols, 6);
    assert.strictEqual(page.data.colsText, "每行 6 字");
    assert.strictEqual(page.data.letterSizeText, "中");
    assert.strictEqual(page.data.letterGapText, "窄");
  });

  // 信纸预览默认用示例词（有多少字排多少格）；输入框有内容后换成输入内容，空时回到示例
  check("letter preview defaults to sample poem", () => {
    const glyphs = page.paperGlyphs();
    // 28 字 ÷ 每行 6 字 = 5 行，最后一行补 2 个空格位
    assert.strictEqual(glyphs.length, 30);
    assert.strictEqual(glyphs[0], "枯");
    assert.strictEqual(glyphs[27], "涯");
    assert.strictEqual(glyphs[28], null);
    assert.strictEqual(glyphs[29], null);
  });

  page.onInput({ detail: { value: "你好" } });
  check("letter preview follows input", () => {
    const glyphs = page.paperGlyphs();
    assert.strictEqual(glyphs.length, 6);
    assert.strictEqual(glyphs[0], "你");
    assert.strictEqual(glyphs[1], "好");
    assert.strictEqual(glyphs[2], null);
    assert.ok(glyphs.slice(2).every((ch) => ch === null), "rest blank");
  });

  page.onInput({ detail: { value: "一二三四五六七八九十甲乙丙" } });
  check("letter preview keeps every character", () => {
    const glyphs = page.paperGlyphs();
    // 13 字 → 3 行 × 6 格，不截断
    assert.strictEqual(glyphs.length, 18);
    assert.strictEqual(glyphs[11], "乙");
    assert.strictEqual(glyphs[12], "丙");
  });

  // 内容超出一屏时，信纸跟着变高（可滚动）
  page.onInput({ detail: { value: "字".repeat(60) } });
  await sleep(80);
  check("letter preview grows with content", () => {
    assert.strictEqual(page.previewLines().length, 10);
    assert.strictEqual(page.data.paperHeightRpx, 10 * (95 * 1.2) + 76); // 1216
    assert.ok(page.data.paperHeightRpx > 1124, "taller than one page");
  });

  page.onInput({ detail: { value: "" } });
  check("letter preview restores sample when empty", () => {
    assert.strictEqual(page.paperGlyphs()[0], "枯");
  });

  // 输入内容保持原样（不改写，避免光标跳到末尾）；空格/制表符在信纸上各占一格
  const returned = page.onInput({ detail: { value: "你 好\t吗" } });
  check("letter keeps input as typed", () => {
    assert.strictEqual(page.data.text, "你 好\t吗");
    assert.strictEqual(returned, "你 好\t吗");
  });
  check("letter spaces take a cell", () => {
    const glyphs = page.paperGlyphs();
    assert.strictEqual(glyphs[0], "你");
    assert.strictEqual(glyphs[1], null); // 空格占格但不写
    assert.strictEqual(glyphs[2], "好");
    assert.strictEqual(glyphs[3], null); // 制表符同理
    assert.strictEqual(glyphs[4], "吗");
  });

  page.onDurationChange({ detail: { value: 1200 } });
  check("letter duration saved", () => {
    assert.strictEqual(page.data.duration, 1200);
    assert.strictEqual(page.data.durationText, "1.2s");
    assert.strictEqual(store["hmh:settings"].letterDuration, 1200);
  });

  page.onInput({ detail: { value: "你好\n世界" } });
  page.startWrite();

  check("letter collapses controls on start", () => {
    assert.strictEqual(page.data.started, true);
    assert.strictEqual(page.data.writing, true);
    assert.strictEqual(page.data.expanded, false);
    assert.ok(page.data.paperHeightRpx > 0, "paper height set");
  });

  check("letter paper fills the screen", () => {
    // 内容只有两行，信纸仍应撑满一屏
    assert.ok(
      page.data.paperHeightRpx >= 1000,
      "paper height: " + page.data.paperHeightRpx
    );
  });

  await sleep(10);
  check("letter canvas ready", () => {
    assert.ok(page.layer, "canvas layer");
    assert.ok(page.layout.cellW > 0);
    assert.ok(canvas.width > 0, "dpr applied");
    assert.ok(canvas._ctx.calls.fillRect > 0, "paper drawn");
  });

  check("letter ink fits inside cells", () => {
    // 字号（墨迹宽）不超过格宽，相邻字不会相撞
    assert.ok(page.cellBox() * 0.88 <= page.layout.cellW + 0.01);
  });

  // 字形在坐标框内偏上，墨迹整体略下移：字底贴近横线，字顶不贴上一行
  check("letter glyph sits low in the row", () => {
    const area = page.cellArea(0, 0);
    const box = page.cellBox();
    const origin = page.glyphOrigin(area, box);
    const centered = area.y + (page.layout.rowH - box) / 2;
    assert.ok(origin.y > centered + 0.5, "nudged down from center");
    assert.ok(
      Math.abs(origin.y - (centered + box * 0.07)) < 1e-6,
      "nudge is 7% of ink box"
    );
    // 墨迹框底部允许略低于行底线（字底留白由字形自带）
    assert.ok(
      origin.y + box - (area.y + page.layout.rowH) <= box * 0.08 + 1e-6,
      "bottom stays near the rule"
    );
  });

  // 信纸顶部留白：首行不贴边，横线也整体下移
  check("letter paper has top padding", () => {
    const padTop = page.padTopRpx() * 0.5; // mock 下 rpxFactor = 0.5
    assert.strictEqual(page.padTopRpx(), Math.round(95 * 0.8));
    assert.ok(Math.abs(page.layout.padTopPx - padTop) < 1e-6, "pad top px");
    assert.ok(Math.abs(page.cellArea(0, 0).y - padTop) < 1e-6, "first row y");
    assert.ok(
      Math.abs(page.cellArea(1, 0).y - (padTop + page.layout.rowH)) < 1e-6,
      "second row y"
    );
    assert.ok(
      page.data.paperHeightRpx >= 2 * (95 * 1.2) + page.padTopRpx(),
      "paper height includes pad"
    );
  });

  // 信纸同样按最多字数居中；未写满的行也同一位置起排
  check("letter paper centered by max cols", () => {
    const cellW = page.layout.cellW;
    const cols = page.data.cols;
    const expected = (311 - cols * cellW) / 2;
    assert.ok(
      Math.abs(page.layout.offsetX - expected) < 1e-6,
      "offsetX: " + page.layout.offsetX
    );
    assert.ok(page.layout.offsetX >= 0);
    assert.ok(
      page.cellArea(0, 1).x - page.layout.offsetX <= cellW + 1e-6,
      "cell area shifted"
    );
    assert.ok(
      page.layout.offsetX + cols * cellW <= 311 + 0.01,
      "paper row does not overflow"
    );
  });

  await drain(canvas, page);
  check("letter writes every character", () => {
    assert.strictEqual(page.data.writing, false);
    assert.strictEqual(page.written, 4);
    assert.ok(page.data.statusText.indexOf("4") > -1, page.data.statusText);
    assert.ok(canvas._ctx.calls.fill > 0, "ink drawn");
  });

  check("letter follows current line", () => {
    assert.ok(page.data.scrollTop > 0, "scrolled to second line");
  });

  // 缺笔顺数据的字：用字体直接写上
  mode = "404";
  const before = canvas._ctx.calls.text.length;
  page.onInput({ detail: { value: "龘" } });
  page.startWrite();
  await sleep(10);
  await drain(canvas, page);
  check("letter falls back for missing data", () => {
    assert.strictEqual(page.data.writing, false);
    assert.ok(
      canvas._ctx.calls.text.length > before,
      "fallback character painted"
    );
    assert.ok(canvas._ctx.calls.text.indexOf("龘") > -1);
  });

  // 负字距下单格重画：只清本字墨迹范围，并补画被擦到的左邻
  check("letter redraw protects left neighbor", () => {
    const parsed = [svgpath.parsePath("M 10 10 L 90 10 L 90 90 L 10 90 Z")];
    const savedGap = page.data.letterGap;
    const savedCols = page.data.cols;
    const savedLayout = page.layout;

    page.data.letterGap = -12;
    page.data.cols = 8;
    const cellW = (95 - 12) * (375 / 750);
    page.layout = {
      cellW: cellW,
      rowH: 95 * 1.2 * (375 / 750),
      offsetX: 0,
      padTopPx: 38,
    };
    page.cacheGlyph(0, 0, parsed);

    const rectsBefore = canvas._ctx.calls.rects.length;
    const fillsBefore = canvas._ctx.calls.fill;
    page.redrawCell(0, 1, parsed);

    const rects = canvas._ctx.calls.rects.slice(rectsBefore);
    const box = 95 * (375 / 750) / 0.88;
    const pad = (cellW - box) / 2;
    assert.ok(pad < 0, "ink wider than cell");
    const inkX0 = cellW + pad;
    assert.ok(
      Math.abs(rects[0][0] - (inkX0 - 2)) < 1e-6,
      "clear starts at ink edge: " + rects[0][0]
    );
    assert.ok(
      Math.abs(rects[0][2] - (box + 4)) < 1e-6,
      "clear width hugs ink: " + rects[0][2]
    );
    assert.ok(rects[0][2] > cellW, "clear range is narrower than the cell");
    assert.strictEqual(
      canvas._ctx.calls.fill - fillsBefore,
      2,
      "own glyph + left neighbor"
    );

    page.data.letterGap = savedGap;
    page.data.cols = savedCols;
    page.layout = savedLayout;
  });

  // 收起 / 展开
  page.toggleControls();
  check("letter expands controls", () => {
    assert.strictEqual(page.data.expanded, true);
  });
  page.toggleControls();
  check("letter collapses again", () => {
    assert.strictEqual(page.data.expanded, false);
  });

  // 离开页面立即取消，不再继续写
  mode = "ok";
  page.onInput({ detail: { value: "你好" } });
  page.startWrite();
  await sleep(10);
  canvas._q.pump(5);
  page.onUnload();
  canvas._q.pump(5000);
  check("letter unload stops writing", () => {
    assert.strictEqual(page.anim, null);
    assert.strictEqual(page.data.writing, true, "state untouched after unload");
  });
}

async function run() {
  await testPage();
  const failed = results.filter((r) => r.indexOf("FAIL") === 0);
  console.log(results.join("\n"));
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
