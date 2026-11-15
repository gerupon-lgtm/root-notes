// おはなしの紙芝居の画面（段階6）。形は FLOAT の scene() と Codex の画面案（物語素材 v0.7.0 preview）：
// 上（横向きは左）に 4:3 の絵、下（横向きは右）に語り・話す人・セリフ・「つづき ▶」。2回目からは「飛ばす」。
// 絵は 1280×960 の座標で重ね、％で置くので、画面の大きさが変わっても位置がずれない。絵をタップすると、その場面の音をもう一度鳴らす。
import { storyArt, BELL_HZ, SKY_STARS, GONE_STARS, SPARKLE_STARS } from '../content/story.js';
import { TIMBRES } from '../content/timbres.js';
import { RIDDLES, riddleHz } from '../content/riddles.js';

const W = 1280, H = 960;
const pct = (v, total) => `${(v / total) * 100}%`;

export function createStoryScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const picture = $('story-picture'), place = $('story-place'), narration = $('story-narration');
  const speech = $('story-speech'), speaker = $('story-speaker'), dialogue = $('story-dialogue');
  const next = $('story-next'), skip = $('story-skip');
  let slides = [], index = 0, opts = null, timers = [], sparkTimers = [];
  const clearSparks = () => { sparkTimers.forEach(clearTimeout); sparkTimers = []; };
  // 星を1つ、不定期にきらめかせ続ける（1.8〜5.5秒おき）
  function sparkle(star) {
    const wait = 1800 + Math.random() * 3700;
    sparkTimers.push(setTimeout(() => {
      star.classList.remove('sparkle');
      void star.offsetWidth;
      star.classList.add('sparkle');
      sparkle(star);
    }, wait));
  }

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const stopSound = () => { clearTimers(); audio.stopAll(); };

  function draw(slide) {
    clearSparks();
    const sparks = [];
    const parts = slide.layers.map(l => {
      const img = document.createElement('img');
      // svg：声の形の印（章の終わり 2）。それ以外は webp の絵
      img.src = l.svg ? new URL(`../../public/art/story/${l.svg}.svg`, import.meta.url).href : storyArt(l.art);
      img.alt = '';
      img.draggable = false;
      img.className = `story-layer ${l.cls ?? ''}`.trim();
      if (l.id) img.dataset.id = l.id;
      Object.assign(img.style, { left: pct(l.x, W), top: pct(l.y, H), width: pct(l.w, W) });
      return img;
    });
    if (slide.stars) {
      SKY_STARS.forEach((s, i) => {
        const star = document.createElement('span');
        const gone = slide.stars === 'broken' && GONE_STARS.includes(i);
        star.className = `story-star${gone ? ' gone' : ''}`;
        Object.assign(star.style, { left: pct(s.x, W), top: pct(s.y, H) });
        if (!gone && SPARKLE_STARS.includes(i)) sparks.push(star);
        parts.splice(1, 0, star);
      });
    }
    // 灯った星（章の終わり 1）：その章で灯した数を、絵の上の方に並べ、順に灯す
    for (let i = 0; i < (slide.lit ?? 0); i++) {
      const star = document.createElement('span');
      const x = slide.lit === 1 ? 640 : 330 + (620 * i) / (slide.lit - 1);
      star.className = 'story-star lit';
      Object.assign(star.style, { left: pct(x, W), top: pct(i % 2 ? 150 : 115, H), animationDelay: `${0.2 + i * 0.25}s` });
      parts.push(star);
    }
    picture.replaceChildren(...parts);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sparks.forEach(sparkle);
  }

  // 光らせる（鐘が鳴るあいだ）
  function glow(ids) {
    for (const id of ids) {
      const el = picture.querySelector(`[data-id="${id}"]`);
      if (!el) continue;
      el.classList.remove('ringing');
      void el.offsetWidth; // 続けて光らせるとき、光り方を始めからにする
      el.classList.add('ringing');
    }
  }

  function playCues(slide) {
    stopSound();
    for (const cue of slide.cues ?? []) {
      if (cue.bells) {
        cue.bells.forEach(n => audio.bell(BELL_HZ[n], { at: cue.at, level: cue.bells.length > 1 ? 0.8 : 1 }));
        timers.push(setTimeout(() => glow(cue.bells.map(n => `bell-${n}`)), cue.at * 1000));
      }
      // 武具から漏れる声（謎と同じ漏れ方・音色）。声の形の印を光らせる
      if (cue.seal) timers.push(setTimeout(() => {
        const R = RIDDLES[cue.seal], hz = riddleHz(R.answer), timbre = R.voice.tone === 'dark' ? TIMBRES.sealDark : TIMBRES.sealClear;
        for (const [at, len] of R.voice.notes) audio.chord([hz], { timbre, delay: 0.02 + at, duration: len, strum: 0, level: R.voice.level });
        const mark = picture.querySelector('[data-id="voice"]');
        mark?.classList.remove('leak'); void mark?.offsetWidth; mark?.classList.add('leak');
      }, cue.at * 1000));
      // その章のフレーズ（第2章の終わり。曲を作る仕組みは流れの側から渡してもらう）
      if (cue.phrase && opts.phrase) timers.push(setTimeout(() => opts.phrase(), cue.at * 1000));
      if (cue.chord) timers.push(setTimeout(() => audio.chord(cue.chord, { timbre: TIMBRES.epiano, duration: 2.6 }), cue.at * 1000));
      // 精霊の声：5セントずらした2本を重ねて、グラスハープのゆらぎを出す
      if (cue.voice) timers.push(setTimeout(() => audio.chord([cue.voice, cue.voice * 2 ** (5 / 1200)], { timbre: TIMBRES.glass, duration: 1.3, strum: 0, level: 0.55 }), cue.at * 1000));
      if (cue.pluck) timers.push(setTimeout(() => audio.pluckGut(cue.pluck), cue.at * 1000));
    }
  }

  function show(i) {
    index = i;
    const slide = slides[i];
    place.textContent = `${opts.title}　${slide.place}`;
    narration.textContent = slide.narration ?? '';
    narration.hidden = !slide.narration;
    speech.hidden = !slide.speaker;
    speaker.textContent = slide.speaker ?? '';
    dialogue.textContent = slide.say ?? '';
    next.innerHTML = i === slides.length - 1 ? `${opts.endLabel} <span aria-hidden="true">▶</span>` : 'つづき <span aria-hidden="true">▶</span>';
    draw(slide);
    playCues(slide);
  }

  // 次の場面の絵を先に読んでおく（切り替えで絵が遅れて出ないように）
  function preload(list) {
    for (const name of new Set(list.flatMap(s => s.layers.filter(l => l.art).map(l => l.art)))) { const img = new Image(); img.src = storyArt(name); }
  }

  next.addEventListener('click', () => {
    if (!opts) return;
    if (index < slides.length - 1) show(index + 1);
    else { const done = opts.onDone; stop(); done(); }
  });
  skip.addEventListener('click', () => { if (!opts) return; const done = opts.onDone; stop(); done(); });
  picture.addEventListener('click', () => { if (opts) playCues(slides[index]); });

  // slides を最初から見せる。canSkip：2回目からの「飛ばす」。onDone：最後の「つづき」か「飛ばす」のあと
  // phrase：章の終わり 1 でフレーズを鳴らす関数（第2章。なければ鳴らさない）
  function play(list, { title, canSkip = false, endLabel = 'はじめる', onDone, phrase = null }) {
    slides = list; opts = { title, onDone, endLabel, phrase };
    skip.hidden = !canSkip;
    preload(list);
    show(0);
    next.focus({ preventScroll: true });
  }
  function stop() { stopSound(); clearSparks(); opts = null; }

  return { play, stop };
}
