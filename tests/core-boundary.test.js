// 部品の境目（docs/design/段階0_土台.md 4章、段階3 2章）。
// 計算の核（src/core/）と遊びの決まり（src/game/）は画面・音・保存に触れない。音（src/audio/）は画面を読み込まない。
// こうしておくと、計算と決まりを画面なしのテストだけで確かめられる
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const filesIn = folder => {
  const dir = new URL(`../src/${folder}/`, import.meta.url);
  return readdirSync(dir).filter(name => name.endsWith('.js')).map(name => [name, readFileSync(new URL(name, dir), 'utf8')]);
};
const imports = code => [...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
const BROWSER = /\b(document|window|navigator|localStorage|sessionStorage|indexedDB|AudioContext|webkitAudioContext|fetch|requestAnimationFrame)\b/;

test('src/core/ には計算のファイルがある', () => {
  assert.ok(filesIn('core').length >= 4);
});

test('src/core/ が読み込むのは、同じフォルダとデータ（src/content/）だけ', () => {
  for (const [name, code] of filesIn('core')) {
    for (const spec of imports(code)) assert.match(spec, /^\.\/[\w-]+\.js$|^\.\.\/content\/[\w-]+\.js$/, `${name} が ${spec} を読み込んでいます`);
    assert.doesNotMatch(code, /\bimport\s*\(/, name);
  }
});

test('src/game/ が読み込むのは、同じフォルダと計算の核とデータだけ', () => {
  for (const [name, code] of filesIn('game')) {
    for (const spec of imports(code)) assert.match(spec, /^\.\/[\w-]+\.js$|^\.\.\/(core|content)\/[\w-]+\.js$/, `${name} が ${spec} を読み込んでいます`);
  }
});

test('src/core/ と src/game/ は画面・音・保存の仕組みに触れない', () => {
  for (const [name, code] of [...filesIn('core'), ...filesIn('game')]) assert.doesNotMatch(code, BROWSER, name);
});

test('src/audio/ は画面や遊びの決まりを読み込まない（受け取るのは周波数と時刻だけ）', () => {
  for (const [name, code] of filesIn('audio')) {
    for (const spec of imports(code)) assert.match(spec, /^\.\/[\w-]+\.js$/, `${name} が ${spec} を読み込んでいます`);
    assert.doesNotMatch(code, /\bdocument\b/, name);
  }
});
