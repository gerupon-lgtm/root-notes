// 正解と発見の判定（要件5章）。すべて長さの2乗の整数で比べる。
import { sameLengths, sortLengths, closes, isRight, sq } from './length.js';

// 発見の種類：閉じない三角形、直角の三角形、1オクターブ違い、長調と短調の鏡写し
export const DISCOVERIES = Object.freeze(['open', 'right', 'octave', 'mirror']);

// 正解：長さの組が一致（順不同、重なりを含む）。音の高さまで一致させるので、1オクターブ違いは不正解
export const isCorrect = (mine, target) => sameLengths(mine, target);

// 3本とも、お題のちょうど2倍か、3本ともちょうど半分（長さが2倍なら2乗は4倍）
function isOctave(x, a) {
  return x.every((v, i) => v === 4 * a[i]) || x.every((v, i) => 4 * v === a[i]);
}

// 自分 x ≤ y ≤ z、お題 a ≤ b ≤ c。比 x:y:z が a:b:c と同じか
function sameRatio([x, y, z], [a, b, c]) {
  return x * b === y * a && y * c === z * b;
}

// 鏡写し：自分の長さの比が、お題の周波数の比（1/c : 1/b : 1/a）と同じ ⇔ x・c ＝ y・b ＝ z・a。
// お題と同じ比のときは数えない
function isMirror(x, a) {
  const [p, q, r] = [x[0] * a[2], x[1] * a[1], x[2] * a[0]];
  return p === q && q === r && !sameRatio(x, a);
}

// 当てはまる発見の一覧（DISCOVERIES の順）
export function discoveries(mine, target) {
  if (mine.length !== 3 || target.length !== 3) throw new Error('発見は3本どうしで比べます。');
  const x = sortLengths(mine).map(sq), a = sortLengths(target).map(sq);
  const found = [];
  if (!closes(mine)) found.push('open');
  if (isRight(mine)) found.push('right');
  if (isOctave(x, a)) found.push('octave');
  if (isMirror(x, a)) found.push('mirror');
  return found;
}
