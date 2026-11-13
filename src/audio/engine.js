// 弦の音（docs/design/段階3_三角形ステージの画面.md 5章）。受け取るのは周波数と時刻だけ。
// - 音色：のこぎり波1本＋高音を少し削る（試作と同じ）。2本をずらす音色は自前のうなりが出るので使わない（Q-05 調査）
// - 準備：スマホは最初の操作まで音を出せないので、unlock() を最初のタップで呼ぶ。遅れの指定は前作と同じ30ミリ秒
// - 止め方：ごく短く小さくしてから止め、プツッという音を防ぐ（PRISM の ownedVoice の考え方）
export const LATENCY_SECONDS = 0.03;
const STOP_FADE = 0.015;

function defaultContext() {
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctx) return null;
  try { return new Ctx({ latencyHint: LATENCY_SECONDS }); } catch { return new Ctx(); }
}

export class StringAudio {
  constructor({ createContext = defaultContext } = {}) {
    this.createContext = createContext;
    this.ctx = null;
    this.input = null;
    this.plucks = new Set(); // 辺・棒の単音
    this.others = new Set(); // 和音・曲
    this.timers = [];
  }

  // 最初のタップで呼ぶ。準備できたら true
  unlock() {
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) return false;
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3000;
      const comp = ctx.createDynamicsCompressor();
      master.connect(lowpass); lowpass.connect(comp); comp.connect(ctx.destination);
      this.input = master;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.();
    return true;
  }

  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // 1音を鳴らし、止められる取っ手を返す。shape：'pluck'（はじいてすぐ減る）か 'tone'（保ってから離す）
  #voice(hz, start, { shape, duration, peak, family }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, start);
    gain.gain.setValueAtTime(0, start);
    let end;
    if (shape === 'pluck') {
      gain.gain.linearRampToValueAtTime(peak, start + 0.008);
      gain.gain.setTargetAtTime(0, start + 0.02, 0.35);
      end = start + duration;
    } else {
      gain.gain.linearRampToValueAtTime(peak, start + 0.015);
      gain.gain.setTargetAtTime(peak * 0.6, start + 0.03, 0.4);
      gain.gain.setTargetAtTime(0, start + duration, 0.08);
      end = start + duration + 0.8;
    }
    osc.connect(gain); gain.connect(this.input);
    osc.start(start);
    osc.stop(end);
    const handle = {
      hz, start, end, stopped: false,
      stop: (fade = STOP_FADE) => {
        if (handle.stopped) return;
        handle.stopped = true;
        const t = ctx.currentTime;
        if (typeof gain.gain.cancelAndHoldAtTime === 'function') gain.gain.cancelAndHoldAtTime(t);
        else { gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); }
        gain.gain.linearRampToValueAtTime(0, t + fade);
        try { osc.stop(t + fade + 0.01); } catch { /* もう止まっている */ }
        family.delete(handle);
      }
    };
    osc.onended = () => { family.delete(handle); try { osc.disconnect(); gain.disconnect(); } catch { /* 外れている */ } };
    family.add(handle);
    return handle;
  }

  // 辺・棒の単音。sustain が 'cut' なら前の単音を止めてから鳴らす（回答前。要件6.5）。お題の和音は止めない
  pluck(hz, sustain) {
    if (!this.ctx) return null;
    if (sustain === 'cut') for (const v of [...this.plucks]) v.stop();
    return this.#voice(hz, this.now + 0.01, { shape: 'pluck', duration: 1.8, peak: 0.12, family: this.plucks });
  }

  // 和音を低い順にジャランと鳴らす
  chord(hzs, { delay = 0.02, duration = 1.8, strum = 0.025, peak = 0.07 } = {}) {
    if (!this.ctx) return [];
    const start = this.now + delay;
    return [...hzs].sort((a, b) => a - b).map((hz, k) => this.#voice(hz, start + k * strum, { shape: 'tone', duration, peak, family: this.others }));
  }

  // 楽譜（src/game/song.js）を鳴らす。onBar(小節) は小節の頭で、onEnd は鳴り終わりで呼ぶ
  playScore(score, { onBar = () => {}, onEnd = () => {}, lead = 0.15 } = {}) {
    if (!this.ctx) { onEnd(); return; }
    const t0 = this.now + lead;
    for (const n of score.notes) this.#voice(n.hz, t0 + n.time, { shape: 'tone', duration: n.duration, peak: n.gain, family: this.others });
    const bars = [...new Set(score.notes.map(n => n.bar))].sort((a, b) => a - b);
    bars.forEach((bar, i) => this.timers.push(setTimeout(() => onBar(bar), (lead + i * (score.duration / bars.length)) * 1000)));
    this.timers.push(setTimeout(onEnd, (lead + score.duration + 0.4) * 1000));
  }

  stopAll() {
    for (const v of [...this.plucks, ...this.others]) v.stop(0.04);
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
