// 音色（ステージごと・曲・ベース）と、正解のあと次の星へ進む決まり（2026-11-14 発案者の実機テストからの指示）
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMBRES, STAGE_TIMBRES, SONG_TIMBRE, BASS_TIMBRE } from '../src/content/timbres.js';
import { Play, stageTimbre } from '../src/game/play.js';
import { buildRun } from '../src/core/stage-gen.js';
import { sameLengths } from '../src/core/length.js';
import { SELECT_PLAY, BARS } from '../src/content/progressions.js';
import { MODES } from '../src/content/modes.js';
import { StringAudio, LIMITER } from '../src/audio/engine.js';
import { fakeAudioContext } from './helpers/fake-audio.js';

const fixed = mode => new Play(mode, buildRun({ ...SELECT_PLAY, decoys: MODES[mode].decoys }));
const answerIndexes = p => p.stage.target.map(t => p.stage.sticks.findIndex(s => sameLengths([s], [t])));
const solve = p => { p.clearSelection(); answerIndexes(p).forEach(i => p.pick(i)); return p.answer(); };

test('音色：倍音が整数倍に並ぶ（FM の倍率は整数、搬送波はサイン・オルガン・のこぎり波）。ずらして重ねる処理は持たない（要件7.1）', () => {
  for (const [id, t] of Object.entries(TIMBRES)) {
    if (t.ratio !== undefined) assert.ok(Number.isInteger(t.ratio) && t.ratio >= 1, `${id} の倍率 ${t.ratio}`);
    assert.ok(['sine', 'organ', 'saw'].includes(t.carrier), `${id} の搬送波`);
    assert.ok(t.name && t.attack > 0 && t.release > 0 && t.gain > 0, id);
    assert.equal(t.doublingCents ?? t.detune ?? 0, 0, `${id} にずらして重ねる処理がある`);
  }
  assert.equal(TIMBRES.organ.ranks.length, 8);
  assert.ok(STAGE_TIMBRES.length >= 3);
  for (const id of [...STAGE_TIMBRES, SONG_TIMBRE, BASS_TIMBRE]) assert.ok(TIMBRES[id], id);
  assert.ok(!STAGE_TIMBRES.includes(BASS_TIMBRE), 'ベースは別の音色');
});

test('音色：ステージごとに違う音色（隣の星と同じにならない）。同じステージは同じ音色', () => {
  for (const seed of [1, 2, 3, 20261113]) {
    const run = buildRun({ ...SELECT_PLAY, seed });
    const ids = Array.from({ length: BARS }, (_, bar) => stageTimbre(run, bar));
    for (let bar = 1; bar < BARS; bar++) assert.notEqual(ids[bar], ids[bar - 1]);
    assert.equal(stageTimbre(run, 3), stageTimbre(run, 3));
  }
});

test('音：FM の音は搬送波と変調波の2つで鳴らし、止めると両方止まる', () => {
  const ctx = fakeAudioContext();
  const made = [];
  const create = ctx.createOscillator.bind(ctx);
  ctx.createOscillator = () => { const o = create(); made.push(o); return o; };
  const audio = new StringAudio({ createContext: () => ctx });
  audio.unlock();
  const v = audio.pluck(220, 'cut', TIMBRES.organ);
  assert.equal(made.length, 2);
  assert.equal(made[0].type, 'custom'); // オルガンの波形
  assert.equal(made[1].frequency.value, 220 * TIMBRES.organ.ratio);
  v.stop();
  assert.ok(made.every(o => o.stoppedAt !== null));
});

test('音：止めるときは今の音量から0.05秒かけて下げる（cancelAndHoldAtTime は使わない。Chrome でその場で0になりブツっと鳴った）', () => {
  const ctx = fakeAudioContext();
  const calls = [];
  const create = ctx.createGain.bind(ctx);
  ctx.createGain = () => { const g = create(); for (const m of ['cancelAndHoldAtTime', 'cancelScheduledValues', 'linearRampToValueAtTime']) { const f = g.gain[m]; g.gain[m] = (...a) => { calls.push([m, ...a]); return f.apply(g.gain, a); }; } return g; };
  const audio = new StringAudio({ createContext: () => ctx });
  audio.unlock();
  const v = audio.pluck(220, 'cut', TIMBRES.bass);
  calls.length = 0;
  ctx.currentTime = 0.5;
  v.stop();
  assert.ok(!calls.some(c => c[0] === 'cancelAndHoldAtTime'));
  assert.deepEqual(calls.at(-1), ['linearRampToValueAtTime', 0, 0.55]);
});

test('音：出口のコンプレッサーは、割れそうなときだけ働く安全装置の設定（初期設定のままだと和音が歪んだ）', () => {
  const ctx = fakeAudioContext();
  let comp;
  const create = ctx.createDynamicsCompressor.bind(ctx);
  ctx.createDynamicsCompressor = () => (comp = create());
  new StringAudio({ createContext: () => ctx }).unlock();
  for (const [k, v] of Object.entries(LIMITER)) assert.equal(comp[k].value, v);
  assert.ok(LIMITER.threshold >= -3);
  // 自然に消えるときもプツッと鳴らないよう、オルガンとベースの消え方の時定数は 0.04 秒（2026-11-14 発案者）
  for (const t of [TIMBRES.organ, TIMBRES.bass]) assert.ok(t.release >= 0.04, t.name);
});

test('連続プレイ：正解のあとは「次の星へ」を待ち、その間は棒を選び直せない', () => {
  const p = fixed('normal');
  assert.equal(solve(p).result, 'correct');
  assert.equal(p.awaitingNext, true);
  const before = [...p.selected];
  p.pick(before[0]);
  assert.deepEqual(p.selected, before);
  p.advance();
  assert.equal(p.awaitingNext, false);
  assert.equal(p.index, 1);
});

test('選択プレイ：連続プレイと同じく、正解したら「次の星へ」を待ち、順に進む（2026-11-15 発案者）', () => {
  const p = fixed('select');
  solve(p);
  assert.equal(p.awaitingNext, true);
  p.advance();
  assert.equal(p.index, 1);
});

test('音：鳴らし続ける音（第1章）は、鳴らしながら高さを変えられ、止められる', () => {
  const ctx = fakeAudioContext();
  const made = [];
  const create = ctx.createOscillator.bind(ctx);
  ctx.createOscillator = () => { const o = create(); made.push(o); return o; };
  const audio = new StringAudio({ createContext: () => ctx });
  audio.unlock();
  const v = audio.hold(196, TIMBRES.organ);
  assert.ok(made[0].stoppedAt > 3000); // 止めるまで鳴る
  v.setHz(294);
  assert.equal(v.hz, 294);
  v.stop();
  assert.ok(made.every(o => o.stoppedAt < 1));
  v.setHz(300); // 止めたあとは何もしない
  assert.equal(v.hz, 294);
});
