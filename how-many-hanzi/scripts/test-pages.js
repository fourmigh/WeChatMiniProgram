const path = require("path");

const store = {};
let app = { globalData: {} };
let lastNav = null;

global.getApp = () => app;
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  navigateTo: (o) => {
    lastNav = o.url;
  },
  redirectTo: (o) => {
    lastNav = o.url;
  },
  reLaunch: (o) => {
    lastNav = o.url;
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

const results = [];
function check(name, cond, extra) {
  results.push((cond ? "PASS " : "FAIL ") + name + (extra ? " :: " + extra : ""));
}

const index = loadPage("index/index.js");
check("index scopes", index.data.scopes.length === 5);
index.randomChar();
check("index random char", index.data.charInput.length === 1, index.data.charInput);
index.setData({ charInput: "行" });
lastNav = null;
index.startSingle();
check("index single nav", lastNav && lastNav.indexOf("mode=single") > -1, lastNav);

lastNav = null;
index.setData({ scopeIndex: 4, sampleSize: 3 });
index.startTest();
check("index test nav", lastNav && lastNav.indexOf("mode=test") > -1, lastNav);

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
check("single level 7", singleResult && singleResult.level === 7, singleResult && singleResult.level);

const testResult = runQuiz({ mode: "test", scope: "0", size: "2" }, "test");
check("test result mode", testResult && testResult.mode === "test");
check("test count", testResult && testResult.count === 2, testResult && testResult.count);

const resultPage = loadPage("result/result.js", { mode: "test" });
check("result has data", resultPage.data.hasResult === true);
check("result bars", resultPage.data.bars.length === 8, "bars=" + resultPage.data.bars.length);

const intro = loadPage("intro/intro.js");
check("intro levels", intro.data.levels.length === 8);
check("intro scopes", intro.data.scopes.length === 5);

const history = loadPage("history/history.js");
history.onShow();
check("history has record", history.data.hasData === true, "len=" + history.data.list.length);
history.clearAll();
check("history cleared", history.data.hasData === false);

resultPage.again();
check("result again nav", lastNav === "/pages/index/index", lastNav);

console.log(results.join("\n"));
const failed = results.filter((r) => r.indexOf("FAIL") === 0);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
process.exit(failed.length ? 1 : 0);
