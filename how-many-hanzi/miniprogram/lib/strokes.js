// 笔顺数据加载与逐笔网格绘制。
// 数据：hanzi-writer-data（每字一份 JSON，含 strokes 矢量轮廓与 medians 中心线）。
// 缓存：写入 wx storage，按最近使用保留有限字数，避免占满 10MB 配额。

const svgpath = require("./svgpath");

const CDN_BASE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/";
const CACHE_PREFIX = "hmh:stroke:";
const CACHE_INDEX = "hmh:stroke:index";
const MAX_CACHE = 400;

const DESIGN_W = 622; // rpx，详情页卡片内容宽度
const COLS = 4;
const GAP = 12; // rpx
const CELL_W = (DESIGN_W - GAP * (COLS - 1)) / COLS;
const NAME_H = 38; // rpx，每格底部笔名区域
const CELL_H = CELL_W + NAME_H;

const COLORS = {
  cellBg: "#FBF7EF",
  cellBorder: "#EDE5D8",
  done: "#22333B",
  current: "#C8553D",
  pending: "#E7DFD1",
  number: "#A29A8E",
  name: "#55636B",
};

const pendingRequests = {};

function hasStorage() {
  return (
    typeof wx !== "undefined" &&
    wx &&
    typeof wx.getStorageSync === "function" &&
    typeof wx.setStorageSync === "function"
  );
}

function readJSON(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const v = wx.getStorageSync(key);
    if (v === "" || v == null) return fallback;
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (!hasStorage()) return;
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    // 忽略配额异常
  }
}

function getCached(ch) {
  const data = readJSON(CACHE_PREFIX + ch, null);
  if (data && Array.isArray(data.strokes) && data.strokes.length) {
    return { strokes: data.strokes, medians: data.medians || [] };
  }
  return null;
}

function putCache(ch, data) {
  if (!ch || !data || !data.strokes) return;
  const slim = { strokes: data.strokes, medians: data.medians || [] };
  writeJSON(CACHE_PREFIX + ch, slim);

  let index = readJSON(CACHE_INDEX, []);
  if (!Array.isArray(index)) index = [];
  index = index.filter((c) => c !== ch);
  index.push(ch);
  if (index.length > MAX_CACHE) {
    const drop = index.splice(0, index.length - MAX_CACHE);
    for (let i = 0; i < drop.length; i++) {
      try {
        if (typeof wx.removeStorageSync === "function") {
          wx.removeStorageSync(CACHE_PREFIX + drop[i]);
        }
      } catch (e) {
        // ignore
      }
    }
  }
  writeJSON(CACHE_INDEX, index);
}

function requestData(ch) {
  return new Promise((resolve, reject) => {
    if (
      typeof wx === "undefined" ||
      !wx ||
      typeof wx.request !== "function"
    ) {
      const err = new Error("wx.request unavailable");
      err.missing = false;
      reject(err);
      return;
    }
    wx.request({
      url: CDN_BASE + encodeURIComponent(ch) + ".json",
      method: "GET",
      timeout: 8000,
      success(res) {
        const status = res && res.statusCode;
        if (status === 404) {
          const err = new Error("stroke data missing");
          err.missing = true;
          reject(err);
          return;
        }
        if (status && (status < 200 || status >= 300)) {
          reject(new Error("HTTP " + status));
          return;
        }
        let data = res && res.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (e) {
            reject(new Error("invalid stroke json"));
            return;
          }
        }
        if (!data || !Array.isArray(data.strokes) || !data.strokes.length) {
          const err = new Error("empty stroke data");
          err.missing = true;
          reject(err);
          return;
        }
        resolve({ strokes: data.strokes, medians: data.medians || [] });
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || "network error"));
      },
    });
  });
}

function load(ch) {
  const cached = getCached(ch);
  if (cached) return Promise.resolve(cached);
  if (pendingRequests[ch]) return pendingRequests[ch];

  const p = requestData(ch).then(
    (data) => {
      delete pendingRequests[ch];
      putCache(ch, data);
      return data;
    },
    (err) => {
      delete pendingRequests[ch];
      throw err;
    }
  );
  pendingRequests[ch] = p;
  return p;
}

function heightRpx(strokeCount) {
  const n = Number(strokeCount) || 0;
  if (n <= 0) return 0;
  const rows = Math.ceil(n / COLS);
  return Math.round(rows * CELL_H + (rows - 1) * GAP);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function parseStrokes(data) {
  const list = data && Array.isArray(data.strokes) ? data.strokes : [];
  return list.map((d) => svgpath.parsePath(d));
}

function cellMapPoint(x, y, box) {
  const glyphScale = (box * 0.9) / 1024;
  const boxOffset = 512 * glyphScale;
  const bx = x + box / 2;
  const by = y + box / 2;
  return function (px, py) {
    return [
      bx - boxOffset + px * glyphScale,
      by - boxOffset + (900 - py) * glyphScale,
    ];
  };
}

// 绘制一个格子：背景 + 灰色整字 + 已完成墨迹 + 当前笔（可选真实轮廓）。
// 返回字形坐标到画布坐标的映射函数，动画直接复用。
function drawCell(opts) {
  const ctx = opts.ctx;
  const parsed = opts.parsed || [];
  const x = opts.x || 0;
  const y = opts.y || 0;
  const w = opts.w;
  const h = opts.h;
  const box = opts.box || Math.min(w, h);
  const k = opts.k || 1;
  const current = typeof opts.current === "number" ? opts.current : -1;
  const outlineCurrent = opts.outlineCurrent !== false;

  roundRect(ctx, x, y, w, h, 10 * k);
  ctx.fillStyle = COLORS.cellBg;
  ctx.fill();
  ctx.strokeStyle = COLORS.cellBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  const mapPoint = cellMapPoint(x, y, box);

  // 第一遍：整字浅灰打底，避免灰色在交叉处盖住墨迹
  for (let j = 0; j < parsed.length; j++) {
    ctx.beginPath();
    svgpath.tracePath(ctx, parsed[j], mapPoint);
    ctx.fillStyle = COLORS.pending;
    ctx.fill();
  }

  // 第二遍：已完成笔画用墨色
  const upTo = Math.min(current, parsed.length);
  for (let j = 0; j < upTo; j++) {
    ctx.beginPath();
    svgpath.tracePath(ctx, parsed[j], mapPoint);
    ctx.fillStyle = COLORS.done;
    ctx.fill();
  }

  // 当前笔最后绘制，保证处在最上层
  if (outlineCurrent && current >= 0 && current < parsed.length) {
    ctx.beginPath();
    svgpath.tracePath(ctx, parsed[current], mapPoint);
    ctx.fillStyle = COLORS.current;
    ctx.fill();
  }

  return mapPoint;
}

// 画布宽度换算成格子布局，绘制与点击命中共用。
function cellLayout(width) {
  const k = width / DESIGN_W;
  return {
    k: k,
    gap: GAP * k,
    cellW: CELL_W * k,
    cellH: CELL_H * k,
    radius: 10 * k,
  };
}

// 点击坐标落在第几个字格；超出范围返回 -1。
function hitCell(layout, x, y, total) {
  if (!layout || !total || x < 0 || y < 0) return -1;
  const col = Math.floor(x / (layout.cellW + layout.gap));
  const row = Math.floor(y / (layout.cellH + layout.gap));
  if (col < 0 || col >= COLS || row < 0) return -1;
  const index = row * COLS + col;
  return index < total ? index : -1;
}

function draw(opts) {
  const ctx = opts.ctx;
  const width = opts.width;
  const height = opts.height;
  const data = opts.data;
  const names = opts.names || [];
  if (!ctx || !data || !Array.isArray(data.strokes) || !data.strokes.length) {
    return;
  }

  const layout = cellLayout(width);
  const k = layout.k;
  const gap = layout.gap;
  const cellW = layout.cellW;
  const cellH = layout.cellH;
  const nameSize = Math.max(9, Math.round(cellW * 0.15));
  const numSize = Math.max(9, Math.round(cellW * 0.13));

  ctx.clearRect(0, 0, width, height);

  // 笔画只解析一次，避免每格重复解析 O(n^2)
  const parsed = parseStrokes(data);

  for (let i = 0; i < parsed.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (cellW + gap);
    const y = row * (cellH + gap);

    drawCell({
      ctx: ctx,
      x: x,
      y: y,
      w: cellW,
      h: cellH,
      box: cellW,
      k: k,
      parsed: parsed,
      current: i,
      outlineCurrent: true,
    });

    // 序号
    ctx.fillStyle = COLORS.number;
    ctx.font = numSize + "px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(i + 1), x + 7 * k, y + 6 * k);

    // 笔名
    const name = names[i] || "";
    if (name) {
      ctx.fillStyle = COLORS.name;
      ctx.font = nameSize + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        name,
        x + cellW / 2,
        y + cellW + (NAME_H * k) / 2,
        cellW * 0.94
      );
    }
  }
}

// 估算笔画在画布上的平均粗细：轮廓面积 ÷ 中心线长度。
// 轮廓由外圈与内孔组成，按子路径求有符号面积再相加，即为笔画实际覆盖面积。
function estimateStrokeWidth(commands, mapPoint, medianLength) {
  const len = Number(medianLength) || 0;
  if (!commands || !commands.length || len <= 0) return 0;

  let cursor = [0, 0];
  let points = [];
  let area = 0;

  function flush() {
    if (points.length >= 3) {
      let sum = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const q = points[(i + 1) % points.length];
        sum += p[0] * q[1] - q[0] * p[1];
      }
      area += sum / 2;
    }
    points = [];
  }

  function push(px, py) {
    points.push(mapPoint(px, py));
    cursor = [px, py];
  }

  function sampleQuad(c, steps) {
    const x0 = cursor[0];
    const y0 = cursor[1];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const mt = 1 - t;
      const px = mt * mt * x0 + 2 * mt * t * c[1] + t * t * c[3];
      const py = mt * mt * y0 + 2 * mt * t * c[2] + t * t * c[4];
      points.push(mapPoint(px, py));
    }
    cursor = [c[3], c[4]];
  }

  function sampleCubic(c, steps) {
    const x0 = cursor[0];
    const y0 = cursor[1];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const d = 3 * mt * t * t;
      const e = t * t * t;
      const px = a * x0 + b * c[1] + d * c[3] + e * c[5];
      const py = a * y0 + b * c[2] + d * c[4] + e * c[6];
      points.push(mapPoint(px, py));
    }
    cursor = [c[5], c[6]];
  }

  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    switch (c[0]) {
      case "M":
        flush();
        cursor = [c[1], c[2]];
        points.push(mapPoint(c[1], c[2]));
        break;
      case "L":
        push(c[1], c[2]);
        break;
      case "Q":
        sampleQuad(c, 8);
        break;
      case "C":
        sampleCubic(c, 10);
        break;
      case "Z":
        flush();
        break;
      default:
        break;
    }
  }
  flush();

  return Math.abs(area) / len;
}

// 沿中心线（medians）逐帧画出当前笔，完成后用真实轮廓收尾。
function animateStroke(opts) {
  const ctx = opts.ctx;
  const canvas = opts.canvas;
  const medians = opts.medians || [];
  const index = opts.index;
  const parsed = opts.parsed || [];
  const mapPoint = opts.mapPoint;
  const box = opts.box || 100;
  const duration = Math.max(60, Number(opts.duration) || 500);
  const color = opts.color || COLORS.current;
  const finishColor = opts.finishColor || COLORS.done;
  const onDone = opts.onDone;

  const pts = medians[index] || [];
  const mapped = pts.map(function (p) {
    return mapPoint(p[0], p[1]);
  });

  // 填充真实轮廓（已完成墨色）。
  const fillOutline = function () {
    if (!parsed[index]) return;
    ctx.beginPath();
    svgpath.tracePath(ctx, parsed[index], mapPoint);
    ctx.fillStyle = finishColor;
    ctx.fill();
  };

  if (pts.length < 2 || !parsed[index]) {
    fillOutline();
    if (onDone) onDone();
    return { cancel: function () {} };
  }

  const segs = [];
  let total = 0;
  for (let i = 0; i < mapped.length - 1; i++) {
    const dx = mapped[i + 1][0] - mapped[i][0];
    const dy = mapped[i + 1][1] - mapped[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push(len);
    total += len;
  }
  if (total <= 0) {
    fillOutline();
    if (onDone) onDone();
    return { cancel: function () {} };
  }

  // 书写线宽度按该笔真实轮廓估算，乘 0.85 略窄于轮廓，收尾时墨色轮廓可完全盖住红线。
  let strokeWidth =
    estimateStrokeWidth(parsed[index], mapPoint, total) * 0.85;
  if (!(strokeWidth > 0)) {
    // 估算失败时退回固定比例
    strokeWidth = 200 * ((box * 0.9) / 1024);
  }
  strokeWidth = Math.min(strokeWidth, box * 0.2);
  strokeWidth = Math.max(strokeWidth, Math.max(1, box * 0.012));

  // 收尾只填真实轮廓：和已完成笔画走同一渲染路径，边缘由轮廓曲线决定。
  // 书写时留下的红色轨迹由页面在 onDone 后整格重画清除。
  const finish = function () {
    fillOutline();
    if (onDone) onDone();
  };

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const frames = Math.max(2, Math.round(duration / (1000 / 60)));
  let frame = 0;
  let segIndex = 0;
  let segStart = 0;
  let last = mapped[0];
  let done = false;
  let cancelled = false;
  let rafId = null;

  const requestFrame =
    canvas && typeof canvas.requestAnimationFrame === "function"
      ? function (cb) {
          return canvas.requestAnimationFrame(cb);
        }
      : function (cb) {
          return setTimeout(cb, 16);
        };

  function drawTo(target) {
    while (segIndex < segs.length && target >= segStart + segs[segIndex]) {
      const end = mapped[segIndex + 1];
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      last = end;
      segStart += segs[segIndex];
      segIndex++;
    }
    if (segIndex < segs.length && target > segStart) {
      const start = mapped[segIndex];
      const end = mapped[segIndex + 1];
      const ratio = (target - segStart) / segs[segIndex];
      const point = [
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ];
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(point[0], point[1]);
      ctx.stroke();
      last = point;
    }
  }

  function tick() {
    if (cancelled || done) return;
    frame++;
    if (frame >= frames) {
      drawTo(total);
      done = true;
      finish();
      return;
    }
    drawTo((total * frame) / frames);
    rafId = requestFrame(tick);
  }

  rafId = requestFrame(tick);

  return {
    cancel: function () {
      cancelled = true;
      if (canvas && canvas.cancelAnimationFrame && rafId) {
        try {
          canvas.cancelAnimationFrame(rafId);
        } catch (e) {
          // ignore
        }
      }
    },
  };
}

// 命中测试：返回离点击点最近的笔画索引（按点到中心线线段的距离）。
function hitTest(medians, mapPoint, x, y, maxDist) {
  let best = -1;
  let bestDist = maxDist * maxDist;

  function testPoint(index, px, py) {
    const dx = px - x;
    const dy = py - y;
    const dist = dx * dx + dy * dy;
    if (dist <= bestDist) {
      bestDist = dist;
      best = index;
    }
  }

  for (let i = 0; i < medians.length; i++) {
    const pts = medians[i] || [];
    if (!pts.length) continue;
    if (pts.length === 1) {
      const p = mapPoint(pts[0][0], pts[0][1]);
      testPoint(i, p[0], p[1]);
      continue;
    }
    let prev = mapPoint(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) {
      const next = mapPoint(pts[j][0], pts[j][1]);
      const vx = next[0] - prev[0];
      const vy = next[1] - prev[1];
      const len2 = vx * vx + vy * vy;
      let t = 0;
      if (len2 > 0) {
        t = ((x - prev[0]) * vx + (y - prev[1]) * vy) / len2;
        t = Math.max(0, Math.min(1, t));
      }
      testPoint(i, prev[0] + vx * t, prev[1] + vy * t);
      prev = next;
    }
  }
  return best;
}

function clearCache() {
  const index = readJSON(CACHE_INDEX, []);
  if (Array.isArray(index)) {
    for (let i = 0; i < index.length; i++) {
      try {
        if (typeof wx !== "undefined" && wx.removeStorageSync) {
          wx.removeStorageSync(CACHE_PREFIX + index[i]);
        }
      } catch (e) {
        // ignore
      }
    }
  }
  writeJSON(CACHE_INDEX, []);
}

module.exports = {
  CDN_BASE,
  CACHE_PREFIX,
  CACHE_INDEX,
  MAX_CACHE,
  DESIGN_W,
  COLS,
  COLORS,
  heightRpx,
  cellLayout,
  hitCell,
  parseStrokes,
  drawCell,
  estimateStrokeWidth,
  animateStroke,
  hitTest,
  load,
  draw,
  clearCache,
};
