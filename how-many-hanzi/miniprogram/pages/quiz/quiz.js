const chars = require("../../lib/chars");
const engine = require("../../lib/engine");
const quiz = require("../../lib/quiz");
const storage = require("../../lib/storage");
const levels = require("../../lib/levels");
const { definePage } = require("../../lib/page-base");
const i18n = require("../../lib/i18n");

const LEVELS = [
  { n: 1, label: i18n.t("pages.quiz.levelLabels.l1") },
  { n: 2, label: i18n.t("pages.quiz.levelLabels.l2") },
  { n: 3, label: i18n.t("pages.quiz.levelLabels.l3") },
  { n: 4, label: i18n.t("pages.quiz.levelLabels.l4") },
  { n: 5, label: i18n.t("pages.quiz.levelLabels.l5") },
  { n: 6, label: i18n.t("pages.quiz.levelLabels.l6") },
];

function decorate(options, selected) {
  const sel = selected || [];
  return options.map((v) => {
    let state = "";
    if (sel.indexOf(v) > -1) state = "selected";
    return { value: v, label: v, state: state };
  });
}

definePage({
  page: "quiz",
  titleKey: "pages.quiz.title",
  home: false,
  data: {
    mode: "test",
    levels: LEVELS,
    char: "",
    layout: "grid",
    level: 0,
    levelMark: "",
    questionMark: "",
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
    nextText: i18n.t("pages.quiz.next"),
    scrollTop: 0,
  },

  onLoad(options) {
    this.mode = options.mode === "single" ? "single" : "test";
    this.scope = Number(options.scope || 4);
    this.pool = chars.getCharsByScope(this.scope);

    if (this.mode === "single") {
      const ch = decodeURIComponent(options.char || "");
      if (chars.getTierOf(ch) < 0) {
        wx.showToast({ title: i18n.t("pages.quiz.blockedRare"), icon: "none" });
        setTimeout(function () {
          wx.navigateBack({ delta: 1 });
        }, 1200);
        return;
      }
      this.test = engine.createCharTest(ch);
      this.setData({
        mode: "single",
        char: ch,
        total: 1,
        progressText: i18n.t("pages.quiz.progressSingle"),
      });
      this.loadQuestion();
    } else {
      const size = Number(options.size || 20);
      this.session = engine.createSession(this.scope, size);
      this.setData({
        mode: "test",
        total: this.session.chars.length,
        progressText: i18n.t("pages.quiz.progressChar", {
          i: 1,
          n: this.session.chars.length,
        }),
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
      progressText: i18n.t("pages.quiz.progressChar", {
        i: this.session.index + 1,
        n: this.session.chars.length,
      }),
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
      layout: q.level === 3 ? "list" : "grid",
      level: this.test.level,
      levelMark: levels.markOf(this.test.level),
      questionMark: levels.markOf(q.level),
      optionViews: decorate(q.options, []),
      selected: [],
      multi: q.type === "multi",
      answered: false,
      isCorrect: false,
      feedback: "",
      feedbackSub: "",
      answerText: "",
      nextText: i18n.t("pages.quiz.next"),
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
      wx.showToast({ title: i18n.t("pages.quiz.toastSelectFirst"), icon: "none" });
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
    let nextText = i18n.t("pages.quiz.next");
    if (this.test.done) {
      nextText = lastChar
        ? i18n.t("pages.quiz.viewResult")
        : this.mode === "test"
        ? i18n.t("pages.quiz.nextChar")
        : i18n.t("pages.quiz.viewResult");
    }

    this.setData({
      answered: true,
      isCorrect: correct,
      optionViews: views,
      level: this.test.level,
      levelMark: levels.markOf(this.test.level),
      feedback: correct
        ? i18n.t("pages.quiz.correct")
        : i18n.t("pages.quiz.wrong"),
      feedbackSub: correct
        ? this.test.queue && this.test.queue.length
          ? i18n.t("pages.quiz.correctSubQueue")
          : i18n.t("pages.quiz.correctSubLevel", {
              mark: levels.markOf(q.level),
              name: q.levelName,
            })
        : i18n.t("pages.quiz.wrongSubLevel", {
            mark: levels.markOf(this.test.level),
            name: quiz.LEVEL_NAMES[this.test.level],
          }),
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
    if (chars.getTierOf(this.test.char) < 0) {
      wx.showToast({ title: i18n.t("pages.quiz.blockedRare"), icon: "none" });
      wx.navigateBack({ delta: 1 });
      return;
    }
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
