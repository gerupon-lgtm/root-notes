// フレーズと1曲の楽譜（AC-12）、色、音の止め方・重ね方（AC-14）
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScore, BAR_SECONDS } from '../src/game/song.js';
import { hueOf, colorOf, blendOf } from '../src/core/color.js';
import { buildRun } from '../src/core/stage-gen.js';
import { SELECT_PLAY } from '../src/content/progressions.js';
import { StringAudio } from '../src/audio/engine.js';
import { fakeAudioContext } from './helpers/fake-audio.js';

const run = buildRun(SELECT_PLAY);

test('楽譜：フレーズは4小節、1曲は8小節。各小節の頭にベースと和音がある', () => {
  for (const [from, to] of [[0, 3], [4, 7], [0, 7]]) {
    const score = buildScore(run.stages, from, to);
    assert.equal(score.bars, to - from + 1);
    assert.equal(score.duration, score.bars * BAR_SECONDS);
    for (let bar = from; bar <= to; bar++) {
      const start = (bar - from) * BAR_SECONDS;
      const notes = score.notes.filter(n => n.bar === bar);
      assert.ok(notes.some(n => n.part === 'bass' && Math.abs(n.time - start) < 1e-9), `${bar + 1}小節目のベース`);
      assert.equal(notes.filter(n => n.part === 'chord').length, 3);
      assert.ok(notes.every(n => n.time >= start - 1e-9 && n.time < start + BAR_SECONDS));
    }
  }
});

test('楽譜：小節の継ぎ目の無音は0.1秒以下（音の消え際で埋まる）', () => {
  const score = buildScore(run.stages, 0, 7);
  const spans = score.notes.map(n => [n.time, n.time + n.duration]).sort((a, b) => a[0] - b[0]);
  let reach = 0, gap = 0;
  for (const [s, e] of spans) { gap = Math.max(gap, s - reach); reach = Math.max(reach, e); }
  assert.ok(gap <= 0.1 + 1e-9, `無音 ${gap.toFixed(3)} 秒`);
});

test('楽譜：曲の余韻を残す設定では、和音が次の小節まで伸びる', () => {
  const plain = buildScore(run.stages, 0, 3).notes.filter(n => n.part === 'chord');
  const carry = buildScore(run.stages, 0, 3, { carryOver: true }).notes.filter(n => n.part === 'chord');
  assert.ok(plain.every(n => n.duration < BAR_SECONDS));
  assert.ok(carry.every(n => n.duration > BAR_SECONDS));
});

test('色：1オクターブ違う音は同じ色。和音は3色を混ぜる', () => {
  assert.equal(hueOf(220), hueOf(440));
  assert.equal(hueOf(261.63 * 4), hueOf(261.63));
  assert.notEqual(hueOf(330), hueOf(440));
  assert.match(colorOf(440), /^hsl\(\d+ 75% 66%\)$/);
  assert.match(blendOf([220, 330, 440]), /^rgb\(\d+ \d+ \d+\)$/);
});

test('音：回答前（cut）は次の単音で前の単音を止め、回答後とフリー（overlap）は止めない（AC-14）', () => {
  const ctx = fakeAudioContext();
  const audio = new StringAudio({ createContext: () => ctx });
  assert.equal(audio.unlock(), true);
  const a = audio.pluck(220, 'cut');
  const b = audio.pluck(330, 'cut');
  assert.equal(a.stopped, true);
  assert.equal(b.stopped, false);
  const c = audio.pluck(440, 'overlap');
  assert.equal(b.stopped, false);
  assert.equal(c.stopped, false);
  audio.pluck(550, 'cut');
  assert.equal(b.stopped, true);
  assert.equal(c.stopped, true);
});

test('音：単音を鳴らしても、お題の和音は止めない。すべて止めると全部止まる', () => {
  const ctx = fakeAudioContext();
  const audio = new StringAudio({ createContext: () => ctx });
  audio.unlock();
  const chord = audio.chord([220, 275, 330]);
  audio.pluck(440, 'cut');
  assert.ok(chord.every(v => !v.stopped));
  audio.stopAll();
  assert.ok(chord.every(v => v.stopped));
});

test('音：最初のタップまで音は準備しない。準備できない端末では false', () => {
  const audio = new StringAudio({ createContext: () => null });
  assert.equal(audio.pluck(220, 'cut'), null);
  assert.equal(audio.unlock(), false);
});
