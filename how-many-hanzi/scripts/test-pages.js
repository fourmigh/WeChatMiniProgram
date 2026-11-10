const path = require("path");

const store = {};
let app = { globalData: {} };
let lastNav = null;
let lastBack = null;
let loadCounts = { show: 0, hide: 0 };

global.getApp = () => app;
global.getCurrentPages = () => [];
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  navigateTo: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
    if (o.complete) o.complete();
  },
  redirectTo: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
    if (o.complete) o.complete();
  },
  reLaunch: (o) => {
    lastNav = o.url;
    if (o.success) o.success();
  },
  showNavigationBarLoading: () => {
    loadCounts.show++;
  },
  hideNavigationBarLoading: () => {
    loadCounts.hide++;
  },
  navigateBack: (o) => {
    lastBack = (o && o.delta) || 1;
    if (o && o.complete) o.complete();
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
  page.setData = function (patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === "function") cb.call(this);
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
  "index single nav no bar loading",
  loadCounts.show === 0,
  "show=" + loadCounts.show
);
pageOnReady(index);
check(
  "index onReady clears bar loading",
  loadCounts.hide >= 1,
  "hide=" + loadCounts.hide
);

lastNav = null;
loadCounts.show = 0;
loadCounts.hide = 0;
index.setData({ scopeIndex: 4, sampleSize: 3 });
index.startTest();
check("index test nav", lastNav && lastNav.indexOf("mode=test") > -1, lastNav);
check(
  "index test nav no bar loading",
  loadCounts.show === 0,
  "show=" + loadCounts.show
);
pageOnReady(index);
check(
  "index test onReady clears bar loading",
  loadCounts.hide >= 1,
  "hide=" + loadCounts.hide
);

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

const singleResult = runQuiz({ mode: "single", char: encodeURIComponent("魑"), scope: "4" }, "single");
check("single result mode", singleResult && singleResult.mode === "single");
check("single level 6", singleResult && singleResult.level === 6, singleResult && singleResult.level);
const recentAfterSingle = global.wx.getStorageSync("hmh:recentChars");
check("single recent stored", recentAfterSingle.length === 1 && recentAfterSingle[0].char === "魑" && recentAfterSingle[0].level === 6, JSON.stringify(recentAfterSingle[0] || {}));

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
  intro.data.ranks.length === 8 &&
    intro.data.ranks[0].name === "白丁" &&
    intro.data.ranks[0].range === "测字 < 18" &&
    intro.data.ranks[1].name === "蒙童" &&
    intro.data.ranks[7].name === "状元" &&
    intro.data.ranks[7].range === "≥ 85%",
  JSON.stringify(intro.data.ranks.map((r) => r.name))
);
check(
  "intro level marks",
  intro.data.levels[0].mark === "庚" &&
    intro.data.levels[1].mark === "己" &&
    intro.data.levels[6].mark === "甲",
  JSON.stringify(intro.data.levels.map((x) => x.mark))
);

const hanziLib = require(path.join(__dirname, "..", "miniprogram", "lib", "hanzi.js"));
check("hanzi strokes for lib char", hanziLib.getStrokeNames("好").length > 0);
check(
  "hanzi strokes empty for rare char",
  hanziLib.getStrokeNames("峠").length === 0 && hanziLib.getStrokeNames("𠀀").length === 0,
  "峠=" + hanziLib.getStrokeNames("峠").length + " 𠀀=" + hanziLib.getStrokeNames("𠀀").length
);
const i18nLib = require(path.join(__dirname, "..", "miniprogram", "lib", "i18n.js"));
check(
  "i18n template params",
  i18nLib.t("pages.charsList.subHidden", { n: 3 }) === "隐藏 · 已收集 3 字",
  i18nLib.t("pages.charsList.subHidden", { n: 3 })
);
check(
  "i18n page text merges common",
  i18nLib.pageText("index").home === "回首页" &&
    i18nLib.pageText("index").title === "我到底认识几个汉字",
  JSON.stringify(Object.keys(i18nLib.pageText("index")).slice(0, 4))
);
check(
  "page data injects T",
  index.data.T && index.data.T.startSingle === "开始测这个字",
  index.data.T ? index.data.T.startSingle : "missing"
);
const pinyinLib = require(path.join(__dirname, "..", "miniprogram", "lib", "pinyin.js"));
check(
  "pinyin for rare char",
  JSON.stringify(pinyinLib.getPinyin("囍")) === JSON.stringify(["xǐ"]) &&
    JSON.stringify(pinyinLib.getPinyin("峠")) === JSON.stringify(["qiǎ"]),
  JSON.stringify(pinyinLib.getPinyin("囍"))
);
check(
  "pinyin for ext-B char",
  JSON.stringify(pinyinLib.getPinyin("𠀀")) === JSON.stringify(["hē"]),
  JSON.stringify(pinyinLib.getPinyin("𠀀"))
);
check(
  "pinyin skips lib char and non-hanzi",
  pinyinLib.getPinyin("好").length === 0 && pinyinLib.getPinyin("A").length === 0
);
check(
  "pinyin polyphonic rare char",
  JSON.stringify(pinyinLib.getPinyin("㐷")) ===
    JSON.stringify(["mǎ", "mà", "mián"]),
  JSON.stringify(pinyinLib.getPinyin("㐷"))
);
const levelsLib = require(path.join(__dirname, "..", "miniprogram", "lib", "levels.js"));
const progressLib = require(path.join(__dirname, "..", "miniprogram", "lib", "progress.js"));
function fakeLevels(n, lv) {
  const m = {};
  for (let i = 0; i < n; i++) m["字" + i] = lv;
  return m;
}
check(
  "progress zero is 白丁",
  progressLib.calcProgress({}, 8105).rank === levelsLib.RANK_ZERO
);
check(
  "progress 17 chars still 白丁",
  progressLib.calcProgress(fakeLevels(17, 6), 8105).rank === "白丁",
  JSON.stringify(progressLib.calcProgress(fakeLevels(17, 6), 8105))
);
check(
  "progress 18 chars leaves 白丁",
  progressLib.calcProgress(fakeLevels(18, 6), 8105).rank === "蒙童",
  JSON.stringify(progressLib.calcProgress(fakeLevels(18, 6), 8105))
);
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
intro.viewportH = 400;
intro.onScroll({ detail: { scrollTop: 100, scrollHeight: 1000 } });
check(
  "intro scrollbar calc",
  intro.data.showBar === true &&
    intro.data.barHeight === 40 &&
    intro.data.barTop === 10,
  JSON.stringify({ top: intro.data.barTop, h: intro.data.barHeight })
);

const introRank = loadPage("intro/intro.js", { anchor: "rank" });
pageOnReady(introRank);
check(
  "intro rank anchor scroll",
  introRank.data.intoView === "rank-card",
  introRank.data.intoView
);

lastNav = null;
index.goRankIntro();
check("index go rank intro nav", lastNav === "/pages/intro/intro?anchor=rank", lastNav);

// —— 字库浏览（列表页 / 详情页） ——
lastNav = null;
intro.openScope({ currentTarget: { dataset: { index: 2 } } });
check("intro open scope nav", lastNav === "/pages/chars-list/chars-list?scope=2", lastNav);

const listPage = loadPage("chars-list/chars-list.js", { scope: "1" });
check(
  "list default scope",
  listPage.data.scope === 1 &&
    listPage.data.pool.length === 2201 &&
    listPage.data.scopeName === "小学" &&
    listPage.data.subText === "小学 · 共 2501 字（本档新字 2201）",
  JSON.stringify({
    scope: listPage.data.scope,
    pool: listPage.data.pool.length,
    sub: listPage.data.subText,
  })
);
check(
  "list first batch",
  listPage.data.chars.length === 200 &&
    listPage.data.chars.every((x) => x.type === "char") &&
    listPage.data.hasMore === true,
  "chars=" + listPage.data.chars.length
);

const somePrimaryChar = listPage.data.pool[0];
listPage.onSearch({ detail: { value: somePrimaryChar } });
check(
  "list search hit",
  listPage.data.chars.length === 1 &&
    listPage.data.chars[0].char === somePrimaryChar,
  "char=" + somePrimaryChar
);
listPage.onSearch({ detail: { value: "一" } });
check(
  "list search miss (tier0 char not in primary)",
  listPage.data.chars.length === 0 && listPage.data.emptyHint.length > 0,
  listPage.data.emptyHint
);
listPage.onSearch({ detail: { value: "" } });
check("list search reset", listPage.data.chars.length === 200);

listPage.onScopeTap({ currentTarget: { dataset: { index: 4 } } });
check(
  "list scope switch",
  listPage.data.scope === 4 &&
    listPage.data.pool.length === 8105 &&
    listPage.data.scopeName === "全部" &&
    listPage.data.subText === "全部 · 共 8105 字",
  JSON.stringify({
    scope: listPage.data.scope,
    pool: listPage.data.pool.length,
    sub: listPage.data.subText,
  })
);
check(
  "list all-scope tier dividers",
  listPage.data.chars[0].type === "divider" &&
    listPage.data.chars[0].title === "全部" &&
    listPage.data.chars.filter((x) => x.type === "divider").length === 1 &&
    listPage.data.chars.filter((x) => x.type === "char").length === 200,
  JSON.stringify({
    first: listPage.data.chars[0],
    dividers: listPage.data.chars.filter((x) => x.type === "divider").length,
  })
);

listPage.setData({ batch: 3000 });
listPage.renderBatch();
const dividersAfterLoad = listPage.data.chars.filter((x) => x.type === "divider");
check(
  "list dividers after load-more",
  dividersAfterLoad.length === 2 && dividersAfterLoad[1].title === "高中",
  JSON.stringify(dividersAfterLoad.map((d) => d.title))
);

const listZero = loadPage("chars-list/chars-list.js", { scope: "0" });
check(
  "list 启蒙 subText",
  listZero.data.pool.length === 300 &&
    listZero.data.subText === "启蒙 · 共 300 字",
  JSON.stringify({ pool: listZero.data.pool.length, sub: listZero.data.subText })
);

const charsLibForScope = require(path.join(__dirname, "..", "miniprogram", "lib", "chars.js"));
check(
  "scopes keep cumulative counts",
  JSON.stringify(charsLibForScope.listScopes().map((s) => s.count)) ===
    JSON.stringify([300, 2501, 3500, 5500, 8105]),
  JSON.stringify(charsLibForScope.listScopes().map((s) => s.count))
);
check(
  "getCharsByScope is per-tier",
  charsLibForScope.getCharsByScope(0).length === 300 &&
    charsLibForScope.getCharsByScope(1).length === 2201 &&
    charsLibForScope.getCharsByScope(2).length === 999 &&
    charsLibForScope.getCharsByScope(3).length === 2000 &&
    charsLibForScope.getCharsByScope(4).length === 8105,
  JSON.stringify([0, 1, 2, 3, 4].map((s) => charsLibForScope.getCharsByScope(s).length))
);

const targetIdx = listPage.data.pool.indexOf("魑");
listPage.viewportH = 500;
listPage.onScroll({ detail: { scrollTop: 250, scrollHeight: 1000 } });
check(
  "list scrollbar calc",
  listPage.data.showBar === true &&
    listPage.data.barHeight === 50 &&
    listPage.data.barTop === 25,
  JSON.stringify({ top: listPage.data.barTop, h: listPage.data.barHeight })
);
listPage.setPendingChar("魑");
listPage.onShow();check(
  "list return scroll",
  listPage.data.intoView === "cell-" + targetIdx &&
    listPage.data.chars.length > targetIdx,
  "intoView=" + listPage.data.intoView + " chars=" + listPage.data.chars.length + " idx=" + targetIdx
);
check(
  "list return highlight",
  listPage.data.highlightIndex === targetIdx,
  "hl=" + listPage.data.highlightIndex
);

const hangIdx = listPage.data.pool.indexOf("行");
const detailPage = loadPage("char-detail/char-detail.js", {
  char: encodeURIComponent("行"),
  scope: "4",
  i: String(hangIdx),
});
check(
  "detail data complete",
  detailPage.data.char === "行" &&
    detailPage.data.readings.length >= 2 &&
    detailPage.data.senses.length >= 2 &&
    detailPage.data.strokeNames.length > 0 &&
    detailPage.data.words.length > 0 &&
    detailPage.data.radical === "行" &&
    detailPage.data.strokes === 6,
  JSON.stringify({
    readings: detailPage.data.readings,
    senses: detailPage.data.senses.length,
    strokes: detailPage.data.strokeNames.length,
    words: detailPage.data.words.length,
  })
);
check(
  "detail tier of char",
  detailPage.data.tierName === "启蒙" &&
    require(path.join(__dirname, "..", "miniprogram", "lib", "chars.js")).getTierOf("魑") === 3,
  detailPage.data.tierName
);

detailPage.goNext();
check("detail next char", detailPage.data.char !== "行", detailPage.data.char);
detailPage.goPrev();
check("detail prev char", detailPage.data.char === "行", detailPage.data.char);

global.getCurrentPages = () => [listPage, detailPage];
detailPage.onUnload();
check(
  "detail unload passes char",
  listPage.pendingChar === "行" && detailPage.viewChar === "行",
  "pending=" + listPage.pendingChar
);

const charsPage = loadPage("chars/chars.js");
charsPage.onShow();
check("chars count", charsPage.data.count === 3, "count=" + charsPage.data.count);
check("chars dist", charsPage.data.dist.length === 7);
check(
  "chars progress",
  charsPage.data.mastery >= 0 &&
    charsPage.data.mastery <= 5 &&
    charsPage.data.rank === "白丁" &&
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
  "index current rank",
  typeof indexAgain.data.currentRank === "string" &&
    indexAgain.data.currentRank.length > 0,
  JSON.stringify({
    rank: indexAgain.data.currentRank,
    mastery: indexAgain.data.currentMastery,
  })
);
check(
  "index last result has no rank",
  indexAgain.data.lastResult && indexAgain.data.lastResult.rank === undefined
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

lastBack = null;
global.getCurrentPages = () => [
  { route: "pages/index/index" },
  { route: "pages/chars/chars" },
  { route: "pages/result/result" },
];
resultPage.goHome();
check("result go home via navigateBack", lastBack === 2, "delta=" + lastBack);
global.getCurrentPages = () => [];

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

// —— 隐藏款（库外字收藏）——
storageLib.clearAll();
const addedFirst = storageLib.addRareChar("峠");
const addedAgain = storageLib.addRareChar("峠");
check("rare add & dedupe", addedFirst === true && addedAgain === false);
storageLib.addRareChar("𠀀");
const rares = storageLib.getRareChars();
check(
  "rare order newest first",
  rares.length === 2 &&
    rares[0].char === "𠀀" &&
    rares[1].char === "峠" &&
    !!rares[0].dateText,
  JSON.stringify(rares.map((r) => r.char))
);
storageLib.clearAll();
check("rare survives clearAll", storageLib.getRareChars().length === 2);
const charsRareEmpty = loadPage("chars/chars.js");
charsRareEmpty.onShow();
check(
  "chars rare entry visible with no chars",
  charsRareEmpty.data.hasData === false && charsRareEmpty.data.rareCount === 2,
  "hasData=" + charsRareEmpty.data.hasData + " rare=" + charsRareEmpty.data.rareCount
);

const hiddenList = loadPage("chars-list/chars-list.js", { scope: "hidden" });
check(
  "hidden list page",
  hiddenList.data.scope === "hidden" &&
    hiddenList.data.isHidden === true &&
    hiddenList.data.pool.length === 2 &&
    hiddenList.data.chars.length === 2,
  JSON.stringify({
    scope: hiddenList.data.scope,
    pool: hiddenList.data.pool.length,
    chars: hiddenList.data.chars.length,
  })
);
check(
  "hidden subtitle",
  hiddenList.data.subText === "隐藏 · 已收集 2 字",
  hiddenList.data.subText
);

const hiddenDetail = loadPage("char-detail/char-detail.js", {
  char: encodeURIComponent("峠"),
  scope: "hidden",
  i: "1",
});
check(
  "hidden detail page",
  hiddenDetail.data.isHidden === true &&
    hiddenDetail.data.char === "峠" &&
    hiddenDetail.data.rareDate.length > 0 &&
    hiddenDetail.data.readings.length > 0 &&
    hiddenDetail.data.tierName === "",
  JSON.stringify({
    hidden: hiddenDetail.data.isHidden,
    rareDate: hiddenDetail.data.rareDate,
    tier: hiddenDetail.data.tierName,
  })
);
check(
  "hidden detail pinyin filled",
  JSON.stringify(hiddenDetail.data.readings) === JSON.stringify(["qiǎ"]),
  JSON.stringify(hiddenDetail.data.readings)
);
check(
  "hidden detail no stroke card",
  hiddenDetail.data.strokeNames.length === 0,
  "strokes=" + hiddenDetail.data.strokeNames.length
);
const quizRare = loadPage("quiz/quiz.js", {
  mode: "single",
  char: encodeURIComponent("峠"),
  scope: "4",
});
check(
  "quiz blocks out-of-library char",
  quizRare.data.char === "" &&
    storageLib.getCharLevels()["峠"] === undefined,
  "char=" + quizRare.data.char
);

lastNav = null;
index.setData({ charInput: "峠" });
index.startSingle();
check("index rare already-collected no nav", lastNav === null);
check(
  "index rare keeps input after collect",
  index.data.charInput === "峠",
  "input=" + index.data.charInput
);
lastNav = null;
index.setData({ charInput: "A" });
index.startSingle();
check(
  "index rejects non-hanzi input",
  lastNav === null &&
    !storageLib.getRareChars().some((r) => r.char === "A"),
  "nav=" + lastNav
);
lastNav = null;
index.setData({ charInput: "" });
index.startSingle();
check("index empty input no random test", lastNav === null, "nav=" + lastNav);
index.setData({ charInput: "龘" });
index.startSingle();
check(
  "index rare collected and guided",
  lastNav === "/pages/chars-list/chars-list?scope=hidden" &&
    storageLib.getRareChars().some((r) => r.char === "龘"),
  JSON.stringify({
    nav: lastNav,
    rares: storageLib.getRareChars().map((r) => r.char),
  })
);

storageLib.saveCharLevel("峠", 0);
const charsRare = loadPage("chars/chars.js");
charsRare.onShow();
check(
  "chars rare entry count",
  charsRare.data.rareCount === 3,
  "rareCount=" + charsRare.data.rareCount
);
check(
  "chars filters out-of-library records",
  charsRare.data.groups.every((g) =>
    g.chars.every((c) => c.char !== "峠")
  ),
  "count=" + charsRare.data.count
);
lastNav = null;
charsRare.goRare();
check(
  "chars go rare nav",
  lastNav === "/pages/chars-list/chars-list?scope=hidden",
  lastNav
);

// —— L1 收紧（无部首/笔画的字跳过 L1）——
const quizLib2 = require(path.join(__dirname, "..", "miniprogram", "lib", "quiz.js"));
const charsLib2 = require(path.join(__dirname, "..", "miniprogram", "lib", "chars.js"));
const poolAll = charsLib2.getCharsByScope(4);
check("L1 still works for normal char", !!quizLib2.buildQuestion("好", 1, poolAll));
check(
  "L1 skipped for char without form data",
  quizLib2.buildQuestion("峠", 1, poolAll) === null
);

// 导航栏 loading：页面隐藏时清理，避免返回后残留转圈
const navLibForReset = require(path.join(__dirname, "..", "miniprogram", "lib", "nav.js"));
navLibForReset.go("/pages/intro/intro");
const hideBeforeReset = loadCounts.hide;
index.onHide();
check(
  "page hide resets nav loading",
  loadCounts.hide === hideBeforeReset + 1,
  "hide=" + loadCounts.hide
);
console.log(results.join("\n"));
const failed = results.filter((r) => r.indexOf("FAIL") === 0);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
process.exit(failed.length ? 1 : 0);
