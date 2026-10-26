const path = require("path");
const base = path.join(__dirname, "..", "miniprogram", "lib");
const chars = require(path.join(base, "chars"));
const quiz = require(path.join(base, "quiz"));
const engine = require(path.join(base, "engine"));

const errors = [];
let questionCount = 0;

function validate(q) {
  questionCount++;
  const opts = q.options;
  if (new Set(opts).size !== opts.length) errors.push("duplicate options L" + q.level + " " + q.char);
  if (opts.length < 3 || opts.length > 7) errors.push("bad option count " + opts.length + " L" + q.level + " " + q.char);
  for (const a of q.answer) {
    if (opts.indexOf(a) === -1) errors.push("answer not in options L" + q.level + " " + q.char);
  }
  if (q.type === "multi" && q.answer.length < 2) errors.push("multi with <2 answers " + q.char);
  if (q.type === "single" && q.answer.length !== 1) errors.push("single with !=1 answer " + q.char);
  if (!q.question) errors.push("empty question " + q.char);
}

for (let scope = 0; scope <= 4; scope++) {
  const pool = chars.getCharsByScope(scope);
  for (const size of [1, 10, 30]) {
    const s = engine.createSession(scope, size);
    if (s.chars.length !== Math.min(size, pool.length)) {
      errors.push("sample size mismatch scope=" + scope + " size=" + size + " got=" + s.chars.length);
    }
    if (new Set(s.chars).size !== s.chars.length) errors.push("duplicate sampled chars scope=" + scope);
    for (let i = 0; i < s.chars.length; i++) {
      const ch = engine.currentChar(s);
      const t = engine.createCharTest(ch);
      let guard = 0;
      let q = engine.questionFor(t, pool);
      while (q && guard++ < 20) {
        validate(q);
        const correct = Math.random() < 0.5;
        engine.applyAnswer(t, q, correct);
        if (t.done) break;
        q = engine.questionFor(t, pool);
      }
      if (t.level < 0 || t.level > 7) errors.push("bad level " + t.level + " " + ch);
      engine.submitCharResult(s, t);
    }
    const sum = engine.summarize(s);
    if (!isFinite(sum.avgLevel) || sum.mastery < 0 || sum.mastery > 100) {
      errors.push("bad summary scope=" + scope + " " + JSON.stringify(sum));
    }
  }
}

// random single-char tests over a wide sample
for (let i = 0; i < 300; i++) {
  const ch = chars.allChars[(i * 7919) % chars.allChars.length];
  const pool = chars.getCharsByScope(4);
  const t = engine.createCharTest(ch);
  let q = engine.questionFor(t, pool);
  let guard = 0;
  while (q && guard++ < 20) {
    validate(q);
    engine.applyAnswer(t, q, Math.random() < 0.5);
    if (t.done) break;
    q = engine.questionFor(t, pool);
  }
}

console.log("questions validated:", questionCount);
console.log("errors:", errors.length);
if (errors.length) {
  console.log(errors.slice(0, 30).join("\n"));
  process.exit(1);
}
