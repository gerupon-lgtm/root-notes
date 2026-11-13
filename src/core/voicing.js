// 2〜24で作れる純正な三角形の一覧（docs/design/段階2_ステージの生成.md 4章）。
// 条件：長さが重ならない、閉じる、三和音、純正さ、広がり、平均律からのずれ（値は src/content/stage-rules.js）
import { len, closes } from './length.js';
import { chordOf } from './chord.js';
import { STAGE_RULES } from '../content/stage-rules.js';

const cache = new Map();

// 最低音（最長辺）から見た各音の、平均律の半音からのずれ（セント）のうち、いちばん大きいもの
function maxOffsetCents(ns) {
  const low = Math.max(...ns);
  return Math.max(...ns.map(n => {
    const cents = 1200 * Math.log2(low / n);
    return Math.abs(cents - 100 * Math.round(cents / 100));
  }));
}

// 戻り値：{ target: 短い順の3本, quality, inversion, limit, span } の一覧（長さの小さい順）
export function pureTriangles({ maxOffsetCents: limitCents = STAGE_RULES.maxOffsetCents } = {}) {
  if (cache.has(limitCents)) return cache.get(limitCents);
  const { minLength, maxLength, maxSpan, limits } = STAGE_RULES;
  const out = [];
  for (let a = minLength; a <= maxLength; a++) {
    for (let b = a + 1; b <= maxLength; b++) {
      for (let c = b + 1; c <= maxLength; c++) {
        const target = [len(a), len(b), len(c)];
        if (!closes(target)) continue;
        const chord = chordOf(target);
        if (!chord || chord.span > maxSpan || chord.limit > limits[chord.quality]) continue;
        if (maxOffsetCents([a, b, c]) > limitCents) continue;
        out.push(Object.freeze({ target: Object.freeze(target), ...chord }));
      }
    }
  }
  const list = Object.freeze(out);
  cache.set(limitCents, list);
  return list;
}
