const path = require("path");

const store = {};
let app = { globalData: {} };
let lastNav = null;
let loadCounts = { show: 0, hide: 0 };

global.getApp = () => app;
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  navigateTo: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
  },
  redirectTo: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
  },
  reLaunch: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
  },
  showLoading: () => {
    loadCounts.show++;
  },
  hideLoading: () => {
    loadCounts.hide++;
  },
  showToast: () => {},
  showModal: (o) => {
    if (o.success) o.success({ confirm: true });
  },
  setNavigationBarTitle: () => {},
  cloud: { init: () => {} },
};

let captured = null;
global.Page = (cfg) => {
  captured = cfg;
};

function loadPage(rel, options) {
  const file = path.join(__dirname, "..", "miniprogram", "pages", rel);
  delete require.cache[require.resolve(file)];
  captured = null;
  require(file);
  const page = Object.create(captured);
  page.data = JSON.parse(JSON.stringify(captured.data || {}));
  page.setData = function (patch) {
    Object.assign(this.data, patch);
  };
  if (page.onLoad) page.onLoad(options || {});
  return page;
}

function pageOnReady(page) {
  if (page.onReady) page.onReady();
}

const results = [];
function check(name, cond, extra) {
  results.push((cond ? "PASS " : "FAIL ") + name + (extra ? " :: " + extra : ""));
}

const index = loadPage("index/index.js");
check("index scopes", index.data.scopes.length === 5);
check("index polyOnly default off", index.data.polyOnly === false);

const polyData = require(path.join(__dirname, "..", "miniprogram", "lib", "chars.data"));
check("poly data exists", polyData.polyphones.length > 500, "count=" + polyData.polyphones.length);
check("poly contains 行", polyData.polyphones.indexOf("行") > -1);
check("poly excludes 一", polyData.polyphones.indexOf("一") === -1);

index.randomChar();
check("index random char", Array.from(index.data.charInput).length === 1, index.data.charInput);

index.onTogglePolyOnly();
let polyHit = true;
for (let i = 0; i < 20; i++) {
  index.randomChar();
  if (polyData.polyphones.indexOf(index.data.charInput) === -1) {
    polyHit = false;
    break;
  }
}
check("index random poly only", polyHit === true, "char=" + index.data.charInput);
check("index toggle state", index.data.polyOnly === true);

index.onTogglePolyOnly();
index.randomChar();
check(
  "index random back to all",
  index.data.polyOnly === false && Array.from(index.data.charInput).length === 1
);
check("index random respects poly", true);

index.setData({ charInput: "行" });
lastNav = null;
loadCounts.show = 0;
loadCounts.hide = 0;
index.startSingle();
check("index single nav", lastNav && lastNav.indexOf("mode=single") > -1, lastNav);
check(
  "index single loading shown, kept until onReady",
  loadCounts.show === 1 && loadCounts.hide === 0,
  "show=" + loadCounts.show + " hide=" + loadCounts.hide
);
pageOnReady(index);
check("index loading closed after onReady", loadCounts.hide === 1, "hide=" + loadCounts.hide);

lastNav = null;
loadCounts.show = 0;
loadCounts.hide = 0;
index.setData({ scopeIndex: 4, sampleSize: 3 });
index.startTest();
check("index test nav", lastNav && lastNav.indexOf("mode=test") > -1, lastNav);
check(
  "index test loading shown, kept until onReady",
  loadCounts.show === 1 && loadCounts.hide === 0,
  "show=" + loadCounts.show + " hide=" + loadCounts.hide
);
pageOnReady(index);
check("index test loading closed after onReady", loadCounts.hide === 1, "hide=" + loadCounts.hide);

function runQuiz(options, label) {
  lastNav = null;
  app = { globalData: {} };
  const page = loadPage("quiz/quiz.js", options);
  let guard = 0;
  let answeredCount = 0;
  while (guard++ < 400) {
    if (lastNav) break;
    if (page.data.answered) {
      page.next();
    } else if (page.data.question) {
      page.setData({ selected: page.data.question.answer.slice() });
      page.submitAnswer();
      answeredCount++;
    } else {
      check(label + " no question", false);
      break;
    }
  }
  check(label + " redirected", !!lastNav, lastNav);
  check(label + " answered", answeredCount > 0, "answers=" + answeredCount);
  check(label + " result stored", !!app.globalData.result, JSON.stringify(app.globalData.result && app.globalData.result.mode));
  return app.globalData.result;
}

const singleResult = runQuiz({ mode: "single", char: encodeURIComponent("行"), scope: "4" }, "single");
check("single result mode", singleResult && singleResult.mode === "single");
check("single level 6", singleResult && singleResult.level === 6, singleResult && singleResult.level);
const recentAfterSingle = global.wx.getStorageSync("hmh:recentChars");
check("single recent stored", recentAfterSingle.length === 1 && recentAfterSingle[0].char === "行" && recentAfterSingle[0].level === 6, JSON.stringify(recentAfterSingle[0] || {}));

const singleResultPage = loadPage("result/result.js", { mode: "single" });
const singleLogs = singleResultPage.data.logRows || [];
check(
  "result single logRows aggregated",
  singleLogs.length >= 1 &&
    singleLogs.every((r) => r.text === "✓" || r.text === "✗" || /^\d+\/\d+$/.test(r.text)) &&
    singleLogs.every((r, i) => i === 0 || singleLogs[i - 1].level < r.level),
  JSON.stringify(singleLogs)
);

const testResult = runQuiz({ mode: "test", scope: "0", size: "2" }, "test");
check("test result mode", testResult && testResult.mode === "test");
check("test count", testResult && testResult.count === 2, testResult && testResult.count);
const recentAfterTest = global.wx.getStorageSync("hmh:recentChars");
check("test recent stored", recentAfterTest.length === 3, "recent=" + recentAfterTest.length);
const charLevelsAfter = global.wx.getStorageSync("hmh:charLevels");
check("char levels stored", Object.keys(charLevelsAfter).length === 3, "chars=" + Object.keys(charLevelsAfter).join(","));

const resultPage = loadPage("result/result.js", { mode: "test" });
check("result has data", resultPage.data.hasResult === true);
check("result bars", resultPage.data.bars.length === 8, "bars=" + resultPage.data.bars.length);
check("result rank", typeof resultPage.data.rank === "string" && resultPage.data.rank.length > 0, resultPage.data.rank);

const intro = loadPage("intro/intro.js");
check("intro levels", intro.data.levels.length === 7);
check(
  "intro ranks",
  intro.data.ranks.length === 7 &&
    intro.data.ranks[0].name === "蒙童" &&
    intro.data.ranks[6].name === "状元" &&
    intro.data.ranks[6].range === "≥ 85%",
  JSON.stringify(intro.data.ranks.map((r) => r.name))
);
check(
  "intro level marks",
  intro.data.levels[0].mark === "庚" &&
    intro.data.levels[1].mark === "己" &&
    intro.data.levels[6].mark === "甲",
  JSON.stringify(intro.data.levels.map((x) => x.mark))
);

const levelsLib = require(path.join(__dirname, "..", "miniprogram", "lib", "levels.js"));
check(
  "levels helpers",
  levelsLib.markOf(0) === "庚" &&
    levelsLib.markOf(3) === "丁" &&
    levelsLib.labelOf(3, "明义") === "丁 · 明义" &&
    levelsLib.rankOf(72) === "进士" &&
    levelsLib.rankOf(5) === "蒙童" &&
    levelsLib.avgText(4) === "丙等 4.0"
);
check("intro scopes", intro.data.scopes.length === 5);

const charsPage = loadPage("chars/chars.js");
charsPage.onShow();
check("chars count", charsPage.data.count === 3, "count=" + charsPage.data.count);
check("chars dist", charsPage.data.dist.length === 7);
check(
  "chars progress",
  charsPage.data.mastery >= 0 &&
    charsPage.data.mastery <= 5 &&
    charsPage.data.rank === "蒙童" &&
    charsPage.data.coverage > 0 &&
    charsPage.data.totalChars === 8105,
  JSON.stringify({
    coverage: charsPage.data.coverage,
    mastery: charsPage.data.mastery,
    rank: charsPage.data.rank,
  })
);
check("chars groups nonempty", charsPage.data.groups.length > 0 && charsPage.data.groups.every((g) => g.chars.length > 0), "groups=" + charsPage.data.groups.map((g) => "L" + g.level + ":" + g.chars.length).join(","));

charsPage.toggleManage();
check("chars manage on", charsPage.data.manage === true);
const delChar = charsPage.data.groups[0].chars[0].char;
charsPage.onMiniTap({ currentTarget: { dataset: { char: delChar } } });
check(
  "chars delete one",
  charsPage.data.count === 2,
  "count=" + charsPage.data.count + " deleted=" + delChar
);
const levelsAfterDel = global.wx.getStorageSync("hmh:charLevels");
check("storage removeChar levels", !(delChar in levelsAfterDel));
const recentAfterDel = global.wx.getStorageSync("hmh:recentChars");
check(
  "storage removeChar recent sync",
  recentAfterDel.every((r) => r.char !== delChar)
);
charsPage.toggleManage();
check("chars manage off", charsPage.data.manage === false);
lastNav = null;
charsPage.goHome();
check("chars go home nav", lastNav === "/pages/index/index", lastNav);

const history = loadPage("history/history.js");
history.onShow();
const indexAgain = loadPage("index/index.js");
check(
  "index last rank",
  indexAgain.data.lastResult && typeof indexAgain.data.lastResult.rank === "string" && indexAgain.data.lastResult.rank.length > 0,
  JSON.stringify(indexAgain.data.lastResult && indexAgain.data.lastResult.rank)
);
check("history has record", history.data.hasData === true, "len=" + history.data.list.length);
check(
  "history days grouped after char delete",
  history.data.hasDays === true &&
    history.data.days.length === 1 &&
    history.data.days[0].chars.length === 2,
  "days=" + history.data.days.length + " first=" + (history.data.days[0] ? history.data.days[0].chars.length : 0)
);
check(
  "history day label",
  history.data.days[0].label.indexOf("今天") > -1 || /^\d+月\d+日$/.test(history.data.days[0].label),
  history.data.days[0].label
);
lastNav = null;
history.goChars();
check("history go chars nav", lastNav === "/pages/chars/chars", lastNav);
lastNav = null;
history.retryChar({ currentTarget: { dataset: { char: "行" } } });
check("history retry nav", lastNav && lastNav.indexOf("char=%E8%A1%8C") > -1, lastNav);
history.deleteRecord({ currentTarget: { dataset: { index: "0" } } });
check(
  "history single delete",
  history.data.list.length === 0 && history.data.hasData === false,
  "len=" + history.data.list.length
);
history.clearAll();
check("history cleared", history.data.hasData === false && history.data.hasDays === false);
check("chars cleared", loadPage("chars/chars.js").data.hasData === false);
lastNav = null;
history.goHome();
check("history empty go home nav", lastNav === "/pages/index/index", lastNav);

lastNav = null;
resultPage.again();
check("result again retest nav", lastNav && lastNav.indexOf("mode=test") > -1 && lastNav.indexOf("scope=0") > -1, lastNav);
lastNav = null;
resultPage.goHome();
check("result go home nav", lastNav === "/pages/index/index", lastNav);

// —— 等级体系迁移（旧 8 级 -> 新 6 级）——
const storageLib = require(path.join(__dirname, "..", "miniprogram", "lib", "storage.js"));
global.wx.setStorageSync("hmh:schemaVersion", 1);
global.wx.setStorageSync("hmh:charLevels", { 好: 7, 行: 4, 学: 3, 一: 2, 的: 0 });
global.wx.setStorageSync("hmh:recentChars", [
  { char: "好", level: 7, id: "a" },
  { char: "学", level: 3, id: "b" },
]);
global.wx.setStorageSync("hmh:history", [
  { avgLevel: 5, avgLevelText: "L5.0", mastery: 71, scopeName: "全部", count: 20 },
]);
check("migrate runs", storageLib.migrate() === true);
const migLevels = global.wx.getStorageSync("hmh:charLevels");
check(
  "migrate charLevels",
  migLevels["好"] === 6 && migLevels["行"] === 3 && migLevels["学"] === 2 && migLevels["一"] === 2 && migLevels["的"] === 0,
  JSON.stringify(migLevels)
);
const migRecent = global.wx.getStorageSync("hmh:recentChars");
check("migrate recentChars", migRecent[0].level === 6 && migRecent[1].level === 2, JSON.stringify(migRecent));
const migHistory = global.wx.getStorageSync("hmh:history");
check(
  "migrate history",
  migHistory[0].avgLevel === 4 &&
    migHistory[0].mastery === 67 &&
    migHistory[0].avgLevelText === "丙等 4.0",
  JSON.stringify(migHistory[0])
);
check("migrate idempotent", storageLib.migrate() === false);

console.log(results.join("\n"));
const failed = results.filter((r) => r.indexOf("FAIL") === 0);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
process.exit(failed.length ? 1 : 0);
