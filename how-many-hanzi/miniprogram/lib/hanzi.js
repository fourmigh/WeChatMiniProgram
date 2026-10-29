const chars = require("./chars");
const cnchar = require("./vendor/cnchar/cnchar.min.js");
cnchar.use(require("./vendor/cnchar/order.min.js"));
cnchar.use(require("./vendor/cnchar/radical.min.js"));
cnchar.use(require("./vendor/cnchar/words.min.js"));

function getReadings(ch) {
  return chars.getReadings(ch);
}

function getPrimaryReading(ch) {
  return chars.getPrimaryReading(ch);
}

function getStrokeNames(ch) {
  const extra = chars.getExtraStrokeNames(ch);
  if (extra && extra.length) return extra.slice();
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
  const extra = chars.getExtraWords(ch);
  if (extra && extra.length) return extra.slice();
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
  getReadings,
  getPrimaryReading,
  getStrokeNames,
  getWords,
  getRadicalInfo,
  STROKE_NAMES,
};
