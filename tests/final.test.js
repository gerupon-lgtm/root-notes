// 最終章（src/content/final.js・src/game/final-play.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { GATES, FINAL_K, DECOY_BY_CHAPTER } from '../src/content/final.js';
import { FinalPlay, missingFrom, startHand, checkGates } from '../src/game/final-play.js';
import { RIDDLES } from '../src/content/riddles.js';
import { BELL_HZ } from '../src/content/story.js';
import { len, closes } from '../src/core/length.js';

const right = { shield: 9, sword: 5, armor: 4 };
const decoys = Object.values(DECOY_BY_CHAPTER);

test('C-03（2026-11-15 合意）：各門で正しい武具を使えば三角形が閉じ、手持ちのうち正解は各門でちょうど1本', () => {
  for (const c of checkGates(startHand(right, decoys))) {
    assert.ok(c.closes, `門${c.gate + 1}`);
    assert.equal(c.answers, 1, `門${c.gate + 1}`);
  }
  // 謎の答えと門の答えが同じ長さ
  for (const g of GATES) assert.equal(RIDDLES[g.art].answer, g.answer, g.art);
  // おとりの辺も、どこかの門で閉じる（聞き比べないと選べない）
  for (const n of decoys) assert.ok(GATES.some(g => closes([...g.given, n].map(x => len(x)))), `おとり ${n}`);
});

test('最終章：基準の音は鐘と同じ（盾の門の響き B♭・C・F）', () => {
  assert.ok(Math.abs(FINAL_K / 9 - BELL_HZ[9]) < 1e-9);
  assert.ok(Math.abs(FINAL_K / 6 - BELL_HZ[6]) < 1e-9);
});

test('最終章：正しい武具で3つの門が開き、報酬の辺6・6で扉が直角に開く', () => {
  const p = new FinalPlay({ artifacts: right, decoys });
  assert.deepEqual(p.missing(), []);
  for (const g of GATES) {
    const i = p.hand.findIndex(h => h.n === g.answer && !h.door);
    const r = p.offer(i);
    assert.equal(r.result, 'open');
  }
  assert.ok(p.atDoor && p.scroll);
  const sixes = p.hand.map((h, i) => (h.door && h.n === 6 ? i : -1)).filter(i => i >= 0);
  assert.equal(sixes.length, 2);
  assert.ok(p.openDoor(sixes[0], sixes[1]));
});

test('最終章：間違えた辺もなくなり、この先が解けなくなったら足りない武具を返す（ZAP）。扉用は門に使えない', () => {
  const p = new FinalPlay({ artifacts: right, decoys });
  const seven = p.hand.findIndex(h => h.n === 7);
  const r = p.offer(seven);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(r.zap, []); // まだ 9 が残っているので解ける
  const nine = p.hand.findIndex(h => h.n === 9);
  p.offer(nine); // 盾の門が開く
  const five = p.hand.findIndex(h => h.n === 5);
  const door = p.hand.findIndex(h => h.door);
  assert.throws(() => p.offer(door));
  // 剣の門で 4（鎧の答え）を使うと、鎧の門が解けなくなる
  const four = p.hand.findIndex(h => h.n === 4);
  assert.deepEqual(p.offer(four).zap, ['armor']);
  assert.ok(five >= 0);
});

test('最終章：謎で間違えた長さを持ち帰ると、入った時点で足りない武具が分かる', () => {
  assert.deepEqual(missingFrom(0, startHand({ shield: 8, sword: 5, armor: 3 }, decoys)), ['shield', 'armor']);
});
