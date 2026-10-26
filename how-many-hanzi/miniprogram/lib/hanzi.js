const cnchar = require("./vendor/cnchar/cnchar.min.js");
cnchar.use(require("./vendor/cnchar/poly.min.js"));
cnchar.use(require("./vendor/cnchar/order.min.js"));
cnchar.use(require("./vendor/cnchar/radical.min.js"));
cnchar.use(require("./vendor/cnchar/words.min.js"));

const PINYIN_RE = /^[a-züêāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]+$/i;

function isPinyin(s) {
  return !!s && PINYIN_RE.test(s);
}

function lowerFirst(s) {
  if (!s) return "";
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function parsePoly(raw) {
  if (!raw) return [];
  let s = String(raw).trim();
  if (s.charAt(0) === "(") s = s.slice(1);
  if (s.charAt(s.length - 1) === ")") s = s.slice(0, -1);
  const parts = s.split("|");
  const result = [];
  const seen = {};
  for (let i = 0; i < parts.length; i++) {
    const v = lowerFirst(parts[i].trim());
    if (v && !seen[v]) {
      seen[v] = true;
      result.push(v);
    }
  }
  return result;
}

function getReadings(ch) {
  try {
    const arr = cnchar.spell(ch, "array", "poly", "tone");
    if (!arr || !arr.length) return [];
    return parsePoly(arr[0]).filter(isPinyin);
  } catch (e) {
    return [];
  }
}

function getPrimaryReading(ch) {
  try {
    const arr = cnchar.spell(ch, "array", "tone");
    if (!arr || !arr.length) return "";
    const v = lowerFirst(String(arr[0]).trim());
    return isPinyin(v) ? v : "";
  } catch (e) {
    return "";
  }
}

function getStrokeNames(ch) {
  try {
    const arr = cnchar.stroke(ch, "order", "name");
    if (!arr || !arr.length) return [];
    const first = arr[0];
    return Array.isArray(first) ? first.slice() : [first];
  } catch (e) {
    return [];
  }
}

function getWords(ch) {
  try {
    const arr = cnchar.words(ch);
    return Array.isArray(arr) ? arr.slice() : [];
  } catch (e) {
    return [];
  }
}

function getRadicalInfo(ch) {
  try {
    const arr = cnchar.radical(ch);
    if (arr && arr[0]) return arr[0];
  } catch (e) {
    return null;
  }
  return null;
}

const STROKE_NAMES = [
  "横",
  "竖",
  "撇",
  "捺",
  "点",
  "提",
  "横折",
  "横钩",
  "横撇",
  "横折钩",
  "横折提",
  "横折弯",
  "横折弯钩",
  "横撇弯钩",
  "横折折撇",
  "横折折折钩",
  "竖提",
  "竖折",
  "竖钩",
  "竖弯",
  "竖弯钩",
  "竖折折钩",
  "撇点",
  "撇折",
  "斜钩",
  "弯钩",
  "卧钩",
  "竖折撇",
];

module.exports = {
  isPinyin,
  getReadings,
  getPrimaryReading,
  getStrokeNames,
  getWords,
  getRadicalInfo,
  STROKE_NAMES,
};
