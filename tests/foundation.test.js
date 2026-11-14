// 段階0の土台のテスト（docs/design/段階0_土台.md 6章）
// 版数の一致、画面に版数と © を出す場所、絵の素材のパスの表、公開用のまとめを確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_VERSION, COPYRIGHT, SERIES } from '../src/version.js';
import { ART_BASE, ART, artPath } from '../src/content/assets.js';
import { build } from '../scripts/build.js';
import { createHash } from 'node:crypto';

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
  assert.equal(COPYRIGHT, '© SIKUMI LAB'); // 年なし（2026-11-14 発案者）
  assert.equal(SERIES, 'SIKUMI NOTES | 04');
});

test('素材：表に書いたパスのファイルはすべて実在する（まだ採用していない絵は null）', () => {
  assert.ok(ART_BASE.endsWith('/'));
  for (const [name, file] of Object.entries(ART)) {
    if (file === null) continue;
    assert.ok(existsSync(new URL(ART_BASE + file, root)), `${name}：${ART_BASE + file} がありません`);
  }
});

test('素材：名前で引くと、リポジトリの一番上から見た場所を返す。採用前の絵は null、表にない名前は止まる', () => {
  for (const [name, file] of Object.entries(ART)) {
    assert.equal(artPath(name), file === null ? null : new URL(ART_BASE + file, root).href);
  }
  assert.throws(() => artPath('no-such-art'), /表にありません/);
});

test('公開用のまとめ：版のフォルダに部品を置き、入口のページがその版を読む', () => {
  const output = mkdtempSync(join(tmpdir(), 'root-notes-build-'));
  try {
    const { version } = build({ output });
    assert.equal(version, APP_VERSION);
    const index = readFileSync(join(output, 'index.html'), 'utf8');
    assert.match(index, new RegExp(`\\./v${version.replaceAll('.', '\\.')}/src/ui/main\\.js`));
    assert.doesNotMatch(index, /"\.\/src\//);
    for (const file of ['src/ui/main.js', 'src/ui/style.css', 'src/version.js', 'src/content/assets.js']) {
      assert.ok(existsSync(join(output, `v${version}`, file)), `${file} がありません`);
    }
    const info = JSON.parse(readFileSync(join(output, 'build-info.json'), 'utf8'));
    assert.equal(info.version, version);
    assert.ok(existsSync(join(output, '.nojekyll')));
    // 通信なしで遊ぶ仕組み（段階7）：印を置き換え、sw.js に版・資材の一覧・照合値を書き込む
    assert.match(index, /<meta name="root-offline" content="enabled"><link rel="manifest" href="\.\/manifest\.webmanifest">/);
    assert.doesNotMatch(index, /OFFLINE_METADATA/);
    const sw = readFileSync(join(output, 'sw.js'), 'utf8');
    assert.ok(sw.includes(`const VERSION = '${version}';`));
    assert.doesNotMatch(sw, /__ROOT_[A-Z]+__/);
    assert.ok(info.assets.includes('./index.html') && info.assets.includes('./manifest.webmanifest'));
    for (const a of info.assets) {
      assert.ok(existsSync(join(output, a)), `${a} がありません`);
      assert.equal(createHash('sha256').update(readFileSync(join(output, a))).digest('hex'), info.hashes[a], `${a} の照合値`);
    }
    const manifest = JSON.parse(readFileSync(join(output, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.short_name, 'ROOT NOTES');
    assert.equal(manifest.display, 'standalone');
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
