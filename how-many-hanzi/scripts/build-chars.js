const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const OUT_DIR = path.join(__dirname, "..", "miniprogram", "lib");

function readCharlist(file) {
  const lines = fs
    .readFileSync(path.join(DATA_DIR, file), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const chars = [];
  const seen = new Set();
  for (const line of lines) {
    const ch = Array.from(line)[0];
    if (ch && !seen.has(ch)) {
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars;
}

const basic300 = readCharlist("《义务教育语文课程》（2022年版）识字写字教学基本字表.txt");
const primary2500 = readCharlist("《义务教育语文课程》（2022年版）常用字表一.txt");
const juniorAdd1000 = readCharlist("《义务教育语文课程》（2022年版）常用字表二.txt");
const all8105 = readCharlist("《通用规范汉字表》（2013年）.txt");
const senior5500 = readCharlist("GF2002-hanzi-application.txt");

const junior3500 = new Set([...primary2500, ...juniorAdd1000]);
const seniorSet = new Set(senior5500);
const allSet = new Set(all8105);
const basicSet = new Set(basic300);
const primarySet = new Set(primary2500);

const tiers = [[], [], [], [], []];
const tierOf = {};

for (const ch of all8105) {
  let tier;
  if (basicSet.has(ch)) tier = 0;
  else if (primarySet.has(ch)) tier = 1;
  else if (junior3500.has(ch)) tier = 2;
  else if (seniorSet.has(ch)) tier = 3;
  else tier = 4;
  tiers[tier].push(ch);
  tierOf[ch] = tier;
}

const allChars = tiers.reduce((arr, t) => arr.concat(t), []);
const explainMap = buildExplain();

const explainLines = [];
for (const ch of allChars) {
  const text = explainMap[ch];
  if (text) explainLines.push(ch + "|" + text);
}
const explainStr = explainLines.join("\n");

const { radicalStr, strokeStr } = buildShapeData();

const content = `// 本文件由 scripts/build-chars.js 自动生成，请勿手动修改
module.exports = {
  tierNames: ["启蒙", "小学", "初中", "高中", "全部"],
  tierChars: ${JSON.stringify(tiers)},
  explains: ${JSON.stringify(explainStr)},
  radicals: ${JSON.stringify(radicalStr)},
  strokes: ${JSON.stringify(strokeStr)}
};
`;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "chars.data.js"), content, "utf8");

const explained = explainLines.filter(Boolean).length;
console.log("tiers:", tiers.map((t) => t.length));
console.log("total chars:", allChars.length);
console.log("explained:", explained, `(${((explained / allChars.length) * 100).toFixed(1)}%)`);
console.log("output bytes:", Buffer.byteLength(content, "utf8"));

function buildShapeData() {
  const cnchar = require("cnchar");
  cnchar.use(require("cnchar-radical"));
  const radLines = [];
  const strokeLines = [];
  for (const ch of allChars) {
    let radical = "";
    try {
      const r = cnchar.radical(ch);
      if (r && r[0] && r[0].radical) radical = r[0].radical;
    } catch (e) {
      radical = "";
    }
    let count = 0;
    try {
      const s = cnchar.stroke(ch);
      count = typeof s === "number" ? s : Number(s && s[0]) || 0;
    } catch (e) {
      count = 0;
    }
    if (radical) radLines.push(ch + "|" + radical);
    if (count) strokeLines.push(ch + "|" + count);
  }
  return { radicalStr: radLines.join("\n"), strokeStr: strokeLines.join("\n") };
}

function buildExplain() {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "word.json"), "utf8"));
  const map = {};
  for (const item of raw) {
    const ch = item.word;
    if (!ch || Array.from(ch).length !== 1) continue;
    const text = shorten(item.explanation || item.more || "");
    if (text && !map[ch]) map[ch] = text;
  }
  return map;
}

function shorten(text) {
  if (!text) return "";
  const s = String(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  const benyi = s.match(/本义[：:]?\s*([^）)\n]+)/);
  if (benyi) {
    const v = trimSentence(benyi[1]);
    if (v.length >= 1 && !badMixed(v)) return clamp(v, 26);
  }

  const yi = s.match(/⒈\s*([^\n]+)/);
  if (yi) {
    const v = trimSentence(yi[1]);
    if (v.length >= 2 && !badMixed(v)) return clamp(v, 26);
  }

  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--") && !l.startsWith("〈"));
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (cleaned.length >= 2 && !/^同本义/.test(cleaned) && !badMixed(cleaned)) {
      return clamp(cleaned, 26);
    }
  }
  return "";
}

function badMixed(v) {
  return /[\u4e00-\u9fa5][a-zA-Z]|[a-zA-Z][\u4e00-\u9fa5]/.test(v);
}

function trimSentence(v) {
  return String(v)
    .split(/[。；;]/)[0]
    .replace(/〈[^〉]*〉/g, "")
    .replace(/[“”"]/g, "")
    .trim();
}

function clamp(v, max) {
  return v.length > max ? v.slice(0, max) : v;
}

function cleanLine(line) {
  return line
    .replace(/^[0-9０-９]+[.、．]/, "")
    .replace(/〈[^〉]*〉/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑]/g, "")
    .replace(/[【】\[\]]/g, "")
    .replace(/[，,、;；]+$/g, "")
    .trim();
}
