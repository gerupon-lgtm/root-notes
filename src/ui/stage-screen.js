// 遊ぶ画面（段階3）。決まりは src/game/play.js、音は src/audio/engine.js、描画は triangle-view.js に任せ、
// ここは画面の部品と操作をつなぐだけにする（docs/design/段階3_三角形ステージの画面.md）
import { Play, stageTimbre, runSpecFor } from '../game/play.js';
import { buildRun } from '../core/stage-gen.js';
import { PROGRESSIONS } from '../content/progressions.js';
import { buildScore } from '../game/song.js';
import { MODES, MODE_ORDER } from '../content/modes.js';
import { TIMBRES, SONG_TIMBRE, BASS_TIMBRE } from '../content/timbres.js';
import { DISCOVERY_TEXT } from '../content/discoveries.js';
import { BARS, PHRASE } from '../content/progressions.js';
import { STAGE_RULES } from '../content/stage-rules.js';
import { frequency, frequencies, beats, beatLevel, ratioOf } from '../core/pitch.js';
import { sortLengths, lengthValue, formatLength } from '../core/length.js';
import { gcd } from '../core/integer.js';
import { colorOf, blendOf } from '../core/color.js';
import { keyLabel } from '../core/harmony.js';
import { drawEmpty, drawOpen, drawClosed } from './triangle-view.js';
import { drawStaff, markStaff } from './staff-view.js';
import { staffColumn } from '../game/notation.js';
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
  const s = { songTimbre: SONG_TIMBRE, tapMode: 'double', lastTap: null, focus: null, lastMusic: null, play: null, busy: false, carryOver: false, msg: null, playingBar: -1, heard: false, result: null, check: new URLSearchParams(location.search).has('check') };
  const svgRoot = $('tri');

  const play = () => s.play;
  const K = () => play().stage.K;
  // そのステージの音色。お題・辺の単音・自分の和音をそろえる（同じ音色でないと聞き比べにならない）
  const timbre = () => TIMBRES[stageTimbre(play().run, play().index)];
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

  // 導線：次に触る所を2回光らせる（開始の合図と同じ間合い）。一度に光らせるのは1か所だけ。
  // 動きを減らす設定では、光らせずに金色の縁を2秒ほど出す
  let flashTimer = null;
  function guide(target) {
    for (const node of document.querySelectorAll('.flash')) node.classList.remove('flash');
    clearTimeout(flashTimer);
    const nodes = (Array.isArray(target) ? target : [target]).map(t => (typeof t === 'string' ? $(t) : t)).filter(Boolean);
    for (const node of nodes) { void node.offsetWidth; node.classList.add('flash'); }
    flashTimer = setTimeout(() => { for (const node of nodes) node.classList.remove('flash'); }, 2000);
  }
  const usedTiles = () => [...document.querySelectorAll('.stick.sel')];

  // 度数とコードネームを並べる（例「IVmaj7（Fmaj7）」）。相対の度数から、進行の気づきにつなげる
  // 画面に出すキー（短調の進行は平行調の短調。例 Gm）
  const keyText = () => keyLabel(play().run.key, play().run.progression.mode);
  const chordText = stage => `${stage.label}（${stage.chordName}）`;
  const progressionLines = (from, to) => {
    const labels = play().run.stages.slice(from, to + 1).map(x => x.label);
    const stages = play().run.stages.slice(from, to + 1);
    return [`度数：${labels.join(' → ')}`, `コード：${stages.map(st => st.chordName).join(' → ')}`];
  };

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
    $('where').replaceChildren(`フレーズ${phrase}の`, el('b', {}, `${pos}つ目`), `の和音・${timbre().name}`);
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
    else drawClosed(svgRoot, sidesOf(p), { hint: !s.edgeTried });
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
    // 棒は、ステージが決めた混ぜた並び（order）で見せる。i は短い順の番号のまま
    const shownOrder = p.stage.order ?? p.stage.sticks.map((_, k) => k);
    $('sticks').replaceChildren(...shownOrder.map(i => {
      const l = p.stage.sticks[i];
      const order = p.selected.indexOf(i), focused = s.focus === i;
      // 選んでいる棒には、もう一度タップしたら何が起きるかを書く（選ぶ → 使う／外す の2段階。2026-11-14 発案者）
      // 選んでいる棒には、次に起きることを短い札で出す。使う＝金色、外す＝赤みのある色（2026-11-14 発案者）
      const intent = !focused ? '' : order >= 0 ? 'remove' : p.selected.length === 3 ? 'full' : 'use';
      const act = { remove: '外す', full: '先に外す', use: '使う' }[intent] ?? '';
      const b = el('button', { type: 'button', class: ['stick', order >= 0 && 'sel', focused && 'focus', focused && s.fading && 'fading', intent && `to-${intent}`].filter(Boolean).join(' '), 'aria-pressed': String(order >= 0), 'data-i': i, 'aria-label': `長さ ${formatLength(l)} の棒${order >= 0 ? '（使っている）' : ''}${act ? `。${act}` : ''}` },
        el('span', { class: 'num' }, formatLength(l)),
        el('span', { class: 'bar', style: `width:${(lengthValue(l) / STAGE_RULES.maxLength) * 100}%;background:${lenColor(l)}` }),
        act ? el('span', { class: 'act' }, act) : '',
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
    const answer = $('b-answer');
    answer.textContent = p.finished ? '最初から' : p.awaitingNext ? '次の星へ' : '回答する';
    for (const id of ['b-target', 'b-chord', 'b-compare', 'b-meter']) $(id).disabled = s.busy;
    // 回答する：三角形ができたときだけ押せる（2026-11-14 発案者）
    answer.disabled = s.busy || !(p.finished || p.awaitingNext || p.closed);
    // お題を聞く：まだ聞いていないステージでは金色の縁で導く
    $('b-target').classList.toggle('guide', !s.heard && !p.finished);
  }

  // ステージの始まりの合図：「お題を聞く」を2回光らせる（前作 AQUA の開始の合図と同じ時間割り）
  function startCue() {
    s.heard = false;
    s.edgeTried = false; // この星で辺に触れたか（触れるまで、辺に触れると鳴る印を出す）
    const b = $('b-target');
    b.classList.remove('cue');
    void b.offsetWidth;
    if (!reduceMotion()) b.classList.add('cue');
  }

  function songTitle() { return `${play().run.progression.name}（キー ${keyText()}）`; }

  function renderSheet() {
    const p = play();
    $('modes').replaceChildren(...MODE_ORDER.map(id => el('button', { type: 'button', class: id === p.mode.id ? 'on' : '', 'data-mode': id }, MODES[id].label)));
    $('mode-desc').textContent = p.mode.desc;
    const n = p.litFromStart;
    const info = $('song-info');
    const lines = (from, to) => progressionLines(from, to).flatMap(line => [el('br'), line]);
    if (p.lit.size === BARS) info.replaceChildren(el('b', {}, songTitle()), ...lines(0, BARS - 1));
    else if (n >= PHRASE) info.replaceChildren(`キー ${keyText()}。ここまで（曲名は8つの星がそろうと分かります）`, ...lines(0, n - 1));
    else info.textContent = '4つの星を灯すと、フレーズが聴けます。';
    for (const b of document.querySelectorAll('[data-song-timbre]')) b.classList.toggle('on', b.dataset.songTimbre === s.songTimbre);
    for (const b of document.querySelectorAll('[data-tap-mode]')) b.classList.toggle('on', b.dataset.tapMode === s.tapMode);
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

  // ---------- 五線譜（曲を流すとき） ----------
  function showStaff(from, to) {
    const p = play();
    drawStaff($('staff'), p.run.stages.slice(from, to + 1).map(st => ({ ...staffColumn(st, p.run.key), bar: st.bar + 1 })), p.run.key, -1);
    $('staff-panel').hidden = false;
  }
  const hideStaff = () => { $('staff-panel').hidden = true; };
  $('staff-panel').addEventListener('click', hideStaff);
  // コード進行を聞き直す（2026-11-14 発案者）。最後に流したフレーズ・1曲をもう一度流す。結果のトーストから選ぶ（譜面には置かない）
  function replay() {
    if (s.busy || !s.lastMusic) return;
    const { from, to, title } = s.lastMusic;
    playMusic(from, to, title);
  }

  // ---------- 曲 ----------
  function playMusic(from, to, title, done = () => {}) {
    const p = play();
    s.busy = true;
    audio.stopAll();
    renderAll();
    const labels = p.run.stages.slice(from, to + 1).map(x => x.label);
    s.lastMusic = { from, to, title };
    showStaff(from, to);
    audio.playScore(buildScore(p.run.stages, from, to, { carryOver: s.carryOver }), {
      chordTimbre: TIMBRES[s.songTimbre],
      bassTimbre: TIMBRES[BASS_TIMBRE],
      onBar: bar => {
        s.playingBar = bar;
        renderStars();
        markStaff($('staff'), bar - from);
        const msg = $('msg');
        msg.className = '';
        msg.replaceChildren(`♪ ${title}　`, ...labels.flatMap((l, j) => [j ? ' → ' : '', from + j === bar ? el('span', { class: 'now' }, chordText(p.run.stages[bar])) : l]));
      },
      onEnd: () => { s.playingBar = -1; s.busy = false; markStaff($('staff'), -1); done(); renderAll(); }
    });
  }

  // ---------- 結果のトースト（前作 AQUA・PRISM の結果のトーストに合わせる） ----------
  // 正解も不正解も同じ形。画面の下の操作欄に重ねて出し、次にすることのボタンを置く。×・トーストの外に触れる・Esc で閉じる
  function showResult(kind, r) {
    const p = play();
    const bar = p.index + 1, label = p.stage.label;
    let head, body, buttons, showKey = false;
    if (kind === 'correct') {
      showKey = true; // キーは大事なので、見出しの横に札で出す（2026-11-14 発案者）
      const song = r.music?.kind === 'song', phrase = r.music?.kind === 'phrase';
      // 「澄んだ！」から変更（2026-11-14 発案者）。星を灯す遊びなので「星が灯った」
      head = song ? '1曲できあがり' : '星が灯った';
      // 度数とコードネームを並べる（相対の度数から、進行の気づきにつなげる。2026-11-14 発案者）
      body = song
        ? [p.run.progression.name, ...progressionLines(0, BARS - 1)]
        : [`${bar}小節目は ${label} ＝ ${p.stage.chordName}`,
           ...(phrase ? [`フレーズ${r.music.from / PHRASE + 1}がそろいました`, ...progressionLines(r.music.from, r.music.to)] : [])];
      // 章の流れ（連続プレイ）の中では、8つの星がそろったら次の場面へ（段階4。src/ui/flow-screen.js）
      if (p.mode.continuous) buttons = bar !== BARS ? [['next', '次の星へ ▶', true]]
        : s.onChapterEnd ? [['chapter-next', '次へ ▶', true], ['title', 'タイトルへ']]
        : [['restart', '新しい曲で遊ぶ', true], ['title', 'タイトルへ']];
      else buttons = p.nextBar() === null ? [['close', '閉じる', true]] : [['next', '次の星へ ▶', true], ['close', 'この星に残る']];
    } else if (r.gameOver) {
      head = 'ゲームオーバー';
      body = ['失敗の上限に達しました。新しい曲でもう一度挑戦できます。'];
      buttons = [['restart', '最初から', true], ['title', 'タイトルへ']];
    } else {
      head = '違う響き';
      body = [`${Number.isFinite(r.livesLeft) ? `失敗の残り ${r.livesLeft} 回。` : ''}辺を1音ずつ鳴らして、お題と比べてみよう。`];
      buttons = [['retry', 'もう一度', true]];
    }
    s.result = kind;
    const t = $('result-toast');
    t.className = `result-toast ${kind === 'correct' ? 'ok' : 'ng'}`;
    t.replaceChildren(
      // 見出し（「1曲できあがり」とキーの行）の右に「もう一度聴く」（フレーズや1曲がそろったとき。2026-11-14 発案者）
      el('div', { class: 'result-head' },
        el('div', { class: 'result-title' }, el('h3', {}, head, showKey ? el('span', { class: 'key-badge' }, `キー ${keyText()}`) : '')),
        r?.music ? el('button', { type: 'button', class: 'replay', 'data-act': 'replay' }, '▶ もう一度聴く') : '',
        el('button', { type: 'button', class: 'close', 'data-act': 'close', 'aria-label': '閉じる' }, '×')),
      // 2行目は横幅いっぱいに使う（ジャズの度数は長いので、1行に収めるため）
      el('p', { class: 'first-line' }, body[0]),
      ...body.slice(1).map(line => el('p', { class: 'sub-line' }, line)),
      el('div', { class: 'result-actions' }, ...buttons.map(([act, text, primary]) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', 'data-act': act }, text))));
    t.hidden = false;
    placeResult();
  }
  function placeResult() {
    const t = $('result-toast');
    if (t.hidden) return;
    const top = $('sticks').getBoundingClientRect(), bottom = $('actions-row').getBoundingClientRect();
    t.style.left = `${top.left}px`;
    t.style.width = `${top.width}px`;
    t.style.bottom = `${Math.max(0, innerHeight - bottom.bottom)}px`;
    t.style.maxHeight = `${bottom.bottom - top.top + 40}px`;
  }
  // 閉じたあと、次にすることを光らせる（goNext・start から閉じるときは光らせない）
  function closeResult({ guideNext = false } = {}) {
    const t = $('result-toast');
    if (t.hidden) return;
    t.hidden = true;
    const kind = s.result;
    s.result = null;
    if (!guideNext || !s.play) return;
    const p = play();
    if (p.finished || p.awaitingNext) guide('b-answer'); // 「最初から」「次の星へ」
    else if (kind === 'wrong') guide('b-target'); // お題を聞き直して比べる
  }
  function goNext() {
    const p = play();
    closeResult();
    audio.stopAll();
    if (p.mode.continuous) p.advance();
    else {
      const bar = p.nextBar();
      if (bar !== null) p.goTo(bar);
    }
    s.msg = null;
    s.focus = null;
    hideStaff();
    startCue();
    renderAll();
  }
  $('result-toast').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    if (act === 'next') goNext();
    else if (act === 'replay') { closeResult(); replay(); return; }
    else if (act === 'restart') { closeResult(); start(play().mode.id); }
    else if (act === 'title') { closeResult(); audio.stopAll(); onTitle(); }
    else if (act === 'chapter-next') { closeResult(); audio.stopAll(); s.onChapterEnd?.(); return; }
    else closeResult({ guideNext: true });
    renderAll();
  });
  document.addEventListener('pointerdown', e => {
    if (!$('result-toast').hidden && !e.target.closest('#result-toast')) closeResult({ guideNext: true });
  }, { capture: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeResult({ guideNext: true }); });
  addEventListener('resize', placeResult);

  function afterCorrect(result) {
    const p = play();
    const done = () => { s.busy = false; renderAll(); showResult('correct', result); };
    if (result.music?.kind === 'song') playMusic(0, BARS - 1, songTitle(), done);
    else if (result.music?.kind === 'phrase') playMusic(result.music.from, result.music.to, `キー ${keyText()}`, done);
    else done();
  }

  // ---------- 操作 ----------
  // options：章の流れから始めるときに渡す（onChapterEnd：8つの星がそろって「次へ」を押したとき。null なら章の流れの外）。
  // 画面の中からの始め直し（遊び方の切り替え・最初から）は options を渡さず、今の流れを保つ
  function start(modeId, options) {
    if (options) s.onChapterEnd = options.onChapterEnd ?? null;
    audio.stopAll();
    // 確認用：?check&prog=進行の記号 で、連続プレイをその進行で始める（実機で進行を試すため）
    const forced = s.check ? new URLSearchParams(location.search).get('prog') : null;
    s.play = forced && MODES[modeId].continuous && PROGRESSIONS.some(x => x.id === forced)
      ? new Play(modeId, buildRun({ ...runSpecFor(modeId, Math.random), progression: forced }))
      : Play.start(modeId);
    s.busy = false; s.msg = null; s.playingBar = -1; s.focus = null;
    closeResult();
    hideStaff();
    renderMeterRows();
    startCue();
    renderAll();
  }

  // 選んでいる棒は、タップから3秒で外す（同じ棒をもう一度タップしたら数え直す）。残り1秒から色を薄くする
  const DOUBLE_TAP_MS = 350, PREVIEW_MS = 1100, FOCUS_MS = 3000, FADE_MS = 1000;
  let focusToken = 0;
  function focusFor(i) {
    s.focus = i;
    s.fading = false;
    const token = ++focusToken;
    clearTimeout(s.fadeTimer);
    clearTimeout(s.focusTimer);
    s.fadeTimer = setTimeout(() => {
      if (token !== focusToken || s.focus !== i) return;
      s.fading = true;
      document.querySelector(`.stick[data-i="${i}"]`)?.classList.add('fading');
    }, FOCUS_MS - FADE_MS);
    s.focusTimer = setTimeout(() => {
      if (token !== focusToken || s.focus !== i) return;
      s.focus = null;
      s.fading = false;
      s.msg = null;
      renderSticks();
      renderStatus();
    }, FOCUS_MS);
  }

  $('sticks').addEventListener('click', e => {
    const b = e.target.closest('.stick');
    if (!b || s.busy || play().finished || play().awaitingNext) return;
    const i = Number(b.dataset.i), p = play();
    const used = p.selected.includes(i), full = !used && p.selected.length === 3;
    // 棒の操作（2026-11-14 発案者と確かめた流れ。docs/design/段階3 の v0.8.8）
    // - second（2回タップ）：1回目で選ぶ（試聴）、2回目（間があいてもよい）で使う・外す
    // - double（ダブルタップ）：タップで選ぶ（試聴がすぐ始まる）。0.35秒以内の2回目で使う・外す（鳴っている試聴は止める）。
    //   0.35秒より後のタップは、新しいダブルタップの1回目として受ける
    // - 試聴中（試聴が始まってから1.1秒）は、同じ棒をタップしても音を新たに鳴らさない（どちらの操作でも）
    // - どちらも、タップから3秒で選択が外れる。同じ棒をもう一度タップしたら数え直す。残り1秒から少しずつ色を薄くする
    const now = performance.now();
    const quick = s.lastTap && s.lastTap.i === i && now - s.lastTap.t < DOUBLE_TAP_MS;
    const act = s.tapMode === 'double' ? quick : s.focus === i;
    s.lastTap = { i, t: now };
    if (!act) {
      const previewing = s.preview && s.preview.i === i && now < s.preview.until;
      if (!previewing) { // 試聴中（1.1秒）は同じ棒を鳴らし直さない。2回タップでも同じ（2026-11-14 発案者：案A）
        s.preview = { i, until: now + PREVIEW_MS, voice: audio.pluck(hz(p.stage.sticks[i]), p.sustain, timbre()) };
      }
      focusFor(i);
      const how = s.tapMode === 'double' ? 'ダブルタップ' : 'もう一度タップ';
      s.msg = full ? { text: '3本そろっています。先に外す棒を選んでください。', kind: 'warn' }
        : { text: `${formatLength(p.stage.sticks[i])} を選んでいます。${how}で${used ? '外します' : '使います'}。`, kind: '' };
      renderSticks();
      renderStatus();
      if (full) guide(usedTiles()); // そろっているときは、先に外す棒へ導く
      return;
    }
    s.lastTap = null;
    // ダブルタップで使う・外すときは、鳴っている試聴を止める
    if (s.tapMode === 'double' && s.preview?.i === i) { s.preview.voice?.stop(); s.preview = null; }
    // 使う・外す。3本そろっているときは勝手に入れ替えない
    if (full) { guide(usedTiles()); return; }
    hideStaff();
    if (used) p.remove(i); else p.use(i);
    s.focus = null;
    s.msg = null;
    for (const d of p.lastFound) toast(`発見：${DISCOVERY_TEXT[d].title}`);
    renderAll();
    // 3本で閉じたら三角形（辺をなぞって確かめる）、閉じなかったら使っている棒（外して選び直す）を光らせる
    if (p.ready) guide(p.closed ? document.querySelector('.board') : usedTiles());
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
    audio.pluck(hz(l), play().sustain, timbre());
    ringSide(k);
    if (!s.edgeTried) { s.edgeTried = true; for (const h of svgRoot.querySelectorAll('.tap-hint')) h.remove(); }
  }
  svgRoot.addEventListener('pointerdown', e => { if (s.busy || !play().ready) return; tracing = true; lastK = null; touchSide(sideAt(e.clientX, e.clientY)); });
  svgRoot.addEventListener('pointermove', e => { if (tracing) touchSide(sideAt(e.clientX, e.clientY)); });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) svgRoot.addEventListener(name, () => { tracing = false; lastK = null; });

  $('stars').addEventListener('click', e => {
    const b = e.target.closest('.star');
    if (!b || s.busy || play().mode.continuous) return;
    audio.stopAll();
    closeResult();
    hideStaff();
    s.focus = null;
    play().goTo(Number(b.dataset.bar));
    s.msg = null;
    startCue();
    renderAll();
  });

  $('b-target').addEventListener('click', () => {
    if (s.busy) return;
    audio.stopAll();
    audio.chord(frequencies(play().stage.target, K()), { timbre: timbre() });
    if (!s.heard) { s.heard = true; renderActions(); if (!play().ready) setTimeout(() => guide('sticks'), 400); }
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
    audio.chord(mine(), { timbre: timbre() });
    glow(mine());
    setTimeout(() => glow(null), 1800);
  });
  $('b-compare').addEventListener('click', () => {
    if (s.busy) return;
    const r = play().canPlayChord();
    if (!r.ok) { say(CHORD_REASON[r.reason], 'warn'); return; }
    audio.stopAll();
    audio.chord(frequencies(play().stage.target, K()), { timbre: timbre(), duration: 1.4 });
    audio.chord(mine(), { timbre: timbre(), delay: 1.72, duration: 1.4 });
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
    if (p.awaitingNext) { goNext(); return; }
    const r = p.answer();
    if (r.result === 'need-three') { say('棒を3本選んでから回答してください。', 'warn'); return; }
    if (r.result === 'open') { say('閉じていない三角形では回答できません（失敗には数えません）。', 'warn'); return; }
    audio.stopAll();
    if (r.result === 'correct') {
      audio.chord(mine(), { timbre: timbre(), duration: 2.0 });
      s.busy = true;
      s.msg = { text: `星が灯った！ ${p.index + 1}小節目は ${chordText(p.stage)}。`, kind: 'ok' };
      renderAll();
      glow(mine());
      // フレーズや1曲がそろったら和音の余韻のあとに流し、終わってから結果を出す。そうでなければ少し聞かせてから出す
      setTimeout(() => afterCorrect(r), r.music ? 2200 : 900);
      return;
    }
    audio.chord(mine(), { timbre: timbre(), duration: 1.0 });
    shake();
    s.msg = r.gameOver ? null : { text: '違う響きです。', kind: 'warn' };
    renderAll();
    setTimeout(() => showResult('wrong', r), 600);
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
    playMusic(0, n - 1, n === BARS ? songTitle() : `キー ${keyText()}`);
  });
  $('song-timbres').addEventListener('click', e => { const b = e.target.closest('[data-song-timbre]'); if (b) { s.songTimbre = b.dataset.songTimbre; renderSheet(); } });
  $('tap-modes').addEventListener('click', e => { const b = e.target.closest('[data-tap-mode]'); if (b) { s.tapMode = b.dataset.tapMode; s.focus = null; s.lastTap = null; renderSheet(); renderSticks(); } });
  $('carry-off').addEventListener('click', () => { s.carryOver = false; renderSheet(); });
  $('carry-on').addEventListener('click', () => { s.carryOver = true; renderSheet(); });
  $('meter-on').addEventListener('click', () => { play().setMeterToggle(true); renderAll(); renderSheet(); });
  $('meter-off').addEventListener('click', () => { play().setMeterToggle(false); renderAll(); renderSheet(); });
  $('b-reveal').addEventListener('click', () => { s.focus = null; play().revealTarget(); s.msg = { text: '確認用：答えの棒を選びました。', kind: '' }; closeSheet(); renderAll(); });
  $('b-title').addEventListener('click', () => { audio.stopAll(); s.busy = false; closeSheet(); onTitle(); });

  requestAnimationFrame(meterLoop);
  return { start };
}
