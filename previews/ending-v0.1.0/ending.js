'use strict';
const byId = id => document.getElementById(id);
const music = byId('music');
const picture = byId('picture');
const seek = byId('seek');
const selector = byId('scenes');
const next = byId('advance');
const back = byId('back');
const transport = byId('transport');
const mute = byId('mute');
const status = byId('status');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const expectedDuration = 199.5;
let mode = 'opening';
let afterIndex = 0;
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
  if (mode === 'after') return afterSong[afterIndex];
  return atSongTime(songPosition);
}
function img(file, cls) {
  const el = document.createElement('img');
  el.alt = '';
  el.src = 'art/' + file;
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
  if (slide.id === 'theme' || slide.id === 'coda') {
    effects.light = document.createElement('div');
    effects.light.className = 'altar-light';
    art.append(effects.light);
  }
  for (const item of slide.art ?? []) {
    art.append(styledLayer(item, 'layer'));
    if (item.strike !== undefined) {
      const glow = styledLayer(item, 'strike');
      art.append(glow);
      effects.bells.push({ at:item.strike, glow });
    }
  }
  art.append(Object.assign(document.createElement('div'), {className:'vignette'}));
  if (slide.id === 'credits') {
    const lettering = document.createElement('div');
    lettering.className = 'credit-name';
    const name = document.createElement('strong');
    name.textContent = 'ROOT NOTES';
    const series = document.createElement('small');
    series.textContent = 'SIKUMI NOTES 04';
    lettering.append(name,series);
    art.append(lettering);
  }
  picture.replaceChildren(art);
  picture.setAttribute('aria-label',slide.alt);
  picture.dataset.scene = slide.id;
}
const clamp = n => Math.max(0, Math.min(1, n));
function animate(slide, time) {
  for (const {at, glow} of effects.bells) {
    const diff = time - at;
    glow.style.opacity = mode === 'song' && !reduce.matches && diff >= 0 && diff < 1.5
      ? 0.85 * Math.exp(-diff * 3.2) : 0;
  }
  for (const [i, star] of effects.stars.entries()) {
    star.style.opacity = slide.id === 'theme' && !reduce.matches
      ? clamp((time - 8.3 - i * 1.35) / 1.2) : 1;
  }
  if (!effects.light) return;
  let level = 0.64;
  if (slide.id === 'coda') {
    // 音源の目印に合わせる。打楽器が抜けてから低いCの余韻まで同じ絵を保つ。
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
    draw(slide);
    byId('place').textContent = slide.place;
    byId('title').textContent = slide.title;
    byId('speaker').textContent = slide.speaker ?? '';
    byId('speaker').hidden = !slide.speaker;
    byId('words').textContent = slide.words;
    byId('words').hidden = !slide.words;
    selector.value = slide.id;
  }
  animate(slide, songPosition);
  const playing = !music.paused && !music.ended;
  transport.textContent = playing ? 'Ⅱ' : '▶';
  transport.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
  transport.title = transport.getAttribute('aria-label');
  next.hidden = mode === 'song' && !cannotPlay;
  back.hidden = mode !== 'after';
  next.textContent = mode === 'opening' ? '曲を聴く ▶' :
    mode === 'song' ? '曲のあとの場面へ ▶' :
    afterIndex === afterSong.length-1 ? 'はじめに戻る' : 'つづき ▶';
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
  if (mode !== 'song' || music.paused || music.ended) return;
  sync();
  frame = requestAnimationFrame(tick);
}
function canKeepScreenOn() {
  return mode === 'song' && document.visibilityState === 'visible'
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
  const req = ++audioRequest;
  if (mode !== 'song' || music.ended) openFilmAt(0);
  showStatus();
  try {
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
      afterIndex = Math.max(0, afterSong.findIndex(item => item.id === id));
      mode = 'after';
      songPosition = duration();
    }
  }
  render();
}
for (const [label, slides] of [['曲の前',[opening]],['曲の中',songSlides],['曲のあと',afterSong]]) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const slide of slides) {
    const option = document.createElement('option');
    option.value = slide.id;
    option.textContent = (slide.at === undefined ? '' : clock(slide.at) + '　') + slide.title;
    group.append(option);
  }
  selector.append(group);
}
function renderMute() {
  mute.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>' +
    (music.muted ? '<path d="m16 9 5 6m0-6-5 6"/>' : '<path d="M16 8q5 4 0 8 M18 5q8 7 0 14"/>') + '</svg>';
  const label = music.muted ? '音を出す' : '音を消す';
  mute.setAttribute('aria-label',label);
  mute.setAttribute('aria-pressed',String(music.muted));
  mute.title = label;
}
selector.addEventListener('change', () => choose(selector.value));
seek.addEventListener('input', () => openFilmAt(Number(seek.value)));
transport.addEventListener('click', () => {
  if (music.paused || music.ended) void playMusic();
  else { pauseMusic(); sync(); }
});
mute.addEventListener('click', () => {music.muted = !music.muted; renderMute();});
next.addEventListener('click', () => {
  if (mode === 'opening') void playMusic();
  else if (mode === 'song') choose(afterSong[0].id);
  else choose(afterSong[afterIndex + 1]?.id ?? opening.id);
});
back.addEventListener('click', () => choose(afterSong[afterIndex - 1]?.id ?? 'coda'));
music.addEventListener('loadedmetadata', render);
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
music.addEventListener('error', allowScreenSleep);
music.addEventListener('ended', () => {
  allowScreenSleep();
  if (mode === 'song' && music.ended) choose(afterSong[0].id);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseMusic(); render(); } });
window.addEventListener('pagehide', pauseMusic);
reduce.addEventListener('change', render);
renderMute();
render();
// 場面切り替え前に、繰り返し使う絵をキャッシュへ読み込む。
for (const file of new Set(['stars-night-empty.webp','temple-sky-sanctuary-no-sky.webp',
  ...[opening,...songSlides,...afterSong].flatMap(slide => [slide.bg,...(slide.art ?? []).map(item => item.file)]).filter(Boolean)])) {
  const preview = new Image();
  preview.src = 'art/' + file;
}
