// テスト用の、音を出さない Web Audio の代わり。呼ばれた操作だけを覚える
function param(value = 0) {
  return {
    value,
    setValueAtTime(v) { this.value = v; return this; },
    linearRampToValueAtTime(v) { this.value = v; return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
    cancelAndHoldAtTime() { return this; }
  };
}
function node(extra = {}) {
  return { connect() {}, disconnect() {}, ...extra };
}

export function fakeAudioContext() {
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: node(),
    resume() { return Promise.resolve(); },
    createOscillator() {
      return node({ type: 'sine', frequency: param(), started: null, stoppedAt: null, onended: null, wave: null,
        setPeriodicWave(w) { this.type = 'custom'; this.wave = w; },
        start(t) { this.started = t; }, stop(t) { this.stoppedAt = t; } });
    },
    createPeriodicWave(real, imag) { return { real, imag }; },
    createGain() { return node({ gain: param(1) }); },
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(), Q: param() }); },
    createDynamicsCompressor() { return node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }); }
  };
  return ctx;
}
