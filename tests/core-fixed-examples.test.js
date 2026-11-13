// 要件5章の固定例（AC-01）。表の6行を、そのまま自動テストにする（docs/design/段階1_計算の核.md 5章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { len, closes, isRight, sq } from '../src/core/length.js';
import { ratioOf, frequencies } from '../src/core/pitch.js';
import { chordOf } from '../src/core/chord.js';

// '6√2' のような書き方から長さを作る（テスト用）
const L = s => (typeof s === 'number' ? len(s) : len(Number(s.replace('√2', '')), true));
const tri = (...xs) => xs.map(L);

test('固定例 3・4・5：比 12:15:20、短三和音の第1転回形（ラ・ド・ミで、ドが一番下）、閉じる（直角）', () => {
  const t = tri(3, 4, 5);
  assert.deepEqual(ratioOf(t), [12, 15, 20]);
  assert.deepEqual(chordOf(t), { quality: 'minor', inversion: 1, limit: 5, span: 9 });
  assert.equal(closes(t), true);
  assert.equal(isRight(t), true);
});

test('固定例 4・5・6：比 10:12:15、短調（短三和音の基本形）、閉じる', () => {
  const t = tri(4, 5, 6);
  assert.deepEqual(ratioOf(t), [10, 12, 15]);
  assert.deepEqual(chordOf(t), { quality: 'minor', inversion: 0, limit: 5, span: 7 });
  assert.equal(closes(t), true);
});

test('固定例 10・12・15：比 4:5:6、長調（長三和音の基本形）、閉じる', () => {
  const t = tri(10, 12, 15);
  assert.deepEqual(ratioOf(t), [4, 5, 6]);
  assert.deepEqual(chordOf(t), { quality: 'major', inversion: 0, limit: 5, span: 7 });
  assert.equal(closes(t), true);
});

test('固定例 1・2・3：閉じない（短い2本の和が最長と等しい）。三和音ではない', () => {
  const t = tri(1, 2, 3);
  assert.equal(closes(t), false);
  assert.equal(chordOf(t), null);
});

test('固定例 2・3・6：閉じない。三和音ではない', () => {
  const t = tri(2, 3, 6);
  assert.equal(closes(t), false);
  assert.equal(chordOf(t), null);
});

test('固定例 6・6・6√2：低い1音（6√2）の増4度上（比 √2）に同じ音2つ（6・6）。閉じる（直角）', () => {
  const t = tri(6, 6, '6√2');
  assert.equal(ratioOf(t), null); // 整数比では書けない
  assert.equal(chordOf(t), null);
  // 比 √2 を整数で確かめる：6√2 の2乗は 6 の2乗のちょうど2倍
  assert.equal(sq(L('6√2')), 2 * sq(L(6)));
  const [low, mid, high] = frequencies(t, 1000);
  assert.equal(mid, high); // 同じ音2つ
  assert.ok(Math.abs(high / low - Math.SQRT2) < 1e-12); // 増4度（600セント）
  assert.equal(closes(t), true);
  assert.equal(isRight(t), true);
});
