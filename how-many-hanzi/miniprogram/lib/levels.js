const LEVEL_TEXT = require("../locales/zh-CN").levels;

const LEVEL_MARKS = LEVEL_TEXT.marks.slice();
const LEVEL_NAMES = LEVEL_TEXT.names.slice();
const RESULT_DESC = LEVEL_TEXT.resultDesc.slice();
const INTRO_DESC = LEVEL_TEXT.introDesc.slice();

const RANK_ZERO = LEVEL_TEXT.zero.name;
const RANK_MIN_CHARS = LEVEL_TEXT.minChars;

const RANKS = LEVEL_TEXT.rankOrder
  .slice()
  .reverse()
  .map((key) => ({
    key: key,
    min: LEVEL_TEXT.ranks[key].min,
    name: LEVEL_TEXT.ranks[key].name,
    desc: LEVEL_TEXT.ranks[key].desc,
  }));

function markOf(level) {
  return LEVEL_MARKS[Number(level)] || "";
}

function levelName(level) {
  return LEVEL_NAMES[Number(level)] || "";
}

function labelOf(level, name) {
  const mark = markOf(level);
  return mark ? mark + " · " + name : name || "";
}

function rankOf(percent) {
  const p = Number(percent) || 0;
  for (const r of RANKS) {
    if (p >= r.min) return r.name;
  }
  return RANKS[RANKS.length - 1].name;
}

function avgText(avg) {
  const value = Number(avg) || 0;
  const lv = Math.min(Math.round(value), 6);
  return LEVEL_TEXT.avgText
    .replace("{mark}", markOf(lv))
    .replace("{value}", value.toFixed(1));
}

module.exports = {
  LEVEL_MARKS,
  LEVEL_NAMES,
  RESULT_DESC,
  INTRO_DESC,
  RANKS,
  RANK_ZERO,
  RANK_MIN_CHARS,
  markOf,
  levelName,
  labelOf,
  rankOf,
  avgText,
};
