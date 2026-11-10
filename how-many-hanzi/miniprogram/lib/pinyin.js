let table = null;

function build() {
  const map = new Map();
  const raw = require("./pinyin.data");
  for (const line of raw.split("\n")) {
    const i = line.indexOf("\t");
    if (i < 1) continue;
    const py = line.slice(0, i);
    for (const ch of line.slice(i + 1)) map.set(ch, py);
  }
  return map;
}

function data() {
  if (!table) table = build();
  return table;
}

function getPinyin(ch) {
  if (!ch || typeof ch !== "string") return [];
  if (Array.from(ch).length !== 1) return [];
  const py = data().get(ch);
  return py ? py.split(",") : [];
}

function hasPinyin(ch) {
  return getPinyin(ch).length > 0;
}

module.exports = {
  getPinyin,
  hasPinyin,
};
