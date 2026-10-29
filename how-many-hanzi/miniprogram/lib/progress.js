const levels = require("./levels");

function calcProgress(charLevels, totalChars) {
  const map = charLevels || {};
  const keys = Object.keys(map);
  const total = Number(totalChars) || 8105;
  const count = keys.length;
  let sum = 0;
  keys.forEach((ch) => {
    sum += Number(map[ch]) || 0;
  });
  const coverage = count ? Math.round((count / total) * 10000) / 100 : 0;
  const depth = count ? sum / (count * 6) : 0;
  const confidence = count ? Math.sqrt(count / total) : 0;
  const mastery = Math.round(depth * confidence * 100);
  return {
    count: count,
    total: total,
    coverage: coverage,
    depth: depth,
    mastery: mastery,
    rank:
      count < levels.RANK_MIN_CHARS
        ? levels.RANK_ZERO
        : levels.rankOf(mastery),
  };
}

module.exports = {
  calcProgress,
};
