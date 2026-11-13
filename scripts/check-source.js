// 構文の確認：src・scripts・tests のすべての .js を node --check にかける。
// 前作 AQUA の scripts/check-source.js を移した。
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
for (const dir of ['src', 'scripts', 'tests']) if (existsSync(join(root, dir))) walk(join(root, dir));
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { failed++; console.error(`${relative(root, f)}\n${e.stderr}`); }
}
console.log(`${files.length} ファイル中 ${files.length - failed} ファイルが構文の確認に合格`);
process.exit(failed ? 1 : 0);
