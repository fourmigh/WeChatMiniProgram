const nav = require("../../lib/nav");

const LEVEL_DESC = [
  "尚未认识",
  "能辨认字形，但读音、意义掌握有限",
  "知道一个读音",
  "掌握全部常见读音",
  "明白主要含义",
  "掌握笔顺，能够书写",
  "能组词、会运用",
  "了解部首与构字来源",
];

const LEVEL_LABEL = ["未识", "识形", "知音", "全音", "明义", "能写", "善用", "通源"];

Page({
  data: {
    result: null,
    mode: "test",
    desc: "",
    logRows: [],
    bars: [],
    hasResult: false,
  },

    onReady() {
    nav.ready();
  },

onLoad(options) {
    const app = getApp();
    const result = app.globalData.result;
    if (!result) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const mode = result.mode || options.mode || "test";
    wx.setNavigationBarTitle({
      title: mode === "single" ? "测字结果" : "自测结果",
    });

    const data = { result: result, mode: mode, hasResult: true, pageTitle: mode === "single" ? "测字结果" : "自测结果" };

    if (mode === "single") {
      data.desc = LEVEL_DESC[result.level] || "";
      data.logRows = (result.log || []).map((row, i) => ({
        key: row.level + "-" + i,
        level: row.level,
        name: LEVEL_LABEL[row.level],
        text: row.correct ? "答对" : "答错",
        ok: row.correct,
      }));
    } else {
      const dist = result.distribution || [];
      const max = Math.max.apply(
        null,
        dist.concat([1])
      );
      const bars = [];
      for (let i = 0; i < dist.length; i++) {
        const count = dist[i] || 0;
        bars.push({
          level: i,
          name: LEVEL_LABEL[i],
          count: count,
          width: Math.round((count / max) * 100),
          empty: count === 0,
        });
      }
      data.bars = bars;
      data.desc = "本次抽样 " + result.count + " 个字";
    }

    this.setData(data);
  },

  again() {
    const r = this.data.result;
    if (!r) return;
    if (r.mode === "test") {
      nav.go(
        "/pages/quiz/quiz?mode=test&scope=" + r.scope + "&size=" + r.count,
        "正在抽题"
      );
    } else {
      nav.go(
        "/pages/quiz/quiz?mode=single&char=" +
          encodeURIComponent(r.char) +
          "&scope=4",
        "正在准备题目"
      );
    }
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },

  goHistory() {
    nav.go("/pages/history/history");
  },
});
