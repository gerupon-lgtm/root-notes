// 計算の核（src/core/）が、画面・音・保存を読み込まないこと（docs/design/段階0_土台.md 4章）。
// こうしておくと、計算を画面なしのテストだけで確かめられる
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/core/', import.meta.url);
const files = readdirSync(dir).filter(name => name.endsWith('.js'));

test('src/core/ には計算のファイルがある', () => {
  assert.ok(files.length >= 4, files.join(', '));
});

test('src/core/ が読み込むのは、同じフォルダとデータ（src/content/）だけ', () => {
  for (const name of files) {
    const code = readFileSync(new URL(name, dir), 'utf8');
    for (const [, spec] of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.match(spec, /^\.\/[\w-]+\.js$|^\.\.\/content\/[\w-]+\.js$/, `${name} が ${spec} を読み込んでいます`);
    }
    assert.doesNotMatch(code, /\bimport\s*\(/, `${name} が途中で読み込みをしています`);
  }
});

test('src/core/ は画面・音・保存の仕組みに触れない', () => {
  for (const name of files) {
    const code = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(code, /\b(document|window|navigator|localStorage|sessionStorage|indexedDB|AudioContext|webkitAudioContext|fetch)\b/, name);
  }
});
