// 9小節目の締め（2026-11-15 発案者：8小節の演奏のあとは、すべてキーの主和音で締める）
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRun, closingStage, MIRROR } from '../src/core/stage-gen.js';
import { buildScore, BAR_SECONDS } from '../src/game/song.js';
import { PROGRESSIONS } from '../src/content/progressions.js';
import { midiToHz } from '../src/core/harmony.js';
import { frequencies } from '../src/core/pitch.js';
import { STAGE_RULES } from '../src/content/stage-rules.js';

const pcOf = hz => ((Math.round(69 + 12 * Math.log2(hz / 440)) % 12) + 12) % 12;

test('どの進行・どのキーでも、締めの和音はキーの主和音（長調は I、短調で出す進行は Im）で、ベースは根音', () => {
  for (const p of [...PROGRESSIONS.map(x => x.id), MIRROR.id]) {
    for (const key of [0, 5, 7, 10]) {
      const run = buildRun({ progression: p, key, seed: 7, decoys: 3 });
      const end = closingStage(run);
      const minor = run.progression.mode === 'minor';
      const rootPc = (key + (minor ? 9 : 0)) % 12;
      assert.equal(((end.bassMidi % 12) + 12) % 12, rootPc, `${p} キー${key}：ベース`);
      const pcs = new Set(frequencies(end.target, end.K).map(pcOf));
      const want = new Set([rootPc, (rootPc + (minor ? 3 : 4)) % 12, (rootPc + 7) % 12]);
      assert.deepEqual([...pcs].sort(), [...want].sort(), `${p} キー${key}：和音の音`);
      assert.ok(frequencies(end.target, end.K).every(hz => Math.round(69 + 12 * Math.log2(hz / 440)) <= STAGE_RULES.maxTopMidi), `${p}：上限`);
    }
  }
});

test('進行の中に主和音の小節があれば、その小節と同じ三角形・同じ基準の音を使う', () => {
  const run = buildRun({ progression: 'canon', key: 0, seed: 3, decoys: 3 });
  const end = closingStage(run);
  assert.equal(end.K, run.stages[0].K);
  assert.deepEqual(end.target, run.stages[0].target);
});

test('締めは9小節目に1回だけ（和音とベースを全音符で）。曲は1小節ぶん長くなる', () => {
  const run = buildRun({ progression: 'royal-road', key: 2, seed: 5, decoys: 3 });
  const plain = buildScore(run.stages, 0, 7), ended = buildScore(run.stages, 0, 7, { ending: closingStage(run) });
  assert.ok(Math.abs(ended.duration - plain.duration - BAR_SECONDS) < 1e-9);
  const last = ended.notes.filter(n => n.bar === 8);
  assert.equal(last.filter(n => n.part === 'bass').length, 1);
  assert.equal(last.filter(n => n.part === 'chord').length, 3);
  assert.ok(last.every(n => n.time >= 8 * BAR_SECONDS));
  assert.ok(Math.abs(last.find(n => n.part === 'bass').hz - midiToHz(closingStage(run).bassMidi)) < 1e-9);
});
