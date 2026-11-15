// 1回のプレイの進み方（docs/design/段階3_三角形ステージの画面.md 4・5.2章）。画面・音に触れない。
// 棒の選択、回答、失敗の残り、メーターの残り、灯った星、発見、フレーズと1曲の合図、ゲームオーバーを受け持つ
import { MODES } from '../content/modes.js';
import { PROGRESSIONS, SELECT_PLAY, BARS, PHRASE } from '../content/progressions.js';
import { buildRun } from '../core/stage-gen.js';
import { closes } from '../core/length.js';
import { isCorrect, discoveries } from '../core/judge.js';
import { STAGE_TIMBRES } from '../content/timbres.js';

// そのステージの音色。種から始めて小節ごとに順に回すので、隣の星は違う音色になる
export const stageTimbre = (run, bar) => STAGE_TIMBRES[(run.seed + bar) % STAGE_TIMBRES.length];

export function modeOf(id) {
  const mode = MODES[id];
  if (!mode) throw new Error(`遊び方「${id}」はありません。`);
  return mode;
}

// 遊び方から、ステージを作る条件を決める。選択プレイは固定、連続プレイは乱数で進行とキーと種を選ぶ（要件6.5）
// progression：決まった曲の作り方を使うとき（第3章の光と影 'mirror'）。null なら第2章の進行から選ぶ
export function runSpecFor(modeId, random, progression = null) {
  const mode = modeOf(modeId);
  if (mode.fixedSong) return { ...SELECT_PLAY, ...(progression ? { progression } : {}), decoys: mode.decoys };
  return {
    progression: progression ?? PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)].id,
    key: Math.floor(random() * 12),
    seed: Math.floor(random() * 2 ** 31),
    decoys: mode.decoys
  };
}

export class Play {
  constructor(modeId, run) {
    this.mode = modeOf(modeId);
    this.run = run;
    this.index = 0;
    this.selected = []; // 選んだ棒の番号（選んだ順、最大3本）
    this.answered = false; // 今の3本で回答したか（棒を選び直すと戻る）
    this.livesLeft = this.mode.lives;
    this.meterLeft = this.mode.meterCount;
    this.meterShown = false; // ボタンで出したメーター（棒を選び直すと消える）
    this.meterToggle = true; // フリーの表示／非表示
    this.lit = new Set();
    this.found = new Set();
    this.lastFound = [];
    this.over = false; // ゲームオーバー
    this.complete = false; // 連続プレイで8つの星を灯し終えた
  }

  static start(modeId, random = Math.random, progression = null) {
    return new Play(modeId, buildRun(runSpecFor(modeId, random, progression)));
  }

  // 保存する形（段階7。src/game/progress.js）。曲は進行・キー・種・おとりの本数から作り直せるので、その4つだけを残す。
  // 上限のない数（Infinity）は null にする
  snapshot() {
    const { progression, key, seed, decoys } = this.run;
    const count = n => (Number.isFinite(n) ? n : null);
    return { spec: { progression: progression.id, key, seed, decoys }, lit: [...this.lit].sort((a, b) => a - b), livesLeft: count(this.livesLeft), meterLeft: count(this.meterLeft) };
  }

  // 保存した形から作り直す。連続プレイは、灯っていない最初の星から（順に通すため）。全部灯っていれば通し終えた扱い
  static restore(modeId, snap) {
    const p = new Play(modeId, buildRun(snap.spec));
    p.lit = new Set(snap.lit.filter(b => Number.isInteger(b) && b >= 0 && b < BARS));
    if (Number.isFinite(p.mode.lives) && Number.isInteger(snap.livesLeft)) p.livesLeft = Math.min(p.mode.lives, snap.livesLeft);
    if (Number.isFinite(p.mode.meterCount) && Number.isInteger(snap.meterLeft)) p.meterLeft = Math.min(p.mode.meterCount, snap.meterLeft);
    if (p.mode.continuous) {
      const next = Array.from({ length: BARS }, (_, b) => b).find(b => !p.lit.has(b));
      if (next === undefined) { p.index = BARS - 1; p.complete = true; } else p.index = next;
      if (Number.isFinite(p.livesLeft) && p.livesLeft <= 0) p.over = true;
    }
    return p;
  }

  get stage() { return this.run.stages[this.index]; }
  get selectedLengths() { return this.selected.map(i => this.stage.sticks[i]); }
  get ready() { return this.selected.length === 3; }
  get closed() { return this.ready && closes(this.selectedLengths); }
  get finished() { return this.over || this.complete; }

  // 連続プレイで、今の星を灯して「次の星へ」を待っている
  get awaitingNext() { return this.mode.continuous && !this.complete && this.lit.has(this.index); }

  // 選択プレイの次の星：今より後ろでまだ灯っていない星。後ろになければ前から。全部灯っていれば null
  nextBar() {
    for (let k = 1; k <= BARS; k++) {
      const bar = (this.index + k) % BARS;
      if (!this.lit.has(bar)) return bar;
    }
    return null;
  }

  // 単音の余韻：回答前（選択・ノーマル・エキスパート）は止める、回答後とフリーは重ねる（要件6.5、AC-14）
  get sustain() { return this.mode.chordBeforeAnswer || this.answered ? 'overlap' : 'cut'; }

  get meterVisible() { return this.mode.meter === 'toggle' ? this.meterToggle : this.meterShown; }

  // 1小節目から続いて灯った星の数（灯った和音で曲を聴き直すとき）
  get litFromStart() {
    let n = 0;
    while (n < BARS && this.lit.has(n)) n++;
    return n;
  }

  // 自分の三角形の和音を鳴らせるか。reason：'need-three'・'open'・'before-answer'
  canPlayChord() {
    if (!this.ready) return { ok: false, reason: 'need-three' };
    if (!this.closed) return { ok: false, reason: 'open' };
    if (!this.mode.chordBeforeAnswer && !this.answered) return { ok: false, reason: 'before-answer' };
    return { ok: true };
  }

  // 棒を使う（三角形に入れる）。3本そろっているときは入れない（後出し優先で勝手に入れ替えない。2026-11-14 発案者）
  use(i) {
    if (this.finished || this.awaitingNext) return false;
    this.#checkIndex(i);
    if (this.selected.includes(i) || this.selected.length === 3) return false;
    this.selected.push(i);
    this.#changed();
    return true;
  }

  // 棒を外す（三角形から出す）
  remove(i) {
    if (this.finished || this.awaitingNext) return false;
    this.#checkIndex(i);
    const at = this.selected.indexOf(i);
    if (at < 0) return false;
    this.selected.splice(at, 1);
    this.#changed();
    return true;
  }

  // 使っていれば外し、使っていなければ使う
  pick(i) { return this.selected.includes(i) ? this.remove(i) : this.use(i); }

  #checkIndex(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.stage.sticks.length) throw new Error(`棒の番号が正しくありません：${i}`);
  }

  // 棒が変わったら回答前に戻し、3本そろったら発見を調べる
  #changed() {
    this.answered = false;
    this.meterShown = false;
    this.lastFound = [];
    if (this.ready) {
      for (const d of discoveries(this.selectedLengths, this.stage.target)) {
        if (!this.found.has(d)) { this.found.add(d); this.lastFound.push(d); }
      }
    }
  }

  clearSelection() {
    this.selected = [];
    this.answered = false;
    this.meterShown = false;
    this.lastFound = [];
  }

  setMeterToggle(on) { this.meterToggle = !!on; }

  // メーターを使う（ボタンの遊び方）。reason：'toggle-mode'・'need-closed'・'shown'・'none-left'
  useMeter() {
    if (this.mode.meter === 'toggle') return { ok: false, reason: 'toggle-mode' };
    if (!this.closed) return { ok: false, reason: 'need-closed' };
    if (this.meterShown) return { ok: false, reason: 'shown' };
    if (this.meterLeft <= 0) return { ok: false, reason: 'none-left' };
    this.meterLeft--;
    this.meterShown = true;
    return { ok: true };
  }

  // 回答する。result：'finished'・'need-three'・'open'・'correct'・'wrong'
  answer() {
    if (this.finished) return { result: 'finished' };
    if (this.awaitingNext) return { result: 'awaiting-next' };
    if (!this.ready) return { result: 'need-three' };
    if (!this.closed) return { result: 'open' }; // 閉じていない回答は失敗に数えない（要件5章）
    this.answered = true;
    if (isCorrect(this.selectedLengths, this.stage.target)) {
      this.lit.add(this.index);
      const from = Math.floor(this.index / PHRASE) * PHRASE, to = from + PHRASE - 1;
      let music = null;
      if (this.lit.size === BARS) music = { kind: 'song', from: 0, to: BARS - 1 };
      else if (Array.from({ length: PHRASE }, (_, k) => from + k).every(b => this.lit.has(b))) music = { kind: 'phrase', from, to };
      return { result: 'correct', music };
    }
    if (Number.isFinite(this.livesLeft)) {
      this.livesLeft--;
      if (this.livesLeft <= 0) this.over = true;
    }
    return { result: 'wrong', livesLeft: this.livesLeft, gameOver: this.over };
  }

  // 連続プレイで、正解のあと次の星へ進む。最後の星なら終わり
  advance() {
    if (!this.mode.continuous) return;
    if (this.index < BARS - 1) {
      this.index++;
      this.clearSelection();
    } else this.complete = true;
  }

  // 選択プレイで、好きな星を選ぶ
  goTo(bar) {
    if (this.mode.continuous) throw new Error('星を選べるのは選択プレイだけです。');
    if (!Number.isInteger(bar) || bar < 0 || bar >= BARS) throw new Error(`星の番号が正しくありません：${bar}`);
    this.index = bar;
    this.clearSelection();
  }

  // 確認用：答えの棒を選ぶ（URL に ?check を付けたときだけ画面に出す）
  revealTarget() {
    this.clearSelection();
    const { sticks, target } = this.stage;
    for (const t of target) this.pick(sticks.findIndex(s => s.n === t.n && s.r2 === t.r2));
  }
}
