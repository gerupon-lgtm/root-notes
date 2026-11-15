// 進み具合の記録（段階7。要件 C-04・AC-07・F-009）
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressBook, PROGRESS_KEY, validContinuous } from '../src/game/progress.js';
import { Play } from '../src/game/play.js';
import { BARS } from '../src/content/progressions.js';

const memory = () => {
  const store = new Map();
  return { store, getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
};

test('記録：発見の巻物と選択プレイの灯った星は、足すだけで減らず、読み直しても残る', () => {
  const storage = memory();
  const book = new ProgressBook(storage);
  assert.equal(book.addFound(['open', 'octave']), true);
  assert.equal(book.addFound(['open']), false); // 同じ発見を足しても変わらない
  book.addSelectLit('ch1', ['1-1', '1-3']);
  book.addSelectLit('ch2', [0, 4]);
  const again = new ProgressBook(storage);
  assert.deepEqual([...again.found()].sort(), ['octave', 'open']);
  assert.deepEqual(again.selectLit('ch1'), ['1-1', '1-3']);
  assert.deepEqual(again.selectLit('ch2'), [0, 4]);
  assert.throws(() => book.addSelectLit('ch9', ['x']));
});

test('記録：連続プレイの続きは、保存・読み直し・消すができる。形の合わない続きは使わない', () => {
  const storage = memory();
  const book = new ProgressBook(storage);
  const run = { mode: 'normal', step: 'ch2', ch1: ['1-1', '1-2', '1-3', '1-4', '1-5'], ch2: { spec: { progression: 'canon', key: 0, seed: 7, decoys: 4 }, lit: [0, 1, 2], livesLeft: 8, meterLeft: 5 }, artifacts: { shield: 9 } };
  book.saveContinuous(run);
  assert.deepEqual(new ProgressBook(storage).continuous(), run);
  assert.throws(() => book.saveContinuous({ mode: 'select', step: 'ch1' })); // 選択プレイは連続プレイの続きにならない
  assert.equal(validContinuous({ mode: 'free', step: 'ch2', ch1: [], ch2: { spec: { progression: 'canon', key: 0, seed: 1 }, lit: [], livesLeft: null, meterLeft: null } }), null);
  // 章末の謎の武具は、2〜24 の整数の長さだけ残す（段階5）
  assert.deepEqual(validContinuous({ mode: 'free', step: 'ch2', artifacts: { shield: 9, sword: 1.5, armor: 30, other: 4 } }).artifacts, { shield: 9 });
  book.clearContinuous();
  assert.equal(new ProgressBook(storage).continuous(), null);
});

test('記録：読めない記録は使わず、空の記録で上書きもしない（C-04）。保存できない端末でも止まらない', () => {
  const storage = memory();
  storage.setItem(PROGRESS_KEY, '{broken');
  const book = new ProgressBook(storage);
  assert.deepEqual([...book.found()], []);
  book.addFound(['open']);
  assert.equal(storage.getItem(PROGRESS_KEY), '{broken');
  const full = new ProgressBook({ getItem: () => null, setItem: () => { throw new Error('full'); } });
  assert.equal(full.addFound(['open']), false);
  assert.deepEqual([...full.found()], ['open']); // 画面の中では覚えている
  assert.equal(new ProgressBook(undefined).continuous(), null);
});

test('遊びの状態：書き出して読み戻すと、同じ曲・灯った星・失敗とメーターの残りに戻る。連続プレイは灯っていない最初の星から', () => {
  const p = Play.start('normal', () => 0.37);
  p.lit = new Set([0, 1, 2]);
  p.livesLeft = 7;
  p.meterLeft = 4;
  const snap = JSON.parse(JSON.stringify(p.snapshot()));
  const q = Play.restore('normal', snap);
  assert.equal(q.run.progression.id, p.run.progression.id);
  assert.equal(q.run.key, p.run.key);
  assert.deepEqual(q.run.stages.map(s => s.target), p.run.stages.map(s => s.target));
  assert.deepEqual([...q.lit], [0, 1, 2]);
  assert.equal(q.index, 3);
  assert.equal(q.livesLeft, 7);
  assert.equal(q.meterLeft, 4);
  // 上限のない数は null で残り、戻すと上限なし
  const free = Play.start('free', () => 0.5);
  assert.equal(free.snapshot().livesLeft, null);
  assert.equal(Play.restore('free', free.snapshot()).livesLeft, Infinity);
  // 全部灯っていれば通し終えた扱い、失敗の残りが0ならゲームオーバー
  assert.equal(Play.restore('normal', { ...snap, lit: Array.from({ length: BARS }, (_, b) => b) }).complete, true);
  assert.equal(Play.restore('normal', { ...snap, livesLeft: 0 }).over, true);
});
