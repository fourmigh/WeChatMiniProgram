// 极简 SVG path 解析器：把 hanzi-writer-data 的笔画路径转成 canvas 指令。
// 支持 M/L/H/V/C/S/Q/T/A/Z（数据实际只用到 M/L/Q/C/Z），输出绝对坐标。

const ARG_COUNT = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

function tokenize(d) {
  const re = /([a-zA-Z])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(d))) {
    tokens.push(m[1] ? m[1] : parseFloat(m[2]));
  }
  return tokens;
}

function reflect(ctrl, x, y) {
  if (!ctrl) return [x, y];
  return [2 * x - ctrl[0], 2 * y - ctrl[1]];
}

function parsePath(d) {
  if (typeof d !== "string" || !d) return [];

  const tokens = tokenize(d);
  const out = [];
  let i = 0;
  let cmd = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cubicCtrl = null;
  let quadCtrl = null;

  while (i < tokens.length) {
    if (typeof tokens[i] === "string") {
      cmd = tokens[i];
      i++;
    }
    if (!cmd) break;

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    if (upper === "Z") {
      out.push(["Z"]);
      x = startX;
      y = startY;
      cubicCtrl = null;
      quadCtrl = null;
      cmd = null;
      continue;
    }

    const need = ARG_COUNT[upper];
    if (need === undefined) {
      i++;
      cmd = null;
      continue;
    }

    let args = [];
    for (let k = 0; k < need; k++) {
      const t = tokens[i + k];
      if (typeof t !== "number") {
        args = [];
        break;
      }
      args.push(t);
    }
    if (args.length < need) break;
    i += need;

    let ax = args.slice();
    if (upper === "A") {
      if (rel) {
        ax[5] += x;
        ax[6] += y;
      }
    } else if (rel) {
      for (let k = 0; k < need; k += 2) {
        ax[k] += x;
        if (k + 1 < need) ax[k + 1] += y;
      }
    }

    switch (upper) {
      case "M": {
        x = ax[0];
        y = ax[1];
        startX = x;
        startY = y;
        out.push(["M", x, y]);
        cubicCtrl = null;
        quadCtrl = null;
        // M 之后紧跟的坐标对按 L 处理
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        x = ax[0];
        y = ax[1];
        out.push(["L", x, y]);
        cubicCtrl = null;
        quadCtrl = null;
        break;
      }
      case "H": {
        x = rel ? x + args[0] : args[0];
        out.push(["L", x, y]);
        cubicCtrl = null;
        quadCtrl = null;
        break;
      }
      case "V": {
        y = rel ? y + args[0] : args[0];
        out.push(["L", x, y]);
        cubicCtrl = null;
        quadCtrl = null;
        break;
      }
      case "C": {
        out.push(["C", ax[0], ax[1], ax[2], ax[3], ax[4], ax[5]]);
        cubicCtrl = [ax[2], ax[3]];
        quadCtrl = null;
        x = ax[4];
        y = ax[5];
        break;
      }
      case "S": {
        const c1 = reflect(cubicCtrl, x, y);
        out.push(["C", c1[0], c1[1], ax[0], ax[1], ax[2], ax[3]]);
        cubicCtrl = [ax[0], ax[1]];
        quadCtrl = null;
        x = ax[2];
        y = ax[3];
        break;
      }
      case "Q": {
        out.push(["Q", ax[0], ax[1], ax[2], ax[3]]);
        quadCtrl = [ax[0], ax[1]];
        cubicCtrl = null;
        x = ax[2];
        y = ax[3];
        break;
      }
      case "T": {
        const c = reflect(quadCtrl, x, y);
        out.push(["Q", c[0], c[1], ax[0], ax[1]]);
        quadCtrl = c;
        cubicCtrl = null;
        x = ax[0];
        y = ax[1];
        break;
      }
      case "A": {
        // 数据中未出现圆弧，退化为直线到终点
        x = ax[5];
        y = ax[6];
        out.push(["L", x, y]);
        cubicCtrl = null;
        quadCtrl = null;
        break;
      }
      default:
        break;
    }
  }

  return out;
}

// 把解析后的指令逐条投到 canvas 上下文；mapPoint 负责坐标变换。
function tracePath(ctx, commands, mapPoint) {
  if (!ctx || !commands || !commands.length) return;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    switch (c[0]) {
      case "M": {
        const p = mapPoint(c[1], c[2]);
        ctx.moveTo(p[0], p[1]);
        break;
      }
      case "L": {
        const p = mapPoint(c[1], c[2]);
        ctx.lineTo(p[0], p[1]);
        break;
      }
      case "Q": {
        const c1 = mapPoint(c[1], c[2]);
        const p = mapPoint(c[3], c[4]);
        ctx.quadraticCurveTo(c1[0], c1[1], p[0], p[1]);
        break;
      }
      case "C": {
        const c1 = mapPoint(c[1], c[2]);
        const c2 = mapPoint(c[3], c[4]);
        const p = mapPoint(c[5], c[6]);
        ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
        break;
      }
      case "Z": {
        ctx.closePath();
        break;
      }
      default:
        break;
    }
  }
}

module.exports = {
  parsePath,
  tracePath,
};
