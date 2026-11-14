// 案内（チュートリアル）の記録。初めての1回だけ自動で出し、済み・スキップを端末の中に残す（AQUA の TutorialBook と同じ考え方）。
// 端末の中だけに保存し、サーバーへ送らない（C-04）。保存できない端末でも遊べるよう、読み書きの失敗は無視する
export const TUTORIAL_KEY = 'root-notes-tutorial-v1';

export class TutorialBook {
  constructor(storage) {
    this.storage = storage;
    this.data = { done: {}, skipped: {} };
    try {
      const saved = JSON.parse(storage?.getItem(TUTORIAL_KEY) || 'null');
      if (saved && typeof saved === 'object') this.data = { done: { ...(saved.done ?? {}) }, skipped: { ...(saved.skipped ?? {}) } };
    } catch { /* 読めないときは初めての扱い */ }
  }
  // その章で、案内を自動で出すか（済みでも、スキップしてもいない）
  shouldAuto(chapter) { return !this.data.done[chapter] && !this.data.skipped[chapter]; }
  complete(chapter) { this.data.done[chapter] = true; this.#save(); }
  skip(chapter) { this.data.skipped[chapter] = true; this.#save(); }
  #save() { try { this.storage?.setItem(TUTORIAL_KEY, JSON.stringify(this.data)); } catch { /* 保存できなくても続ける */ } }
}
