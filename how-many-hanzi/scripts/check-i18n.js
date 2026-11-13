// 校验 i18n key：WXML 的 {{T.xxx}} 与 JS 的 i18n.t("xxx") 必须存在于语言包。
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "miniprogram");
const messages = require(path.join(ROOT, "locales", "zh-CN.js"));

const PAGE_BY_DIR = {
  index: "index",
  quiz: "quiz",
  result: "result",
  intro: "intro",
  history: "history",
  chars: "chars",
  "chars-list": "charsList",
  "char-detail": "charDetail",
  "stroke-play": "strokePlay",
  letter: "letter",
};

function resolveKey(key) {
  const parts = key.split(".");
  let node = messages;
  for (const part of parts) {
    if (node == null) return undefined;
    node = node[part];
  }
  return node;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT, []);
const missing = [];
const stats = { wxmlRefs: 0, jsRefs: 0 };

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const isWxml = rel.endsWith(".wxml");
  const isJs = rel.endsWith(".js") && !rel.startsWith("lib/vendor/") && !rel.endsWith(".data.js");
  if (!isWxml && !isJs) continue;

  const source = fs.readFileSync(file, "utf8");
  const dirName = rel.split("/")[1];
  const pageId = isWxml ? PAGE_BY_DIR[dirName] : null;

  if (isWxml && pageId) {
    const pageMessages = messages.pages[pageId] || {};
    const re = /\{\{\s*T\.([A-Za-z0-9_]+)/g;
    let m;
    while ((m = re.exec(source))) {
      stats.wxmlRefs++;
      const key = m[1];
      if (messages.common[key] === undefined && pageMessages[key] === undefined) {
        missing.push(rel + " -> T." + key);
      }
    }
  }

  if (isJs && (rel.startsWith("pages/") || rel.startsWith("lib/"))) {
    const re = /i18n\.(?:t|setNavTitle)\(\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(source))) {
      stats.jsRefs++;
      if (typeof resolveKey(m[1]) !== "string") {
        missing.push(rel + ' -> t("' + m[1] + '")');
      }
    }
  }
}

console.log("i18n refs:", JSON.stringify(stats));

// 导航栏标题已置空（由页面内 .page-head 承担）；若 json 仍配置标题，
// 则必须与语言包保持一致。
for (const dir of Object.keys(PAGE_BY_DIR)) {
  const pageId = PAGE_BY_DIR[dir];
  const jsonPath = path.join(ROOT, "pages", dir, dir + ".json");
  if (!fs.existsSync(jsonPath)) continue;
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const actual = json.navigationBarTitleText || "";
  const expected = (messages.pages[pageId] || {}).title;
  if (actual && expected && actual !== expected) {
    missing.push(
      "pages/" + dir + "/" + dir + ".json -> navigationBarTitleText (expected: " + expected + ")"
    );
  }
}

if (missing.length) {
  console.log("missing keys (" + missing.length + "):");
  for (const item of missing) console.log("  " + item);
  process.exit(1);
}
console.log("all i18n keys resolved");
