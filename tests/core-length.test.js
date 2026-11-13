// 長さ（整数部分＋√2の有無）、大小、閉じる、直角（docs/design/段階1_計算の核.md 2・3章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { len, sq, compareLength, sortLengths, sameLengths, closes, isRight, lengthValue, formatLength, surdSign } from '../src/core/length.js';

const L = s => (typeof s === 'number' ? len(s) : len(Number(s.replace('√2', '')), true));
const tri = (...xs) => xs.map(L);
const show = ls => ls.map(formatLength).join('・');

test('長さを作る：整数部分は正の整数だけ', () => {
  assert.deepEqual(len(6), { n: 6, r2: false });
  assert.deepEqual(len(6, true), { n: 6, r2: true });
  assert.ok(Object.isFrozen(len(6)));
  for (const bad of [0, -1, 1.5, NaN, '6']) assert.throws(() => len(bad), /正の整数/);
  assert.throws(() => len(6, 1), /√2/);
});

test('長さの2乗は整数（n√2 の2乗は 2n²）', () => {
  assert.equal(sq(L(6)), 36);
  assert.equal(sq(L('6√2')), 72);
});

test('√2 の大小を整数で比べる：6√2 は 8 より長く、9 より短い', () => {
  assert.ok(compareLength(L('6√2'), L(8)) > 0);
  assert.ok(compareLength(L('6√2'), L(9)) < 0);
  assert.equal(compareLength(L('6√2'), L('6√2')), 0);
  assert.equal(show(sortLengths(tri(9, '6√2', 8))), '8・6√2・9');
});

test('長さの組の一致：順不同、同じ長さの重なりも数える', () => {
  assert.ok(sameLengths(tri(6, '6√2', 6), tri('6√2', 6, 6)));
  assert.ok(!sameLengths(tri(6, 6, '6√2'), tri(6, '6√2', '6√2')));
  assert.ok(!sameLengths(tri(6, 6, 12), tri(6, 6, '6√2')));
});

test('「整数＋整数×√2」の符号を整数だけで求める', () => {
  assert.equal(surdSign(0, 0), 0);
  assert.equal(surdSign(3, 0), 1);
  assert.equal(surdSign(0, -2), -1);
  assert.equal(surdSign(9, -6), 1); // 9 − 6√2 ≒ 0.51
  assert.equal(surdSign(8, -6), -1); // 8 − 6√2 ≒ −0.49
  assert.equal(surdSign(-7, 5), 1); // 5√2 − 7 ≒ 0.07
  assert.equal(surdSign(-8, 5), -1); // 5√2 − 8 ≒ −0.93
});

test('閉じる：短い2本の和が最長より長いときだけ。√2 が混ざっても整数で決める', () => {
  assert.equal(closes(tri(3, 6, '6√2')), true); // 9 > 8.49
  assert.equal(closes(tri(2, 6, '6√2')), false); // 8 < 8.49
  assert.equal(closes(tri(2, '5√2', 9)), true); // 9.07 > 9
  assert.equal(closes(tri(2, '5√2', 10)), false);
  assert.equal(closes(tri(1, 1, '1√2')), true);
  assert.throws(() => closes(tri(3, 4)), /3本/);
});

test('閉じる：和が最長とちょうど等しいときは閉じない（小数では間違える21通りも含む）', () => {
  let floatWrong = 0;
  for (let a = 2; a <= 24; a++) {
    for (let b = a; a + b <= 24; b++) {
      const t = [len(a, true), len(b, true), len(a + b, true)];
      assert.equal(closes(t), false, show(t));
      if (lengthValue(t[0]) + lengthValue(t[1]) > lengthValue(t[2])) floatWrong++;
      // 1だけ短くすれば閉じる
      assert.equal(closes([len(a, true), len(b, true), len(a + b - 1, true)]), true);
    }
  }
  assert.equal(floatWrong, 21); // 小数で計算すると「閉じる」と間違える組の数（設計メモ 2.2）
  assert.equal(closes(tri(3, 4, 7)), false);
});

test('直角：短い2本の2乗の和 ＝ 最長の2乗', () => {
  assert.equal(isRight(tri(5, 3, 4)), true);
  assert.equal(isRight(tri(6, 8, 10)), true);
  assert.equal(isRight(tri(6, 6, '6√2')), true);
  assert.equal(isRight(tri('3√2', '4√2', '5√2')), true);
  assert.equal(isRight(tri(4, 5, 6)), false);
});

test('表示用の文字と小数の長さ', () => {
  assert.equal(formatLength(L(6)), '6');
  assert.equal(formatLength(L('6√2')), '6√2');
  assert.equal(lengthValue(L('6√2')), 6 * Math.SQRT2);
});
