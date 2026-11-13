// 和音の種類、正解、発見（docs/design/段階1_計算の核.md 3・4章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { len } from '../src/core/length.js';
import { chordOf } from '../src/core/chord.js';
import { isCorrect, discoveries, DISCOVERIES } from '../src/core/judge.js';

const L = s => (typeof s === 'number' ? len(s) : len(Number(s.replace('√2', '')), true));
const tri = (...xs) => xs.map(L);

test('和音：長三和音の基本形・第1転回形・第2転回形（要件5章の数え上げの例）', () => {
  assert.deepEqual(chordOf(tri(6, 10, 15)), { quality: 'major', inversion: 0, limit: 5, span: 16 }); // 2:3:5
  assert.deepEqual(chordOf(tri(10, 15, 24)), { quality: 'major', inversion: 1, limit: 5, span: 15 }); // 5:8:12
  assert.deepEqual(chordOf(tri(12, 15, 20)), { quality: 'major', inversion: 2, limit: 5, span: 9 }); // 3:4:5
});

test('和音：減三和音は 7 を使う純正さになる（例 7:10:12、第2転回形）', () => {
  assert.deepEqual(chordOf(tri(35, 42, 60)), { quality: 'diminished', inversion: 2, limit: 7, span: 9 });
});

test('和音：三和音でないものは null（同じ音名が重なる、√2 を含む、3本でない）', () => {
  assert.equal(chordOf(tri(5, 10, 15)), null); // 1オクターブが重なる
  assert.equal(chordOf(tri(6, 6, '6√2')), null);
  assert.equal(chordOf(tri(4, 5)), null);
});

test('正解：長さの組が一致すれば、並び順にかかわらず正解。1オクターブ違いは不正解', () => {
  assert.equal(isCorrect(tri(5, 3, 4), tri(3, 4, 5)), true);
  assert.equal(isCorrect(tri('6√2', 6, 6), tri(6, 6, '6√2')), true);
  assert.equal(isCorrect(tri(6, 8, 10), tri(3, 4, 5)), false);
  assert.equal(isCorrect(tri(3, 4, 6), tri(3, 4, 5)), false);
});

test('発見の一覧は4種', () => {
  assert.deepEqual([...DISCOVERIES], ['open', 'right', 'octave', 'mirror']);
});

test('発見：閉じない三角形', () => {
  assert.deepEqual(discoveries(tri(2, 3, 6), tri(4, 5, 6)), ['open']);
  assert.deepEqual(discoveries(tri(4, 5, 6), tri(4, 5, 6)), []);
});

test('発見：直角の三角形（正解でも数える）', () => {
  assert.deepEqual(discoveries(tri(3, 4, 5), tri(3, 4, 5)), ['right']);
  assert.ok(discoveries(tri(6, 6, '6√2'), tri(4, 5, 6)).includes('right'));
});

test('発見：1オクターブ違い（3本ともちょうど2倍か、3本ともちょうど半分）', () => {
  assert.deepEqual(discoveries(tri(6, 8, 10), tri(3, 4, 5)), ['right', 'octave']);
  assert.deepEqual(discoveries(tri(3, 4, 5), tri(6, 8, 10)), ['right', 'octave']);
  assert.ok(!discoveries(tri(12, 16, 20), tri(3, 4, 5)).includes('octave')); // 4倍は数えない
  assert.ok(!discoveries(tri(6, 8, 11), tri(3, 4, 5)).includes('octave'));
});

test('発見：長調と短調の鏡写し（自分の長さの比 ＝ お題の周波数の比。お題と同じ比は除く）', () => {
  // お題 4・5・6（周波数 10:12:15）に 10・12・15 → 10×6 ＝ 12×5 ＝ 15×4 ＝ 60
  assert.deepEqual(discoveries(tri(10, 12, 15), tri(4, 5, 6)), ['mirror']);
  assert.deepEqual(discoveries(tri(4, 5, 6), tri(10, 12, 15)), ['mirror']);
  // 3・4・5（周波数 12:15:20）の鏡写しは 12・15・20
  assert.ok(discoveries(tri(12, 15, 20), tri(3, 4, 5)).includes('mirror'));
  // 4・6・9 は自分自身が鏡写しの形（周波数も 4:6:9）。お題と同じ比なので数えない
  assert.ok(!discoveries(tri(4, 6, 9), tri(4, 6, 9)).includes('mirror'));
  assert.ok(!discoveries(tri(8, 12, 18), tri(4, 6, 9)).includes('mirror'));
});
