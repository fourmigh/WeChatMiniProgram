const chars = require("./chars");
const quiz = require("./quiz");
const levels = require("./levels");
const { shuffle, pickN } = require("./utils");

const MAX_LEVEL = 6;

function createCharTest(ch) {
  return {
    char: ch,
    level: 0,
    next: 1,
    log: [],
    done: false,
    queue: [],
  };
}

function questionFor(test, pool) {
  if (test.queue && test.queue.length) {
    return test.queue.shift();
  }
  let lv = test.next;
  while (lv <= MAX_LEVEL) {
    const group = quiz.buildQuestionGroup(test.char, lv, pool);
    if (group && group.length) {
      test.queue = group.slice(1);
      return group[0];
    }
    lv++;
  }
  return null;
}

function applyAnswer(test, question, correct) {
  test.log.push({ level: question.level, correct: correct });
  if (correct) {
    if (test.queue && test.queue.length) {
      // 组内还有子题，级别保持，继续下一子题
    } else {
      test.level = question.level;
      test.next = question.level + 1;
      if (test.level >= MAX_LEVEL) test.done = true;
    }
  } else {
    test.queue = [];
    test.done = true;
  }
  return test;
}

function sampleChars(scope, sampleSize) {
  if (scope >= 4) {
    const weights = [0.072, 0.528, 0.25, 0.1, 0.05];
    const picked = [];
    for (let t = 0; t < chars.tierChars.length; t++) {
      let n = Math.round(weights[t] * sampleSize);
      if (t === chars.tierChars.length - 1) {
        n = sampleSize - picked.length;
      }
      picked.push.apply(picked, pickN(chars.tierChars[t], Math.max(0, n)));
    }
    if (picked.length < sampleSize) {
      picked.push.apply(picked, pickN(chars.allChars, sampleSize - picked.length));
    }
    return shuffle(picked).slice(0, sampleSize);
  }
  const pool = chars.getCharsByScope(scope);
  return pickN(pool, sampleSize);
}

function createSession(scope, sampleSize) {
  return {
    scope: scope,
    sampleSize: sampleSize,
    chars: sampleChars(scope, sampleSize),
    index: 0,
    results: [],
    startedAt: Date.now(),
  };
}

function currentChar(session) {
  return session.chars[session.index] || null;
}

function submitCharResult(session, test) {
  session.results.push({
    char: test.char,
    level: test.level,
    log: test.log,
  });
  session.index++;
  return session;
}

function summarize(session) {
  const results = session.results;
  const distribution = [0, 0, 0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (let i = 0; i < results.length; i++) {
    const lv = results[i].level;
    distribution[lv] = (distribution[lv] || 0) + 1;
    sum += lv;
  }
  const count = results.length || 1;
  const avg = sum / count;
  const mastery = (sum / (count * MAX_LEVEL)) * 100;
  const scopeTotal = chars.getCharsByScope(session.scope).length;
  const estimated = Math.round((mastery / 100) * scopeTotal);
  return {
    count: results.length,
    avgLevel: avg,
    avgLevelText: levels.avgText(avg),
    mastery: Math.round(mastery),
    distribution: distribution,
    scopeTotal: scopeTotal,
    estimated: estimated,
    results: results,
  };
}

module.exports = {
  MAX_LEVEL,
  createCharTest,
  questionFor,
  applyAnswer,
  createSession,
  currentChar,
  submitCharResult,
  summarize,
  sampleChars,
};
