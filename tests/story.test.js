// 段階6 おはなしの紙芝居の中身（src/content/story.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PROLOGUE, STORY_ART_DIR, BELL_HZ, SKY_STARS, GONE_STARS } from '../src/content/story.js';
import { FLOW } from '../src/game/flow.js';

const root = new URL('../', import.meta.url);

test('序章：名前は「序章」、8場面、どの絵もファイルがある', () => {
  assert.equal(FLOW[0].title, '序章');
  assert.equal(PROLOGUE.length, 8);
  for (const s of PROLOGUE) {
    assert.ok(s.layers.length > 0, s.id);
    assert.ok(s.narration || s.say, `${s.id} に語りかセリフがある`);
    for (const l of s.layers) {
      assert.ok(existsSync(new URL(`${STORY_ART_DIR}${l.art}.webp`, root)), `${s.id}：${l.art} がない`);
      assert.ok(l.x >= 0 && l.x < 1280 && l.y >= 0 && l.y < 960 && l.w > 0 && l.x + l.w <= 1280, `${s.id}：${l.art} が絵の外`);
    }
  }
});

test('序章：鐘は 12：9：8：6 の大きさのまま並び、高さは伝承の比（4/3・3/2・2倍）', () => {
  const b = Object.fromEntries(PROLOGUE[0].layers.filter(l => l.art.startsWith('bell-')).map(l => [l.art.slice(5), l.w]));
  for (const n of ['9', '8', '6']) assert.ok(Math.abs(b[n] / b['12'] - Number(n) / 12) < 1e-9, `鐘${n}`);
  assert.ok(Math.abs(BELL_HZ[9] / BELL_HZ[12] - 4 / 3) < 1e-9);
  assert.ok(Math.abs(BELL_HZ[8] / BELL_HZ[12] - 3 / 2) < 1e-9);
  assert.ok(Math.abs(BELL_HZ[6] / BELL_HZ[12] - 2) < 1e-9);
});

test('序章：欠けた星は星の表の中、音の合図は鐘の大きさを使う', () => {
  for (const i of GONE_STARS) assert.ok(SKY_STARS[i]);
  for (const s of PROLOGUE) for (const c of s.cues) for (const n of c.bells ?? []) assert.ok(BELL_HZ[n], `${s.id} 鐘${n}`);
});

test('章の終わり：終1・終2 と 終4 の絵がそろい、終4 の文に選んだ長さを出さない（正誤を漏らさない）', async () => {
  const { endBefore, endAfter, CHAPTER_END } = await import('../src/content/story.js');
  for (const [id, name] of [['shield', '盾'], ['sword', '剣'], ['armor', '鎧']]) {
    assert.ok(CHAPTER_END[id], id);
    const slides = [...endBefore(id, name), ...endAfter(id, name, 465.6)];
    assert.equal(slides.length, 3, id);
    for (const s of slides) for (const l of s.layers) {
      const file = l.svg ? `${STORY_ART_DIR}${l.svg}.svg` : `${STORY_ART_DIR}${l.art}.webp`;
      assert.ok(existsSync(new URL(file, root)), `${s.id}：${file} がない`);
    }
    const last = slides[2];
    assert.ok(!/\d/.test(last.say), `${id}：終4 の文に数字（長さ）が出ている`);
  }
});
