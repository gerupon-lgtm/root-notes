// 1回のプレイの決まり（docs/design/段階3_三角形ステージの画面.md 4・5.2章、AC-05・AC-14）
import test from 'node:test';
import assert from 'node:assert/strict';
import { Play, runSpecFor } from '../src/game/play.js';
import { buildRun } from '../src/core/stage-gen.js';
import { closes, sameLengths } from '../src/core/length.js';
import { MODES } from '../src/content/modes.js';
import { SELECT_PLAY, BARS } from '../src/content/progressions.js';

const fixed = mode => new Play(mode, buildRun({ ...SELECT_PLAY, decoys: MODES[mode].decoys }));
// 今の星の、正解の棒の番号
const answerIndexes = play => play.stage.target.map(t => play.stage.sticks.findIndex(s => sameLengths([s], [t])));
// 閉じるが正解ではない3本の番号
function wrongIndexes(play) {
  const { sticks, target } = play.stage;
  for (let i = 0; i < sticks.length; i++) for (let j = i + 1; j < sticks.length; j++) for (let k = j + 1; k < sticks.length; k++) {
    const t = [sticks[i], sticks[j], sticks[k]];
    if (closes(t) && !sameLengths(t, target)) return [i, j, k];
  }
  throw new Error('閉じる不正解の組がありません');
}
function openIndexes(play) {
  const { sticks } = play.stage;
  for (let i = 0; i < sticks.length; i++) for (let j = i + 1; j < sticks.length; j++) for (let k = j + 1; k < sticks.length; k++) {
    if (!closes([sticks[i], sticks[j], sticks[k]])) return [i, j, k];
  }
  throw new Error('閉じない組がありません');
}
const pickAll = (play, idx) => idx.forEach(i => play.pick(i));

test('遊び方の始め方：選択プレイはカノン進行・キーC で固定、連続プレイは乱数で進行とキーを選ぶ', () => {
  assert.deepEqual(runSpecFor('select', Math.random), { ...SELECT_PLAY, decoys: 3 });
  const spec = runSpecFor('normal', () => 0.5);
  assert.equal(spec.decoys, 4);
  assert.equal(spec.key, 6);
  assert.throws(() => runSpecFor('nope', Math.random), /遊び方/);
});

test('回答前の和音：選択・ノーマル・エキスパートは鳴らせない、フリーは鳴らせる（AC-05）', () => {
  for (const mode of ['select', 'normal', 'expert', 'free']) {
    const play = fixed(mode);
    pickAll(play, answerIndexes(play));
    assert.equal(play.canPlayChord().ok, mode === 'free', mode);
    if (mode !== 'free') assert.equal(play.canPlayChord().reason, 'before-answer');
  }
});

test('回答後は、その三角形が出ている間だけ和音を鳴らせる。棒を選び直すと回答前に戻る', () => {
  const play = fixed('select');
  pickAll(play, wrongIndexes(play));
  assert.equal(play.answer().result, 'wrong');
  assert.equal(play.canPlayChord().ok, true);
  const k = play.selected[0];
  play.pick(k); // 1本外して
  play.pick(k); // 同じ棒を選び直す
  assert.equal(play.canPlayChord().reason, 'before-answer');
});

test('閉じていない三角形は和音も回答もできず、失敗にも数えない', () => {
  const play = fixed('normal');
  pickAll(play, openIndexes(play));
  assert.equal(play.canPlayChord().reason, 'open');
  assert.equal(play.answer().result, 'open');
  assert.equal(play.livesLeft, 10);
});

test('失敗の上限はプレイ全体で数え、使い切ったらゲームオーバー（ノーマル10回、エキスパート5回）', () => {
  for (const [mode, lives] of [['normal', 10], ['expert', 5]]) {
    const play = fixed(mode);
    pickAll(play, wrongIndexes(play));
    for (let n = 1; n < lives; n++) {
      const r = play.answer();
      assert.equal(r.result, 'wrong');
      assert.equal(r.livesLeft, lives - n);
      assert.equal(r.gameOver, false);
    }
    // 星を進めても残りは引き継ぐ
    const play2 = fixed(mode);
    pickAll(play2, wrongIndexes(play2));
    play2.answer();
    play2.selected.splice(0);
    pickAll(play2, answerIndexes(play2));
    assert.equal(play2.answer().result, 'correct');
    play2.advance();
    pickAll(play2, wrongIndexes(play2));
    assert.equal(play2.answer().livesLeft, lives - 2);
    // 最後の1回でゲームオーバー
    const last = play.answer();
    assert.equal(last.gameOver, true);
    assert.equal(play.answer().result, 'finished');
  }
  const free = fixed('free');
  pickAll(free, wrongIndexes(free));
  for (let n = 0; n < 20; n++) assert.equal(free.answer().gameOver, false);
});

test('メーター：閉じた三角形だけ。回数はプレイ全体で数え、閉じていないときは減らない。棒を選び直すと消える', () => {
  const play = fixed('expert');
  pickAll(play, openIndexes(play));
  assert.equal(play.useMeter().reason, 'need-closed');
  assert.equal(play.meterLeft, 3);
  play.selected.splice(0);
  pickAll(play, wrongIndexes(play));
  assert.equal(play.useMeter().ok, true);
  assert.equal(play.meterVisible, true);
  assert.equal(play.useMeter().reason, 'shown');
  assert.equal(play.meterLeft, 2);
  play.pick(play.selected[0]);
  assert.equal(play.meterVisible, false);
  const sel = fixed('select');
  pickAll(sel, wrongIndexes(sel));
  for (let n = 0; n < 10; n++) {
    assert.equal(sel.useMeter().ok, true); // 選択プレイは回数制限なし
    const k = sel.selected[2];
    sel.pick(k);
    sel.pick(k);
  }
  const free = fixed('free');
  assert.equal(free.useMeter().reason, 'toggle-mode');
  assert.equal(free.meterVisible, true);
  free.setMeterToggle(false);
  assert.equal(free.meterVisible, false);
});

test('余韻：回答前（選択・ノーマル・エキスパート）は止める、回答後とフリーは重ねる（AC-14）', () => {
  for (const mode of ['select', 'normal', 'expert']) {
    const play = fixed(mode);
    assert.equal(play.sustain, 'cut', mode);
    pickAll(play, wrongIndexes(play));
    assert.equal(play.sustain, 'cut', mode);
    play.answer();
    assert.equal(play.sustain, 'overlap', mode);
    play.pick(play.selected[0]);
    assert.equal(play.sustain, 'cut', mode);
  }
  assert.equal(fixed('free').sustain, 'overlap');
});

test('正解で星が灯り、4つそろうとフレーズ、8つで1曲。連続プレイは次の星へ進み、最後で終わる', () => {
  const play = fixed('normal');
  const music = [];
  for (let bar = 0; bar < BARS; bar++) {
    assert.equal(play.index, bar);
    pickAll(play, answerIndexes(play));
    const r = play.answer();
    assert.equal(r.result, 'correct');
    music.push(r.music ? `${r.music.kind}:${r.music.from}-${r.music.to}` : '-');
    play.advance();
  }
  assert.deepEqual(music, ['-', '-', '-', 'phrase:0-3', '-', '-', '-', 'song:0-7']);
  assert.equal(play.complete, true);
  assert.equal(play.lit.size, BARS);
});

test('選択プレイ：好きな星を選べ、そろった4つの星でフレーズが鳴る', () => {
  const play = fixed('select');
  for (const bar of [7, 5, 6, 4]) {
    play.goTo(bar);
    pickAll(play, answerIndexes(play));
    const r = play.answer();
    assert.equal(r.result, 'correct');
    if (bar === 4) assert.deepEqual(r.music, { kind: 'phrase', from: 4, to: 7 });
  }
  assert.equal(play.litFromStart, 0); // 1小節目から続いて灯った数（曲を聴き直すとき）
  const cont = fixed('free');
  assert.throws(() => cont.goTo(3), /選択プレイ/);
});

test('発見：3本選ぶと新しい発見を返し、同じ発見は2度返さない', () => {
  const play = fixed('select');
  const idx = openIndexes(play);
  pickAll(play, idx);
  assert.ok(play.lastFound.includes('open'));
  assert.ok(play.found.has('open'));
  const k = play.selected[0];
  play.pick(k);
  assert.deepEqual(play.lastFound, []); // 2本では判定しない
  play.pick(k);
  assert.deepEqual(play.lastFound, []); // 同じ発見は2度返さない
});

test('確認用：答えの棒を選ぶ', () => {
  const play = fixed('free');
  play.revealTarget();
  assert.ok(sameLengths(play.selectedLengths, play.stage.target));
});
