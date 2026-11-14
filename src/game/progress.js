// 進み具合の記録（段階7。要件 C-04・AC-07・F-009。docs/design/段階7_PWA.md）。
// 端末の中だけに保存し、サーバーへ送らない。無断で消さない（消すのは、ゲームオーバー・通し終えたとき・発案者の決めた「最初から」を選んだときの、連続プレイの続きだけ）。
// 保存できない端末でも遊べるよう、読み書きの失敗は無視する。読めない・形の合わない記録は使わないが、上書きもしない
//
// 保存する物（2026-11-14 発案者）
// - found：発見の巻物。遊び方にかかわらずためる
// - select：選択プレイで灯した星（ch1：第1章の面の id、ch2：第2章の星の番号）。残す
// - continuous：連続プレイの続き（遊び方・今の章・第1章の灯った面・第2章の遊びの状態）。「連続プレイ」で続きから／最初からを選ぶ
export const PROGRESS_KEY = 'root-notes-progress-v1';
const FORMAT = 1;
const CONTINUOUS_MODES = ['free', 'normal', 'expert'];

const strings = xs => (Array.isArray(xs) ? xs.filter(x => typeof x === 'string') : []);
const bars = xs => (Array.isArray(xs) ? xs.filter(x => Number.isInteger(x) && x >= 0 && x < 8) : []);

// 連続プレイの続きの形を確かめる（合わなければ null）
export function validContinuous(c) {
  if (!c || typeof c !== 'object') return null;
  if (!CONTINUOUS_MODES.includes(c.mode) || typeof c.step !== 'string') return null;
  let ch2 = null;
  if (c.ch2 != null) {
    const s = c.ch2.spec;
    if (!s || typeof s.progression !== 'string' || !Number.isInteger(s.key) || !Number.isInteger(s.seed) || !Number.isInteger(s.decoys)) return null;
    const count = v => (v === null || (Number.isInteger(v) && v >= 0) ? v : undefined);
    if (count(c.ch2.livesLeft) === undefined || count(c.ch2.meterLeft) === undefined) return null;
    ch2 = { spec: { progression: s.progression, key: s.key, seed: s.seed, decoys: s.decoys }, lit: bars(c.ch2.lit), livesLeft: c.ch2.livesLeft, meterLeft: c.ch2.meterLeft };
  }
  return { mode: c.mode, step: c.step, ch1: strings(c.ch1), ch2 };
}

export class ProgressBook {
  constructor(storage) {
    this.storage = storage;
    this.data = { format: FORMAT, found: [], select: { ch1: [], ch2: [] }, continuous: null };
    this.readable = true;
    try {
      const saved = JSON.parse(storage?.getItem(PROGRESS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        this.data = {
          format: FORMAT,
          found: strings(saved.found),
          select: { ch1: strings(saved.select?.ch1), ch2: bars(saved.select?.ch2) },
          continuous: validContinuous(saved.continuous)
        };
      }
    } catch { this.readable = false; /* 読めないときは記録なしの扱い。元の記録は上書きしない */ }
  }
  #save() {
    if (!this.readable) return false; // 読めなかった記録を、空の記録で上書きしない（C-04）
    try { this.storage?.setItem(PROGRESS_KEY, JSON.stringify(this.data)); return true; } catch { return false; }
  }

  // 発見の巻物：見つけた発見を足す（減らさない）
  found() { return new Set(this.data.found); }
  addFound(ids) {
    const before = this.data.found.length;
    const all = new Set([...this.data.found, ...ids]);
    if (all.size === before) return false;
    this.data.found = [...all];
    return this.#save();
  }

  // 選択プレイの灯った星：足すだけ（減らさない）
  selectLit(chapter) { return [...(this.data.select[chapter] ?? [])]; }
  addSelectLit(chapter, ids) {
    if (!(chapter in this.data.select)) throw new Error(`章「${chapter}」の記録はありません。`);
    const before = this.data.select[chapter].length;
    const all = [...new Set([...this.data.select[chapter], ...ids])];
    if (all.length === before) return false;
    this.data.select[chapter] = all;
    return this.#save();
  }

  // 連続プレイの続き
  continuous() { return this.data.continuous ? structuredClone(this.data.continuous) : null; }
  saveContinuous(c) {
    const ok = validContinuous(c);
    if (!ok) throw new Error('連続プレイの続きの形が正しくありません。');
    this.data.continuous = ok;
    return this.#save();
  }
  clearContinuous() {
    if (!this.data.continuous) return false;
    this.data.continuous = null;
    return this.#save();
  }
}
