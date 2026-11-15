// おはなしの紙芝居の画面（段階6）。形は FLOAT の scene() と Codex の画面案（物語素材 v0.7.0 preview）：
// 上（横向きは左）に 4:3 の絵、下（横向きは右）に語り・話す人・セリフ・「つづき ▶」。2回目からは「飛ばす」。
// 絵は 1280×960 の座標で重ね、％で置くので、画面の大きさが変わっても位置がずれない。絵をタップすると、その場面の音をもう一度鳴らす。
import { storyArt, BELL_HZ, SKY_STARS, GONE_STARS, SPARKLE_STARS } from '../content/story.js';
import { TIMBRES } from '../content/timbres.js';

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
      img.src = storyArt(l.art);
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
      if (cue.chord) timers.push(setTimeout(() => audio.chord(cue.chord, { timbre: TIMBRES.epiano, duration: 2.6 }), cue.at * 1000));
      if (cue.pluck) timers.push(setTimeout(() => audio.pluck(cue.pluck, 'overlap', TIMBRES.organ), cue.at * 1000));
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
    for (const name of new Set(list.flatMap(s => s.layers.map(l => l.art)))) { const img = new Image(); img.src = storyArt(name); }
  }

  next.addEventListener('click', () => {
    if (!opts) return;
    if (index < slides.length - 1) show(index + 1);
    else { const done = opts.onDone; stop(); done(); }
  });
  skip.addEventListener('click', () => { if (!opts) return; const done = opts.onDone; stop(); done(); });
  picture.addEventListener('click', () => { if (opts) playCues(slides[index]); });

  // slides を最初から見せる。canSkip：2回目からの「飛ばす」。onDone：最後の「つづき」か「飛ばす」のあと
  function play(list, { title, canSkip = false, endLabel = 'はじめる', onDone }) {
    slides = list; opts = { title, onDone, endLabel };
    skip.hidden = !canSkip;
    preload(list);
    show(0);
    next.focus({ preventScroll: true });
  }
  function stop() { stopSound(); clearSparks(); opts = null; }

  return { play, stop };
}
