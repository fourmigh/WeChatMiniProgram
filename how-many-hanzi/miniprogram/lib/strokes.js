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

function draw(opts) {
  const ctx = opts.ctx;
  const width = opts.width;
  const height = opts.height;
  const data = opts.data;
  const names = opts.names || [];
  if (!ctx || !data || !Array.isArray(data.strokes) || !data.strokes.length) {
    return;
  }

  const k = width / DESIGN_W;
  const gap = GAP * k;
  const cellW = CELL_W * k;
  const cellH = CELL_H * k;
  const radius = 10 * k;
  const glyphScale = (cellW * 0.9) / 1024;
  const boxOffset = 512 * glyphScale;
  const nameSize = Math.max(9, Math.round(cellW * 0.15));
  const numSize = Math.max(9, Math.round(cellW * 0.13));

  ctx.clearRect(0, 0, width, height);

  // 笔画只解析一次，避免每格重复解析 O(n^2)
  const parsed = data.strokes.map((d) => svgpath.parsePath(d));

  for (let i = 0; i < parsed.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (cellW + gap);
    const y = row * (cellH + gap);

    roundRect(ctx, x, y, cellW, cellH, radius);
    ctx.fillStyle = COLORS.cellBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.cellBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    const bx = x + cellW / 2;
    const by = y + cellW / 2;
    const mapPoint = (px, py) => [
      bx - boxOffset + px * glyphScale,
      by - boxOffset + (900 - py) * glyphScale,
    ];

    for (let j = 0; j < parsed.length; j++) {
      ctx.beginPath();
      svgpath.tracePath(ctx, parsed[j], mapPoint);
      if (j < i) ctx.fillStyle = COLORS.done;
      else if (j === i) ctx.fillStyle = COLORS.current;
      else ctx.fillStyle = COLORS.pending;
      ctx.fill();
    }

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
  heightRpx,
  load,
  draw,
  clearCache,
};
