// 遊ぶ画面（段階3）。決まりは src/game/play.js、音は src/audio/engine.js、描画は triangle-view.js に任せ、
// ここは画面の部品と操作をつなぐだけにする（docs/design/段階3_三角形ステージの画面.md）
import { Play } from '../game/play.js';
import { buildScore } from '../game/song.js';
import { MODES, MODE_ORDER } from '../content/modes.js';
import { DISCOVERY_TEXT } from '../content/discoveries.js';
import { BARS, PHRASE } from '../content/progressions.js';
import { STAGE_RULES } from '../content/stage-rules.js';
import { frequency, frequencies, beats, beatLevel, ratioOf } from '../core/pitch.js';
import { sortLengths, lengthValue, formatLength } from '../core/length.js';
import { gcd } from '../core/integer.js';
import { colorOf, blendOf } from '../core/color.js';
import { keyName } from '../core/harmony.js';
import { drawEmpty, drawOpen, drawClosed } from './triangle-view.js';
import { APP_VERSION, COPYRIGHT } from '../version.js';

const $ = id => document.getElementById(id);
const ROWS = ['低', '中', '高'];
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children);
  return node;
}

export function createStageScreen({ audio, onTitle }) {
  const s = { play: null, busy: false, carryOver: false, msg: null, playingBar: -1, check: new URLSearchParams(location.search).has('check') };
  const svgRoot = $('tri');

  const play = () => s.play;
  const K = () => play().stage.K;
  const hz = l => frequency(l, K());
  const lenColor = l => colorOf(hz(l));
  const say = (text, kind = '') => { s.msg = { text, kind }; renderStatus(); };

  let toastTimer = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function shake() {
    if (reduceMotion()) return;
    const app = $('stage-screen');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  }
  function glow(hzs) {
    const fill = $('tri-fill');
    if (!fill) return;
    fill.style.fill = hzs ? blendOf(hzs) : '';
    fill.classList.toggle('lit', !!hzs);
  }
  function ringSide(k, seconds = 0.6) {
    const side = svgRoot.querySelector(`.side[data-k="${k}"]`);
    if (!side || reduceMotion()) return;
    side.classList.add('ring');
    setTimeout(() => side.classList.remove('ring'), seconds * 1000);
  }

  // ---------- 表示 ----------
  function renderHead() {
    $('mode-chip').textContent = `${play().mode.label} ▾`;
  }

  function renderStars() {
    const p = play(), box = $('stars');
    box.replaceChildren(...Array.from({ length: BARS }, (_, i) => {
      const classes = ['star', i === p.index && 'on', p.lit.has(i) && 'lit', i === s.playingBar && 'play', i === PHRASE && 'gap'].filter(Boolean).join(' ');
      const b = el('button', { type: 'button', class: classes, 'aria-pressed': String(i === p.index), 'aria-label': `${i + 1}小節目${p.lit.has(i) ? '（灯った）' : ''}`, 'data-bar': i },
        el('span', { class: 'glyph', 'aria-hidden': 'true' }, '✦'), String(i + 1));
      b.disabled = (p.mode.continuous && i !== p.index) || s.busy;
      return b;
    }));
  }

  function renderSub() {
    const p = play();
    const phrase = Math.floor(p.index / PHRASE) + 1, pos = (p.index % PHRASE) + 1;
    $('where').replaceChildren(`フレーズ${phrase}の`, el('b', {}, `${pos}つ目`), 'の和音');
    const lives = $('lives');
    if (Number.isFinite(p.mode.lives)) {
      lives.replaceChildren(...Array.from({ length: p.mode.lives }, (_, i) => el('span', { class: i < p.livesLeft ? 'gem' : 'gem lost', 'aria-hidden': 'true' }, '◆')));
      lives.setAttribute('aria-label', `失敗の残り ${p.livesLeft} 回`);
    } else lives.replaceChildren();
  }

  function sidesOf(p) { return p.selectedLengths.map(length => ({ length, color: lenColor(length) })); }

  function renderBoard() {
    const p = play();
    if (!p.ready) {
      drawEmpty(svgRoot, p.selected.length ? `あと${3 - p.selected.length}本選んでください` : 'お題を聞いて、下の棒を3本選んでください');
      return;
    }
    if (!p.closed) drawOpen(svgRoot, sidesOf(p));
    else drawClosed(svgRoot, sidesOf(p));
  }

  function defaultMessage() {
    const p = play();
    if (p.over) return { text: '失敗の上限に達しました。ゲームオーバー。「最初から」で新しい曲に挑戦できます。', kind: 'warn' };
    if (p.complete) return { text: `1曲できあがり：${songTitle()}。「最初から」で新しい曲に挑戦できます。`, kind: 'ok' };
    if (!p.ready) return { text: '', kind: '' };
    if (!p.closed) {
      const [a, b, c] = sortLengths(p.selectedLengths).map(lengthValue);
      return { text: `閉じない：${a}＋${b}＝${a + b} は ${c} に届きません。1本ずつなら音は鳴ります。`, kind: 'warn' };
    }
    if (p.meterVisible) return { text: '揺れメーターを表示中。棒を選び直すと消えます。', kind: '' };
    return { text: '辺をタップ（なぞる）して1音ずつ確かめ、納得したら回答。', kind: '' };
  }

  function renderStatus() {
    const p = play();
    const m = s.msg ?? defaultMessage();
    const msg = $('msg');
    msg.textContent = m.text;
    msg.className = m.kind;
    const info = $('info');
    if (p.closed) {
      const sorted = sortLengths(p.selectedLengths);
      const ns = sorted.map(l => l.n), g = ns.reduce(gcd);
      const fr = ratioOf(sorted);
      info.replaceChildren('辺 ', el('b', {}, ns.map(n => n / g).join(':')), ' → 音の高さ ', el('b', {}, fr ? [...fr].reverse().join(':') : '—'), '（短い辺ほど高い）');
    } else info.replaceChildren();
    const meter = $('meter');
    meter.hidden = !p.meterVisible;
  }

  function renderMeterRows() {
    $('meter').replaceChildren(el('span', {}, '揺れ'), ...ROWS.map((label, i) => el('span', { class: 'm' }, label, el('span', { class: 'dot', id: `dot${i}` }), el('span', { id: `beat${i}` }, '—'))));
  }

  function renderSticks() {
    const p = play();
    $('sticks').replaceChildren(...p.stage.sticks.map((l, i) => {
      const order = p.selected.indexOf(i);
      const b = el('button', { type: 'button', class: order >= 0 ? 'stick sel' : 'stick', 'aria-pressed': String(order >= 0), 'data-i': i, 'aria-label': `長さ ${formatLength(l)} の棒` },
        el('span', { class: 'num' }, formatLength(l)),
        el('span', { class: 'bar', style: `width:${(lengthValue(l) / STAGE_RULES.maxLength) * 100}%;background:${lenColor(l)}` }),
        order >= 0 ? el('span', { class: 'ord' }, String(order + 1)) : '');
      b.disabled = p.finished || s.busy;
      return b;
    }));
  }

  function renderActions() {
    const p = play();
    const chordOk = p.canPlayChord().ok;
    for (const id of ['b-chord', 'b-compare']) $(id).classList.toggle('dim', !chordOk);
    const meter = $('b-meter');
    meter.hidden = p.mode.meter === 'toggle';
    meter.innerHTML = p.meterShown ? 'メーター<br>表示中' : Number.isFinite(p.meterLeft) ? `メーター<br>残り${p.meterLeft}` : 'メーター';
    meter.classList.toggle('dim', p.meterShown || p.meterLeft <= 0 || !p.closed);
    $('b-answer').textContent = p.finished ? '最初から' : '回答する';
    for (const id of ['b-target', 'b-chord', 'b-compare', 'b-meter', 'b-answer']) $(id).disabled = s.busy;
  }

  function songTitle() { return `${play().run.progression.name}（キー ${keyName(play().run.key)}）`; }

  function renderSheet() {
    const p = play();
    $('modes').replaceChildren(...MODE_ORDER.map(id => el('button', { type: 'button', class: id === p.mode.id ? 'on' : '', 'data-mode': id }, MODES[id].label)));
    $('mode-desc').textContent = p.mode.desc;
    const n = p.litFromStart, labels = p.run.stages.map(x => x.label);
    const info = $('song-info');
    if (p.lit.size === BARS) info.replaceChildren(el('b', {}, songTitle()), '：', labels.join(' → '));
    else if (n >= PHRASE) info.textContent = `キー ${keyName(p.run.key)}。ここまで：${labels.slice(0, n).join(' → ')}（曲名は8つの星がそろうと分かります）`;
    else info.textContent = '4つの星を灯すと、フレーズが聴けます。';
    $('carry-off').classList.toggle('on', !s.carryOver);
    $('carry-on').classList.toggle('on', s.carryOver);
    $('found').replaceChildren(...Object.entries(DISCOVERY_TEXT).map(([id, d]) => p.found.has(id)
      ? el('li', { class: 'got' }, el('b', {}, d.title), d.text)
      : el('li', {}, el('b', {}, '？？？'), 'まだ見つかっていない')));
    $('meter-setting').hidden = p.mode.meter !== 'toggle';
    $('meter-on').classList.toggle('on', p.meterToggle);
    $('meter-off').classList.toggle('on', !p.meterToggle);
    $('b-reveal').hidden = !s.check;
    $('sheet-version').textContent = `v${APP_VERSION}`;
    $('sheet-copyright').textContent = COPYRIGHT;
  }

  function renderAll() {
    renderHead(); renderStars(); renderSub(); renderBoard(); renderStatus(); renderSticks(); renderActions();
    if (!$('sheet').hidden) renderSheet();
  }

  // ---------- 揺れメーター（点は揺れの速さで明滅） ----------
  function meterLoop(now) {
    if (!$('stage-screen').hidden && s.play) {
      const p = play();
      if (p.meterVisible) {
        const bs = p.closed ? beats(p.stage.target, p.selectedLengths, K()) : null;
        for (let i = 0; i < 3; i++) {
          const dot = $(`dot${i}`), text = $(`beat${i}`);
          if (!dot || !text) continue;
          if (!bs) { dot.style.opacity = 0.35; dot.dataset.level = ''; text.textContent = '—'; text.dataset.level = ''; continue; }
          const b = bs[i], level = beatLevel(b);
          dot.dataset.level = level; text.dataset.level = level;
          text.textContent = level === 'clear' ? '澄' : level === 'far' ? '遠い' : `${b.toFixed(1)}/秒`;
          if (reduceMotion() || level === 'clear') dot.style.opacity = 1;
          else if (level === 'far') dot.style.opacity = 0.35 + 0.3 * Math.random();
          else dot.style.opacity = 0.55 + 0.45 * Math.cos((2 * Math.PI * b * now) / 1000);
        }
      }
    }
    requestAnimationFrame(meterLoop);
  }

  // ---------- 曲 ----------
  function playMusic(from, to, title, done = () => {}) {
    const p = play();
    s.busy = true;
    audio.stopAll();
    renderAll();
    const labels = p.run.stages.slice(from, to + 1).map(x => x.label);
    audio.playScore(buildScore(p.run.stages, from, to, { carryOver: s.carryOver }), {
      onBar: bar => {
        s.playingBar = bar;
        renderStars();
        const msg = $('msg');
        msg.className = '';
        msg.replaceChildren(`♪ ${title}　`, ...labels.flatMap((l, j) => [j ? ' → ' : '', from + j === bar ? el('span', { class: 'now' }, l) : l]));
      },
      onEnd: () => { s.playingBar = -1; s.busy = false; done(); renderAll(); }
    });
  }

  function afterCorrect(result) {
    const p = play();
    const next = () => {
      if (p.mode.continuous) {
        p.advance();
        s.msg = null;
        if (!p.complete) toast(`${p.index + 1}小節目へ`);
      }
      renderAll();
    };
    if (result.music?.kind === 'song') { toast('8つの星がそろった。1曲を通して流します'); playMusic(0, BARS - 1, songTitle(), () => { s.msg = { text: `1曲できあがり：${songTitle()}`, kind: 'ok' }; next(); }); }
    else if (result.music?.kind === 'phrase') { toast(`フレーズ${result.music.from / PHRASE + 1}が鳴ります`); playMusic(result.music.from, result.music.to, `キー ${keyName(p.run.key)}`, next); }
    else { s.busy = false; next(); }
  }

  // ---------- 操作 ----------
  function start(modeId) {
    audio.stopAll();
    s.play = Play.start(modeId);
    s.busy = false; s.msg = null; s.playingBar = -1;
    renderMeterRows();
    renderAll();
  }

  $('sticks').addEventListener('click', e => {
    const b = e.target.closest('.stick');
    if (!b || s.busy || play().finished) return;
    const i = Number(b.dataset.i);
    play().pick(i);
    s.msg = null;
    audio.pluck(hz(play().stage.sticks[i]), play().sustain);
    for (const d of play().lastFound) toast(`発見：${DISCOVERY_TEXT[d].title}`);
    renderAll();
  });

  // 辺をタップ・なぞる（試作と同じく、指の下の当たりを探す）
  let tracing = false, lastK = null;
  const sideAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('#tri .hit') ?? null;
  function touchSide(hit) {
    if (!hit) { lastK = null; return; }
    const k = Number(hit.dataset.k);
    if (k === lastK) return;
    lastK = k;
    const l = play().selectedLengths[k];
    if (!l) return;
    audio.pluck(hz(l), play().sustain);
    ringSide(k);
  }
  svgRoot.addEventListener('pointerdown', e => { if (s.busy || !play().ready) return; tracing = true; lastK = null; touchSide(sideAt(e.clientX, e.clientY)); });
  svgRoot.addEventListener('pointermove', e => { if (tracing) touchSide(sideAt(e.clientX, e.clientY)); });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) svgRoot.addEventListener(name, () => { tracing = false; lastK = null; });

  $('stars').addEventListener('click', e => {
    const b = e.target.closest('.star');
    if (!b || s.busy || play().mode.continuous) return;
    audio.stopAll();
    play().goTo(Number(b.dataset.bar));
    s.msg = null;
    renderAll();
  });

  $('b-target').addEventListener('click', () => {
    if (s.busy) return;
    audio.stopAll();
    audio.chord(frequencies(play().stage.target, K()));
    const star = $('stars').querySelector('.star.on');
    if (star && !reduceMotion()) { star.classList.add('twinkle'); setTimeout(() => star.classList.remove('twinkle'), 1200); }
  });

  const CHORD_REASON = {
    'need-three': '先に棒を3本選んでください。',
    open: '閉じていないので和音は鳴りません。辺をタップすると1音ずつ鳴ります。',
    'before-answer': 'この遊び方では、回答するまで自分の和音は鳴らせません。辺を1音ずつ鳴らして確かめてください。'
  };
  function mine() { return frequencies(play().selectedLengths, K()); }
  $('b-chord').addEventListener('click', () => {
    if (s.busy) return;
    const r = play().canPlayChord();
    if (!r.ok) { say(CHORD_REASON[r.reason], 'warn'); return; }
    audio.stopAll();
    audio.chord(mine());
    glow(mine());
    setTimeout(() => glow(null), 1800);
  });
  $('b-compare').addEventListener('click', () => {
    if (s.busy) return;
    const r = play().canPlayChord();
    if (!r.ok) { say(CHORD_REASON[r.reason], 'warn'); return; }
    audio.stopAll();
    audio.chord(frequencies(play().stage.target, K()), { duration: 1.4 });
    audio.chord(mine(), { delay: 1.72, duration: 1.4 });
    say('お題 → 自分の順に鳴らしています。');
    setTimeout(() => glow(mine()), 1720);
    setTimeout(() => glow(null), 3300);
  });

  const METER_REASON = {
    'need-closed': '閉じた三角形を作ってから使ってください（回数は減りません）。',
    shown: 'メーターは表示中です。棒を選び直すと消えます。',
    'none-left': 'メーターは使い切りました。'
  };
  $('b-meter').addEventListener('click', () => {
    if (s.busy) return;
    const r = play().useMeter();
    s.msg = r.ok ? null : { text: METER_REASON[r.reason], kind: 'warn' };
    renderAll();
  });

  $('b-answer').addEventListener('click', () => {
    if (s.busy) return;
    const p = play();
    if (p.finished) { start(p.mode.id); return; }
    const r = p.answer();
    if (r.result === 'need-three') { say('棒を3本選んでから回答してください。', 'warn'); return; }
    if (r.result === 'open') { say('閉じていない三角形では回答できません（失敗には数えません）。', 'warn'); return; }
    audio.stopAll();
    if (r.result === 'correct') {
      audio.chord(mine(), { duration: 2.0 });
      s.busy = true;
      s.msg = { text: `澄んだ！ ${p.index + 1}小節目は「${p.stage.label}」。`, kind: 'ok' };
      renderAll();
      glow(mine());
      setTimeout(() => afterCorrect(r), 2200);
      return;
    }
    audio.chord(mine(), { duration: 1.0 });
    shake();
    if (r.gameOver) s.msg = null;
    else s.msg = Number.isFinite(r.livesLeft)
      ? { text: `違う響きです。失敗の残り ${r.livesLeft} 回。`, kind: 'warn' }
      : { text: '違う響きです。辺を1音ずつ鳴らして、お題と比べてみてください。', kind: 'warn' };
    renderAll();
  });

  // ---------- 引き出し ----------
  const openSheet = () => { renderSheet(); $('sheet').hidden = false; };
  const closeSheet = () => { $('sheet').hidden = true; };
  $('mode-chip').addEventListener('click', openSheet);
  $('menu-button').addEventListener('click', openSheet);
  $('sheet-back').addEventListener('click', closeSheet);
  $('b-close').addEventListener('click', closeSheet);
  $('modes').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    start(b.dataset.mode);
    closeSheet();
    toast(`${MODES[b.dataset.mode].label}で遊びます`);
  });
  $('b-song').addEventListener('click', () => {
    const n = play().litFromStart;
    if (!n) { toast('まだ1小節目から灯った和音がありません'); return; }
    if (s.busy) return;
    closeSheet();
    playMusic(0, n - 1, n === BARS ? songTitle() : `キー ${keyName(play().run.key)}`);
  });
  $('carry-off').addEventListener('click', () => { s.carryOver = false; renderSheet(); });
  $('carry-on').addEventListener('click', () => { s.carryOver = true; renderSheet(); });
  $('meter-on').addEventListener('click', () => { play().setMeterToggle(true); renderAll(); renderSheet(); });
  $('meter-off').addEventListener('click', () => { play().setMeterToggle(false); renderAll(); renderSheet(); });
  $('b-reveal').addEventListener('click', () => { play().revealTarget(); s.msg = { text: '確認用：答えの棒を選びました。', kind: '' }; closeSheet(); renderAll(); });
  $('b-title').addEventListener('click', () => { audio.stopAll(); s.busy = false; closeSheet(); onTitle(); });

  requestAnimationFrame(meterLoop);
  return { start };
}
