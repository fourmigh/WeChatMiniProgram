const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const LEVEL_DESC = levels.RESULT_DESC;
const LEVEL_LABEL = levels.LEVEL_NAMES;

definePage({
  page: "result",
  data: {
    result: null,
    mode: "test",
    desc: "",
    logRows: [],
    bars: [],
    hasResult: false,
  },

  onLoad(options) {
    const app = getApp();
    const result = app.globalData.result;
    if (!result) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const mode = result.mode || options.mode || "test";

    const data = {
      result: result,
      mode: mode,
      hasResult: true,
      pageTitle: i18n.t(
        mode === "single" ? "pages.result.titleSingle" : "pages.result.titleTest"
      ),
      levelMark: levels.markOf(result.level),
    };

    if (mode === "single") {
      data.desc = LEVEL_DESC[result.level] || "";
      const byLevel = {};
      (result.log || []).forEach((row) => {
        if (!byLevel[row.level]) {
          byLevel[row.level] = { level: row.level, ok: 0, total: 0 };
        }
        byLevel[row.level].total++;
        if (row.correct) byLevel[row.level].ok++;
      });
      data.logRows = Object.keys(byLevel)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((lv) => {
          const g = byLevel[lv];
          const allOk = g.ok === g.total;
          return {
            key: "L" + lv,
            level: lv,
            mark: levels.markOf(lv),
            name: LEVEL_LABEL[lv],
            ok: allOk,
            text: g.total > 1 ? g.ok + "/" + g.total : allOk ? "✓" : "✗",
          };
        });
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
          mark: levels.markOf(i),
          name: LEVEL_LABEL[i],
          count: count,
          width: Math.round((count / max) * 100),
          empty: count === 0,
        });
      }
      data.bars = bars;
      data.desc = i18n.t("pages.result.descSampled", { n: result.count });
      data.rank = levels.rankOf(result.mastery);
    }

    this.setData(data);
  },

  again() {
    const r = this.data.result;
    if (!r) return;
    if (r.mode === "test") {
      nav.go(
        "/pages/quiz/quiz?mode=test&scope=" + r.scope + "&size=" + r.count,
        i18n.t("common.navSampling")
      );
    } else {
      nav.go(
        "/pages/quiz/quiz?mode=single&char=" +
          encodeURIComponent(r.char) +
          "&scope=4",
        i18n.t("common.navPreparing")
      );
    }
  },

  goHistory() {
    nav.go("/pages/history/history");
  },
});
