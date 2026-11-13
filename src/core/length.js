// 長さ（要件5章）。「整数部分 n」と「√2 が付くか r2」の組で持ち、比べるときもこの組のまま比べる。
// 判定はすべて整数で行う。長さの2乗は必ず整数（n√2 の2乗は 2n²）なので、大小・直角・比は2乗で比べる。
// 「閉じる」は和を比べるので、「整数＋整数×√2」の符号を整数だけで求める（surdSign）。
// √2 の辺に許容差は使わない（要件5章）。小数の長さ（lengthValue）は描画と音のためだけに使う。

export function len(n, r2 = false) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`長さの整数部分は正の整数にしてください：${n}`);
  if (typeof r2 !== 'boolean') throw new Error('√2 が付くかどうかは true か false で指定してください。');
  return Object.freeze({ n, r2 });
}

// 長さの2乗（整数）
export const sq = l => l.n * l.n * (l.r2 ? 2 : 1);

// 長さの大小。負なら a が短い、0 なら同じ長さ、正なら a が長い
export const compareLength = (a, b) => sq(a) - sq(b);

// 短い順に並べる（元の並びは変えない）
export const sortLengths = ls => [...ls].sort(compareLength);

const sameLength = (a, b) => a.n === b.n && a.r2 === b.r2;

// 長さの組が一致するか（順不同、同じ長さの重なりも数える）
export function sameLengths(a, b) {
  if (a.length !== b.length) return false;
  const x = sortLengths(a), y = sortLengths(b);
  return x.every((l, i) => sameLength(l, y[i]));
}

// 「p ＋ q√2」（p, q は整数）の符号：1・0・−1。
// √2 は無理数なので 0 になるのは p ＝ q ＝ 0 のときだけ。p と q の符号が違うときは、p² と 2q² の大きさで決まる
export function surdSign(p, q) {
  if (p >= 0 && q >= 0) return p === 0 && q === 0 ? 0 : 1;
  if (p <= 0 && q <= 0) return -1;
  const pp = p * p, qq = 2 * q * q;
  return p > 0 ? Math.sign(pp - qq) : Math.sign(qq - pp);
}

// 長さを「整数の部分」と「√2 の係数」に分ける
const parts = l => (l.r2 ? [0, l.n] : [l.n, 0]);

// 閉じる：短い2本の和 ＞ 最長の1本。和が最長とちょうど等しいときは閉じない（要件5章）
export function closes(ls) {
  if (ls.length !== 3) throw new Error('三角形は3本で作ります。');
  const [a, b, c] = sortLengths(ls).map(parts);
  return surdSign(a[0] + b[0] - c[0], a[1] + b[1] - c[1]) > 0;
}

// 直角：短い2本の2乗の和 ＝ 最長の2乗（整数で厳密に判定。要件5章）
export function isRight(ls) {
  if (ls.length !== 3) throw new Error('三角形は3本で作ります。');
  const [a, b, c] = sortLengths(ls).map(sq);
  return a + b === c;
}

// 小数の長さ。描画と音のためだけに使い、判定には使わない
export const lengthValue = l => l.n * (l.r2 ? Math.SQRT2 : 1);

// 表示用の文字（6、6√2）
export const formatLength = l => `${l.n}${l.r2 ? '√2' : ''}`;
