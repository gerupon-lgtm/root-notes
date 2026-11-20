import { endingStars, opening, songSlides, credits, endingArt, endingMusic } from '../content/ending.js';

export function createEndingScreen({ audio, onTitle }) {
  const root = document.getElementById('ending-screen');
  let active = false;
  const byId = id => root.querySelector('[data-ending="' + id + '"]');
  const music = byId('music');
  const picture = byId('picture');
  const seek = byId('seek');
  const next = byId('advance');
  const transport = byId('transport');
  const status = byId('status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const expectedDuration = 199.5;
  let mode = 'opening';
  let songPosition = 0;
  let frame = 0;
  let audioRequest = 0;
  let current = '';
  let effects = {};
  let cannotPlay = false;
  let screenLock = null;
  let screenLockPending = false;

  function clock(seconds) {
    const n = Math.max(0, Math.floor(seconds));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  }
  function duration() {
    return Number.isFinite(music.duration) ? music.duration : expectedDuration;
  }
  function atSongTime(seconds) {
    let found = songSlides[0];
    for (const slide of songSlides) {
      if (slide.at > seconds) break;
      found = slide;
    }
    return found;
  }
  function selectedSlide() {
    if (mode === 'opening') return opening;
    if (mode === 'after') return credits;
    return atSongTime(songPosition);
  }
  function img(file, cls) {
    const el = document.createElement('img');
    el.alt = '';
    el.src = endingArt(file);
    el.className = cls;
    el.decoding = 'async';
    return el;
  }
  function styledLayer(art, cls) {
    const el = img(art.file, cls);
    el.style.left = art.x + '%';
    el.style.top = art.y + '%';
    el.style.width = art.width + '%';
    return el;
  }
  function draw(slide) {
    const art = document.createElement('div');
    art.className = 'frame';
    art.setAttribute('aria-hidden', 'true');
    const sky = slide.sky || slide.credit;
    art.append(img(sky ? 'stars-night-empty.webp' : slide.bg, 'fill'));
    effects = { bells:[], stars:[], light:null };
    if (sky) {
      for (const [x,y] of endingStars) {
        const star = document.createElement('i');
        star.className = 'sky-star';
        star.style.left = x + '%';
        star.style.top = y + '%';
        art.append(star);
        effects.stars.push(star);
      }
    }
    if (slide.sky) art.append(img('temple-sky-sanctuary-no-sky.webp', 'fill'));
    if (slide.id === 'theme' || slide.pictureKey === 'reunion') {
      effects.light = document.createElement('div');
      effects.light.className = 'altar-light';
      art.append(effects.light);
    }
    for (const item of slide.art ?? []) {
      art.append(styledLayer(item, 'layer'));
      if (item.strikes) {
        const glow = styledLayer(item, 'strike');
        art.append(glow);
        effects.bells.push({ strikes:item.strikes, glow });
      }
    }
    art.append(Object.assign(document.createElement('div'), {className:'vignette'}));
    if (slide.credit) {
      const lettering = document.createElement('div');
      lettering.className = 'credit-name';
      const name = document.createElement('strong');
      name.textContent = 'SIKUMI LAB';
      const series = document.createElement('small');
      series.textContent = 'ROOT NOTES';
      lettering.append(name,series);
      art.append(lettering);
    }
    picture.replaceChildren(art);
    picture.dataset.composition = slide.pictureKey ?? slide.id;
  }
  const clamp = n => Math.max(0, Math.min(1, n));
  function animate(slide, time) {
    for (const {strikes, glow} of effects.bells) {
      const strike = strikes.findLast(cue => cue <= time);
      const diff = strike === undefined ? Infinity : time - strike;
      glow.style.opacity = mode === 'song' && !reduce.matches && diff < 1.5
        ? 0.85 * Math.exp(-diff * 3.2) : 0;
    }
    for (const [i, star] of effects.stars.entries()) {
      star.style.opacity = slide.id === 'theme' && !reduce.matches
        ? clamp((time - slide.at - i * 1.35) / 1.2) : 1;
    }
    if (!effects.light) return;
    let level = 0.64;
    if (slide.pictureKey === 'reunion') {
      // 二人の会話から最後の低いCの余韻まで、同じ絵のまま光を変える。
      if (time >= 189.6) level = .78 - .35 * clamp((time - 189.6) / 3.6);
      if (time >= 193.2) level = .43 + .39 * clamp((time - 193.2) / 3);
      if (time >= 196.2) level = .82 * (1 - .86 * clamp((time - 196.2) / 3.3));
    }
    effects.light.style.opacity = reduce.matches ? .32 : level;
  }
  function render() {
    const slide = selectedSlide();
    if (slide.id !== current) {
      current = slide.id;
      if (picture.dataset.composition !== (slide.pictureKey ?? slide.id)) draw(slide);
      picture.setAttribute('aria-label',slide.alt);
      picture.dataset.scene = slide.id;
      byId('place').textContent = slide.place;
      byId('title').textContent = slide.title;
      byId('speaker').textContent = slide.speaker ?? '';
      byId('speaker').hidden = !slide.speaker;
      byId('words').textContent = slide.words;
      byId('words').hidden = !slide.words;
    }
    animate(slide, songPosition);
    const playing = !music.paused && !music.ended;
    transport.textContent = playing ? 'Ⅱ' : '▶';
    transport.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
    transport.title = transport.getAttribute('aria-label');
    next.hidden = mode === 'song' && !cannotPlay;
    next.textContent = mode === 'opening' ? '曲を聴く ▶' :
      mode === 'song' ? '曲のあとの場面へ ▶' :
      'タイトルへ';
    seek.max = duration();
    seek.value = songPosition;
    byId('time').textContent = clock(songPosition) + ' / ' + clock(duration());
  }
  function sync() {
    if (mode !== 'song') return;
    songPosition = music.currentTime;
    render();
  }
  function tick() {
    frame = 0;
    if (!active || mode !== 'song' || music.paused || music.ended) return;
    sync();
    frame = requestAnimationFrame(tick);
  }
  function canKeepScreenOn() {
    return active && mode === 'song' && document.visibilityState === 'visible'
      && !music.paused && !music.ended && !music.error;
  }
  async function keepScreenOn() {
    if (!navigator.wakeLock || screenLock || screenLockPending || !canKeepScreenOn()) return;
    screenLockPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!canKeepScreenOn()) {
        await lock.release();
        return;
      }
      if (lock.released) return;
      screenLock = lock;
      lock.addEventListener('release', () => {
        if (screenLock === lock) screenLock = null;
      }, { once:true });
    } catch {
      // 端末が画面の点灯維持を許可しない場合も、曲はそのまま再生する。
    } finally {
      screenLockPending = false;
    }
  }
  function allowScreenSleep() {
    const lock = screenLock;
    screenLock = null;
    if (lock && !lock.released) void lock.release().catch(() => {});
  }
  function pauseMusic() {
    audioRequest++;
    music.pause();
    allowScreenSleep();
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function showStatus(message = '') {
    status.textContent = message;
    status.hidden = !message;
  }
  function setTime(seconds) {
    songPosition = Math.min(seconds, Math.max(0, duration() - .05));
    music.currentTime = songPosition;
  }
  function openFilmAt(seconds) {
    mode = 'song';
    setTime(seconds);
    render();
  }
  async function playMusic() {
    if (!active) return;
    const req = ++audioRequest;
    if (mode !== 'song' || music.ended) openFilmAt(0);
    showStatus();
    try {
      if (music.error) music.load();
      await music.play();
      if (req !== audioRequest) return;
      cannotPlay = false;
      sync();
    } catch {
      if (req !== audioRequest) return;
      cannotPlay = true;
      showStatus('曲を再生できませんでした。再生ボタンで再試行できます。');
      render();
    }
}
  function choose(id) {
    pauseMusic();
    showStatus();
    if (id === opening.id) {
      mode = 'opening';
      setTime(0);
    } else {
      const slide = songSlides.find(item => item.id === id);
      if (slide) {
        openFilmAt(slide.at);
      } else {
        mode = 'after';
        songPosition = duration();
      }
    }
    render();
  }
  seek.addEventListener('input', () => openFilmAt(Number(seek.value)));
  transport.addEventListener('click', () => {
    if (music.paused || music.ended) void playMusic();
    else { pauseMusic(); sync(); }
  });
  next.addEventListener('click', () => {
    if (mode === 'opening') void playMusic();
    else if (mode === 'song') choose(credits.id);
    else { stop(); onTitle(); }
  });
  music.addEventListener('loadedmetadata', () => { if (active) render(); });
  music.addEventListener('seeking', sync);
  music.addEventListener('pause', () => {
    if (music.paused) allowScreenSleep();
    sync();
  });
  music.addEventListener('playing', () => {
    if (mode !== 'song' || music.paused) return;
    void keepScreenOn();
    if (!frame) tick();
  });
  music.addEventListener('error', () => {
    allowScreenSleep();
    if (!active) return;
    cannotPlay = true;
    showStatus('曲を読み込めませんでした。通信を確認して、再生ボタンで再試行してください。');
    render();
  });
  music.addEventListener('ended', () => {
    allowScreenSleep();
    if (mode === 'song' && music.ended) choose(credits.id);
  });
  document.addEventListener('visibilitychange', () => { if (active && document.hidden) { pauseMusic(); render(); } });
  window.addEventListener('pagehide', pauseMusic);
  reduce.addEventListener('change', () => { if (active) render(); });

  byId('exit').addEventListener('click', () => { stop(); onTitle(); });
  music.src = endingMusic;
  music.preload = 'none';
  function setMuted(value) { music.muted = !!value; }
  function play() {
    pauseMusic();
    active = true;
    audio.stopAll();
    setMuted(audio.muted);
    cannotPlay = false;
    current = '';
    mode = 'song';
    setTime(0);
    render();
    transport.focus({ preventScroll: true });
    void playMusic();
  }
  function stop() {
    active = false;
    pauseMusic();
  }
  return { play, stop, setMuted };
}
