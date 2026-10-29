const chars = require("../../lib/chars");
const nav = require("../../lib/nav");

Page({
  data: {
    levels: [
      { n: 0, name: "未识", desc: "还不能稳定辨认这个字。" },
      { n: 1, name: "识形", desc: "能从形近字中认出目标字，对字形有印象。" },
      { n: 2, name: "知音", desc: "知道它的一个常见读音（多音字直接考全部读音）。" },
      { n: 3, name: "全音", desc: "多选它的全部常见读音（多音字专属）。" },
      { n: 4, name: "明义", desc: "明白主要含义；多音字按读音对应不同意思。" },
      { n: 5, name: "能写", desc: "掌握笔顺，能够正确书写。" },
      { n: 6, name: "善用", desc: "能辨认包含它的词语，会组词运用。" },
      { n: 7, name: "通源", desc: "了解它的部首与构字来源。" },
    ],
    scopes: [],
    total: 0,
  },

  onReady() {
    nav.ready();
  },

  onLoad() {
    this.setData({
      scopes: chars.listScopes(),
      total: chars.allChars.length,
    });
  },

  goHome() {
    nav.relaunch("/pages/index/index");
  },
});
