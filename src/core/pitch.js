// 音の高さと揺れ（要件5章）。音の高さは長さに反比例する：f ＝ K ÷ 長さ（C-01）。
// K は星（ステージ）ごとの基準の音で、1つのステージの中では1つに固定する（決め方は段階2）。
// 周波数と揺れの値は小数（Hz）。正誤の判定には使わない。
import { lengthValue } from './length.js';
import { gcd, lcm } from './integer.js';

// 揺れの表示の境目（要件5章【想定】）。0.6未満＝「澄」、15超＝「遠い」、その間は数値
export const BEAT_CLEAR_BELOW = 0.6;
export const BEAT_FAR_ABOVE = 15;

export function frequency(l, K) {
  if (!(K > 0) || !Number.isFinite(K)) throw new Error(`基準の音 K は正の数にしてください：${K}`);
  return K / lengthValue(l);
}

// 周波数を低い順に（最長辺が最低音）
export const frequencies = (ls, K) => ls.map(l => frequency(l, K)).sort((a, b) => a - b);

// 周波数の整数比を低い順に、いちばん小さい整数で返す。√2 を含むときは整数比で書けないので null
export function ratioOf(ls) {
  if (ls.some(l => l.r2)) return null;
  const ns = ls.map(l => l.n);
  const common = ns.reduce(lcm);
  const terms = ns.map(n => common / n).sort((a, b) => a - b);
  const g = terms.reduce(gcd);
  return terms.map(t => t / g);
}

// 揺れの値：お題と自分の音をそれぞれ低い順に並べて組にし、各組の周波数の差（回/秒）
export function beats(target, mine, K) {
  if (target.length !== mine.length) throw new Error('お題と自分の音は同じ本数で比べます。');
  const t = frequencies(target, K), m = frequencies(mine, K);
  return t.map((f, i) => Math.abs(f - m[i]));
}

// 揺れの値の見せ方：'clear'（澄）、'near'（数値で見せる）、'far'（遠い）
export function beatLevel(hz) {
  if (hz < BEAT_CLEAR_BELOW) return 'clear';
  if (hz > BEAT_FAR_ABOVE) return 'far';
  return 'near';
}
