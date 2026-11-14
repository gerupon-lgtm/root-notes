// フレーズと1曲の楽譜（要件6.5、F-024、AC-12）。いつ・どの高さ・どれだけ鳴らすかを作るだけで、音は鳴らさない。
// 形は試作と同じ：1小節1.6秒【想定】。小節の頭と半分でベース、頭で三角形の和音をジャラン、裏拍で軽く刻む
import { frequencies } from '../core/pitch.js';
import { midiToHz } from '../core/harmony.js';

export const BAR_SECONDS = 1.6;
const STRUM = 0.035, CUT_STRUM = 0.02;

// carryOver：和音を次の小節まで伸ばして余韻を重ねる（要件6.5【要確認】。聞き比べ用の切り替え）
export function buildScore(stages, from, to, { carryOver = false } = {}) {
  const notes = [];
  for (let bar = from; bar <= to; bar++) {
    const stage = stages[bar], start = (bar - from) * BAR_SECONDS;
    // bassCents：分数コードでベースを三角形の3度に合わせた分（v0.19）
    const bass = midiToHz(stage.bassMidi) * 2 ** ((stage.bassCents ?? 0) / 1200);
    notes.push({ bar, part: 'bass', time: start, hz: bass, duration: BAR_SECONDS * 0.95, gain: 0.11 });
    notes.push({ bar, part: 'bass', time: start + BAR_SECONDS / 2, hz: bass, duration: BAR_SECONDS * 0.45, gain: 0.08 });
    frequencies(stage.target, stage.K).forEach((hz, k) => {
      notes.push({ bar, part: 'chord', time: start + k * STRUM, hz, duration: BAR_SECONDS * (carryOver ? 1.9 : 0.9), gain: 0.06 });
      notes.push({ bar, part: 'cut', time: start + BAR_SECONDS * 0.5 + k * CUT_STRUM, hz, duration: BAR_SECONDS * 0.4, gain: 0.04 });
    });
  }
  const bars = to - from + 1;
  return { bars, duration: bars * BAR_SECONDS, notes };
}
