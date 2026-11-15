// 最終章の中身（要件6.4・6.7・F-019。docs/design/段階5_最終章.md。2026-11-15 発案者と決めた8つ）。
// 3つの門（盾・剣・鎧の順）。各門で、与えられた2辺に手持ちから1本を足して、門の響きと同じ和音を作る。
// 正しければ門が開き、門の先の小部屋で武具が報酬を差し出す（盾・剣＝辺6「扉用」、鎧＝巻物）。
// 扉では、報酬の辺6を2本「直角に開く」と斜辺 6√2 が生まれ、封印の三角形 6・6・6√2 で扉が開く。
// 基準の音は謎・鐘と同じ（大きさ12の鐘＝ファ。src/content/riddles.js の RIDDLE_K）。周波数 ＝ K ÷ 長さ
import { RIDDLE_K } from './riddles.js';

export const FINAL_K = RIDDLE_K;

// 門（要件6.4 の試作の課題）。chord は門の響き（説明用）
export const GATES = Object.freeze([
  Object.freeze({ art: 'shield', name: '盾', given: Object.freeze([6, 8]), answer: 9, reward: 6, chord: 'B♭・C・F（sus4）' }),
  Object.freeze({ art: 'sword', name: '剣', given: Object.freeze([4, 6]), answer: 5, reward: 6, chord: 'F・A♭・C（Fm）' }),
  Object.freeze({ art: 'armor', name: '鎧', given: Object.freeze([3, 6]), answer: 4, reward: 'scroll', chord: 'F・C・F' })
]);

// おとりの辺：第2章・第3章の終わりで、精霊が「もう1本、落ちていた弦」を拾う（Q-13。2026-11-15 発案者）
export const DECOY_BY_CHAPTER = Object.freeze({ sword: 7, armor: 10 });

// 扉：同じ長さ2本を直角に開く（報酬の辺6・6）
export const DOOR_EDGE = 6;
