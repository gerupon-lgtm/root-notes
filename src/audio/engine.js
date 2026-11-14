// 弦の音（docs/design/段階3_三角形ステージの画面.md 5章）。受け取るのは周波数・時刻・音色の値だけ。
// - 音色：2オペレーターFM（src/content/timbres.js の値を受け取る）。変調の倍率は整数で、倍音が整数倍に並ぶ。
//   音色を渡さないときは、のこぎり波1本（試作の音）
// - 準備：スマホは最初の操作まで音を出せないので、unlock() を最初のタップで呼ぶ。遅れの指定は前作と同じ30ミリ秒
// - 止め方：ごく短く小さくしてから止め、プツッという音を防ぐ（PRISM の ownedVoice の考え方）
export const LATENCY_SECONDS = 0.03;
// 音を止めるときのフェードアウトの長さ（秒）。短すぎるとブツっと鳴る（0.015秒で鳴っていた。2026-11-14 発案者）
const STOP_FADE = 0.05;
// 出口の安全装置（コンプレッサー）の設定：-3dB を超えたときだけ強く押さえる
export const LIMITER = Object.freeze({ threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.1 });
const SAW = Object.freeze({ carrier: 'saw', attack: 0.015, decay: 0.4, sustain: 0.6, release: 0.08, gain: 0.1 });

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
      lowpass.frequency.value = 9000;
      // 割れそうなときだけ働く安全装置。初期設定（-24dB・12:1）のままだと和音でいつも強くかかり、
      // 波の形が崩れて歪んでいた（曲で約6%。2026-11-14 発案者「音量を下げても歪む」）。ふだんは素通り
      const comp = ctx.createDynamicsCompressor();
      for (const [k, v] of Object.entries(LIMITER)) comp[k].value = v;
      master.connect(lowpass); lowpass.connect(comp); comp.connect(ctx.destination);
      this.input = master;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.();
    return true;
  }

  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // オルガンの波形（倍音1〜8を足したもの）。一度作ったら使い回す
  #organWave(ranks) {
    this.waves ??= new Map();
    const key = ranks.join(',');
    if (!this.waves.has(key)) {
      const real = new Float32Array(ranks.length + 1), imag = new Float32Array(ranks.length + 1);
      ranks.forEach((g, i) => { imag[i + 1] = g; });
      this.waves.set(key, this.ctx.createPeriodicWave(real, imag));
    }
    return this.waves.get(key);
  }

  // 1音を鳴らし、止められる取っ手を返す。duration 秒保ってから、音色の release で消える。
  // level は音色の基本の音量（gain）に掛ける割合
  #voice(hz, start, { timbre = SAW, duration, level, family }) {
    const ctx = this.ctx, t = timbre;
    const peak = (t.gain ?? 0.12) * level;
    const carrier = ctx.createOscillator(), amp = ctx.createGain();
    const oscillators = [carrier], nodes = [carrier, amp];
    if (t.carrier === 'organ') carrier.setPeriodicWave(this.#organWave(t.ranks));
    else carrier.type = t.carrier === 'saw' || t.wave === 'sawtooth' ? 'sawtooth' : 'sine';
    carrier.frequency.setValueAtTime(hz, start);
    if (t.ratio) {
      // FM：変調の深さ（周波数の揺れ幅）＝ 変調波の高さ × index。modDecay の時定数で indexSustain の割合まで減る（twist と同じ式）
      const mod = ctx.createOscillator(), depth = ctx.createGain();
      const modHz = hz * t.ratio;
      mod.type = 'sine';
      mod.frequency.setValueAtTime(modHz, start);
      depth.gain.setValueAtTime(modHz * t.index, start);
      depth.gain.setTargetAtTime(modHz * t.index * t.indexSustain, start, t.modDecay);
      mod.connect(depth); depth.connect(carrier.frequency);
      oscillators.push(mod); nodes.push(mod, depth);
    }
    let out = carrier;
    if (t.cutoff) {
      // 高音を削る（koekit の strings と同じ：最初は cutoff 倍、cutoffDecay の時定数で cutoffFloor 倍へ）
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.55;
      filter.frequency.setValueAtTime(hz * t.cutoff, start);
      filter.frequency.setTargetAtTime(hz * t.cutoffFloor, start + t.attack, t.cutoffDecay);
      carrier.connect(filter);
      out = filter;
      nodes.push(filter);
    }
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(peak, start + t.attack);
    amp.gain.setTargetAtTime(peak * t.sustain, start + t.attack, t.decay);
    amp.gain.setTargetAtTime(0, start + duration, t.release);
    const end = start + duration + Math.max(0.05, t.release * 8);
    out.connect(amp); amp.connect(this.input);
    for (const o of oscillators) { o.start(start); o.stop(end); }
    const handle = {
      hz, start, end, stopped: false,
      stop: (fade = STOP_FADE) => {
        if (handle.stopped) return;
        handle.stopped = true;
        const now = ctx.currentTime;
        // 今の音量から fade 秒かけて0へ。cancelAndHoldAtTime の後に直線で下げると、Chrome では
        // その場で0に落ちてブツっと鳴っていた（書き出して確かめた。v0.8.9〜0.8.11）。予定を消して今の値から下げる
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value, now);
        amp.gain.linearRampToValueAtTime(0, now + fade);
        for (const o of oscillators) { try { o.stop(now + fade + 0.01); } catch { /* もう止まっている */ } }
        family.delete(handle);
      }
    };
    carrier.onended = () => { family.delete(handle); for (const n of nodes) { try { n.disconnect(); } catch { /* 外れている */ } } };
    family.add(handle);
    return handle;
  }

  // 辺・棒の単音。sustain が 'cut' なら前の単音を止めてから鳴らす（回答前。要件6.5）。お題の和音は止めない
  pluck(hz, sustain, timbre) {
    if (!this.ctx) return null;
    if (sustain === 'cut') for (const v of [...this.plucks]) v.stop();
    return this.#voice(hz, this.now + 0.01, { timbre, duration: 1.1, level: 1, family: this.plucks });
  }

  // 和音を低い順にジャランと鳴らす
  chord(hzs, { timbre, delay = 0.02, duration = 1.8, strum = 0.025, level = 0.75 } = {}) {
    if (!this.ctx) return [];
    const start = this.now + delay;
    return [...hzs].sort((a, b) => a - b).map((hz, k) => this.#voice(hz, start + k * strum, { timbre, duration, level, family: this.others }));
  }

  // 楽譜（src/game/song.js）を鳴らす。和音とベースは別の音色。onBar(小節) は小節の頭で、onEnd は鳴り終わりで呼ぶ
  playScore(score, { chordTimbre, bassTimbre, onBar = () => {}, onEnd = () => {}, lead = 0.15 } = {}) {
    if (!this.ctx) { onEnd(); return; }
    const t0 = this.now + lead;
    for (const n of score.notes) {
      const timbre = n.part === 'bass' ? bassTimbre : chordTimbre;
      this.#voice(n.hz, t0 + n.time, { timbre, duration: n.duration, level: n.gain / 0.08, family: this.others });
    }
    const bars = [...new Set(score.notes.map(n => n.bar))].sort((a, b) => a - b);
    bars.forEach((bar, i) => this.timers.push(setTimeout(() => onBar(bar), (lead + i * (score.duration / bars.length)) * 1000)));
    this.timers.push(setTimeout(onEnd, (lead + score.duration + 0.4) * 1000));
  }

  stopAll() {
    for (const v of [...this.plucks, ...this.others]) v.stop();
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
