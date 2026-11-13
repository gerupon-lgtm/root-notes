// 音の高さ（f ＝ K ÷ 長さ）、整数比、揺れの値（docs/design/段階1_計算の核.md 3章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { len } from '../src/core/length.js';
import { frequency, frequencies, ratioOf, beats, beatLevel, BEAT_CLEAR_BELOW, BEAT_FAR_ABOVE } from '../src/core/pitch.js';

const tri = (...ns) => ns.map(n => len(n));

test('周波数は長さに反比例する（C-01）：f ＝ K ÷ 長さ', () => {
  assert.equal(frequency(len(10), 1000), 100);
  assert.equal(frequency(len(5), 1000), 200); // 長さ半分で1オクターブ上
  assert.ok(Math.abs(frequency(len(6, true), 1000) - 1000 / (6 * Math.SQRT2)) < 1e-12);
  for (const bad of [0, -1, NaN]) assert.throws(() => frequency(len(10), bad), /基準の音/);
});

test('3本の周波数を低い順に（最長辺が最低音）', () => {
  assert.deepEqual(frequencies(tri(12, 10, 15), 1200), [80, 100, 120]);
});

test('周波数の整数比（低い順、いちばん小さい整数）。√2 を含むと null', () => {
  assert.deepEqual(ratioOf(tri(6, 10, 15)), [2, 3, 5]);
  assert.deepEqual(ratioOf(tri(10, 15, 24)), [5, 8, 12]);
  assert.deepEqual(ratioOf(tri(12, 15, 20)), [3, 4, 5]);
  assert.equal(ratioOf([len(6), len(6), len(6, true)]), null);
});

test('揺れ：お題と自分をそれぞれ低い順に並べて組にし、各組の周波数の差', () => {
  assert.deepEqual(beats(tri(10, 12, 15), tri(15, 10, 12), 1200), [0, 0, 0]);
  assert.deepEqual(beats(tri(10, 12, 15), tri(10, 12, 16), 1200), [5, 0, 0]); // 80 と 75
  assert.throws(() => beats(tri(10, 12, 15), tri(10, 12), 1200), /同じ本数/);
});

test('揺れの表示：0.6未満は「澄」、15超は「遠い」、その間は数値（要件5章【想定】）', () => {
  assert.equal(BEAT_CLEAR_BELOW, 0.6);
  assert.equal(BEAT_FAR_ABOVE, 15);
  assert.equal(beatLevel(0), 'clear');
  assert.equal(beatLevel(0.59), 'clear');
  assert.equal(beatLevel(0.6), 'near');
  assert.equal(beatLevel(15), 'near');
  assert.equal(beatLevel(15.01), 'far');
});
