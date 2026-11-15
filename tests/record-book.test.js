// 第1章の時間の記録（src/game/record-book.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordBook, RECORDS_KEY, formatSeconds } from '../src/game/record-book.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('記録：遊び方×面ごとに最速だけ残す。遅い時間では書きかえない。初めての記録も「更新」', () => {
  const storage = memory();
  const book = new RecordBook(storage);
  assert.equal(book.best('free', '1-1'), null);
  assert.deepEqual(book.submit('free', '1-1', 9800), { updated: true, best: 9800 });
  assert.deepEqual(book.submit('free', '1-1', 12000), { updated: false, best: 9800 });
  assert.deepEqual(book.submit('free', '1-1', 7000), { updated: true, best: 7000 });
  assert.equal(book.best('normal', '1-1'), null); // 遊び方ごとに別
  assert.equal(new RecordBook(storage).best('free', '1-1'), 7000); // 読み直しても残る
  assert.throws(() => book.submit('tutorial', '1-1', 1000));
});

test('記録：読めない記録は使わず、上書きもしない。表示は0.1秒単位', () => {
  const storage = memory();
  storage.setItem(RECORDS_KEY, '{broken');
  const book = new RecordBook(storage);
  book.submit('free', '1-2', 5000);
  assert.equal(storage.getItem(RECORDS_KEY), '{broken');
  assert.equal(formatSeconds(9876), '9.8秒');
  assert.equal(formatSeconds(12000), '12.0秒');
});
