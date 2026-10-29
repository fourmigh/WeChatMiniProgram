// scripts/fetch-zdic.js
// 从汉典（ZDIC.NET）抓取全部通用字的分读音释义，作为唯一释义/读音数据源。
// 用法：
//   node scripts/fetch-zdic.js --limit=10     只抓前 N 个未缓存的字
//   node scripts/fetch-zdic.js                抓全部未缓存的字
//   node scripts/fetch-zdic.js --retry-failed 只重抓失败清单里的字
//   node scripts/fetch-zdic.js --chars=大好行 只抓指定字
//   node scripts/fetch-zdic.js --merge-only   只合并缓存为 zdic.json
// 缓存：scripts/data/zdic/<字>.json（断点续抓）
// 产物：scripts/data/zdic.json
// 说明：robots.txt 未禁止 /hans/ 页面；低频抓取，产物固化后构建不再联网。

const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_DIR = path.join(__dirname, "data");
const CACHE_DIR = path.join(DATA_DIR, "zdic");
const OUT_FILE = path.join(DATA_DIR, "zdic.json");
const FAIL_FILE = path.join(DATA_DIR, "zdic-failures.txt");
const EXTRA_FILE = path.join(DATA_DIR, "zdic-extra.json");
const DELAY_MS = 500;
const RETRIES = 3;
const MAX_LEN = 26;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const PINYIN = "a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüê\u0261ńňǹḿ";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { limit: 0, retryFailed: false, mergeOnly: false, chars: "" };
  for (const a of args) {
    if (a.indexOf("--limit=") === 0) out.limit = Number(a.slice(8)) || 0;
    else if (a === "--retry-failed") out.retryFailed = true;
    else if (a === "--merge-only") out.mergeOnly = true;
    else if (a.indexOf("--chars=") === 0) out.chars = a.slice(8);
  }
  return out;
}

function loadAllChars() {
  const data = require("../miniprogram/lib/chars.data");
  const all = [];
  for (const tier of data.tierChars) {
    for (const ch of Array.from(tier)) all.push(ch);
  }
  return all;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fixLocation(loc, base) {
  let href = loc;
  if (/[^\x00-\x7f]/.test(href)) {
    try {
      href = Buffer.from(href, "latin1").toString("utf8");
    } catch (e) {
      // keep original
    }
  }
  return new URL(href, base).href;
}

function fetchHtml(url, redirectsLeft) {
  const left = redirectsLeft === undefined ? 4 : redirectsLeft;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (left <= 0) return reject(new Error("too many redirects"));
          return resolve(fetchHtml(fixLocation(res.headers.location, url), left - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanSense(ch, raw) {
  let s = String(raw)
    .split("反馈")[0]
    .replace(/[ㄅ-ㄩㄪㄫㄬ]+/g, "")
    .replace(/[ˊˇˋ˙]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/～/g, ch)
    .replace(/\s+/g, "")
    .trim();
  s = (s.split(/[。；;]/)[0] || "").trim();
  s = s.replace(/^(——|--|-)+/, "").replace(/^常用词组/, "").trim();
  if (s.length > MAX_LEN) {
    const cut = s.slice(0, MAX_LEN);
    const idx = Math.max(
      cut.lastIndexOf("，"),
      cut.lastIndexOf("、"),
      cut.lastIndexOf("；")
    );
    s = idx >= MAX_LEN - 8 ? cut.slice(0, idx) : cut;
  }
  return s;
}

function collectHeads(ch, zone, prefix) {
  const re = new RegExp(
    prefix + "\\s*" + ch + "\\s*(?:[\\u4e00-\\u9fa5]{0,2}\\s*)?([" + PINYIN + "]+)",
    "g"
  );
  const heads = [];
  let m;
  while ((m = re.exec(zone)) !== null) {
    heads.push({ p: m[1].toLowerCase(), start: m.index + m[0].length, at: m.index });
  }
  return heads;
}

function buildFromHeads(ch, zone, heads) {
  const readings = [];
  const senses = [];
  for (let i = 0; i < heads.length; i++) {
    const stop = i + 1 < heads.length ? heads[i + 1].at : zone.length;
    const raw = zone.slice(heads[i].start, stop > heads[i].start ? stop : zone.length);
    const v = cleanSense(ch, raw);
    if (readings.indexOf(heads[i].p) === -1) readings.push(heads[i].p);
    if (v && !senses.some((x) => x.p === heads[i].p)) {
      senses.push({ p: heads[i].p, m: v });
    }
  }
  if (!senses.length) return null;
  return { readings: readings, explain: senses[0].m, senses: senses };
}

function parsePage(ch, html) {
  const text = htmlToText(html);
  const bIdx = text.lastIndexOf("基本解释");
  if (bIdx > -1) {
    const dIdx = text.indexOf("详细解释", bIdx + 4);
    const zone = dIdx > bIdx ? text.slice(bIdx, dIdx) : text.slice(bIdx, bIdx + 4000);
    const res = buildFromHeads(ch, zone, collectHeads(ch, zone, "●"));
    if (res) return res;
  }
  const dIdx2 = text.lastIndexOf("详细解释");
  if (dIdx2 === -1) return null;
  let end = text.length;
  ["康熙字典", "音韵方言", "國語辭典", "说文解字", "字源字形"].forEach((mk) => {
    const i = text.indexOf(mk, dIdx2 + 4);
    if (i > -1 && i < end) end = i;
  });
  const zone2 = text.slice(dIdx2, end);
  return buildFromHeads(ch, zone2, collectHeads(ch, zone2, "◎"));
}

async function fetchOne(ch) {
  const url = "https://zdic.net/hans/" + encodeURIComponent(ch);
  let lastErr = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const html = await fetchHtml(url);
      const parsed = parsePage(ch, html);
      if (!parsed) throw new Error("parse failed");
      return parsed;
    } catch (e) {
      lastErr = e;
      const msg = String((e && e.message) || "");
      if (msg.indexOf("429") > -1 || msg.indexOf("403") > -1) {
        await sleep(30000);
      } else {
        await sleep(attempt * 2000);
      }
    }
  }
  throw lastErr || new Error("unknown");
}

function loadExtraChars() {
  if (!fs.existsSync(EXTRA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(EXTRA_FILE, "utf8")) || {};
  } catch (e) {
    return {};
  }
}

async function main() {
  const opts = parseArgs();
  const all = loadAllChars();
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (!opts.mergeOnly) {
    let todo = all.filter((ch) => !fs.existsSync(path.join(CACHE_DIR, ch + ".json")));
    if (opts.chars) {
      todo = Array.from(opts.chars).filter((c) => all.indexOf(c) > -1);
    } else if (opts.retryFailed && fs.existsSync(FAIL_FILE)) {
      const failed = Array.from(fs.readFileSync(FAIL_FILE, "utf8"));
      todo = failed.filter((ch) => all.indexOf(ch) > -1);
    }
    if (opts.limit > 0) todo = todo.slice(0, opts.limit);
    console.log("pending:", todo.length, "of", all.length, "limit:", opts.limit || "all");

    let ok = 0;
    let failCount = 0;
    for (let i = 0; i < todo.length; i++) {
      const ch = todo[i];
      try {
        const parsed = await fetchOne(ch);
        fs.writeFileSync(
          path.join(CACHE_DIR, ch + ".json"),
          JSON.stringify(parsed),
          "utf8"
        );
        ok++;
      } catch (e) {
        failCount++;
        console.log("FAIL", ch, (e && e.message) || "");
      }
      if ((i + 1) % 50 === 0) {
        console.log("progress", i + 1, "/", todo.length, "ok:", ok, "fail:", failCount);
      }
      await sleep(DELAY_MS);
    }

    const extraSet = loadExtraChars();
    const missing = all.filter(
      (ch) => !fs.existsSync(path.join(CACHE_DIR, ch + ".json")) && !extraSet[ch]
    );
    if (missing.length) {
      fs.writeFileSync(FAIL_FILE, missing.join(""), "utf8");
    } else if (fs.existsSync(FAIL_FILE)) {
      fs.unlinkSync(FAIL_FILE);
    }
    console.log(
      "batch done. ok:",
      ok,
      "fail:",
      failCount,
      "cached:",
      all.length - missing.length - Object.keys(extraSet).length,
      "missing(uncovered):",
      missing.length
    );
  }

  const out = {};
  for (const ch of all) {
    const f = path.join(CACHE_DIR, ch + ".json");
    if (!fs.existsSync(f)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
      out[ch] = {
        readings: parsed.readings || [],
        explain: parsed.explain || "",
        senses: parsed.senses || [],
      };
    } catch (e) {
      // skip broken cache entry
    }
  }
  const extra = loadExtraChars();
  for (const ch of Object.keys(extra)) {
    if (!out[ch]) out[ch] = extra[ch];
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(out), "utf8");
  console.log("merged:", Object.keys(out).length, "/", all.length, "->", OUT_FILE);
}

main();
