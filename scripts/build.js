// 公開用のまとめを dist/ に作る。前作 AQUA の scripts/build.js を土台にした。
// 部品は版ごとのフォルダ（v0.1.1/ など）に置く。版が変わると読み込む場所も変わるので、
// スマホのブラウザが前の版の部品を使い続けることがない。
// 通信なしで遊ぶ仕組み（段階7。docs/design/段階7_PWA.md）：worker（sw.js）に版・資材の一覧・資材ごとの照合値（SHA-256）を書き込み、
// マニフェストと、index.html の印（OFFLINE_METADATA）を置き換える。アイコンは public/ にあれば入れる（Codex に依頼中）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, posix, resolve, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// アプリのアイコン（Codex 素材 アイコン v1.0.0、B案。2026-11-14 発案者が採用）。public/ に置くと、マニフェストと入口のページに入る
const APP_ICONS = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

export function build({ root = repo, output = join(root, 'dist') } = {}) {
  const read = p => readFileSync(join(root, p), 'utf8');
  const version = JSON.parse(read('package.json')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版番号は x.y.z の形にしてください。');
  // 版の同値検査：正典は package.json。画面に出す版がずれていたら止める
  const shown = /^export const APP_VERSION = '([^']+)';$/m.exec(read('src/version.js'))?.[1];
  if (shown !== version) throw new Error(`版がそろっていません：package.json ${version}、画面 ${shown}`);

  // 消してよい出力先は、この作業場所の dist/ か、一時フォルダの中だけ
  output = resolve(output);
  if (output !== join(root, 'dist') && !output.startsWith(resolve(tmpdir()) + sep)) {
    throw new Error(`出力先 ${output} は使えません（dist/ か一時フォルダの中だけ）。`);
  }
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  const prefix = `v${version}`;
  const files = [];
  const copyTree = dir => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const source = posix.join(dir, entry.name);
      if (entry.isDirectory()) { if (source !== 'src/pwa') copyTree(source); continue; }
      if (!/\.(js|css|png|svg|webp|ttf|txt|mp3)$/.test(entry.name)) continue;
      // アプリのアイコンは版のフォルダの外にだけ置く（下の icons。版のフォルダにも写すと、使わない写しが保存場所に二重に入る）
      if (dir === 'public' && APP_ICONS.includes(entry.name)) continue;
      const target = posix.join(prefix, source);
      mkdirSync(join(output, posix.dirname(target)), { recursive: true });
      copyFileSync(join(root, source), join(output, target));
      files.push(`./${target}`);
    }
  };
  copyTree('src');
  if (existsSync(join(root, 'public'))) copyTree('public');
  // 試聴などの確認用ページ（public/audition/*.html）は、版のフォルダの外の audition/ に置く。
  // アプリの資材の一覧（files）には入れないので、通信なしの保存には入らない（本体の画面ではないため）
  const audition = join(root, 'public', 'audition');
  if (existsSync(audition)) {
    mkdirSync(join(output, 'audition'), { recursive: true });
    for (const name of readdirSync(audition)) if (name.endsWith('.html')) copyFileSync(join(audition, name), join(output, 'audition', name));
  }
  // エンディングの確認ページは、絵と音源を含め audition/ にまとめて配信する。
  const endingPreview = 'ending-v0.1.0';
  const endingPreviewSource = join(root, 'previews', endingPreview);
  if (existsSync(endingPreviewSource)) {
    cpSync(endingPreviewSource, join(output, 'audition', endingPreview), { recursive: true });
  }

  // アイコンは版のフォルダの外の決まった場所にも置き、マニフェストと画面はこちらを指す（AQUA 2026-11-03：
  // 古い版の画面のままホーム画面に追加すると、版つきのアイコンが見つからずインストールできないことがあった）
  const icons = APP_ICONS.filter(name => existsSync(join(root, 'public', name)));
  for (const name of icons) copyFileSync(join(root, 'public', name), join(output, name));

  let index = read('index.html');
  if (!index.includes('<!-- OFFLINE_METADATA -->')) throw new Error('index.html に OFFLINE_METADATA の印がありません。');
  const iconLinks = (icons.includes('icon-192.png') ? '<link rel="icon" href="./icon-192.png">' : '')
    + (icons.includes('apple-touch-icon.png') ? '<link rel="apple-touch-icon" href="./apple-touch-icon.png">' : '');
  index = index.replaceAll('./src/', `./${prefix}/src/`).replaceAll('./public/', `./${prefix}/public/`)
    .replace('<!-- OFFLINE_METADATA -->', `<meta name="root-offline" content="enabled"><link rel="manifest" href="./manifest.webmanifest">${iconLinks}`);
  writeFileSync(join(output, 'index.html'), index);
  files.unshift('./index.html');

  const manifest = {
    id: './', name: 'ルート・ノーツ', short_name: 'ROOT NOTES', lang: 'ja', start_url: './', scope: './',
    display: 'standalone', background_color: '#062522', theme_color: '#062522',
    icons: [192, 512].filter(size => icons.includes(`icon-${size}.png`)).map(size => ({ src: `./icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }))
  };
  writeFileSync(join(output, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  // 通信なしで使う資材：入口のページ・マニフェスト・アイコン・版のフォルダの部品
  const assets = ['./index.html', './manifest.webmanifest', ...icons.map(name => `./${name}`), ...files.slice(1)];
  const hashes = Object.fromEntries(assets.map(a => [a, createHash('sha256').update(readFileSync(join(output, a))).digest('hex')]));
  const worker = read('src/pwa/worker.js').replace('__ROOT_VERSION__', version).replace('__ROOT_ASSETS__', JSON.stringify(assets)).replace('__ROOT_HASHES__', JSON.stringify(hashes));
  if (/__ROOT_[A-Z]+__/.test(worker)) throw new Error('sw.js に書き込めていない印があります。');
  writeFileSync(join(output, 'sw.js'), worker);
  // 公開された版と元のコミットを、外から確かめられるようにする
  writeFileSync(join(output, 'build-info.json'), JSON.stringify({ version, commit: process.env.GITHUB_SHA ?? null, files, assets, hashes }, null, 2));
  writeFileSync(join(output, '.nojekyll'), '');
  return { version, output, files, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { version, files } = build();
  console.log(`dist/ に v${version} を作りました（${files.length} ファイル）`);
}
