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

function listScopes() {
  return tierNames.map((name, index) => ({
    index,
    name,
    count: tierChars.slice(0, index + 1).reduce((n, t) => n + t.length, 0),
  }));
}

function getCharsByScope(scope) {
  const scopes = [];
  for (let i = 0; i <= scope && i < tierChars.length; i++) {
    scopes.push.apply(scopes, tierChars[i]);
  }
  return scopes;
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

module.exports = {
  tierNames,
  tierChars,
  allChars,
  explainMap,
  radicalMap,
  strokeMap,
  listScopes,
  getCharsByScope,
  getExplain,
  getRadical,
  getStrokeCount,
};
