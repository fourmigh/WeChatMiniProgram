const data = require("./chars.data");

function parseMap(str) {
  const map = {};
  if (!str) return map;
  const lines = str.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const idx = line.indexOf("|");
    if (idx <= 0) continue;
    map[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return map;
}

const tierChars = data.tierChars.map((s) => Array.from(s));
const tierNames = data.tierNames;
const explainMap = parseMap(data.explains);
const radicalMap = parseMap(data.radicals);
const strokeMap = parseMap(data.strokes);

const allChars = tierChars.reduce((arr, t) => arr.concat(t), []);

const polyChars = data.polyphones ? Array.from(data.polyphones) : [];
const polySet = {};
for (const c of polyChars) polySet[c] = true;

const readingMap = {};
const readingLines = data.readings ? data.readings.split("\n") : [];
for (const line of readingLines) {
  const i = line.indexOf("|");
  if (i <= 0) continue;
  const ch = line.slice(0, i);
  const list = line.slice(i + 1).split(",").filter(Boolean);
  if (list.length) readingMap[ch] = list;
}

const senseMap = {};
const senseLines = data.senses ? data.senses.split("\n") : [];
for (const line of senseLines) {
  const i = line.indexOf("|");
  if (i <= 0) continue;
  const ch = line.slice(0, i);
  const entries = [];
  for (const seg of line.slice(i + 1).split(";")) {
    const c = seg.indexOf(":");
    if (c <= 0) continue;
    const p = seg.slice(0, c);
    const m = seg.slice(c + 1);
    if (p && m) entries.push({ p: p, m: m });
  }
  if (entries.length >= 2) senseMap[ch] = entries;
}

function listScopes() {
  return tierNames.map((name, index) => ({
    index,
    name,
    count: tierChars.slice(0, index + 1).reduce((n, t) => n + t.length, 0),
  }));
}

function getTierChars(tier) {
  const t = Number(tier);
  if (!isFinite(t) || t < 0 || t >= tierChars.length) return [];
  return tierChars[t].slice();
}

function getCharsByScope(scope) {
  const s = Number(scope);
  if (!isFinite(s) || s >= tierChars.length - 1) {
    // 全部档按难度倒序：其余 → 高中 → 初中 → 小学 → 启蒙
    const out = [];
    for (let i = tierChars.length - 1; i >= 0; i--) {
      out.push.apply(out, tierChars[i]);
    }
    return out;
  }
  return getTierChars(Math.max(0, s));
}

function getExplain(ch) {
  return explainMap[ch] || "";
}

function getRadical(ch) {
  return radicalMap[ch] || "";
}

function getStrokeCount(ch) {
  return Number(strokeMap[ch]) || 0;
}

function isPolyphone(ch) {
  return !!polySet[ch];
}

function getPolyChars(pool) {
  return pool.filter((c) => polySet[c]);
}

function getSenses(ch) {
  return senseMap[ch] || null;
}

function getReadings(ch) {
  return readingMap[ch] || [];
}

function getPrimaryReading(ch) {
  const list = readingMap[ch];
  return list && list.length ? list[0] : "";
}

function getTierOf(ch) {
  for (let i = 0; i < tierChars.length; i++) {
    if (tierChars[i].indexOf(ch) > -1) return i;
  }
  return -1;
}

const extraStrokeMap = {};
for (const line of (data.extraStrokes || "").split("\n")) {
  const i = line.indexOf("|");
  if (i <= 0) continue;
  const list = line.slice(i + 1).split(",").filter(Boolean);
  if (list.length) extraStrokeMap[line.slice(0, i)] = list;
}

const extraWordMap = {};
for (const line of (data.extraWords || "").split("\n")) {
  const i = line.indexOf("|");
  if (i <= 0) continue;
  const list = line.slice(i + 1).split(",").filter(Boolean);
  if (list.length) extraWordMap[line.slice(0, i)] = list;
}

function getExtraStrokeNames(ch) {
  return extraStrokeMap[ch] || null;
}

function getExtraWords(ch) {
  return extraWordMap[ch] || null;
}

module.exports = {
  tierNames,
  tierChars,
  allChars,
  explainMap,
  radicalMap,
  strokeMap,
  polyChars,
  listScopes,
  getTierChars,
  getCharsByScope,
  getExplain,
  getRadical,
  getStrokeCount,
  isPolyphone,
  getPolyChars,
  getSenses,
  getReadings,
  getPrimaryReading,
  getTierOf,
  getExtraStrokeNames,
  getExtraWords,
};
