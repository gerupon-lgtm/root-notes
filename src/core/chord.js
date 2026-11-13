// 和音の種類（要件5章：三和音だけ。長三和音・短三和音・減三和音と各転回形）。
// 最長辺が最低音。周波数の整数比から、最低音から見た半音の数を求め、構成音の並びと照らす。
// 半音へ丸めるところだけ小数（対数）を使う。音名を見分けるためだけで、正誤の判定には使わない。
// 純正さ（2・3・5だけの整数比か、7まで使うか）は、整数比の素因数で決める（整数のまま）。
import { ratioOf } from './pitch.js';
import { largestPrimeFactor } from './integer.js';

// 根音からの半音の数
export const TRIADS = Object.freeze({
  major: Object.freeze([0, 4, 7]),
  minor: Object.freeze([0, 3, 7]),
  diminished: Object.freeze([0, 3, 6])
});

const key = semis => [...semis].sort((a, b) => a - b).join(',');

// 転回形ごとに、最低音から見た音名の並びを用意する
const SHAPES = Object.entries(TRIADS).flatMap(([quality, tones]) =>
  tones.map((bass, inversion) => ({ quality, inversion, shape: key(tones.map(t => (t - bass + 12) % 12)) }))
);

// 戻り値：{ quality: 'major'|'minor'|'diminished', inversion: 0|1|2, limit: いちばん大きい素因数, span: 最低音から最高音までの半音の数 }。
// 三和音でないとき（√2 を含む、同じ音名が重なる、など）は null
export function chordOf(ls) {
  if (ls.length !== 3) return null;
  const ratio = ratioOf(ls);
  if (!ratio) return null;
  const semis = ratio.map(r => Math.round(12 * Math.log2(r / ratio[0])));
  const names = semis.map(s => s % 12);
  if (new Set(names).size !== 3) return null;
  const found = SHAPES.find(s => s.shape === key(names));
  if (!found) return null;
  return { quality: found.quality, inversion: found.inversion, limit: Math.max(...ratio.map(largestPrimeFactor)), span: semis[2] };
}
