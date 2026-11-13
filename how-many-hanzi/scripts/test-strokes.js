const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "miniprogram");
const svgpath = require(path.join(ROOT, "lib", "svgpath"));
const strokes = require(path.join(ROOT, "lib", "strokes"));

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push("PASS " + name);
  } catch (e) {
    results.push("FAIL " + name + " :: " + (e && e.message));
  }
}

// ---------- svg path ----------
check("parse basic commands", () => {
  const cmds = svgpath.parsePath("M 0 0 L 10 0 Q 20 0 20 10 Z");
  assert.deepStrictEqual(cmds, [
    ["M", 0, 0],
    ["L", 10, 0],
    ["Q", 20, 0, 20, 10],
    ["Z"],
  ]);
});

check("parse relative commands", () => {
  const cmds = svgpath.parsePath("m 5 5 l 10 0 v 10 h -10");
  assert.deepStrictEqual(cmds, [
    ["M", 5, 5],
    ["L", 15, 5],
    ["L", 15, 15],
    ["L", 5, 15],
  ]);
});

check("parse implicit lineto after M", () => {
  const cmds = svgpath.parsePath("M0 0 10 0 10 10");
  assert.deepStrictEqual(cmds, [
    ["M", 0, 0],
    ["L", 10, 0],
    ["L", 10, 10],
  ]);
});

check("parse cubic and smooth cubic", () => {
  const cmds = svgpath.parsePath("M0 0 C 1 1 2 2 3 3 S 4 4 5 5");
  assert.deepStrictEqual(cmds[1], ["C", 1, 1, 2, 2, 3, 3]);
  assert.deepStrictEqual(cmds[2], ["C", 4, 4, 4, 4, 5, 5]);
});

// ---------- 绘制 ----------
function fakeCtx() {
  const calls = {
    fill: 0,
    stroke: 0,
    text: [],
    moveTo: 0,
    lineTo: 0,
    styles: [],
    strokeStyles: [],
  };
  return {
    calls,
    clearRect() {},
    beginPath() {},
    moveTo() {
      calls.moveTo++;
    },
    lineTo() {
      calls.lineTo++;
    },
    quadraticCurveTo() {},
    bezierCurveTo() {},
    closePath() {},
    fill() {
      calls.fill++;
      calls.styles.push(this.fillStyle);
    },
    stroke() {
      calls.stroke++;
      calls.strokeStyles.push(this.strokeStyle);
    },
    fillText(t) {
      calls.text.push(String(t));
    },
    setTransform() {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
}

const FIXTURE = {
  strokes: [
    "M 100 500 L 900 500 L 900 560 L 100 560 Z",
    "M 450 900 L 520 900 L 520 100 L 450 100 Z",
  ],
  medians: [
    [[100, 530], [900, 530]],
    [[485, 900], [485, 100]],
  ],
};

check("height layout", () => {
  assert.strictEqual(strokes.heightRpx(0), 0);
  assert.strictEqual(strokes.heightRpx(1), 185);
  assert.strictEqual(strokes.heightRpx(5), 381);
  assert.strictEqual(strokes.heightRpx(9), 578);
});

check("draw grid", () => {
  const ctx = fakeCtx();
  const width = 311;
  const height = strokes.heightRpx(2) / 2; // 622rpx -> 311px
  strokes.draw({
    ctx,
    width,
    height,
    data: FIXTURE,
    names: ["横", "竖"],
  });
  const C = strokes.COLORS;
  // 每格：背景 1 次 + 灰色打底 2 次 + 已完成 + 当前笔
  assert.strictEqual(ctx.calls.fill, 9, "fill calls");
  assert.strictEqual(ctx.calls.stroke, 2, "cell borders");
  assert.deepStrictEqual(ctx.calls.text, ["1", "横", "2", "竖"]);
  // 顺序必须是：灰底 → 墨迹 → 当前笔，当前笔永远最后
  assert.deepStrictEqual(ctx.calls.styles, [
    C.cellBg,
    C.pending,
    C.pending,
    C.current,
    C.cellBg,
    C.pending,
    C.pending,
    C.done,
    C.current,
  ]);
});

check("current stroke on top in every cell", () => {
  const C = strokes.COLORS;
  const ctx = fakeCtx();
  const three = {
    strokes: FIXTURE.strokes.concat([
      "M 200 200 L 800 200 L 800 260 L 200 260 Z",
    ]),
    medians: FIXTURE.medians.concat([[[200, 230], [800, 230]]]),
  };
  strokes.draw({
    ctx,
    width: 311,
    height: strokes.heightRpx(3) / 2,
    data: three,
    names: [],
  });
  let pos = 0;
  for (let i = 0; i < 3; i++) {
    const count = 1 + 3 + i + 1; // 背景 + 灰底 + 已完成 + 当前笔
    const seg = ctx.calls.styles.slice(pos, pos + count);
    pos += count;
    assert.strictEqual(seg[0], C.cellBg, "cell " + i + " bg");
    assert.strictEqual(
      seg[seg.length - 1],
      C.current,
      "cell " + i + " current on top"
    );
    const gray = seg.slice(1, 4);
    const ink = seg.slice(4, -1);
    assert.ok(
      gray.every((s) => s === C.pending),
      "cell " + i + " gray first"
    );
    assert.ok(
      ink.every((s) => s === C.done),
      "cell " + i + " ink after gray"
    );
  }
});

// ---------- 单笔动画 ----------
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

const identity = (x, y) => [x, y];

check("animate stroke draws progressively", () => {
  const ctx = fakeCtx();
  const canvas = queueCanvas();
  let done = 0;
  const anim = strokes.animateStroke({
    canvas,
    ctx,
    medians: FIXTURE.medians,
    index: 0,
    parsed: strokes.parseStrokes(FIXTURE),
    mapPoint: identity,
    box: 1024,
    duration: 100,
    onDone: () => {
      done++;
    },
  });
  assert.ok(canvas.queue.length === 1, "first frame scheduled");
  const frames = canvas.pump();
  assert.ok(frames >= 5, "multiple frames: " + frames);
  assert.strictEqual(done, 1, "onDone once");
  assert.ok(ctx.calls.lineTo >= frames, "line grows every frame");
  assert.strictEqual(ctx.calls.fill, 1, "outline filled at end");
  // 收尾轮廓直接填成「已完成」墨色，写完即视为完成
  assert.strictEqual(ctx.calls.styles[0], strokes.COLORS.done);
  // 书写中的粗线是当前笔红色
  assert.strictEqual(ctx.calls.strokeStyles[0], strokes.COLORS.current);
  // 收尾不再沿中心线重描，书写轨迹之外没有任何描边，由页面整格重画清除
  assert.ok(
    ctx.calls.strokeStyles.every((s) => s === strokes.COLORS.current),
    "only writing trace is stroked"
  );
  assert.strictEqual(ctx.calls.fill, 1, "outline filled once at end");
  anim.cancel();
});

check("animate line width follows stroke shape", () => {
  // 第一笔轮廓 800 长 × 60 宽，中心线 800 → 估算宽度约 60
  const parsed = strokes.parseStrokes(FIXTURE);
  const w = strokes.estimateStrokeWidth(parsed[0], identity, 800);
  assert.ok(Math.abs(w - 60) < 1, "width ~60, got " + w);
  const v = strokes.estimateStrokeWidth(parsed[1], identity, 800);
  assert.ok(Math.abs(v - 70) < 1, "width ~70, got " + v);
  // 缺中心线时返回 0，交由调用方降级
  assert.strictEqual(strokes.estimateStrokeWidth(parsed[0], identity, 0), 0);
});

check("animate stroke keeps width near outline", () => {
  const ctx = fakeCtx();
  const canvas = queueCanvas();
  strokes.animateStroke({
    canvas,
    ctx,
    medians: FIXTURE.medians,
    index: 0,
    parsed: strokes.parseStrokes(FIXTURE),
    mapPoint: identity,
    box: 1024,
    duration: 100,
  });
  canvas.pump();
  assert.ok(ctx.lineWidth > 0, "line width set");
  assert.ok(ctx.lineWidth <= 60, "no thicker than outline: " + ctx.lineWidth);
  assert.strictEqual(ctx.lineCap, "round");
});

check("animate stroke can be cancelled", () => {
  const ctx = fakeCtx();
  const canvas = queueCanvas();
  let done = 0;
  const anim = strokes.animateStroke({
    canvas,
    ctx,
    medians: FIXTURE.medians,
    index: 1,
    parsed: strokes.parseStrokes(FIXTURE),
    mapPoint: identity,
    box: 1024,
    duration: 500,
    onDone: () => {
      done++;
    },
  });
  canvas.pump(3);
  anim.cancel();
  canvas.pump();
  assert.strictEqual(done, 0, "no completion after cancel");
  assert.strictEqual(ctx.calls.fill, 0, "no outline fill after cancel");
  assert.ok(ctx.calls.lineTo > 0, "drew some segments before cancel");
});

check("animate falls back without medians", () => {
  const ctx = fakeCtx();
  const canvas = queueCanvas();
  let done = 0;
  strokes.animateStroke({
    canvas,
    ctx,
    medians: [],
    index: 0,
    parsed: strokes.parseStrokes(FIXTURE),
    mapPoint: identity,
    box: 1024,
    duration: 300,
    onDone: () => {
      done++;
    },
  });
  assert.strictEqual(done, 1, "immediate completion");
  assert.strictEqual(ctx.calls.fill, 1, "outline filled");
});

check("hit test selects nearest stroke", () => {
  const medians = [
    [[100, 500], [900, 500]],
    [[500, 900], [500, 100]],
  ];
  assert.strictEqual(strokes.hitTest(medians, identity, 300, 520, 80), 0);
  assert.strictEqual(strokes.hitTest(medians, identity, 520, 300, 80), 1);
  assert.strictEqual(strokes.hitTest(medians, identity, 20, 20, 80), -1);
});

// ---------- 缓存与网络 ----------
const store = {};
let requestCount = 0;
let mode = "ok";
let lastUrl = "";
let response = FIXTURE;

// 7 笔的假数据：用来验证「肠」的笔顺修正会同时重排 strokes 与 medians
const SEVEN = {
  strokes: Array.from({ length: 7 }, function (_, i) {
    const x = i * 10;
    return "M " + x + " 100 L " + (x + 5) + " 100 L " + (x + 5) + " 110 L " + x + " 110 Z";
  }),
  medians: Array.from({ length: 7 }, function (_, i) {
    return [[i * 10, 105], [i * 10 + 5, 105]];
  }),
};

global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  removeStorageSync: (k) => {
    delete store[k];
  },
  request: (opts) => {
    requestCount++;
    lastUrl = opts.url;
    if (mode === "404") {
      opts.success({ statusCode: 404, data: {} });
      return;
    }
    if (mode === "fail") {
      opts.fail({ errMsg: "network down" });
      return;
    }
    opts.success({ statusCode: 200, data: response });
  },
};

// ---------- 笔顺修正表 ----------
check("stroke order fix swaps wrong pair", () => {
  const fixed = strokes.applyOrderFix("肠", SEVEN);
  const order = [0, 1, 2, 3, 5, 4, 6];
  assert.deepStrictEqual(fixed.strokes, order.map((i) => SEVEN.strokes[i]));
  assert.deepStrictEqual(
    fixed.medians.map((m) => m[0][0]),
    order.map((i) => i * 10)
  );
  assert.strictEqual(SEVEN.strokes[4], fixed.strokes[5], "raw data untouched");
});

check("stroke order fix ignores other chars", () => {
  assert.strictEqual(strokes.applyOrderFix("好", SEVEN), SEVEN);
});

check("stroke order fix ignores unexpected stroke count", () => {
  const two = { strokes: FIXTURE.strokes, medians: FIXTURE.medians };
  assert.strictEqual(strokes.applyOrderFix("肠", two), two);
});

check("stroke order fixes are valid permutations", () => {
  const fixes = strokes.STROKE_ORDER_FIXES;
  for (const ch of Object.keys(fixes)) {
    const order = fixes[ch];
    const sorted = order.slice().sort((a, b) => a - b);
    assert.deepStrictEqual(
      sorted,
      order.map((_, i) => i),
      ch + " 的修正表必须是 0..n-1 的排列"
    );
  }
  assert.ok(Object.keys(fixes).length >= 1);
});

async function runAsync() {
  requestCount = 0;
  const data = await strokes.load("丁");
  check("load ok", () => {
    assert.strictEqual(data.strokes.length, 2);
    assert.strictEqual(requestCount, 1);
    assert.strictEqual(lastUrl, strokes.CDN_BASE + encodeURIComponent("丁") + ".json");
  });

  const again = await strokes.load("丁");
  check("load cached", () => {
    assert.strictEqual(again.strokes.length, 2);
    assert.strictEqual(requestCount, 1, "should not refetch");
    assert.ok(store[strokes.CACHE_PREFIX + "丁"], "cache written");
    assert.deepStrictEqual(store[strokes.CACHE_INDEX], ["丁"]);
  });

  // 「肠」：网络数据与缓存数据都要按修正表重排
  response = SEVEN;
  const chang = await strokes.load("肠");
  check("load applies stroke order fix", () => {
    assert.strictEqual(chang.strokes[4], SEVEN.strokes[5]);
    assert.strictEqual(chang.strokes[5], SEVEN.strokes[4]);
    assert.deepStrictEqual(chang.medians[4], SEVEN.medians[5]);
    assert.deepStrictEqual(
      store[strokes.CACHE_PREFIX + "肠"].strokes,
      SEVEN.strokes,
      "cache keeps raw order"
    );
  });
  const changAgain = await strokes.load("肠");
  check("cached load still applies fix", () => {
    assert.strictEqual(changAgain.strokes[4], SEVEN.strokes[5]);
    assert.deepStrictEqual(changAgain.medians[4], SEVEN.medians[5]);
  });
  response = FIXTURE;

  mode = "404";
  let missing = null;
  try {
    await strokes.load("龘");
  } catch (e) {
    missing = e;
  }
  check("load 404 marked missing", () => {
    assert.ok(missing && missing.missing === true);
  });

  mode = "fail";
  let failed = null;
  try {
    await strokes.load("好");
  } catch (e) {
    failed = e;
  }
  check("load network error", () => {
    assert.ok(failed && failed.missing !== true);
  });

  await testDetailPage();
  await testStrokePlayPage();
  report();
}

// ---------- 详情页集成 ----------
function fakeCanvas() {
  const ctx = fakeCtx();
  return { width: 0, height: 0, getContext: () => ctx, _ctx: ctx };
}

async function testDetailPage() {
  const canvas = fakeCanvas();
  let captured = null;
  global.Page = (cfg) => {
    captured = cfg;
  };
  global.getCurrentPages = () => [];

  global.wx.createSelectorQuery = () => {
    const query = {
      in() {
        return query;
      },
      select() {
        return query;
      },
      fields() {
        return query;
      },
      exec(cb) {
        cb([{ node: canvas, width: 311, height: 200 }]);
      },
    };
    return query;
  };
  global.wx.getWindowInfo = () => ({ pixelRatio: 3 });
  global.wx.setNavigationBarTitle = () => {};

  mode = "ok";
  const file = path.join(ROOT, "pages", "char-detail", "char-detail.js");
  delete require.cache[require.resolve(file)];
  require(file);
  const page = Object.create(captured);
  page.data = JSON.parse(JSON.stringify(captured.data || {}));
  page.setData = function (patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === "function") cb.call(this);
  };
  page.onLoad({ char: encodeURIComponent("行"), scope: "4", i: "0" });

  await new Promise((r) => setTimeout(r, 30));

  check("detail stroke ready", () => {
    assert.strictEqual(page.data.strokeStatus, "ready");
    assert.strictEqual(page.data.canvasHeightRpx, strokes.heightRpx(2));
  });
  check("detail canvas drawn", () => {
    assert.strictEqual(canvas.width, 311 * 3);
    assert.strictEqual(canvas.height, 200 * 3);
    assert.ok(canvas._ctx.calls.fill > 0, "drew strokes");
    const firstName = page.data.strokeNames[0].name;
    assert.ok(
      canvas._ctx.calls.text.indexOf(firstName) > -1,
      "drew stroke name " + firstName
    );
  });

  // 失败 -> 缺数据提示 -> 重试成功
  mode = "404";
  page.loadStroke("龘");
  await new Promise((r) => setTimeout(r, 20));
  check("detail missing state", () => {
    assert.strictEqual(page.data.strokeStatus, "missing");
  });

  mode = "ok";
  page.data.char = "龘";
  page.retryStrokes();
  await new Promise((r) => setTimeout(r, 30));
  check("detail retry recovers", () => {
    assert.strictEqual(page.data.strokeStatus, "ready");
  });

  // 连续切换时旧请求不能覆盖新字
  mode = "ok";
  page.loadStroke("行");
  page.loadStroke("好");
  await new Promise((r) => setTimeout(r, 30));
  check("detail stale request ignored", () => {
    assert.strictEqual(page.data.char, "龘");
    assert.strictEqual(page.data.strokeStatus, "ready");
  });

  // 点字格进入动画页，并从该格笔画开始
  let navigated = null;
  global.wx.navigateTo = (opts) => {
    navigated = opts.url;
    if (opts.complete) opts.complete();
  };
  mode = "ok";
  page.loadStroke("行");
  await new Promise((r) => setTimeout(r, 30));
  check("detail has cell layout", () => {
    assert.ok(page.strokeLayout && page.strokeLayout.cellW > 0);
  });
  const layout = page.strokeLayout;
  page.onStrokeCellTap({
    changedTouches: [
      { x: layout.cellW + layout.gap + layout.cellW / 2, y: layout.cellH / 2 },
    ],
  });
  check("detail tap cell opens animation from stroke", () => {
    assert.ok(navigated, "navigated");
    assert.ok(navigated.indexOf("/pages/stroke-play/stroke-play") > -1);
    assert.ok(navigated.indexOf("char=") > -1);
    assert.ok(navigated.indexOf("start=1") > -1, navigated);
  });

  navigated = null;
  page.onStrokeCellTap({ changedTouches: [{ x: 4, y: 4000 }] });
  check("detail tap outside cells ignored", () => {
    assert.strictEqual(navigated, null);
  });

  // 隐藏字彩蛋入口：点顶部大字进入信纸页
  navigated = null;
  page.data.isHidden = true;
  page.data.char = "写";
  page.onBigCharTap();
  check("detail big char opens letter", () => {
    assert.ok(navigated, "navigated");
    assert.ok(navigated.indexOf("/pages/letter/letter") > -1, navigated);
  });

  navigated = null;
  page.data.char = "信";
  page.onBigCharTap();
  check("detail big char opens letter for xin", () => {
    assert.ok(navigated && navigated.indexOf("/pages/letter/letter") > -1);
  });

  // 常用字库里打开「写」也要能进入（不依赖隐藏字路径）
  navigated = null;
  page.data.isHidden = false;
  page.data.char = "写";
  page.onBigCharTap();
  check("detail big char works outside hidden pool", () => {
    assert.ok(navigated && navigated.indexOf("/pages/letter/letter") > -1);
  });

  navigated = null;
  page.data.char = "好";
  page.onBigCharTap();
  check("detail big char ignores unlisted chars", () => {
    assert.strictEqual(navigated, null);
  });
}

// ---------- 写字动画页 ----------
function playCanvas() {
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

async function testStrokePlayPage() {
  const canvas = playCanvas();
  let captured = null;
  global.Page = (cfg) => {
    captured = cfg;
  };
  global.getCurrentPages = () => [];

  global.wx.createSelectorQuery = () => {
    const query = {
      in() {
        return query;
      },
      select() {
        return query;
      },
      fields() {
        return query;
      },
      boundingClientRect() {
        return query;
      },
      exec(cb) {
        cb([{ node: canvas, width: 311, height: 311 }]);
      },
    };
    return query;
  };
  global.wx.getWindowInfo = () => ({ pixelRatio: 2 });
  global.wx.setNavigationBarTitle = () => {};

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 推完所有动画帧，等候逐笔停顿后再继续，直到整字写完
  async function drain(target, host) {
    for (let i = 0; i < 30; i++) {
      target._q.pump(1000);
      if (!target._q.queue.length && !host.pauseTimer) break;
      await sleep(12);
    }
  }

  mode = "ok";
  const file = path.join(ROOT, "pages", "stroke-play", "stroke-play.js");
  delete require.cache[require.resolve(file)];
  require(file);
  const page = Object.create(captured);
  page.data = JSON.parse(JSON.stringify(captured.data || {}));
  page.setData = function (patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === "function") cb.call(this);
  };
  page.onLoad({ char: encodeURIComponent("行") });
  page.pauseMs = 5; // 测试里缩短笔间停顿
  await new Promise((r) => setTimeout(r, 30));

  check("play ready", () => {
    assert.strictEqual(page.data.status, "ready");
    assert.strictEqual(page.data.total, 2);
    assert.strictEqual(page.data.cursor, 0);
  });

  await drain(canvas, page);
  check("play opens writing only first stroke", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.ok(!page.pauseTimer, "no pause scheduled");
    assert.strictEqual(page.anim, null);
    assert.ok(page.data.caption.indexOf("1") > -1, page.data.caption);
  });

  check("play finished stroke turns done", () => {
    assert.ok(
      canvas._ctx.calls.styles.indexOf(strokes.COLORS.done) > -1,
      "completed outline is ink colored"
    );
  });

  page.nextStroke();
  check("play next schedules frame", () => {
    assert.ok(canvas._q.queue.length > 0, "frame queued");
  });
  canvas._q.pump(500);
  check("play next stroke", () => {
    assert.strictEqual(page.data.cursor, 1);
  });

  page.prevStroke();
  check("play prev stroke", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.ok(page.data.caption.indexOf("1") > -1, page.data.caption);
  });

  page.selectStroke({ currentTarget: { dataset: { index: 0 } } });
  await drain(canvas, page);
  check("play select writes only that stroke", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.ok(!page.pauseTimer, "no pause scheduled");
  });

  page.replay();
  check("play replay restarts", () => {
    assert.strictEqual(page.data.cursor, 0);
  });
  canvas._q.pump(500);
  check("play replay pauses between strokes", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.ok(page.pauseTimer, "waiting between strokes");
  });
  await drain(canvas, page);
  check("play replay finishes", () => {
    assert.strictEqual(page.data.cursor, 1);
    assert.strictEqual(page.pauseTimer, null);
  });

  // 重写此笔：只写当前一笔，写完不继续
  page.prevStroke();
  page.rewriteStroke();
  canvas._q.pump(1000);
  check("play rewrite only current stroke", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.strictEqual(page.pauseTimer, null);
    assert.strictEqual(page.anim, null);
  });

  // 关闭笔间停顿：重播整字连续写完
  page.onPauseChange({ detail: { value: false } });
  check("play pause switch saved", () => {
    assert.strictEqual(page.data.pause, false);
    assert.strictEqual(page.pauseOn, false);
    assert.strictEqual(store["hmh:settings"].strokePause, false);
  });
  page.replay();
  canvas._q.pump(1000);
  check("play replay without pause runs straight", () => {
    assert.strictEqual(page.data.cursor, 1);
    assert.strictEqual(page.pauseTimer, null);
  });
  page.onPauseChange({ detail: { value: true } });

  // 停顿期间切换笔画要能打断，不能自己继续写
  page.replay();
  canvas._q.pump(1000);
  page.prevStroke();
  await sleep(20);
  canvas._q.pump(1000);
  check("play pause can be interrupted", () => {
    assert.strictEqual(page.data.cursor, 0);
    assert.strictEqual(page.pauseTimer, null);
  });

  // 入口参数 start：从这个笔画开始
  const page2 = Object.create(captured);
  page2.data = JSON.parse(JSON.stringify(captured.data || {}));
  page2.setData = function (patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === "function") cb.call(this);
  };
  page2.onLoad({ char: encodeURIComponent("行"), start: "1" });
  page2.pauseMs = 5;
  await new Promise((r) => setTimeout(r, 30));
  await drain(canvas, page2);
  check("play starts from requested stroke", () => {
    assert.strictEqual(page2.data.cursor, 1);
    assert.ok(page2.data.caption.indexOf("2") > -1, page2.data.caption);
  });

  page.onDurationChange({ detail: { value: 800 } });
  check("play duration saved", () => {
    assert.strictEqual(page.data.duration, 800);
    assert.strictEqual(page.data.durationText, "0.8s");
    assert.strictEqual(store["hmh:settings"].strokeDuration, 800);
  });

  // 点击第二笔中心线附近
  const p = page.mapPoint(FIXTURE.medians[1][1][0], FIXTURE.medians[1][1][1]);
  page.onCanvasTouchEnd({ changedTouches: [{ x: p[0], y: p[1] }] });
  canvas._q.pump(500);
  check("play tap stroke", () => {
    assert.strictEqual(page.data.cursor, 1);
  });

  mode = "404";
  page.loadChar("靐");
  await new Promise((r) => setTimeout(r, 20));
  check("play missing state", () => {
    assert.strictEqual(page.data.status, "missing");
  });

  mode = "ok";
  page.data.char = "靐";
  page.retry();
  await new Promise((r) => setTimeout(r, 30));
  canvas._q.pump(500);
  check("play retry recovers", () => {
    assert.strictEqual(page.data.status, "ready");
  });

  page.onUnload();
  canvas._q.pump(500);
  check("play unload stops", () => {
    assert.strictEqual(page.anim, null);
  });
}

function report() {
  console.log(results.join("\n"));
  const failed = results.filter((r) => r.indexOf("FAIL") === 0);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
  process.exit(failed.length ? 1 : 0);
}

runAsync().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
