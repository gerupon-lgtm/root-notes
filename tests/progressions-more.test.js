// 進行の追加（2026-11-14 発案者：ポップス5つ、ジャズの II–V–I・I–VI–II–V、平行調の II–V–I（短調））と、
// そのための書き方（音階の外の根音、分数コード、m7(♭5)、短調のキー表示）。docs/design/コード進行の候補_Q-10.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, chordName, keyLabel } from '../src/core/harmony.js';
import { buildRun } from '../src/core/stage-gen.js';
import { staffColumn, noteName } from '../src/game/notation.js';
import { PROGRESSIONS } from '../src/content/progressions.js';

const names = id => buildRun({ progression: id, key: 0, seed: 1, decoys: 3 }).stages.map(s => s.chordName);
const labels = id => buildRun({ progression: id, key: 0, seed: 1, decoys: 3 }).stages.map(s => s.label);

test('度数に ♯・♭ を付けて、音階の外の根音を書ける', () => {
  assert.deepEqual(parseChord('♯Vdim'), { degree: 4, quality: 'diminished', shift: 1 });
  assert.deepEqual(parseChord('♭VII'), { degree: 6, quality: 'major', shift: -1 });
  assert.deepEqual(parseChord('IIm'), { degree: 1, quality: 'minor', shift: 0 });
});

test('コードネーム：分数コード、7・maj7・m7・m7(♭5)、音階の外の根音', () => {
  assert.equal(chordName('V/VII', 0), 'G/B');
  assert.equal(chordName('I/III', 0), 'C/E');
  assert.equal(chordName('I7', 0), 'C7');
  assert.equal(chordName('III7', 0), 'E7');
  assert.equal(chordName('VI7', 0), 'A7');
  assert.equal(chordName('IIm7', 10), 'Cm7'); // キー B♭
  assert.equal(chordName('VIIm7(♭5)', 10), 'Am7(♭5)');
  assert.equal(chordName('♯Vdim', 0), 'G♯dim');
});

test('キーの表示：長調はそのまま、短調は平行調の短調（キー B♭ の短調は Gm）', () => {
  assert.equal(keyLabel(10, 'major'), 'B♭');
  assert.equal(keyLabel(10, 'minor'), 'Gm');
  assert.equal(keyLabel(6, 'minor'), 'D♯m');
  assert.equal(keyLabel(1, 'minor'), 'B♭m');
});

test('進行：13種（今の5つ＋ポップス5つ＋ジャズ3つ）。どれも8小節', () => {
  assert.equal(PROGRESSIONS.length, 13);
  for (const p of PROGRESSIONS) assert.equal(buildRun({ progression: p.id, key: 0, seed: 2, decoys: 3 }).stages.length, 8);
});

test('ポップス：キーC のコードネームが、発案者の資料どおり', () => {
  assert.deepEqual(names('jpop-royal'), ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C7']);
  assert.deepEqual(names('emo'), ['Am', 'F', 'C', 'G', 'Am', 'Em', 'F', 'G']);
  assert.deepEqual(names('cliche'), ['C', 'G/B', 'Am', 'C/G', 'F', 'C/E', 'Dm', 'G']);
  assert.deepEqual(names('b-melo'), ['F', 'G', 'Em', 'Am', 'F', 'G', 'E7', 'Am']);
  assert.deepEqual(names('seishun'), ['Am', 'G', 'F', 'C', 'Dm', 'Em', 'F', 'G']);
});

test('ジャズ：キーC の II–V–I と I–VI–II–V', () => {
  assert.deepEqual(names('ii-v-i'), ['Dm7', 'G7', 'Cmaj7', 'Cmaj7', 'Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.deepEqual(names('i-vi-ii-v'), ['Cmaj7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7']);
});

test('平行調の II–V–I：キー B♭（短調の表示は Gm）で Cm7 F7 B♭maj7 E♭maj7 ／ Am7(♭5) D7 Gm7 Gm7。度数は短調の度数で出す', () => {
  const run = buildRun({ progression: 'relative-ii-v-i', key: 10, seed: 3, decoys: 3 });
  assert.equal(run.progression.mode, 'minor');
  assert.deepEqual(run.stages.map(s => s.chordName), ['Cm7', 'F7', 'B♭maj7', 'E♭maj7', 'Am7(♭5)', 'D7', 'Gm7', 'Gm7']);
  assert.deepEqual(run.stages.map(s => s.label), ['IVm7', '♭VII7', '♭IIImaj7', '♭VImaj7', 'IIm7(♭5)', 'V7', 'Im7', 'Im7']);
});

test('7の和音の音：C7 は ベース C ＋ 三角形 E・G・B♭、E7 は ベース E ＋ 三角形 G♯・B・D（音階の外の根音も正しく綴る）', () => {
  const c7 = buildRun({ progression: 'jpop-royal', key: 0, seed: 1, decoys: 3 }).stages[7];
  const col = staffColumn(c7, 0);
  assert.equal(noteName(col.bass)[0], 'C');
  assert.deepEqual([...new Set(col.chord.map(n => n.letter + n.accidental))].sort(), ['B♭', 'E', 'G']);
  const e7 = buildRun({ progression: 'b-melo', key: 0, seed: 1, decoys: 3 }).stages[6];
  const col2 = staffColumn(e7, 0);
  assert.equal(col2.bass.letter, 'E');
  assert.deepEqual([...new Set(col2.chord.map(n => n.letter + n.accidental))].sort(), ['B', 'D', 'G♯']);
  assert.equal(labels('b-melo')[6], 'III7');
});
