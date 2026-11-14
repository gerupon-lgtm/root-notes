// 五線譜に書く音符（2026-11-14 発案者：コード進行を鳴らすとき、五線譜で鳴っている音符を見せる）
import test from 'node:test';
import assert from 'node:assert/strict';
import { staffColumn, noteName } from '../src/game/notation.js';
import { buildRun } from '../src/core/stage-gen.js';
import { PROGRESSIONS, SELECT_PLAY } from '../src/content/progressions.js';

const run = buildRun(SELECT_PLAY); // カノン進行・キーC
const names = col => col.chord.map(noteName);

test('音符：キーC の1小節目（I、15·20·24、第1転回形、最低音 E3）はミ・ソ・ド、ベースは C', () => {
  const col = staffColumn(run.stages[0], run.key);
  assert.deepEqual(names(col), ['E3', 'G3', 'C4']);
  assert.equal(noteName(col.bass), 'C2');
  assert.equal(col.label, 'I');
  assert.equal(col.name, 'C');
});

test('音符：和音の音は根音の文字から3度・5度で綴る（キー B♭ の VIm は G・B♭・D）', () => {
  const r = buildRun({ ...SELECT_PLAY, key: 10 });
  const col = staffColumn(r.stages[2], r.key); // VIm
  assert.deepEqual([...new Set(col.chord.map(n => n.letter + n.accidental))].sort(), ['B♭', 'D', 'G']);
  assert.equal(col.name, 'Gm');
});

test('音符：キー F♯ の VII（E♯ の和音）は E♯ と綴る', () => {
  const stage = { ...run.stages[0], chord: { degree: 6, quality: 'diminished' }, bassDegree: 6, label: 'VIIdim', lowMidi: 53, bassMidi: 41 };
  const col = staffColumn({ ...stage, target: run.stages[0].target }, 6);
  assert.equal(noteName(col.bass), 'E♯2');
});

test('音符：五線の位置（step）は音の高さの順に並び、ベースは和音より下', () => {
  for (const p of PROGRESSIONS) for (let key = 0; key < 12; key++) {
    const r = buildRun({ progression: p.id, key, seed: 5, decoys: 3 });
    for (const stage of r.stages) {
      const col = staffColumn(stage, key);
      const steps = col.chord.map(n => n.step);
      assert.deepEqual(steps, [...steps].sort((a, b) => a - b), `${p.name} key${key}`);
      assert.ok(col.bass.step < steps[0]);
      // 綴りと MIDI 番号が合っている（文字と変化記号から求めた高さ ＝ 平均律の音）
      for (const n of [...col.chord, col.bass]) assert.equal(n.natural + n.shift, n.midi);
    }
  }
});
