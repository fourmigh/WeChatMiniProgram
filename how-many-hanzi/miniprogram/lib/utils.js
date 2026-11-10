function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

function pickOne(arr) {
  if (!arr.length) return null;
  return arr[randomInt(arr.length)];
}

function unique(arr) {
  const seen = {};
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v && !seen[v]) {
      seen[v] = true;
      out.push(v);
    }
  }
  return out;
}

function isHanChar(ch) {
  if (typeof ch !== "string" || !ch) return false;
  if (Array.from(ch).length !== 1) return false;
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x3134f) ||
    (cp >= 0x2f800 && cp <= 0x2fa1f)
  );
}

module.exports = { randomInt, shuffle, pickN, pickOne, unique, isHanChar };
