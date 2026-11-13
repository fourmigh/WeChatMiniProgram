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
  const calls = { fill: 0, stroke: 0, text: [], moveTo: 0, styles: [] };
  return {
    calls,
    clearRect() {},
    beginPath() {},
    moveTo() {
      calls.moveTo++;
    },
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

// ---------- 缓存与网络 ----------
const store = {};
let requestCount = 0;
let mode = "ok";
let lastUrl = "";

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
    opts.success({ statusCode: 200, data: FIXTURE });
  },
};

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
