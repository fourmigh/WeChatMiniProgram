const chars = require("./chars");
const hanzi = require("./hanzi");
const D = require("./distractors");
const { shuffle, pickOne, randomInt } = require("./utils");
const i18n = require("./i18n");

const LEVEL_NAMES = require("../locales/zh-CN").levels.names.slice();

function buildOptions(correct, distractors) {
  return shuffle([correct].concat(distractors));
}

function buildQuestion(ch, level, pool) {
  switch (level) {
    case 1:
      return buildLevel1(ch, pool);
    case 2:
      return buildLevel2(ch, pool);
    case 3:
      return buildLevel3(ch, pool);
    case 4:
      return buildLevel4(ch, pool);
    case 5:
      return buildLevel5(ch, pool);
    case 6:
      return buildLevel6(ch, pool);
    default:
      return null;
  }
}

function buildQuestionGroup(ch, level, pool) {
  if (level !== 3) {
    const q = buildQuestion(ch, level, pool);
    return q ? [q] : null;
  }
  const senses = chars.getSenses(ch);
  if (senses && senses.length >= 2) {
    const group = [];
    for (const s of shuffle(senses)) {
      const q = buildSenseQuestion(ch, s, senses, pool);
      if (q) group.push(q);
    }
    if (group.length >= 2) return group;
  }
  const q = buildLevel3(ch, pool);
  return q ? [q] : null;
}

function buildSenseQuestion(ch, sense, senses, pool) {
  const others = [];
  const seen = {};
  for (const s of senses) {
    if (s.p === sense.p) continue;
    if (s.m === sense.m || seen[s.m]) continue;
    seen[s.m] = true;
    others.push(s.m);
  }
  let distractors = shuffle(others).slice(0, 3);
  if (distractors.length < 3) {
    const extra = D.pickExplanations(sense.m, 3 - distractors.length, pool).filter(
      (x) => x !== sense.m && distractors.indexOf(x) === -1
    );
    distractors = distractors.concat(extra);
  }
  if (distractors.length < 3) return null;
  const q = base(ch, 3, i18n.t("quiz.q.l3sense", { p: sense.p }));
  q.options = buildOptions(sense.m, distractors);
  q.answer = [sense.m];
  return q;
}

function base(ch, level, question) {
  return {
    char: ch,
    level: level,
    levelName: LEVEL_NAMES[level],
    type: "single",
    options: [],
    answer: [],
    question: question,
  };
}

function buildLevel1(ch, pool) {
  const distractors = D.pickFormSimilar(ch, 3, pool);
  if (distractors.length < 3) return null;
  const q = base(ch, 1, i18n.t("quiz.q.l1"));
  q.options = buildOptions(ch, distractors);
  q.answer = [ch];
  return q;
}

function buildLevel2(ch, pool) {
  const readings = chars.getReadings(ch).filter(Boolean);
  if (readings.length >= 2) {
    const seen = {};
    readings.forEach((r) => (seen[r] = true));
    const distractorCount = Math.min(3, Math.max(2, 5 - readings.length));
    const distractors = D.pickPinyins(readings[0], distractorCount, pool).filter(
      (p) => !seen[p]
    );
    if (!distractors.length) return null;
    const q = base(ch, 2, i18n.t("quiz.q.l2poly"));
    q.type = "multi";
    q.options = shuffle(readings.concat(distractors));
    q.answer = readings.slice();
    return q;
  }
  const correct = chars.getPrimaryReading(ch);
  if (!correct) return null;
  const distractors = D.pickPinyins(correct, 3, pool);
  if (distractors.length < 3) return null;
  const q = base(ch, 2, i18n.t("quiz.q.l2single"));
  q.options = buildOptions(correct, distractors);
  q.answer = [correct];
  return q;
}

function buildLevel3(ch, pool) {
  const correct = chars.getExplain(ch);
  if (!correct) return null;
  const distractors = D.pickExplanations(correct, 3, pool);
  if (distractors.length < 3) return null;
  const q = base(ch, 3, i18n.t("quiz.q.l3"));
  q.options = buildOptions(correct, distractors);
  q.answer = [correct];
  return q;
}

function buildLevel4(ch, pool) {
  const names = hanzi
    .getStrokeNames(ch)
    .map((n) => (n == null ? "" : String(n)))
    .map((s) => s.split("|")[0].replace(/\d+$/, ""))
    .filter((s) => s && s !== "null" && s !== "undefined");
  if (names.length < 2) return null;
  const idx = randomInt(names.length);
  const correct = names[idx];
  const distractors = D.pickStrokeNames(correct, 3);
  if (distractors.length < 3) return null;
  const q = base(ch, 4, i18n.t("quiz.q.l4", { n: idx + 1 }));
  q.options = buildOptions(correct, distractors);
  q.answer = [correct];
  return q;
}

function buildLevel5(ch, pool) {
  const words = hanzi.getWords(ch).filter((w) => {
    const len = Array.from(w).length;
    return len >= 2 && len <= 4 && w.indexOf(ch) !== -1;
  });
  if (!words.length) return null;
  const correct = pickOne(words);
  const distractors = D.pickWords(correct, 3, pool);
  if (distractors.length < 3) return null;
  const q = base(ch, 5, i18n.t("quiz.q.l5"));
  q.options = buildOptions(correct, distractors);
  q.answer = [correct];
  return q;
}

function buildLevel6(ch, pool) {
  const correct = chars.getRadical(ch);
  if (!correct) return null;
  const distractors = D.pickRadicals(correct, 3, pool);
  if (distractors.length < 3) return null;
  const q = base(ch, 6, i18n.t("quiz.q.l6"));
  q.options = buildOptions(correct, distractors);
  q.answer = [correct];
  return q;
}

function isCorrect(question, selected) {
  if (!question || !selected) return false;
  const answer = question.answer.slice().sort();
  const chosen = selected.slice().sort();
  if (answer.length !== chosen.length) return false;
  for (let i = 0; i < answer.length; i++) {
    if (answer[i] !== chosen[i]) return false;
  }
  return true;
}

module.exports = {
  LEVEL_NAMES,
  buildQuestion,
  buildQuestionGroup,
  isCorrect,
};
