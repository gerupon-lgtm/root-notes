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
// ガット弦の値（試聴ページの「F＋・硬め・減り始め 0.5秒・低音をもっと抑える」と同じ。2026-11-15 発案者。A区分）。
// hit・body：変調の深さ（はじいた瞬間・鳴っている間。高さの何倍か）、harm・harmBody・harmTail：倍率3の変調の深さ、
// punch：はじいた瞬間の音量の山、hold：減り始めまで、life：約 -40dB になるまで、tail：音を止めるまで（秒）、
// bodyGain：胴の響き（220Hz）の持ち上げ（dB）、shelf・shelfAt：低い側を下げる量（dB）と境目（Hz）。
// 低音を抑えたのはスマホのスピーカーで低めの音が2つ重なると歪んで聞こえたため（2026-11-15 発案者。イヤホンでは歪まない）
export const GUT = Object.freeze({
  hit: 4.5, hitTau: 0.03, body: 0.95, harm: 0.8, harmBody: 0.22, harmTail: 0.06, hiCut: 12.6, punch: 1.7,
  // level・sustainLevel：試聴ページ（0.24・0.16）の 0.7倍。2本同時にはじくと 0.84 になり、出口の安全装置（0.71 から押さえる）に届いて歪むため。
  // 0.7倍で、2本同時 0.59・重ねて鳴らす＋はじく 0.48 前後（書き出して確認。2026-11-15）
  hold: 0.5, life: 1.1, tail: 1.6, level: 0.17, sustainLevel: 0.11, bodyGain: 0, shelf: -6, shelfAt: 300,
  noise: 0.2, noiseBand: 3200, noiseQ: 0.9, noiseLen: 0.012
});
// おはなしの鐘の値（試聴ページの「K1＋キラッ（弱）」と同じ。2026-11-15 発案者。A区分）。
// index → tailIndex：変調の深さ（打った瞬間 → 余韻）。sparkle：キラッの倍音 [何倍, 強さ, 消える時定数]、sparkleAmount：キラッの強さ
export const BELL = Object.freeze({
  index: 1.4, tailIndex: 0.12,
  sparkle: Object.freeze([[4, 0.07, 0.05], [6, 0.05, 0.035], [9, 0.035, 0.022]].map(x => Object.freeze(x))),
  sparkleAmount: 0.6
});
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
      master.gain.value = this.muted ? 0 : 0.9;
      this.master = master;
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
  // 消音（全画面共通。2026-11-15 発案者）。出口の手前で音量を0にする。鳴っている音も予約した音も、消音中は聞こえない
  setMuted(muted) {
    this.muted = !!muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.01);
    if (this.muted) this.stopAll();
  }
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
    let mod = null, depth = null, filter = null;
    if (t.ratio) {
      // FM：変調の深さ（周波数の揺れ幅）＝ 変調波の高さ × index。modDecay の時定数で indexSustain の割合まで減る（twist と同じ式）
      mod = ctx.createOscillator(); depth = ctx.createGain();
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
      filter = ctx.createBiquadFilter();
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
      // 鳴らしながら高さを変える（第1章の駒・微調整。15ミリ秒ほどでなめらかに移る）
      setHz: next => {
        if (handle.stopped) return;
        const now = ctx.currentTime;
        carrier.frequency.setTargetAtTime(next, now, 0.015);
        if (mod) {
          mod.frequency.setTargetAtTime(next * t.ratio, now, 0.015);
          depth.gain.setTargetAtTime(next * t.ratio * t.index * t.indexSustain, now, 0.015);
        }
        if (filter) filter.frequency.setTargetAtTime(next * t.cutoffFloor, now, 0.015);
        handle.hz = next;
      },
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

  // 鳴らし続ける音（第1章の「重ねて鳴らす」）。止めるまで鳴る。handle.setHz で高さを変え、handle.stop で止める
  hold(hz, timbre, { level = 0.6 } = {}) {
    if (!this.ctx) return null;
    return this.#voice(hz, this.now + 0.02, { timbre, duration: 3600, level, family: this.others });
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

  // 弦の音：ガット弦（2026-11-15 発案者が試聴で決定：「F＋・硬め・減り始め 0.5秒」。試聴ページ public/audition/guitar.html）。
  // FM で作る：変調の倍率1（温かい芯）＋倍率3（倍音を加える）。はじいた瞬間だけ変調を深くし（硬めのアタック）、
  // 音量も一瞬だけ 1.7倍の山を作り、高めの短い雑音（ピック）を重ねる。0.5秒ほぼそのまま鳴ってから自然に減り、1.1秒ぐらいで約 -40dB。
  // 高すぎる音を少し削り、胴の響き（220Hz あたり）を足す。sustain：重ねて鳴らす用に、消えずに鳴り続ける（止めるまで）
  #gut(hz, start, { sustain = false, level = 1, family }) {
    const ctx = this.ctx, G = GUT;
    const car = ctx.createOscillator(), m1 = ctx.createOscillator(), d1 = ctx.createGain(), m3 = ctx.createOscillator(), d3 = ctx.createGain();
    const lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), punch = ctx.createGain(), amp = ctx.createGain();
    car.type = m1.type = m3.type = 'sine';
    car.frequency.setValueAtTime(hz, start); m1.frequency.setValueAtTime(hz, start); m3.frequency.setValueAtTime(hz * 3, start);
    d1.gain.setValueAtTime(hz * G.hit, start);
    d1.gain.setTargetAtTime(hz * G.body, start, G.hitTau);
    d3.gain.setValueAtTime(hz * 3 * G.harm, start);
    d3.gain.setTargetAtTime(hz * 3 * G.harmBody, start, 0.08);
    if (!sustain) {
      d1.gain.setTargetAtTime(hz * G.body * 0.5, start + G.hold, 0.25);
      d3.gain.setTargetAtTime(hz * 3 * G.harmTail, start + G.hold, 0.2);
    }
    m1.connect(d1); d1.connect(car.frequency); m3.connect(d3); d3.connect(car.frequency);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, hz * G.hiCut), start); lp.Q.value = 0.5;
    body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 0.9; body.gain.value = G.bodyGain;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = G.shelfAt; shelf.gain.value = G.shelf;
    punch.gain.setValueAtTime(G.punch, start);
    punch.gain.setTargetAtTime(1, start + 0.004, 0.025);
    const peak = (sustain ? G.sustainLevel : G.level) * level;
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(peak, start + 0.004);
    let end;
    if (sustain) {
      amp.gain.setTargetAtTime(peak * 0.6, start + 0.004, 0.3);
      end = start + 3600;
    } else {
      const tau = (G.life - G.hold) / 4.6; // 減り始めから G.life 秒（1.1秒）ぐらいで約 -40dB
      amp.gain.linearRampToValueAtTime(peak * 0.9, start + G.hold);
      amp.gain.setTargetAtTime(0, start + G.hold, tau);
      end = start + G.tail;
    }
    car.connect(lp); lp.connect(body); body.connect(shelf); shelf.connect(punch); punch.connect(amp); amp.connect(this.input);
    const oscs = [car, m1, m3];
    for (const o of oscs) { o.start(start); o.stop(end); }
    // ピック：短い雑音を帯域で絞って重ねる（雑音の波形は1回だけ作って使い回す）
    if (!this.pickNoise || this.pickNoise.sampleRate !== ctx.sampleRate) {
      const n = Math.floor(ctx.sampleRate * G.noiseLen), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.25));
      this.pickNoise = buf;
    }
    const noise = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    noise.buffer = this.pickNoise; bp.type = 'bandpass'; bp.frequency.value = G.noiseBand; bp.Q.value = G.noiseQ; ng.gain.value = G.noise * level;
    noise.connect(bp); bp.connect(ng); ng.connect(this.input); noise.start(start);
    const nodes = [car, m1, d1, m3, d3, lp, body, shelf, punch, amp, noise, bp, ng];
    const handle = {
      hz, start, end, stopped: false,
      setHz: next => {
        if (handle.stopped) return;
        const now = ctx.currentTime;
        car.frequency.setTargetAtTime(next, now, 0.015);
        m1.frequency.setTargetAtTime(next, now, 0.015);
        m3.frequency.setTargetAtTime(next * 3, now, 0.015);
        d1.gain.setTargetAtTime(next * G.body, now, 0.015);
        d3.gain.setTargetAtTime(next * 3 * G.harmBody, now, 0.015);
        lp.frequency.setTargetAtTime(Math.min(9000, next * G.hiCut), now, 0.015);
        handle.hz = next;
      },
      stop: (fade = STOP_FADE) => {
        if (handle.stopped) return;
        handle.stopped = true;
        const now = ctx.currentTime;
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value, now);
        amp.gain.linearRampToValueAtTime(0, now + fade);
        for (const o of oscs) { try { o.stop(now + fade + 0.01); } catch { /* もう止まっている */ } }
        family.delete(handle);
      }
    };
    car.onended = () => { family.delete(handle); for (const n of nodes) { try { n.disconnect(); } catch { /* 外れている */ } } };
    family.add(handle);
    return handle;
  }
  // 弦をはじく（第1章・章末の謎・序章の琴）。sustain が 'cut' なら前の単音を止めてから鳴らす。at は今から何秒後か
  pluckGut(hz, { sustain = 'overlap', at = 0, level = 1 } = {}) {
    if (!this.ctx) return null;
    if (sustain === 'cut') for (const v of [...this.plucks]) v.stop();
    return this.#gut(hz, this.now + 0.01 + at, { level, family: this.plucks });
  }
  // 弦を鳴らし続ける（第1章の「重ねて鳴らす」・謎の「重ねて聞く」）。止めるまで鳴る。handle.setHz で高さを変える
  holdGut(hz, { level = 1 } = {}) {
    if (!this.ctx) return null;
    return this.#gut(hz, this.now + 0.02, { sustain: true, level, family: this.others });
  }

  // おはなしの鐘（2026-11-15 発案者が試聴で決定：「K1＋キラッ（弱）」。試聴ページ public/audition/bell.html）。
  // 前は PRISM と同じ √2 の FM で、音の9割が整数倍に並ばない倍音だったため、重ねると濁った。
  // 今は変調の倍率1（倍音が整数倍に並ぶ）、変調の深さ 1.4 → 0.12（時定数 0.42 秒）。鳴り方は PRISM の鐘と同じ：
  // 3ミリ秒で立ち上がり、0.6 秒までは時定数 0.325、そのあとは 0.18 で余韻が消える（全体 2.6 秒）。
  // 打った瞬間：高さ2倍の短い「カン」と、キラッ（4・6・9倍の倍音を 0.02〜0.05 秒、6000Hz より上の短い雑音。強さ 0.6）。at は今から何秒後か
  bell(hz, { at = 0, level = 1 } = {}) {
    if (!this.ctx) return null;
    const ctx = this.ctx, start = this.now + 0.02 + at, peak = 0.2 * level;
    const carrier = ctx.createOscillator(), mod = ctx.createOscillator(), depth = ctx.createGain(), amp = ctx.createGain();
    carrier.type = mod.type = 'sine';
    carrier.frequency.setValueAtTime(hz, start);
    mod.frequency.setValueAtTime(hz, start);
    depth.gain.setValueAtTime(hz * BELL.index, start);
    depth.gain.setTargetAtTime(hz * BELL.tailIndex, start, 0.42);
    const bodyEnd = 0.6, body = peak * Math.exp(-(bodyEnd - 0.003) / 0.325);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(peak, start + 0.003);
    amp.gain.setTargetAtTime(0, start + 0.003, 0.325);
    amp.gain.setValueAtTime(body, start + bodyEnd);
    amp.gain.setTargetAtTime(0, start + bodyEnd, 0.18);
    amp.gain.setValueAtTime(body * Math.exp(-(2.54 - bodyEnd) / 0.18), start + 2.54);
    amp.gain.linearRampToValueAtTime(0, start + 2.6);
    mod.connect(depth); depth.connect(carrier.frequency); carrier.connect(amp); amp.connect(this.input);
    const end = start + 2.62;
    const oscs = [carrier, mod], nodes = [carrier, mod, depth, amp];
    // 打った瞬間の音（カン・キラッ）は、まとめて attack を通す（止めるときに一緒に消す）
    const attack = ctx.createGain();
    attack.connect(this.input); nodes.push(attack);
    const partial = (f, a, tau) => {
      if (f > 12000) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(a * level, start + 0.003); g.gain.setTargetAtTime(0, start + 0.003, tau);
      o.connect(g); g.connect(attack); o.start(start); o.stop(start + 0.4);
      oscs.push(o); nodes.push(o, g);
    };
    partial(hz * 2, 0.06, 0.02); // カン
    for (const [n, a, tau] of BELL.sparkle) partial(hz * n, a * BELL.sparkleAmount, tau); // キラッ
    if (!this.sparkleNoise || this.sparkleNoise.sampleRate !== ctx.sampleRate) {
      const n = Math.floor(ctx.sampleRate * 0.012), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.2));
      this.sparkleNoise = buf;
    }
    const noise = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    noise.buffer = this.sparkleNoise; hp.type = 'highpass'; hp.frequency.value = 6000; ng.gain.value = 0.05 * BELL.sparkleAmount * level;
    noise.connect(hp); hp.connect(ng); ng.connect(attack); noise.start(start);
    nodes.push(noise, hp, ng);
    for (const o of [carrier, mod]) { o.start(start); o.stop(end); }
    const handle = {
      hz, start, end, stopped: false,
      stop: (fade = STOP_FADE) => {
        if (handle.stopped) return;
        handle.stopped = true;
        const now = ctx.currentTime;
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value, now);
        amp.gain.linearRampToValueAtTime(0, now + fade);
        attack.gain.cancelScheduledValues(now);
        attack.gain.setValueAtTime(attack.gain.value, now);
        attack.gain.linearRampToValueAtTime(0, now + fade);
        for (const o of oscs) { try { o.stop(now + fade + 0.01); } catch { /* もう止まっている */ } }
        this.others.delete(handle);
      }
    };
    carrier.onended = () => { this.others.delete(handle); for (const n of nodes) { try { n.disconnect(); } catch { /* 外れている */ } } };
    this.others.add(handle);
    return handle;
  }

  // 第3章の鏡写しの説明「光の響き」：4・5・6 回のような刻みのパルスを、同じ割合で速めていき、最後に和音にする
  // （Codex 試作 v0.5.0 の accelerate と同じ。後半は聞き取りを助ける同じ周期の正弦波を重ねる）。ticks：刻みの数、factor：最後の倍率
  // hold：和音になってから、そのまま鳴らす長さ。release：そのあと消えるまでの長さ
  // （2026-11-17 発案者「パルスが上がったあとの和音の長さを伸ばして」。前は 0.65秒鳴らして 0.25秒で消していた）
  mirrorPulses(ticks, factor, { duration = 4, hold = 3.5, release = 1.5 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.06, top = t + duration + hold, end = top + release + 0.02;
    for (const n of ticks) {
      const length = Math.round(c.sampleRate / n), buf = c.createBuffer(1, length, c.sampleRate), d = buf.getChannelData(0), pulse = Math.round(c.sampleRate * 0.012);
      const mean = (pulse * 0.375) / length;
      for (let i = 0; i < length; i++) d[i] = (i < pulse ? Math.sin((Math.PI * i) / (pulse - 1)) ** 4 : 0) - mean;
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.loop = true;
      src.playbackRate.setValueAtTime(1, t); src.playbackRate.exponentialRampToValueAtTime(factor, t + duration);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.04); g.gain.setValueAtTime(0.11, top); g.gain.linearRampToValueAtTime(0, top + release);
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(n, t); o.frequency.exponentialRampToValueAtTime(n * factor, t + duration);
      og.gain.setValueAtTime(0, t); og.gain.setValueAtTime(0, t + duration * 0.6); og.gain.linearRampToValueAtTime(0.045, t + duration); og.gain.setValueAtTime(0.045, top); og.gain.linearRampToValueAtTime(0, top + release);
      src.connect(g); g.connect(this.input); o.connect(og); og.connect(this.input);
      src.start(t); src.stop(end); o.start(t); o.stop(end);
      const handle = { stopped: false, stop: () => { if (handle.stopped) return; handle.stopped = true; const now = c.currentTime; for (const x of [g, og]) { x.gain.cancelScheduledValues(now); x.gain.setValueAtTime(x.gain.value, now); x.gain.linearRampToValueAtTime(0, now + 0.03); } try { src.stop(now + 0.05); o.stop(now + 0.05); } catch { /* 止まっている */ } this.others.delete(handle); } };
      o.onended = () => { this.others.delete(handle); for (const x of [src, g, o, og]) { try { x.disconnect(); } catch { /* 外れている */ } } };
      this.others.add(handle);
    }
  }

  stopAll() {
    for (const v of [...this.plucks, ...this.others]) v.stop();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.#endFade();
  }

  // 鳴っている音を、ブツっと切らずに seconds 秒で消してから止める（2026-11-17 発案者「次へでブツっと切らずに消音して次へ」）。
  // 出口の音量をゆっくり0にし、消えきったら全部止めて音量を戻す。待つミリ秒を返す（この間に次の音を鳴らさない）
  fadeOutAll(seconds = 0.5) {
    if (!this.ctx || !this.master || (!this.plucks.size && !this.others.size && !this.timers.length)) { this.stopAll(); return 0; }
    this.#endFade();
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + seconds);
    this.fading = setTimeout(() => { this.fading = 0; this.stopAll(); }, seconds * 1000 + 20);
    return seconds * 1000 + 40;
  }
  #endFade() {
    if (this.fading) { clearTimeout(this.fading); this.fading = 0; }
    if (!this.master) return;
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.muted ? 0 : 0.9, now);
  }
}
