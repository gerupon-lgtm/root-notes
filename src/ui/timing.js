// 画面の切り替えの待ち（2026-11-15 発案者。PRISM の値を参考に、ROOT NOTES 全体でそろえる）
// - LAUNCH_DELAY_MS：タイトルから最初の画面・物語を始めるまでの待ち（PRISM src/ui/app.js の LAUNCH_DELAY_MS と同じ）
// - resultDelayMs()：判定（合格・正解・不正解・門の判定）のあと、結果のトーストを出すまでの待ち。
//   既定 0.5秒（2026-11-15 発案者：0.3秒は速く感じる）。メニューの設定で 0〜5秒・0.1秒きざみに変えられ、端末に記録する（PRISM と同じ幅）
// - AFTER_TOAST_MS：トーストを閉じてから、次の動き（次の星・紙芝居・次の場面）へ移るまでの待ち（面を始めるまでの待ちと同じ意味）
export const LAUNCH_DELAY_MS = 250;
export const AFTER_TOAST_MS = 250;

export const RESULT_DELAY_DEFAULT_MS = 500;
export const RESULT_DELAY_MAX_MS = 5000;
const KEY = 'root-notes-result-delay-v1';

// 0〜5秒、0.1秒きざみにそろえる（読めない値は既定）
export function normalizeResultDelay(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return RESULT_DELAY_DEFAULT_MS;
  return Math.min(RESULT_DELAY_MAX_MS, Math.max(0, Math.round(n / 100) * 100));
}
function store() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function resultDelayMs() {
  try {
    const v = store()?.getItem(KEY);
    return v == null ? RESULT_DELAY_DEFAULT_MS : normalizeResultDelay(v);
  } catch { return RESULT_DELAY_DEFAULT_MS; }
}
export function setResultDelayMs(ms) {
  const v = normalizeResultDelay(ms);
  try { store()?.setItem(KEY, String(v)); } catch { /* 記録できない端末 */ }
  return v;
}
