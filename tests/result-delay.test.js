// 結果を出すまでの待ち（設定。2026-11-15 発案者：既定 1.5秒、0〜5秒・0.1秒きざみ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResultDelay, resultDelayMs, setResultDelayMs, RESULT_DELAY_DEFAULT_MS } from '../src/ui/timing.js';

test('既定は 1.5秒。0〜5秒・0.1秒きざみにそろえ、読めない値は既定', () => {
  assert.equal(RESULT_DELAY_DEFAULT_MS, 1500);
  assert.equal(normalizeResultDelay(-3), 0);
  assert.equal(normalizeResultDelay(9000), 5000);
  assert.equal(normalizeResultDelay(1234), 1200);
  assert.equal(normalizeResultDelay('abc'), 1500);
});

test('記録した値を読み、記録できない端末では既定', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.equal(resultDelayMs(), 1500);
  assert.equal(setResultDelayMs(800), 800);
  assert.equal(resultDelayMs(), 800);
  delete globalThis.localStorage;
  assert.equal(resultDelayMs(), 1500);
});
