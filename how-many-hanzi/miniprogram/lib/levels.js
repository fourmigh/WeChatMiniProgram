const LEVEL_MARKS = ["庚", "己", "戊", "丁", "丙", "乙", "甲"];

const RANK_ZERO = "白丁";
const RANK_MIN_CHARS = 18;

const RANKS = [
  { min: 85, name: "状元", desc: "登峰造极" },
  { min: 70, name: "进士", desc: "融会贯通" },
  { min: 55, name: "贡士", desc: "登堂入室" },
  { min: 40, name: "举人", desc: "渐入佳境" },
  { min: 25, name: "秀才", desc: "粗通文义" },
  { min: 10, name: "童生", desc: "略有所得" },
  { min: 0, name: "蒙童", desc: "初识门径" },
];

function markOf(level) {
  return LEVEL_MARKS[Number(level)] || "";
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
  return markOf(lv) + "等 " + value.toFixed(1);
}

module.exports = {
  LEVEL_MARKS,
  RANKS,
  RANK_ZERO,
  RANK_MIN_CHARS,
  markOf,
  labelOf,
  rankOf,
  avgText,
};
