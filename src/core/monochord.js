// 一弦の琴の計算（要件5章・6.2）。音も画面も持たない。
import { BRIDGE_RANGE, START_OFFSET, PASS_BEAT, PASS_HOLD } from '../content/monochord.js';

// 駒で区切った長さ r（弦全体＝1）の部分の音。長さに反比例（C-01）
export const stringHz = (open, r) => open / r;
// お題の音：弦全体の num/den の長さの音
export const targetHz = (open, num, den) => (open * den) / num;
// 揺れの値：2つの音の周波数の差（回/秒）
export const beatHz = (a, b) => Math.abs(a - b);

export const clampBridge = r => Math.min(BRIDGE_RANGE[1], Math.max(BRIDGE_RANGE[0], r));

// 面に入ったときの駒の位置：答えから START_OFFSET の幅だけ、左右どちらかに離す（範囲の外なら反対側）
export function startPosition(answer, rng) {
  const [lo, hi] = START_OFFSET;
  const away = lo + rng() * (hi - lo);
  const side = rng() < 0.5 ? -1 : 1;
  for (const dir of [side, -side]) {
    const r = answer + dir * away;
    if (r >= BRIDGE_RANGE[0] && r <= BRIDGE_RANGE[1]) return r;
  }
  return clampBridge(answer + side * lo);
}

// 合格の判定を1こま進める。重ねて鳴らしている間に、揺れが PASS_BEAT 未満なら保ちの秒数を足し、
// PASS_HOLD 秒に届いたら合格。途中で揺れが大きくなったら、保ちの秒数は0から数え直す
export function holdStep({ hold, passed }, { beat, dt, droning }) {
  if (passed) return { hold: PASS_HOLD, passed: true };
  if (!droning || !(beat < PASS_BEAT)) return { hold: 0, passed: false };
  const next = hold + dt;
  return next >= PASS_HOLD ? { hold: PASS_HOLD, passed: true } : { hold: next, passed: false };
}
