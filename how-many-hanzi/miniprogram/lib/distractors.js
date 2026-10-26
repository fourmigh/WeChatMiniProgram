const chars = require("./chars");
const hanzi = require("./hanzi");
const { pickOne, pickN, unique } = require("./utils");

function randomPoolChar(pool, exclude) {
  for (let i = 0; i < 40; i++) {
    const c = pickOne(pool);
    if (c && c !== exclude && exclude.indexOf(c) === -1) return c;
  }
  return null;
}

function pickPinyins(correct, count, pool) {
  const out = [];
  const seen = {};
  seen[correct] = true;
  const base = correct.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, "");
  for (let i = 0; i < 60 && out.length < count; i++) {
    const c = randomPoolChar(pool, correct);
    if (!c) continue;
    const py = hanzi.getPrimaryReading(c);
    if (!py || seen[py]) continue;
    if (py.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, "") === base) continue;
    seen[py] = true;
    out.push(py);
  }
  return out;
}

function pickExplanations(correct, count, pool) {
  const out = [];
  const seen = {};
  seen[correct] = true;
  for (let i = 0; i < 80 && out.length < count; i++) {
    const c = randomPoolChar(pool, correct);
    if (!c) continue;
    const ex = chars.getExplain(c);
    if (!ex || seen[ex] || ex === correct) continue;
    seen[ex] = true;
    out.push(ex);
  }
  return out;
}

function pickWords(correctWord, count, pool) {
  const out = [];
  const seen = {};
  seen[correctWord] = true;
  const char = correctWord.charAt(0);
  for (let i = 0; i < 80 && out.length < count; i++) {
    const c = randomPoolChar(pool, char);
    if (!c) continue;
    const list = hanzi.getWords(c);
    if (!list.length) continue;
    const w = pickOne(list);
    if (!w || seen[w] || w.indexOf(char) !== -1) continue;
    if (Array.from(w).length > 4) continue;
    seen[w] = true;
    out.push(w);
  }
  return out;
}

function pickStrokeNames(correct, count) {
  const pool = hanzi.STROKE_NAMES.filter((n) => n !== correct);
  return pickN(pool, count);
}

function pickRadicals(correct, count, pool) {
  const out = [];
  const seen = {};
  seen[correct] = true;
  for (let i = 0; i < 80 && out.length < count; i++) {
    const c = randomPoolChar(pool, "");
    if (!c) continue;
    const r = chars.getRadical(c);
    if (!r || seen[r] || r === correct) continue;
    seen[r] = true;
    out.push(r);
  }
  return out;
}

function pickFormSimilar(ch, count, pool) {
  const targetRadical = chars.getRadical(ch);
  const targetStroke = chars.getStrokeCount(ch);
  const sameRadical = [];
  const nearStroke = [];
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (!c || c === ch) continue;
    const r = chars.getRadical(c);
    if (targetRadical && r === targetRadical) sameRadical.push(c);
    else if (targetStroke) {
      const s = chars.getStrokeCount(c);
      if (s && Math.abs(s - targetStroke) <= 1) nearStroke.push(c);
    }
  }
  let out = pickN(unique(sameRadical), count);
  if (out.length < count) {
    out = out.concat(pickN(unique(nearStroke).filter((c) => out.indexOf(c) === -1), count - out.length));
  }
  if (out.length < count) {
    out = out.concat(
      pickN(
        pool.filter((c) => c !== ch && out.indexOf(c) === -1),
        count - out.length
      )
    );
  }
  return out.slice(0, count);
}

module.exports = {
  pickPinyins,
  pickExplanations,
  pickWords,
  pickStrokeNames,
  pickRadicals,
  pickFormSimilar,
};
