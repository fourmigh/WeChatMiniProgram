// 信纸文本排版：把输入内容按「每行 cols 字」切分成信纸行。
// 换行符换行，空格占一格但不书写，最终格式与输入一致。

function normalize(text) {
  return String(text == null ? "" : text).replace(/\r\n?/g, "\n");
}

// 返回行数组，每行是字符（按码点）数组；空行为空数组。
function parseLines(text, cols) {
  const width = Math.max(1, Math.floor(Number(cols) || 6));
  const paragraphs = normalize(text).split("\n");
  const lines = [];
  for (let p = 0; p < paragraphs.length; p++) {
    const chars = Array.from(paragraphs[p]);
    if (!chars.length) {
      lines.push([]);
      continue;
    }
    for (let i = 0; i < chars.length; i += width) {
      lines.push(chars.slice(i, i + width));
    }
  }
  return lines;
}

// 空白字符（含半角/全角空格）占格不写。
function isBlank(ch) {
  return /^\s$/.test(ch);
}

// 统计需要书写的字数（不含空白）。
function countWritable(lines) {
  let n = 0;
  for (let r = 0; r < lines.length; r++) {
    for (let c = 0; c < lines[r].length; c++) {
      if (!isBlank(lines[r][c])) n++;
    }
  }
  return n;
}

module.exports = {
  normalize,
  parseLines,
  isBlank,
  countWritable,
};
