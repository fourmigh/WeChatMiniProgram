const { parseSpecText } = require("./constants");

const PRICE_PATTERNS = [
  /[¥￥]\s*([\d.]+)/,
  /价格[：:\s]*([\d.]+)/,
  /单价[：:\s]*([\d.]+)/,
  /售价[：:\s]*([\d.]+)/,
  /(\d+\.?\d+)\s*元/,
];

const SPEC_PATTERN = /^([\d.]+)\s*(g|kg|ml|L|个|包|瓶|罐|盒|斤)(?:[×xX]\s*(\d+)\s*(瓶|包|罐|盒|袋|个|支))?$/i;

const SKIP_WORDS = new Set([
  "元", "块", "钱", "¥", "￥", "价格", "单价", "售价",
  "条码", " barcode", "规格", "净含量", "保质期",
  "配料", "成分", "生产日期", "产地", "地址", "电话",
  "客服", "全国", "统一", "零售价", "建议零售价",
]);

function parseOcrResult(items) {
  if (!items || !Array.isArray(items)) {
    return { price: null, spec: null, candidates: [] };
  }

  let price = null;
  let spec = null;
  const candidates = [];
  const consumedIndices = new Set();

  // Pass 1: extract price
  for (let i = 0; i < items.length; i++) {
    const text = items[i].text.trim();
    for (const pattern of PRICE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const val = parseFloat(match[1]);
        if (val > 0 && val < 100000) {
          price = String(val);
          consumedIndices.add(i);
          break;
        }
      }
    }
    if (price) break;
  }

  // Pass 2: extract spec
  for (let i = 0; i < items.length; i++) {
    if (consumedIndices.has(i)) continue;
    const text = items[i].text.trim().replace(/\s/g, "");
    if (SPEC_PATTERN.test(text)) {
      spec = text;
      consumedIndices.add(i);
      break;
    }
    const parsed = parseSpecText(text);
    if (parsed) {
      spec = text;
      consumedIndices.add(i);
      break;
    }
  }

  // Pass 3: collect remaining candidates
  for (let i = 0; i < items.length; i++) {
    if (consumedIndices.has(i)) continue;
    const text = items[i].text.trim();
    if (text.length <= 2) continue;
    if (/^\d+(\.\d+)?$/.test(text)) continue;
    if (SKIP_WORDS.has(text)) continue;
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) continue;
    if (/^\d{6,}/.test(text)) continue;
    candidates.push({ text, pos: items[i].pos, index: i });
  }

  return { price, spec, candidates };
}

module.exports = { parseOcrResult };
