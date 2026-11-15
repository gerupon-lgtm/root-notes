// 章末の謎の画面（段階5。docs/design/段階5_章末の謎.md、内容は src/content/riddles.js）。
// 上（横向きは左）に背景と封印中の武具、武具から声が漏れる印。下（横向きは右）に案内の文、4本の弦（木の棒）、ボタン。
// - 弦をタップ：選んで単音を鳴らす。「声を聞く」：武具の声。「重ねて聞く」：声と選んだ弦を同時に鳴らし続ける（もう一度押すと止める）
// - フリーだけ揺れメーターを出す（ノーマル・エキスパートは耳だけ。第1章と同じ）
// - 「この弦を持ち帰る」で決める。正誤は出さない（答えても反応は同じ。要件6.3）
// - 弦の並びは毎回ランダム（2026-11-15 発案者「答えが上から2番ばかり」）。弦の位置は動かさない：
//   弦の図は始めに1回だけ描き、選んだ印だけを付け替える。案内の文とメーターの場所は、先に一番高い分を取っておく
//   （2026-11-15 発案者「選ぶと弦がパッと動く。文字が減って折り返しが無くなり、弦が上に詰まる」）
import { svg } from './svg.js';
import { woodDefs, woodBar, part, PIN } from './instrument-parts.js';
import { storyArt } from '../content/story.js';
import { riddleHz, beatRate } from '../content/riddles.js';
import { TIMBRES } from '../content/timbres.js';

const STRING_TIMBRE = TIMBRES.organ; // 第1章の弦と同じ（音色はあとで変える予定。2026-11-15 発案者）
const W = 320, ROW = 46, TOP = 12;
const VOICE_REPEAT_MS = 3800; // 声は、選ぶ前に何度か自然に漏れる

export function createRiddleScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const picture = $('riddle-picture'), bars = $('riddle-bars'), guide = $('riddle-guide'), meter = $('riddle-meter');
  const listen = $('riddle-listen'), overlap = $('riddle-overlap'), take = $('riddle-take'), next = $('riddle-next');
  let R = null, opts = null, chosen = -1, drone = null, timers = [], done = false, order = [];
  const lengthAt = k => order[k];

  const voiceTimbre = () => (R.voice.tone === 'dark' ? TIMBRES.sealDark : TIMBRES.sealClear);
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function stopDrone() {
    if (drone) for (const v of drone) v?.stop();
    drone = null;
    overlap.classList.remove('on');
    overlap.textContent = '重ねて聞く';
    idleMeter();
  }
  // メーターを使える遊び方では、場所を取っておく（出たり消えたりで弦が動かないように）
  function idleMeter() {
    meter.hidden = !opts?.meter;
    meter.classList.add('idle');
    meter.textContent = '揺れ：―';
  }

  // 武具の声（漏れる印を光らせる）
  function voice() {
    const hz = riddleHz(R.answer);
    for (const [at, len] of R.voice.notes) audio.chord([hz], { timbre: voiceTimbre(), delay: 0.02 + at, duration: len, strum: 0, level: R.voice.level });
    const mark = picture.querySelector('.riddle-voice');
    mark?.classList.remove('leak'); void mark?.offsetWidth; mark?.classList.add('leak');
  }
  // 選ぶ前は、声が何度か自然に漏れる（要件6.3「声は選ぶ前に漏れる」）
  function leakLoop(count) {
    if (count <= 0) return;
    timers.push(setTimeout(() => { if (!drone && !done) voice(); leakLoop(count - 1); }, VOICE_REPEAT_MS));
  }

  function drawPicture() {
    const img = (art, cls, style = {}) => { const x = document.createElement('img'); x.src = storyArt(art); x.alt = ''; x.draggable = false; x.className = cls; Object.assign(x.style, style); return x; };
    const voiceImg = document.createElement('img');
    voiceImg.src = new URL(`../../public/art/story/voice-${R.id}.svg`, import.meta.url).href;
    voiceImg.alt = ''; voiceImg.className = 'riddle-voice';
    picture.replaceChildren(
      img(R.background, 'story-layer', { left: 0, top: 0, width: '100%' }),
      img(`${R.id}-sealed`, 'story-layer riddle-item', { left: '33%', top: '22%', width: '34%' }),
      voiceImg
    );
  }

  function drawBars() {
    while (bars.firstChild) bars.firstChild.remove();
    woodDefs(bars);
    const max = Math.max(...order);
    order.forEach((n, k) => {
      const y = TOP + 22 + k * ROW, w = Math.max(40, (n / max) * 236);
      const p = [16, y], q = [16 + w, y], sp = [p[0] + 8, y - 9], sq = [q[0] - 8, y - 9];
      const g = svg('g', { class: 'riddle-row', 'data-k': k });
      // 選んだ印：行全体の淡い金の帯と枠（.chosen のときだけ見える）
      g.append(svg('rect', { x: 4, y: y - ROW / 2 + 1, width: W - 8, height: ROW - 6, rx: 8, class: 'riddle-sel' }));
      g.append(woodBar(p, q, bars));
      g.append(svg('line', { x1: sp[0], y1: sp[1], x2: sq[0], y2: sq[1], class: 'riddle-string' }));
      g.append(part('string-pin', sp, PIN * 2, '#caa25a'), part('string-pin', sq, PIN * 2, '#caa25a'));
      g.append(svg('text', { x: q[0] + 12, y: y + 5, class: 'tri-label riddle-label' }, String(n)));
      g.append(svg('rect', { x: 0, y: y - ROW / 2 - 4, width: W, height: ROW, class: 'riddle-hit', fill: 'transparent' }));
      bars.append(g);
    });
    bars.setAttribute('viewBox', `0 0 ${W} ${TOP + 22 + R.choices.length * ROW - 10}`);
  }

  function render() {
    for (const row of bars.querySelectorAll('.riddle-row')) row.classList.toggle('chosen', Number(row.dataset.k) === chosen);
    overlap.disabled = chosen < 0 || done;
    take.disabled = chosen < 0 || done;
    listen.disabled = done;
    take.hidden = done; overlap.hidden = done; listen.hidden = done;
    next.hidden = !done;
  }

  function updateMeter() {
    if (!drone || !opts.meter) { idleMeter(); return; }
    const b = beatRate(riddleHz(R.answer), riddleHz(lengthAt(chosen)));
    meter.hidden = false;
    meter.classList.remove('idle');
    meter.textContent = b < 1 ? '揺れ：なし（一つにまとまって聞こえる）' : `揺れ：${b < 10 ? b.toFixed(1) : Math.round(b)} 回/秒`;
  }

  bars.addEventListener('pointerdown', e => {
    const row = e.target.closest('.riddle-row');
    if (!row || done) return;
    chosen = Number(row.dataset.k);
    const hz = riddleHz(lengthAt(chosen));
    if (drone) { drone[1]?.setHz(hz); updateMeter(); }
    else audio.pluck(hz, 'cut', STRING_TIMBRE);
    render();
  });
  listen.addEventListener('click', () => { stopDrone(); voice(); });
  overlap.addEventListener('click', () => {
    if (chosen < 0) return;
    if (drone) { stopDrone(); return; }
    audio.stopAll(); clearTimers();
    drone = [audio.hold(riddleHz(R.answer), voiceTimbre(), { level: 0.5 }), audio.hold(riddleHz(lengthAt(chosen)), STRING_TIMBRE, { level: 0.5 })];
    overlap.classList.add('on');
    overlap.textContent = '止める';
    updateMeter();
  });
  take.addEventListener('click', () => {
    if (chosen < 0 || done) return;
    stopDrone(); audio.stopAll(); clearTimers();
    done = true;
    // 正誤にかかわらず同じ反応（要件6.3）
    guide.textContent = takenText(lengthAt(chosen));
    picture.querySelector('.riddle-item')?.classList.add('taken');
    audio.pluck(riddleHz(lengthAt(chosen)), 'cut', STRING_TIMBRE);
    render();
    next.focus({ preventScroll: true });
  });
  next.addEventListener('click', () => { if (!opts) return; const length = lengthAt(chosen), cb = opts.onDone; stop(); cb(length); });
  $('riddle-title').addEventListener('click', () => { if (!opts) return; const cb = opts.onTitle; stop(); cb(); });

  // riddle：RIDDLES の1つ。meter：揺れメーターを出すか。onDone(選んだ長さ)
  function start(riddle, { meter: showMeter = false, onDone, onTitle }) {
    R = riddle; opts = { meter: showMeter, onDone, onTitle }; chosen = -1; done = false;
    order = shuffled(R.choices);
    $('riddle-place').textContent = `${R.chapter}の終わり　謎（${R.name}）`;
    drawPicture(); drawBars(); stopDrone(); render();
    // 案内の文：始めの文と、持ち帰ったあとの文（一番長い数字で）の高い方に合わせて、高さを固定する
    guide.style.minHeight = '';
    let high = 0;
    for (const text of [takenText(Math.max(...R.choices)), startText()]) { guide.textContent = text; high = Math.max(high, guide.offsetHeight); }
    guide.style.minHeight = `${high}px`;
    clearTimers();
    timers.push(setTimeout(voice, 600));
    leakLoop(2);
  }
  function stop() { stopDrone(); clearTimers(); audio.stopAll(); opts = null; }
  const startText = () => `${R.name}から、声が漏れています。同じ高さの弦を選んでください。`;
  const takenText = n => `${R.name}から漏れていた声を、長さ ${n} の弦に写しました。`;
  // 弦の並びを毎回混ぜる（答えの位置が決まらないように）
  function shuffled(xs) {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  return { start, stop };
}
