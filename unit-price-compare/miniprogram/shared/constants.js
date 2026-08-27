const PLATFORM_CATEGORIES = [
  { key: "online", label: "线上" },
  { key: "offline", label: "线下" },
];

const PLATFORMS = {
  online: ["淘宝", "京东", "拼多多", "抖音", "快手", "其他"],
  offline: ["山姆", "盒马", "Costco", "大润发", "永辉", "沃尔玛", "其他"],
};

const SPEC_UNITS = [
  { label: "克 (g)", value: "g" },
  { label: "千克 (kg)", value: "kg" },
  { label: "毫升 (ml)", value: "ml" },
  { label: "升 (L)", value: "L" },
  { label: "个", value: "个" },
  { label: "包", value: "包" },
  { label: "瓶", value: "瓶" },
  { label: "罐", value: "罐" },
  { label: "盒", value: "盒" },
  { label: "斤", value: "斤" },
];

const PIECE_UNITS = ["瓶", "包", "罐", "盒", "袋", "个", "支"];

const BARCODE_REGEX = /^\d{8,14}$/;

function parseSpecText(specText) {
  if (!specText) return null;
  const cleaned = specText.replace(/\s/g, "");
  const pattern = /^([\d.]+)\s*(g|kg|ml|L|个|包|瓶|罐|盒|斤)(?:[×xX]\s*(\d+)\s*(瓶|包|罐|盒|袋|个|支))?$/i;
  const match = cleaned.match(pattern);
  if (!match) return null;
  const result = {
    specValue: Number(match[1]),
    specUnit: match[2].toLowerCase() === "l" ? "L" : match[2].toLowerCase(),
  };
  if (match[3] && match[4]) {
    result.pieceCount = Number(match[3]);
    result.pieceUnit = match[4];
  }
  return result;
}

function calcUnitPrice(price, specValue, specUnit) {
  if (!price || !specValue) return 0;
  return price / specValue;
}

function formatUnitPrice(unitPrice) {
  if (unitPrice === 0) return "-";
  if (unitPrice < 0.0001) return unitPrice.toExponential(2);
  if (unitPrice < 1) return unitPrice.toFixed(4);
  return unitPrice.toFixed(2);
}

function formatDate(date) {
  if (!date) return "";
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string" || typeof date === "number") {
    d = new Date(date);
  } else if (date && date.$date) {
    d = new Date(date.$date);
  } else {
    return "";
  }
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

module.exports = {
  PLATFORM_CATEGORIES,
  PLATFORMS,
  SPEC_UNITS,
  PIECE_UNITS,
  BARCODE_REGEX,
  calcUnitPrice,
  formatUnitPrice,
  formatDate,
  parseSpecText,
};
