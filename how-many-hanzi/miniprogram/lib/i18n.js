const zhCN = require("../locales/zh-CN");

const locales = { "zh-CN": zhCN };
let current = "zh-CN";

function messages() {
  return locales[current] || zhCN;
}

function resolve(path) {
  if (!path) return undefined;
  const parts = String(path).split(".");
  let node = messages();
  for (let i = 0; i < parts.length; i++) {
    if (node == null) return undefined;
    node = node[parts[i]];
  }
  return node;
}

function format(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] === undefined || params[k] === null ? "" : String(params[k])
  );
}

function t(key, params) {
  const value = resolve(key);
  if (typeof value !== "string") return key;
  return format(value, params);
}

function pageText(pageId) {
  const m = messages();
  const pageMessages = (m.pages && m.pages[pageId]) || {};
  return Object.assign({}, m.common, pageMessages);
}

function setNavTitle(key) {
  if (typeof wx === "undefined" || !wx.setNavigationBarTitle) return;
  if (typeof key !== "string" || !key) return;
  wx.setNavigationBarTitle({ title: t(key) });
}

function setLocale(locale) {
  if (locales[locale]) current = locale;
}

function currentLocale() {
  return current;
}

function isDefaultLocale() {
  return current === "zh-CN";
}

module.exports = {
  t,
  pageText,
  setNavTitle,
  setLocale,
  currentLocale,
  isDefaultLocale,
  LOCALES: Object.keys(locales),
};
