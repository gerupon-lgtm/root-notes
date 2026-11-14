// 第1章「一弦の琴」の計算と、ゲームの流れ（段階4。docs/design/段階4_第1章_一弦の琴.md 6章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { stringHz, targetHz, beatHz, holdStep, startPosition, clampBridge } from '../src/core/monochord.js';
import { MONOCHORD_STAGES, OPEN_HZ, BRIDGE_RANGE, PASS_BEAT, PASS_HOLD, START_OFFSET } from '../src/content/monochord.js';
import { FLOW, firstStep, nextStep, playableChapters, PROLOGUE_SCENES } from '../src/game/flow.js';
import { mulberry32 } from '../src/core/random.js';

test('一弦の琴：1-1〜1-5 は 1/2・2/3・3/4・4/5・5/6（要件6.2）', () => {
  assert.deepEqual(MONOCHORD_STAGES.map(s => `${s.num}/${s.den}`), ['1/2', '2/3', '3/4', '4/5', '5/6']);
  assert.equal(OPEN_HZ, 196);
});

test('一弦の琴：答えの位置に駒を置くと、弦の音がお題と一致し、揺れが0になる', () => {
  for (const s of MONOCHORD_STAGES) {
    const r = s.num / s.den;
    assert.ok(Math.abs(stringHz(OPEN_HZ, r) - targetHz(OPEN_HZ, s.num, s.den)) < 1e-9, s.id);
    assert.ok(beatHz(stringHz(OPEN_HZ, r), targetHz(OPEN_HZ, s.num, s.den)) < 1e-9, s.id);
  }
  // 長さが半分なら1オクターブ上（長さに反比例。C-01）
  assert.equal(stringHz(OPEN_HZ, 0.5), OPEN_HZ * 2);
});

test('一弦の琴：すべての答えが駒の動く範囲の中にあり、始めの位置は答えから離れている', () => {
  const rng = mulberry32(5);
  for (const s of MONOCHORD_STAGES) {
    const answer = s.num / s.den;
    assert.ok(answer >= BRIDGE_RANGE[0] && answer <= BRIDGE_RANGE[1], s.id);
    for (let i = 0; i < 200; i++) {
      const r = startPosition(answer, rng);
      assert.ok(r >= BRIDGE_RANGE[0] && r <= BRIDGE_RANGE[1], `${s.id} 範囲`);
      assert.ok(Math.abs(r - answer) >= START_OFFSET[0] - 1e-12, `${s.id} 離れている`);
      // 離れた位置では揺れが合格の値より大きい（始めから合格しない）
      assert.ok(beatHz(stringHz(OPEN_HZ, r), targetHz(OPEN_HZ, s.num, s.den)) > PASS_BEAT, `${s.id} 揺れ`);
    }
  }
  assert.equal(clampBridge(0), BRIDGE_RANGE[0]);
  assert.equal(clampBridge(2), BRIDGE_RANGE[1]);
});

test('一弦の琴：揺れ1秒に1回未満を1秒保つと合格。途中で1回以上になると数え直す（要件5章）', () => {
  let st = { hold: 0, passed: false };
  for (let i = 0; i < 9; i++) st = holdStep(st, { beat: 0.5, dt: 0.1, droning: true });
  assert.equal(st.passed, false);
  st = holdStep(st, { beat: 1.2, dt: 0.1, droning: true }); // 揺れが大きくなった
  assert.deepEqual(st, { hold: 0, passed: false });
  for (let i = 0; i < 10; i++) st = holdStep(st, { beat: PASS_BEAT - 0.01, dt: 0.1 + 1e-9, droning: true });
  assert.equal(st.passed, true);
  assert.equal(st.hold, PASS_HOLD);
  // 重ねて鳴らしていないときは数えない
  assert.deepEqual(holdStep({ hold: 0.5, passed: false }, { beat: 0, dt: 0.6, droning: false }), { hold: 0, passed: false });
  // 合格のあとは合格のまま
  assert.equal(holdStep({ hold: 1, passed: true }, { beat: 9, dt: 0.1, droning: true }).passed, true);
});

test('流れ：連続プレイは 序 → 第1章 → 謎（盾）→ 第2章 → … → 最終章 の順で、最後のあとはタイトルへ（null）', () => {
  assert.equal(firstStep().id, 'prologue');
  const ids = [];
  for (let s = firstStep(); s; s = nextStep(s.id)) ids.push(s.id);
  assert.deepEqual(ids, ['prologue', 'ch1', 'riddle-shield', 'ch2', 'riddle-sword', 'ch3', 'riddle-armor', 'final']);
  assert.equal(nextStep('final'), null);
  assert.throws(() => nextStep('nope'));
  // 選択プレイで選べる章は、遊べる2つ（第1章・第2章）
  assert.deepEqual(playableChapters().map(x => x.id), ['ch1', 'ch2']);
  assert.ok(FLOW.every(x => x.title));
  assert.equal(PROLOGUE_SCENES.length, 8); // 要件6.10 の序の8場面
});
