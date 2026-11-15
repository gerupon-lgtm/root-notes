// 第1章の時間の記録（2026-11-15 発案者）。遊び方（選択・フリー・ノーマル・エキスパート）×面（1-1〜1-5）ごとに、最速の1つだけ持つ。
// 端末の中だけに保存する。進み具合（progress.js）とは別の場所に置く（2つの保存が互いを古い中身で上書きしないように）。
// 読めない記録は使わず、上書きもしない（C-04。progress.js と同じ考え方）
export const RECORDS_KEY = 'root-notes-records-v1';
const FORMAT = 1;
const MODES = ['select', 'free', 'normal', 'expert'];

export class RecordBook {
  constructor(storage) {
    this.storage = storage;
    this.data = { format: FORMAT, ch1: {} };
    this.readable = true;
    try {
      const saved = JSON.parse(storage?.getItem(RECORDS_KEY) || 'null');
      if (saved && typeof saved === 'object' && saved.ch1 && typeof saved.ch1 === 'object') {
        for (const mode of MODES) {
          const m = saved.ch1[mode];
          if (!m || typeof m !== 'object') continue;
          for (const [id, ms] of Object.entries(m)) if (typeof id === 'string' && Number.isFinite(ms) && ms > 0) (this.data.ch1[mode] ??= {})[id] = ms;
        }
      }
    } catch { this.readable = false; }
  }
  // 最速（ミリ秒）。なければ null
  best(mode, id) { return this.data.ch1[mode]?.[id] ?? null; }
  // 計った時間を出す。速ければ記録を書きかえる。{ updated：記録が変わったか, best：今の最速 }
  submit(mode, id, ms) {
    if (!MODES.includes(mode)) throw new Error(`遊び方「${mode}」の記録はありません。`);
    if (!Number.isFinite(ms) || ms <= 0) throw new Error(`時間が正しくありません：${ms}`);
    const before = this.best(mode, id);
    if (before !== null && before <= ms) return { updated: false, best: before };
    (this.data.ch1[mode] ??= {})[id] = ms;
    if (this.readable) { try { this.storage?.setItem(RECORDS_KEY, JSON.stringify(this.data)); } catch { /* 保存できない端末 */ } }
    return { updated: true, best: ms };
  }
}

// 画面の表示：0.1秒単位（2026-11-15 発案者）
export const formatSeconds = ms => `${(Math.floor(ms / 100) / 10).toFixed(1)}秒`;
