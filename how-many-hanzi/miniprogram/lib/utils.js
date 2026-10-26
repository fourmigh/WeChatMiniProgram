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

module.exports = { randomInt, shuffle, pickN, pickOne, unique };
