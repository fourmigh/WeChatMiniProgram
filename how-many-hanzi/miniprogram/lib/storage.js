const KEY_SETTINGS = "hmh:settings";
const KEY_HISTORY = "hmh:history";
const KEY_CHAR_LEVELS = "hmh:charLevels";
const MAX_HISTORY = 50;

const DEFAULT_SETTINGS = {
  scope: 4,
  sampleSize: 20,
};

function hasWx() {
  return typeof wx !== "undefined" && wx && typeof wx.getStorageSync === "function";
}

function read(key, fallback) {
  if (!hasWx()) return fallback;
  try {
    const v = wx.getStorageSync(key);
    return v === "" || v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  if (!hasWx()) return;
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    // ignore quota errors
  }
}

function getSettings() {
  const s = read(KEY_SETTINGS, null);
  if (!s || typeof s !== "object") return Object.assign({}, DEFAULT_SETTINGS);
  return Object.assign({}, DEFAULT_SETTINGS, s);
}

function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {});
  write(KEY_SETTINGS, next);
  return next;
}

function getHistory() {
  const h = read(KEY_HISTORY, []);
  return Array.isArray(h) ? h : [];
}

function addHistory(record) {
  const list = getHistory();
  list.unshift(record);
  const trimmed = list.slice(0, MAX_HISTORY);
  write(KEY_HISTORY, trimmed);
  return trimmed;
}

function clearHistory() {
  write(KEY_HISTORY, []);
}

function getCharLevels() {
  const m = read(KEY_CHAR_LEVELS, {});
  return m && typeof m === "object" ? m : {};
}

function saveCharLevel(ch, level) {
  const m = getCharLevels();
  if (!(ch in m) || level > m[ch]) {
    m[ch] = level;
    write(KEY_CHAR_LEVELS, m);
  }
}

function clearAll() {
  write(KEY_HISTORY, []);
  write(KEY_CHAR_LEVELS, {});
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  getHistory,
  addHistory,
  clearHistory,
  getCharLevels,
  saveCharLevel,
  clearAll,
};
