const chars = require("../../lib/chars");
const engine = require("../../lib/engine");
const quiz = require("../../lib/quiz");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");

const LEVELS = [
  { n: 1, label: "形" },
  { n: 2, label: "音" },
  { n: 3, label: "全音" },
  { n: 4, label: "义" },
  { n: 5, label: "写" },
  { n: 6, label: "用" },
  { n: 7, label: "源" },
];

function decorate(options, selected) {
  const sel = selected || [];
  return options.map((v) => {
    let state = "";
    if (sel.indexOf(v) > -1) state = "selected";
    return { value: v, label: v, state: state };
  });
}

Page({
  data: {
    mode: "test",
    levels: LEVELS,
    char: "",
    layout: "grid",
    level: 0,
    total: 0,
    index: 0,
    progressText: "",
    question: null,
    optionViews: [],
    selected: [],
    multi: false,
    answered: false,
    isCorrect: false,
    feedback: "",
    feedbackSub: "",
    answerText: "",
    nextText: "继续",
    scrollTop: 0,
  },

    onReady() {
    nav.ready();
  },

onLoad(options) {
    this.mode = options.mode === "single" ? "single" : "test";
    this.scope = Number(options.scope || 4);
    this.pool = chars.getCharsByScope(this.scope);

    if (this.mode === "single") {
      const ch = decodeURIComponent(options.char || "");
      this.test = engine.createCharTest(ch);
      this.setData({
        mode: "single",
        char: ch,
        total: 1,
        progressText: "单字测级",
      });
      this.loadQuestion();
    } else {
      const size = Number(options.size || 20);
      this.session = engine.createSession(this.scope, size);
      this.setData({
        mode: "test",
        total: this.session.chars.length,
        progressText: "第 1 / " + this.session.chars.length + " 字",
      });
      this.startCurrentChar();
    }
  },

  startCurrentChar() {
    const ch = engine.currentChar(this.session);
    if (!ch) {
      this.finishSession();
      return;
    }
    this.test = engine.createCharTest(ch);
    this.setData({
      char: ch,
      level: 0,
      index: this.session.index,
      progressText: "第 " + (this.session.index + 1) + " / " + this.session.chars.length + " 字",
    });
    this.loadQuestion();
  },

  loadQuestion() {
    const q = engine.questionFor(this.test, this.pool);
    if (!q) {
      this.finishChar();
      return;
    }
    this.setData({
      question: q,
      char: q.char,
      layout: q.level === 4 ? "list" : "grid",
      level: this.test.level,
      optionViews: decorate(q.options, []),
      selected: [],
      multi: q.type === "multi",
      answered: false,
      isCorrect: false,
      feedback: "",
      feedbackSub: "",
      answerText: "",
      nextText: "继续",
      scrollTop: 0,
    });
  },

  onOption(e) {
    if (this.data.answered) return;
    const value = e.currentTarget.dataset.value;
    if (this.data.multi) {
      const sel = this.data.selected.slice();
      const i = sel.indexOf(value);
      if (i > -1) sel.splice(i, 1);
      else sel.push(value);
      this.setData({
        selected: sel,
        optionViews: decorate(this.data.question.options, sel),
      });
    } else {
      this.setData({
        selected: [value],
        optionViews: decorate(this.data.question.options, [value]),
      });
      this.submitAnswer();
    }
  },

  submitAnswer() {
    if (this.data.answered) return;
    if (!this.data.selected.length) {
      wx.showToast({ title: "请先选择", icon: "none" });
      return;
    }
    const q = this.data.question;
    const selected = this.data.selected;
    const correct = quiz.isCorrect(q, selected);
    engine.applyAnswer(this.test, q, correct);

    const views = q.options.map((v) => {
      let state = "";
      if (q.answer.indexOf(v) > -1) state = "right";
      else if (selected.indexOf(v) > -1) state = "wrong";
      return { value: v, label: v, state: state };
    });

    const lastChar =
      this.mode === "test" && this.session.index + 1 >= this.session.chars.length;
    let nextText = "继续";
    if (this.test.done) nextText = lastChar ? "查看结果" : this.mode === "test" ? "下一个字" : "查看结果";

    this.setData({
      answered: true,
      isCorrect: correct,
      optionViews: views,
      level: this.test.level,
      feedback: correct ? "回答正确" : "回答错误",
      feedbackSub: correct
        ? this.test.queue && this.test.queue.length
          ? "回答正确，继续"
          : "达到 L" + q.level + " " + q.levelName
        : "停在 L" + this.test.level + " " + quiz.LEVEL_NAMES[this.test.level],
      answerText: q.answer.join(" / "),
      nextText: nextText,
    });
  },

  next() {
    if (!this.data.answered) return;
    if (this.test.done) {
      this.finishChar();
      return;
    }
    this.loadQuestion();
  },

  finishChar() {
    storage.addCharRecord({
      char: this.test.char,
      level: this.test.level,
      levelName: quiz.LEVEL_NAMES[this.test.level],
      dateText: this.formatDate(new Date()),
    });
    if (this.mode === "single") {
      const result = {
        mode: "single",
        char: this.test.char,
        level: this.test.level,
        levelName: quiz.LEVEL_NAMES[this.test.level],
        log: this.test.log,
      };
      getApp().globalData.result = result;
      wx.redirectTo({ url: "/pages/result/result?mode=single" });
      return;
    }

    engine.submitCharResult(this.session, this.test);
    if (this.session.index >= this.session.chars.length) {
      this.finishSession();
    } else {
      this.startCurrentChar();
    }
  },

  finishSession() {
    const summary = engine.summarize(this.session);
    const scopeName = chars.listScopes()[this.scope].name;
    const result = Object.assign(
      { mode: "test", scope: this.scope, scopeName: scopeName },
      summary
    );
    getApp().globalData.result = result;
    storage.addHistory({
      scopeName: scopeName,
      avgLevelText: summary.avgLevelText,
      avgLevel: summary.avgLevel,
      mastery: summary.mastery,
      estimated: summary.estimated,
      count: summary.count,
      createdAt: Date.now(),
      dateText: this.formatDate(new Date()),
    });
    wx.redirectTo({ url: "/pages/result/result?mode=test" });
  },

  formatDate(d) {
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});
