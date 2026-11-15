// 段階5 章末の謎の中身（src/content/riddles.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RIDDLES, RIDDLE_IDS, RIDDLE_K, riddleHz } from '../src/content/riddles.js';
import { BELL_HZ, STORY_ART_DIR } from '../src/content/story.js';
import { FLOW } from '../src/game/flow.js';

const root = new URL('../', import.meta.url);
const cents = r => 1200 * Math.log2(r);

test('謎：答えは要件6.4 の長さ（盾9・剣5・鎧4）、候補は4本で答えを含み、答えのオクターブ違いは入れない', () => {
  assert.deepEqual(RIDDLE_IDS, ['shield', 'sword', 'armor']);
  assert.deepEqual(RIDDLE_IDS.map(id => RIDDLES[id].answer), [9, 5, 4]);
  for (const id of RIDDLE_IDS) {
    const r = RIDDLES[id];
    assert.equal(r.choices.length, 4, id);
    assert.ok(r.choices.includes(r.answer), id);
    assert.equal(new Set(r.choices).size, 4, id);
    for (const n of r.choices) if (n !== r.answer) {
      const c = Math.abs(cents(n / r.answer)) % 1200;
      assert.ok(c > 50 && c < 1150, `${id}：${n} は答え ${r.answer} のオクターブ違い`);
    }
  }
});

test('謎：声の高さは序章の鐘と同じ基準（盾＝鐘9、鎧＝鐘8の1オクターブ上）', () => {
  assert.ok(Math.abs(riddleHz(9) - BELL_HZ[9]) < 1e-9);
  assert.ok(Math.abs(riddleHz(4) - BELL_HZ[8] * 2) < 1e-9);
  assert.ok(Math.abs(RIDDLE_K / 12 - BELL_HZ[12]) < 1e-9);
});

test('謎：流れの中の位置と、絵の素材がある', () => {
  for (const id of RIDDLE_IDS) {
    assert.ok(FLOW.some(s => s.kind === 'riddle' && s.riddle === id), id);
    for (const art of [RIDDLES[id].background, `${id}-sealed`]) assert.ok(existsSync(new URL(`${STORY_ART_DIR}${art}.webp`, root)), art);
    assert.ok(existsSync(new URL(`${STORY_ART_DIR}voice-${id}.svg`, root)), `voice-${id}`);
  }
});
