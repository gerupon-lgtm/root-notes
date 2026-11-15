// 画面の切り替えの待ち（2026-11-15 発案者。PRISM の値を参考に、ROOT NOTES 全体でそろえる）
// - LAUNCH_DELAY_MS：タイトルから最初の画面・物語を始めるまでの待ち（PRISM src/ui/app.js の LAUNCH_DELAY_MS と同じ）
// - RESULT_DELAY_MS：判定（合格・正解・不正解・門の判定）のあと、結果のトーストを出すまでの待ち（発案者「0.3秒ぐらい」）
// - AFTER_TOAST_MS：トーストを閉じてから、次の動き（次の星・紙芝居・次の場面）へ移るまでの待ち（面を始めるまでの待ちと同じ意味）
export const LAUNCH_DELAY_MS = 250;
export const RESULT_DELAY_MS = 300;
export const AFTER_TOAST_MS = 250;
