const chars = require("../../lib/chars");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const scrollbar = require("../../lib/scrollbar");

const BATCH = 200;

Page({
  data: Object.assign(
    {
      scopes: [],
      scope: 0,
      scopeName: "",
      keyword: "",
      pool: [],
      chars: [],
      batch: BATCH,
      hasMore: false,
      intoView: "",
      highlightIndex: -1,
      emptyHint: "",
    },
    scrollbar.createState()
  ),

  onLoad(options) {
    const raw = Number((options && options.scope) || 0);
    const scope = Math.min(Math.max(raw, 0), 4);
    this.setData({ scopes: chars.listScopes() });
    this.loadScope(scope);
  },

  onReady() {
    nav.ready();
    scrollbar.measure(this);
  },

  onScroll(e) {
    scrollbar.onScroll(this, e);
  },

  onShow() {
    if (this.pendingChar) {
      const target = this.pendingChar;
      this.pendingChar = "";
      this.scrollToChar(target);
    }
  },

  setPendingChar(ch) {
    this.pendingChar = ch;
  },

  loadScope(scope) {
    const pool = chars.getCharsByScope(scope);
    const scopeName = chars.listScopes()[scope].name;
    this.setData({
      scope: scope,
      scopeName: scopeName,
      keyword: "",
      pool: pool,
      batch: BATCH,
      emptyHint: "",
      intoView: "",
    });
    this.renderBatch(() => {
      // 切档后回到顶部
      this.setData({ intoView: "cell-0" });
    });
  },

  buildItems(count) {
    const pool = this.data.pool;
    const levelsMap = storage.getCharLevels();
    const list = [];
    for (let i = 0; i < pool.length && i < count; i++) {
      const ch = pool[i];
      const lv = levelsMap[ch];
      list.push({
        char: ch,
        level: lv === undefined ? -1 : lv,
        mark: lv === undefined ? "" : levels.markOf(lv),
      });
    }
    return list;
  },

  renderBatch(cb) {
    const count = this.data.batch;
    this.setData(
      {
        chars: this.buildItems(count),
        hasMore: count < this.data.pool.length,
      },
      cb
    );
  },

  onSearch(e) {
    const kw = String((e.detail && e.detail.value) || "").trim();
    this.setData({ keyword: kw, emptyHint: "" });
    if (!kw) {
      this.renderBatch();
      return;
    }
    const ch = Array.from(kw)[0];
    const all = chars.getCharsByScope(this.data.scope);
    if (all.indexOf(ch) === -1) {
      this.setData({ chars: [], hasMore: false, emptyHint: "该字不在本档位" });
      return;
    }
    const levelsMap = storage.getCharLevels();
    const lv = levelsMap[ch];
    this.setData({
      chars: [
        {
          char: ch,
          level: lv === undefined ? -1 : lv,
          mark: lv === undefined ? "" : levels.markOf(lv),
        },
      ],
      hasMore: false,
    });
  },

  onScopeTap(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.scope) return;
    this.loadScope(idx);
  },

  onScrollToLower() {
    if (!this.data.hasMore) return;
    this.setData({ batch: this.data.batch + BATCH });
    this.renderBatch();
  },

  scrollToChar(ch) {
    const pool = this.data.pool;
    const index = pool.indexOf(ch);
    if (index === -1) return;
    const need = Math.max(this.data.batch, index + 1);
    this.setData(
      {
        keyword: "",
        batch: need,
        chars: this.buildItems(need),
        hasMore: need < pool.length,
        emptyHint: "",
        highlightIndex: index,
      },
      () => {
        this.setData({ intoView: "cell-" + index });
        setTimeout(() => {
          this.setData({ highlightIndex: -1 });
        }, 1600);
      }
    );
  },

  goDetail(e) {
    const ch = e.currentTarget.dataset.char;
    const idx = Number(e.currentTarget.dataset.index);
    nav.go(
      "/pages/char-detail/char-detail?char=" +
        encodeURIComponent(ch) +
        "&scope=" +
        this.data.scope +
        "&i=" +
        idx
    );
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },
});
