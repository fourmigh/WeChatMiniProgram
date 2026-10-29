const KEY_SETTINGS = "hmh:settings";
const KEY_HISTORY = "hmh:history";
const KEY_CHAR_LEVELS = "hmh:charLevels";
const KEY_RECENT_CHARS = "hmh:recentChars";
const MAX_HISTORY = 50;
const MAX_RECENT_CHARS = 50;

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

function getRecentChars() {
  const list = read(KEY_RECENT_CHARS, []);
  return Array.isArray(list) ? list : [];
}

function addCharRecord(record) {
  const list = getRecentChars();
  list.unshift(
    Object.assign(
      {
        createdAt: Date.now(),
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      },
      record
    )
  );
  write(KEY_RECENT_CHARS, list.slice(0, MAX_RECENT_CHARS));
  saveCharLevel(record.char, record.level);
}

function clearAll() {
  write(KEY_HISTORY, []);
  write(KEY_RECENT_CHARS, []);
  write(KEY_CHAR_LEVELS, {});
}

function removeChar(ch) {
  const m = getCharLevels();
  if (ch in m) {
    delete m[ch];
    write(KEY_CHAR_LEVELS, m);
  }
  write(KEY_RECENT_CHARS, getRecentChars().filter((r) => r.char !== ch));
}

function removeHistoryAt(index) {
  const list = getHistory();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  write(KEY_HISTORY, list);
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
  getRecentChars,
  addCharRecord,
  clearAll,
  removeChar,
  removeHistoryAt,
};
