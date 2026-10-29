// 本文件由 scripts/build-chars.js 使用汉典数据（scripts/data/zdic.json）生成字库。
// 数据来源：释义 / 分读音义 / 读音 = 汉典（ZDIC.NET）；部首 / 笔画 = cnchar。
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
const basicSet = new Set(basic300);
const primarySet = new Set(primary2500);

const tiers = [[], [], [], [], []];
for (const ch of all8105) {
  let tier;
  if (basicSet.has(ch)) tier = 0;
  else if (primarySet.has(ch)) tier = 1;
  else if (junior3500.has(ch)) tier = 2;
  else if (seniorSet.has(ch)) tier = 3;
  else tier = 4;
  tiers[tier].push(ch);
}

const allChars = tiers.reduce((arr, t) => arr.concat(t), []);
const zdic = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "zdic.json"), "utf8"));

const explainLines = [];
const readingLines = [];
const senseLines = [];
const extraStrokeLines = [];
const extraWordLines = [];
const polyArr = [];

for (const ch of allChars) {
  const v = zdic[ch];
  if (!v) continue;
  if (v.explain) explainLines.push(ch + "|" + v.explain);
  const readings = (v.readings || []).filter(Boolean);
  if (readings.length) readingLines.push(ch + "|" + readings.join(","));
  if (readings.length >= 2) {
    polyArr.push(ch);
    const senses = (v.senses || []).filter((s) => s.p && s.m);
    if (senses.length >= 2) {
      const seg = senses
        .map((s) => s.p + ":" + s.m)
        .join(";")
        .slice(0, 400);
      if (seg) senseLines.push(ch + "|" + seg);
    }
  }
  const extra = v;
  if (extra) {
    if (extra.strokeNames && extra.strokeNames.length) {
      extraStrokeLines.push(ch + "|" + extra.strokeNames.join(","));
    }
    if (extra.words && extra.words.length) {
      extraWordLines.push(ch + "|" + extra.words.join(","));
    }
  }
}

const { radicalStr, strokeStr } = buildShapeData();

const content = `// 本文件由 scripts/build-chars.js 自动生成，请勿手动修改
// 数据来源：释义/读音/分读音义 = 汉典 ZDIC.NET；部首/笔画 = cnchar
module.exports = {
  tierNames: ["启蒙", "小学", "初中", "高中", "全部"],
  tierChars: ${JSON.stringify(tiers)},
  explains: ${JSON.stringify(explainLines.join("\n"))},
  radicals: ${JSON.stringify(radicalStr)},
  strokes: ${JSON.stringify(strokeStr)},
  readings: ${JSON.stringify(readingLines.join("\n"))},
  polyphones: ${JSON.stringify(polyArr.join(""))},
  senses: ${JSON.stringify(senseLines.join("\n"))},
  extraStrokes: ${JSON.stringify(extraStrokeLines.join("\n"))},
  extraWords: ${JSON.stringify(extraWordLines.join("\n"))}
};
`;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "chars.data.js"), content, "utf8");

const explained = explainLines.length;
const withReadings = readingLines.length;
const senseCount = senseLines.length;
console.log("tiers:", tiers.map((t) => t.length));
console.log("total chars:", allChars.length);
console.log(
  "explained:",
  explained,
  `(${((explained / allChars.length) * 100).toFixed(1)}%)`
);
console.log("with readings:", withReadings);
console.log("polyphones:", polyArr.length);
console.log(
  "senses:",
  senseCount,
  `(${((senseCount / Math.max(polyArr.length, 1)) * 100).toFixed(1)}% of poly)`
);
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
    const info = zdic[ch];
    if (!radical && info && info.radical) radical = info.radical;
    if (!count && info && info.strokes) count = info.strokes;
    if (radical) radLines.push(ch + "|" + radical);
    if (count) strokeLines.push(ch + "|" + count);
  }
  return { radicalStr: radLines.join("\n"), strokeStr: strokeLines.join("\n") };
}
