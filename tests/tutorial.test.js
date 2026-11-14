// 第1章の案内（チュートリアル）の手順と記録（2026-11-14 発案者。前作 AQUA・PRISM の形にそろえる）
import test from 'node:test';
import assert from 'node:assert/strict';
import { CH1_STEPS, CH1_CLEAR, CH1_FLASH, STEP_IDS, advanceStep } from '../src/content/tutorial.js';
import { TutorialBook, TUTORIAL_KEY } from '../src/game/tutorial-book.js';

test('案内：第1章は 聞く → はじく → 駒 → 重ねる → 揺れを消す の5手順。どれも見出し・操作・補足と、光らせる所がある', () => {
  assert.deepEqual(STEP_IDS, ['target', 'pluck', 'move', 'drone', 'tune']);
  for (const s of CH1_STEPS) {
    assert.ok(s.heading && s.text && s.note, s.id);
    assert.ok(s.targets.length >= 1, s.id);
  }
  // 指先の輪のお手本は、駒を動かす手順とつまみを回す手順
  assert.deepEqual(CH1_STEPS.filter(s => s.demo).map(s => [s.id, s.demo]), [['move', 'bridge'], ['tune', 'knob']]);
  assert.ok(CH1_CLEAR.heading.includes('クリア'));
  // 1-2〜1-5 の光の導線：お題 → はじく → 駒・つまみ → 重ねて鳴らす（2026-11-14 発案者）
  assert.deepEqual([...CH1_FLASH.target, ...CH1_FLASH.pluck], ['mono-target', 'mono-pluck']);
  assert.ok(CH1_FLASH.move.includes('bridge') && CH1_FLASH.move.includes('knob'));
  assert.deepEqual([...CH1_FLASH.drone], ['mono-drone']);
});

test('案内：操作をすると次の手順へ。先の手順の操作をしたら飛ばして進み、前の手順の操作では戻らない', () => {
  let step = 0;
  step = advanceStep(step, 'target'); assert.equal(step, 1);
  step = advanceStep(step, 'target'); assert.equal(step, 1); // もう一度聞いても戻らない・進まない
  step = advanceStep(step, 'move'); assert.equal(step, 3); // はじかずに駒を動かした → 重ねる手順へ
  step = advanceStep(step, 'pluck'); assert.equal(step, 3);
  step = advanceStep(step, 'drone'); assert.equal(step, 4);
  step = advanceStep(step, 'drone'); assert.equal(step, 4); // 最後の手順（揺れを消す）は合格で終わる
  assert.throws(() => advanceStep(0, 'nope'));
});

test('案内の記録：初めては自動で出す。済み・スキップは端末に残り、読み書きできない端末でも止まらない', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const book = new TutorialBook(storage);
  assert.equal(book.shouldAuto('ch1'), true);
  book.complete('ch1');
  assert.equal(new TutorialBook(storage).shouldAuto('ch1'), false);
  const other = new TutorialBook({ getItem: () => null, setItem: () => {} });
  other.skip('ch1');
  assert.equal(other.shouldAuto('ch1'), false);
  // 壊れた記録・保存できない端末
  assert.equal(new TutorialBook({ getItem: () => '{oops', setItem: () => { throw new Error('full'); } }).shouldAuto('ch1'), true);
  const broken = new TutorialBook({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
  broken.complete('ch1');
  assert.equal(broken.shouldAuto('ch1'), false);
  assert.equal(new TutorialBook(undefined).shouldAuto('ch1'), true);
  assert.equal(TUTORIAL_KEY, 'root-notes-tutorial-v1');
});
