// 一次性排查工具：对比 hanzi-writer-data 的笔画顺序与 cnchar（规范笔顺）是否一致。
// 用法：node scripts/check-stroke-order.js [--limit 200] [--chars 肠,汤] [--concurrency 12]
// 缓存目录默认 F:/Temp/opencode/stroke-cache，可用 --cache <dir> 覆盖。
// 只输出疑似错序的字，供人工复核后补进 lib/strokes.js 的 STROKE_ORDER_FIXES。

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VENDOR = path.join(ROOT, "miniprogram", "lib", "vendor", "cnchar");
const cnchar = require(path.join(VENDOR, "cnchar.min.js"));
cnchar.use(require(path.join(VENDOR, "order.min.js")));
const strokesLib = require(path.join(ROOT, "miniprogram", "lib", "strokes"));

const CDN_HOSTS = [
  "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/",
  "https://fastly.jsdelivr.net/npm/hanzi-writer-data@2.0/",
  "https://gcore.jsdelivr.net/npm/hanzi-writer-data@2.0/",
];

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
}
const CACHE_DIR = argValue("--cache", "F:/Temp/opencode/stroke-cache");
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "12")) || 12);
const LIMIT = Number(argValue("--limit", "0")) || 0;
const ONLY_CHARS = argValue("--chars", "");
const OUT_FILE = argValue("--out", path.join(CACHE_DIR, "stroke-order-report.txt"));

// 只比较「起笔是横还是竖」这一层：中线采样稀疏，细分撇/捺容易误判，
// 但横笔与竖笔的起笔方向差异稳定，足以发现前后笔顺颠倒。
// 撇的起笔方向因字形而异（有的很平），无法可靠判断，按通配处理。
// 返回 "H"（横起笔）/ "V"（竖起笔）/ "A"（撇，通配）/ null（点捺提等，跳过）。
function expectedAxis(name) {
  const first = String(name || "").split("|")[0].replace(/\d+$/, "");
  if (!first) return null;
  if (first === "横") return "H";
  if (first === "竖") return "V";
  if (first === "撇") return "A";
  if (/^横/.test(first)) return "H"; // 横折、横钩、横撇、横折钩……
  if (/^竖/.test(first)) return "V"; // 竖折、竖钩、竖提、竖弯……
  if (/^撇/.test(first)) return "A"; // 撇点、撇折
  return null; // 点、捺、提、斜钩、弯钩、卧钩
}

// 中线开头常有一小段顿笔（横竖都可能有），先跳过前 25 个单位，
// 再取接下来一小段（不超过 120）的合方向判断起笔是横还是竖。
// 比逐点转角稳：中线采样稀疏，折点常落在两点之间。
function dataAxis(points) {
  const pts = points || [];
  if (pts.length < 2) return null;
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d);
    total += d;
  }
  if (total < 60) return null;
  const skip = Math.min(25, total * 0.04);
  const win = Math.min(60, total * 0.12);
  let walked = 0;
  let start = pts[0];
  let end = pts[pts.length - 1];
  let found = false;
  for (let i = 1; i < pts.length; i++) {
    walked += segs[i - 1];
    if (!found && walked >= skip) {
      start = pts[i];
      found = true;
    }
    if (walked >= skip + win) {
      end = pts[i];
      break;
    }
  }
  const dx = end[0] - start[0];
  const dy = -(end[1] - start[1]);
  if (Math.hypot(dx, dy) < 40) return null;
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (ang > 90) ang = 180 - ang; // 右下 / 左下都按与水平线夹角看
  if (ang < -90) ang = -180 - ang;
  return Math.abs(ang) <= 40 ? "H" : "V";
}

function specNames(ch) {
  try {
    const arr = cnchar.stroke(ch, "order", "name");
    return (arr && arr[0]) || [];
  } catch (e) {
    return [];
  }
}

function cachePath(ch) {
  return path.join(CACHE_DIR, encodeURIComponent(ch) + ".json");
}

function readCache(ch) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(ch), "utf8"));
  } catch (e) {
    return null;
  }
}

async function fetchData(ch) {
  const cached = readCache(ch);
  if (cached) return cached;
  let lastErr;
  for (let round = 0; round < 2; round++) {
    for (let h = 0; h < CDN_HOSTS.length; h++) {
      try {
        const res = await fetch(CDN_HOSTS[h] + encodeURIComponent(ch) + ".json");
        if (res.status === 404) return { missing: true };
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && Array.isArray(data.strokes)) {
          fs.writeFileSync(cachePath(ch), JSON.stringify(data));
          return data;
        }
        throw new Error("bad json");
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * (round + 1)));
      }
    }
  }
  return { error: (lastErr && lastErr.message) || "fetch failed" };
}

function compare(ch, data) {
  const names = specNames(ch);
  if (!names.length) return { skip: "no spec" };
  const medians = data.medians || [];
  if (medians.length !== names.length) {
    // 中线缺失时跳过，只记一笔数量差（个别字的 medians 比 strokes 短）
    return medians.length ? { skip: "median count " + medians.length + "/" + names.length } : { skip: "no medians" };
  }
  const rows = [];
  for (let i = 0; i < names.length; i++) {
    const exp = expectedAxis(names[i]);
    if (!exp) {
      rows.push({ i: i, name: names[i], exp: null, got: null, skip: true });
      continue;
    }
    const got = dataAxis(medians[i]);
    // 撇的起笔方向不稳定，只记录不参与比对
    rows.push({ i: i, name: names[i], exp: exp, got: got, skip: exp === "A" || !got });
  }
  const bad = rows.filter((r) => !r.skip && r.exp !== r.got);
  return { rows: rows, bad: bad };
}

function fmtRow(r) {
  return (
    (r.i + 1) +
    ":" +
    String(r.name).split("|")[0] +
    " 期望" +
    r.exp +
    " 实际" +
    r.got
  );
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  let chars;
  if (ONLY_CHARS) {
    chars = Array.from(ONLY_CHARS);
  } else {
    chars = Array.from(new Set(require(path.join(ROOT, "miniprogram", "lib", "chars")).allChars));
  }
  if (LIMIT > 0) chars = chars.slice(0, LIMIT);

  const flagged = [];
  const skipped = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < chars.length) {
      const ch = chars[cursor++];
      const data = await fetchData(ch);
      done++;
      if (done % 200 === 0) {
        process.stdout.write("扫描 " + done + "/" + chars.length + "，疑似 " + flagged.length + "\n");
      }
      if (!data || data.missing || data.error) continue;
      const res = compare(ch, strokesLib.applyOrderFix(ch, data));
      if (res.skip) {
        skipped.push({ ch: ch, reason: res.skip });
        continue;
      }
      if (res.bad.length) {
        flagged.push({
          ch: ch,
          bad: res.bad.map(fmtRow),
          data: res.rows.map((r) => (r.skip ? "?" : r.got)).join(""),
          spec: res.rows.map((r) => r.exp || "?").join(""),
        });
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  const lines = [];
  lines.push("扫描 " + chars.length + " 字，疑似 " + flagged.length + " 个，跳过 " + skipped.length + " 个");
  for (const item of flagged) {
    lines.push(
      item.ch + "  数据 " + item.data + "  规范 " + item.spec + "  | " + item.bad.join("; ")
    );
  }
  if (skipped.length) {
    lines.push("");
    lines.push("-- 跳过（中线/笔画数不齐，无法自动比对）--");
    for (const item of skipped) {
      lines.push(item.ch + "  " + item.reason);
    }
  }
  const text = lines.join("\n");
  fs.writeFileSync(OUT_FILE, text + "\n");
  console.log(text);
  console.log("\n报告已写入 " + OUT_FILE);
}

main().catch((e) => {
  console.error("扫描失败:", e && e.stack);
  process.exit(1);
});
