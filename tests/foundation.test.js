// 段階0の土台のテスト（docs/design/段階0_土台.md 6章）
// 版数の一致、画面に版数と © を出す場所、絵の素材のパスの表を確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { APP_VERSION, COPYRIGHT, SERIES } from '../src/version.js';
import { ART_BASE, ART, artPath } from '../src/content/assets.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('版数：package.json（正典）と画面の版がそろい、x.y.z の形', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(APP_VERSION, pkg.version);
});

test('画面：index.html に、シリーズ表記・版数・© を差し込む場所がある', () => {
  const html = read('index.html');
  for (const id of ['app-series', 'app-version', 'app-copyright']) {
    assert.match(html, new RegExp(`id="${id}"`), `id="${id}" がありません`);
  }
  assert.match(COPYRIGHT, /^© .*SIKUMI LAB$/);
  assert.match(SERIES, /^SIKUMI NOTES \| 04$/);
});

test('素材：表に書いたパスのファイルはすべて実在する（まだ採用していない絵は null）', () => {
  assert.ok(ART_BASE.endsWith('/'));
  for (const [name, file] of Object.entries(ART)) {
    if (file === null) continue;
    assert.ok(existsSync(new URL(ART_BASE + file, root)), `${name}：${ART_BASE + file} がありません`);
  }
});

test('素材：名前で引くと、採用前の絵は null、表にない名前は止まる', () => {
  for (const name of Object.keys(ART)) {
    const path = artPath(name);
    assert.ok(path === null || path === `./${ART_BASE}${ART[name]}`);
  }
  assert.throws(() => artPath('no-such-art'), /表にありません/);
});
