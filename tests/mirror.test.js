// 第3章「長調と短調」の光と影の組（src/core/stage-gen.js の buildRun({ progression: 'mirror' })）
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRun, MIRROR, mirrorLengths, soundAlikes } from '../src/core/stage-gen.js';
import { lengthValue, closes } from '../src/core/length.js';
import { chordOf } from '../src/core/chord.js';
import { degreePc, midiToHz } from '../src/core/harmony.js';

test('鏡写し：ハ長調の 10・12・15 の鏡写しに、平行調の 12・15・18（4:5:6）がある', () => {
  assert.ok(mirrorLengths([10, 12, 15]).some(m => m.join() === '12,15,18'));
});

test('光と影：全キー×30種で、影は光の平行調の短調・2本は同じ棒・同じ K・ベースは影の根音とちょうどオクターブ・正解は1組だけ', () => {
  for (let key = 0; key < 12; key++) for (let seed = 1; seed <= 30; seed++) {
    const run = buildRun({ progression: MIRROR.id, key, seed, decoys: 4 });
    assert.equal(run.stages.length, 8);
    assert.deepEqual(run.stages.map(s => s.label), MIRROR.pairs.flat());
    for (const s of run.stages) {
      const where = `key${key} seed${seed} ${s.label}`;
      assert.ok(closes(s.target), where);
      assert.equal(chordOf(s.target).quality, s.side === 'light' ? 'major' : 'minor', where);
      assert.ok(s.topMidi <= 72, `${where} トップノート`);
      assert.equal(soundAlikes(s.sticks, s.target).length, 0, `${where} 同じ響きの別の三角形`);
      if (s.side !== 'shadow') continue;
      const light = run.stages[s.mirrorOf];
      assert.equal(s.K, light.K, `${where} K`);
      assert.equal(s.target.filter(t => light.target.some(x => x.n === t.n)).length, 2, `${where} 共有する棒`);
      assert.equal(((s.rootMidi % 12) + 12) % 12, degreePc(key, s.chord.degree), `${where} 平行調の根音`);
      const o = Math.log2((s.K / lengthValue(s.rootLength)) / (midiToHz(s.bassMidi) * 2 ** (s.bassCents / 1200)));
      assert.ok(Math.abs(o - Math.round(o)) < 1e-9, `${where} ベース`);
    }
  }
});
