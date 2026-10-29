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
  log("\n=== " + ch + " radical=" + chars.getRadical(ch) + " strokes=" + chars.getStrokeCount(ch) + " poly=" + chars.isPolyphone(ch) + " ===");
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

log("\n=== poly L2/L4 checks ===");
for (const ch of ["好", "行"]) {
  const l2 = quiz.buildQuestion(ch, 2, pool);
  const l4 = quiz.buildQuestion(ch, 4, pool);
  log(
    ch + " L2=null:" + (l2 === null) +
      " L4=" + (l4 ? l4.question + " | options=" + JSON.stringify(l4.options) + " | answer=" + JSON.stringify(l4.answer) : "null")
  );
}
for (const ch of ["一", "学"]) {
  const l2 = quiz.buildQuestion(ch, 2, pool);
  const l3 = quiz.buildQuestion(ch, 3, pool);
  log(ch + " L2!=null:" + (l2 !== null) + " L3=null:" + (l3 === null));
}

log("\n=== L4 group checks ===");
for (const ch of ["好", "行", "着"]) {
  const group = quiz.buildQuestionGroup(ch, 4, pool);
  if (!group) {
    log(ch + " L4 group: null");
    continue;
  }
  log(ch + " L4 group size: " + group.length);
  for (const q of group) {
    log("  " + q.question + " => answer=" + JSON.stringify(q.answer));
  }
}
const gSingle = quiz.buildQuestionGroup("学", 4, pool);
log("学 L4 group size: " + (gSingle ? gSingle.length : 0) + " (expect 1)");

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
