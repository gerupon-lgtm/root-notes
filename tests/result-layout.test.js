import test from 'node:test';
import assert from 'node:assert/strict';
import { resultToastHeight } from '../src/ui/result-layout.js';

const fixed = { headerHeight: 38, actionsHeight: 58, verticalInsets: 34, gap: 12, bodyHeight: 48 };
test('小さい操作欄でも、終了ボタンと下余白を本文に押し出させない', () => {
  // 360×640で観測した旧上限167pxでは、本文の最小高だけでも178px必要。
  const height = resultToastHeight({ ...fixed, controlsHeight: 127, bottom: 630 });
  assert.ok(height >= fixed.headerHeight + fixed.actionsHeight + fixed.verticalInsets + fixed.gap * 2 + fixed.bodyHeight);
  assert.ok(height > 167);
  assert.ok(height <= 622);
});
test('余裕がある操作欄は元の範囲を使い、画面上端の外へ広げない', () => {
  assert.equal(resultToastHeight({ ...fixed, controlsHeight: 280, bottom: 830 }), 320);
  const largeText = { ...fixed, headerHeight: 90, actionsHeight: 80 };
  assert.ok(resultToastHeight({ ...largeText, controlsHeight: 130, bottom: 270 }) <= 262);
});

