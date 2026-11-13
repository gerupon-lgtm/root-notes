// 公開用のまとめを dist/ に作る。前作 AQUA の scripts/build.js を土台にした、段階7までの仮の形。
// 部品は版ごとのフォルダ（v0.1.1/ など）に置く。版が変わると読み込む場所も変わるので、
// スマホのブラウザが前の版の部品を使い続けることがない。
// 通信なしで遊ぶ仕組み（worker・マニフェスト・アイコン）と Cloudflare 用の設定は、段階7で足す。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, posix, resolve, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
      if (!/\.(js|css|png|svg|webp|ttf|txt)$/.test(entry.name)) continue;
      const target = posix.join(prefix, source);
      mkdirSync(join(output, posix.dirname(target)), { recursive: true });
      copyFileSync(join(root, source), join(output, target));
      files.push(`./${target}`);
    }
  };
  copyTree('src');
  if (existsSync(join(root, 'public'))) copyTree('public');

  const index = read('index.html').replaceAll('./src/', `./${prefix}/src/`).replaceAll('./public/', `./${prefix}/public/`);
  writeFileSync(join(output, 'index.html'), index);
  files.unshift('./index.html');
  // 公開された版と元のコミットを、外から確かめられるようにする
  writeFileSync(join(output, 'build-info.json'), JSON.stringify({ version, commit: process.env.GITHUB_SHA ?? null, files }, null, 2));
  writeFileSync(join(output, '.nojekyll'), '');
  return { version, output, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { version, files } = build();
  console.log(`dist/ に v${version} を作りました（${files.length} ファイル）`);
}
