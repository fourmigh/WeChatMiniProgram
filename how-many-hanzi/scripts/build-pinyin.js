// 本文件由 scripts/build-pinyin.js 使用汉典拼音数据（scripts/data/pinyin-zdic.txt）生成库外字拼音表。
// 数据来源：汉典（ZDIC.NET），经 mozillazg/pinyin-data 整理（zdic.txt）。
const fs = require("fs");
const path = require("path");
const chars = require("../miniprogram/lib/chars");

const SRC = path.join(__dirname, "data", "pinyin-zdic.txt");
const OUT = path.join(__dirname, "..", "miniprogram", "lib", "pinyin.data.js");
const SOURCE_URL =
  "https://raw.githubusercontent.com/mozillazg/pinyin-data/master/zdic.txt";

async function ensureSource(refresh) {
  if (!refresh && fs.existsSync(SRC)) return;
  console.log("downloading:", SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error("download failed: HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(SRC), { recursive: true });
  fs.writeFileSync(SRC, buf);
  console.log("saved:", SRC, Math.round(buf.length / 1024) + "KB");
}

function parse(text) {
  const map = new Map();
  const re = /^U\+([0-9A-Fa-f]+):\s*([^#]+?)\s*(?:#.*)?$/;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(re);
    if (!m) continue;
    const cp = parseInt(m[1], 16);
    if (!Number.isFinite(cp) || cp > 0x10ffff) continue;
    const ch = String.fromCodePoint(cp);
    const py = m[2].replace(/\s+/g, "").replace(/,+$/, "");
    if (!py) continue;
    map.set(ch, py);
  }
  return map;
}

async function main() {
  const refresh = process.argv.indexOf("--refresh") > -1;
  await ensureSource(refresh);

  const text = fs.readFileSync(SRC, "utf8");
  const map = parse(text);

  const entries = [];
  for (const [ch, py] of map) {
    if (chars.getTierOf(ch) >= 0) continue;
    entries.push([ch, py]);
  }
  entries.sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0));

  const groups = new Map();
  for (const [ch, py] of entries) {
    if (!groups.has(py)) groups.set(py, []);
    groups.get(py).push(ch);
  }
  const combos = Array.from(groups.keys()).sort();
  const serialized = combos
    .map((py) => py + "\t" + groups.get(py).join(""))
    .join("\n");

  const content =
    "// 本文件由 scripts/build-pinyin.js 自动生成，请勿手动修改\n" +
    "// 数据来源：汉典 ZDIC.NET（mozillazg/pinyin-data: zdic.txt）\n" +
    "// 格式：每行「完整读音组合<TAB>汉字串」，同一读音的字连续存放，多音用逗号分隔\n" +
    "module.exports = " +
    JSON.stringify(serialized) +
    ";\n";

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, content, "utf8");

  const sizeKB = Math.round(Buffer.byteLength(content) / 1024);
  console.log("source entries:", map.size);
  console.log("output chars:", entries.length);
  console.log("size:", sizeKB + "KB");
  for (const ch of ["囍", "囧", "峠", "𠀀", "龘", "㐷", "好"]) {
    console.log(
      "  " + ch + " ->",
      map.get(ch) || (chars.getTierOf(ch) >= 0 ? "(in 8105, skipped)" : "(none)")
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
