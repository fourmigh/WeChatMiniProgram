const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..", "miniprogram", "lib");
const chars = require(path.join(base, "chars"));
const quiz = require(path.join(base, "quiz"));
const engine = require(path.join(base, "engine"));

const lines = [];
const log = (...args) => lines.push(args.join(" "));

const pool = chars.getCharsByScope(4);
log("all chars:", chars.allChars.length);
log("scopes:", chars.listScopes().map((s) => s.name + ":" + s.count).join(", "));

const samples = ["好", "行", "一", "学", "魑", "的", "乐"];
for (const ch of samples) {
  log("\n=== " + ch + " radical=" + chars.getRadical(ch) + " strokes=" + chars.getStrokeCount(ch) + " ===");
  for (let lv = 1; lv <= 7; lv++) {
    const q = quiz.buildQuestion(ch, lv, pool);
    if (!q) {
      log("L" + lv + ": null");
      continue;
    }
    log(
      "L" +
        lv +
        " [" +
        q.type +
        "] " +
        q.question +
        " => " +
        JSON.stringify(q.options) +
        " answer=" +
        JSON.stringify(q.answer)
    );
  }
}

log("\n=== session ===");
const s = engine.createSession(4, 10);
log("sample:", s.chars.join(""));

const t = engine.createCharTest("行");
let q = engine.questionFor(t, pool);
while (q) {
  const correct = Math.random() > 0.3;
  engine.applyAnswer(t, q, correct);
  log("answered L" + q.level + " correct=" + correct + " -> level " + t.level);
  if (t.done) break;
  q = engine.questionFor(t, pool);
}
engine.submitCharResult(s, t);
log("summary:", JSON.stringify(engine.summarize(s)));

fs.writeFileSync(path.join(__dirname, "test-out.txt"), lines.join("\n"), "utf8");
console.log("wrote", lines.length, "lines");
