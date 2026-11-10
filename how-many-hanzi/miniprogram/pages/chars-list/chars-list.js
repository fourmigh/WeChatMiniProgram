const chars = require("../../lib/chars");
const storage = require("../../lib/storage");
const nav = require("../../lib/nav");
const levels = require("../../lib/levels");
const i18n = require("../../lib/i18n");
const { definePage } = require("../../lib/page-base");

const BATCH = 200;

definePage({
  page: "charsList",
  titleKey: "pages.charsList.title",
  data: {
    scopes: [],
    scope: 0,
    isHidden: false,
    scopeName: "",
    subText: "",
    keyword: "",
    pool: [],
    chars: [],
    batch: BATCH,
    hasMore: false,
    intoView: "",
    highlightIndex: -1,
    emptyHint: "",
  },

  onLoad(options) {
    const rawScope = options && options.scope;
    const scope =
      rawScope === "hidden"
        ? "hidden"
        : Math.min(Math.max(Number(rawScope) || 0, 0), 4);
    const scopes = chars.listScopes().concat([
      { index: "hidden", name: i18n.t("pages.charsList.hiddenName") },
    ]);
    this.setData({ scopes: scopes });
    this.loadScope(scope);
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
    const isHidden = scope === "hidden";
    this.isHidden = isHidden;

    let pool;
    let scopeName;
    let subText;
    let emptyHint = "";
    if (isHidden) {
      pool = storage.getRareChars().map((r) => r.char);
      scopeName = i18n.t("pages.charsList.hiddenName");
      subText = i18n.t("pages.charsList.subHidden", { n: pool.length });
      if (!pool.length) {
        emptyHint = i18n.t("pages.charsList.subHiddenEmpty");
      }
    } else {
      pool = chars.getCharsByScope(scope);
      const info = chars.listScopes()[scope];
      scopeName = info.name;
      if (scope === 0) {
        subText = i18n.t("pages.charsList.subTier", {
          name: info.name,
          n: info.count,
        });
      } else if (scope >= 4) {
        subText = i18n.t("pages.charsList.subAll", {
          n: chars.allChars.length,
        });
      } else {
        subText = i18n.t("pages.charsList.subTierNew", {
          name: info.name,
          n: info.count,
          m: chars.getTierChars(scope).length,
        });
      }
    }
    this.setData({
      scope: scope,
      isHidden: isHidden,
      scopeName: scopeName,
      subText: subText,
      keyword: "",
      pool: pool,
      batch: BATCH,
      emptyHint: emptyHint,
      intoView: "",
    });
    this.renderBatch(() => {
      // 切档后回到顶部
      if (this.data.pool.length) this.setData({ intoView: "cell-0" });
    });
  },

  buildItems(count) {
    const pool = this.data.pool;
    const levelsMap = storage.getCharLevels();
    const list = [];

    let segments = [];
    if (!this.isHidden && this.data.scope >= 4) {
      const order = [4, 3, 2, 1, 0];
      let cursor = 0;
      for (const t of order) {
        const len = chars.getTierChars(t).length;
        segments.push({ start: cursor, name: chars.tierNames[t], count: len });
        cursor += len;
      }
    }

    let si = 0;
    for (let i = 0; i < pool.length && i < count; i++) {
      while (si < segments.length && segments[si].start === i) {
        list.push({
          type: "divider",
          key: "d-" + segments[si].name,
          title: segments[si].name,
          count: segments[si].count,
        });
        si++;
      }
      const ch = pool[i];
      const lv = levelsMap[ch];
      list.push({
        type: "char",
        key: "c-" + i,
        char: ch,
        poolIndex: i,
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
    const all = this.isHidden
      ? storage.getRareChars().map((r) => r.char)
      : chars.getCharsByScope(this.data.scope);
    if (all.indexOf(ch) === -1) {
      this.setData({
        chars: [],
        hasMore: false,
        emptyHint: this.isHidden
          ? i18n.t("pages.charsList.hintNotInHidden")
          : i18n.t("pages.charsList.hintNotInScope"),
      });
      return;
    }
    const levelsMap = storage.getCharLevels();
    const lv = levelsMap[ch];
    this.setData({
      chars: [
        {
          type: "char",
          key: "c-search",
          char: ch,
          poolIndex: all.indexOf(ch),
          level: lv === undefined ? -1 : lv,
          mark: lv === undefined ? "" : levels.markOf(lv),
        },
      ],
      hasMore: false,
    });
  },

  onScopeTap(e) {
    const raw = e.currentTarget.dataset.index;
    const idx = raw === "hidden" ? "hidden" : Number(raw);
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
});
