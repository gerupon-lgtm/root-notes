// 第3章「光の響きから影の琴へ」の数字（src/content/mirror-explain.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorModel } from '../src/content/mirror-explain.js';
import { buildRun } from '../src/core/stage-gen.js';

const C4 = 261.6255653005986;

test('ドミソの例：上から ソ6・ミ5・ド4 → 弦 18ラ・15ド・12ミ（Codex 試作 v0.5.0 の表と同じ）', () => {
  const m = mirrorModel([10, 12, 15], [12, 15, 18], C4 * 15);
  assert.deepEqual(m.rows.map(r => [r.note, r.ticks, r.length, r.target.length, r.target.note]), [['ソ', 6, 10, 18, 'ラ'], ['ミ', 5, 12, 15, 'ド'], ['ド', 4, 15, 12, 'ミ']]);
  assert.equal(m.unit, 3);
});

test('ほかの形：15・20・24 → 8・6・5、12・15・20 → 5・4・3。本体が作った光と影の組なら、どのキーでも作れる', () => {
  assert.deepEqual(mirrorModel([15, 20, 24], [15, 18, 24], 3000).ticks, [8, 6, 5]);
  assert.deepEqual(mirrorModel([12, 15, 20], [9, 12, 15], 3000).ticks, [5, 4, 3]);
  for (let key = 0; key < 12; key++) for (let seed = 1; seed <= 20; seed++) {
    const [light, shadow] = buildRun({ progression: 'mirror', key, seed, decoys: 3 }).stages;
    assert.doesNotThrow(() => mirrorModel(light.target.map(l => l.n), shadow.target.map(l => l.n), light.K), `key${key} seed${seed}`);
  }
});
