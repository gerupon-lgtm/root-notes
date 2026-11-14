// 第1章の案内（チュートリアル）の手順と記録（2026-11-14 発案者。前作 AQUA・PRISM の形にそろえる）
import test from 'node:test';
import assert from 'node:assert/strict';
import { CH1_STEPS, CH1_CLEAR, CH1_FLASH, STEP_IDS, ACTIONS, FINE_BEAT, advanceStep, readNext, nextAction, plain } from '../src/content/tutorial.js';
import { TutorialBook, TUTORIAL_KEY } from '../src/game/tutorial-book.js';

test('案内：チューニングの順番（お手本を聞く → はじく → 解説 → 重ねて聞く → 解説 → 揺れを消す）。2026-11-14 発案者', () => {
  assert.deepEqual(STEP_IDS, ['target', 'pluck', 'about-tuning', 'drone', 'about-beat', 'move']);
  assert.deepEqual(CH1_STEPS.map(s => s.kind), ['action', 'action', 'read', 'action', 'read', 'action']);
  for (const s of CH1_STEPS) {
    assert.ok(s.heading && s.text && s.note, s.id);
    if (s.kind === 'action') assert.ok(s.targets.length >= 1, s.id);
  }
  // 「一つにまとまって聞こえる」という手がかり（きれいな和音では揺れが分かりにくいため）
  assert.ok(plain(CH1_STEPS.find(s => s.id === 'about-beat').note).includes('一つにまとまって'));
  assert.ok(plain(CH1_STEPS.find(s => s.id === 'move').fine.note).includes('一つにまとまった'));
  assert.ok(plain(CH1_CLEAR.text).includes('一つにまとまり'));
  // 揺れを消す手順は、持ち手のお手本から、揺れが遅くなったらつまみの仕上げへ
  const move = CH1_STEPS.find(s => s.id === 'move');
  assert.equal(move.demo, 'bridge');
  assert.equal(move.fine.demo, 'knob');
  assert.ok(move.fine.targets.includes('knob'));
  assert.ok(FINE_BEAT > 1);
  // 1-2〜1-5 の光の導線も同じ順番
  assert.deepEqual([...ACTIONS], ['target', 'pluck', 'drone', 'move']);
  assert.equal(nextAction('target'), 'pluck');
  assert.equal(nextAction('pluck'), 'drone');
  assert.equal(nextAction('drone'), 'move');
  assert.equal(nextAction('move'), null);
  assert.deepEqual([...CH1_FLASH.drone], ['mono-drone']);
  assert.ok(CH1_FLASH.move.includes('bridge') && CH1_FLASH.move.includes('knob'));
});

test('案内：操作の手順は操作で、解説の手順は「次へ」で進む。先の操作をしたら飛ばして進み、戻らない', () => {
  let step = 0;
  step = advanceStep(step, 'target'); assert.equal(STEP_IDS[step], 'pluck');
  step = advanceStep(step, 'pluck'); assert.equal(STEP_IDS[step], 'about-tuning');
  assert.equal(advanceStep(step, 'pluck'), step); // もう一度はじいても進まない
  step = readNext(step); assert.equal(STEP_IDS[step], 'drone');
  assert.equal(readNext(step), step); // 操作の手順は「次へ」では進まない
  step = advanceStep(step, 'drone'); assert.equal(STEP_IDS[step], 'about-beat');
  step = readNext(step); assert.equal(STEP_IDS[step], 'move');
  assert.equal(advanceStep(step, 'move'), step); // 最後の手順は合格で終わる
  // はじかずに重ねて鳴らしたら、うなりの解説へ
  assert.equal(STEP_IDS[advanceStep(1, 'drone')], 'about-beat');
  assert.throws(() => advanceStep(0, 'about-beat'));
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
