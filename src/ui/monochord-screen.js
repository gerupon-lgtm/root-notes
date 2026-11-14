// 第1章「一弦の琴」の画面（要件6.2、F-017、AC-09。docs/design/段階4_第1章_一弦の琴.md 4章）。
// 試作 docs/prototypes/chapter1-monochord.html の配置と操作を移した。計算は src/core/monochord.js。
// - 駒（金色の三角）を指で大まかに動かし、微調整つまみ（と ◀▶）でゆっくり詰める。張りは変えない（C-01）
// - 「重ねて鳴らす」で、お題の単音と自分の弦を同時に鳴らし続ける。揺れが1秒に1回未満を1秒保ったら合格
// - 選択プレイ・フリーは揺れメーターを使える。ノーマル・エキスパートは耳で合わせる【想定】（要件6.6）
import { svg } from './svg.js';
import { woodDefs, woodBar, part } from './instrument-parts.js';
import { MONOCHORD_STAGES, OPEN_HZ, KNOB_PER_RADIAN, NUDGE, PASS_BEAT, PASS_HOLD } from '../content/monochord.js';
import { stringHz, targetHz, beatHz, holdStep, startPosition, clampBridge } from '../core/monochord.js';
import { MODES } from '../content/modes.js';
import { TIMBRES } from '../content/timbres.js';
import { BEAT_FAR_ABOVE } from '../core/pitch.js';

// 重ねて鳴らすときの音色：音量が落ちず、揺れを聞き取りやすいオルガン（仮。2026-11-14 発案者 OK。A区分）
const TIMBRE = TIMBRES.organ;
const X0 = 30, X1 = 290, Y = 92; // 弦の左端・右端・高さ（SVG の単位。viewBox 320×210）
const NEXT_AFTER_PASS_MS = 2600; // 合格のあと、次の面へ移るまで（試作と同じ）

export function createMonochordScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const root = $('lyre');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = {
    mode: MODES.free, i: 0, r: 0.8, lit: new Set(), drone: null, meterOn: true,
    hold: 0, passed: false, pluckAt: -1e9, knob: 0, dragging: false, raf: 0, last: 0,
    onDone: () => {}, onTitle: () => {}, nextTimer: 0, ended: false
  };
  const stage = () => MONOCHORD_STAGES[S.i];
  const meterAllowed = () => S.mode.id === 'select' || S.mode.id === 'free';
  const showMeter = () => meterAllowed() && S.meterOn;
  const target = () => targetHz(OPEN_HZ, stage().num, stage().den);
  const current = () => stringHz(OPEN_HZ, S.r);
  const beat = () => beatHz(current(), target());

  function say(text, kind = '') { const m = $('mono-msg'); m.textContent = text; m.className = kind; }

  // ---------- 音 ----------
  function stopDrone() {
    if (S.drone) for (const v of S.drone) v?.stop();
    S.drone = null; S.hold = 0;
    renderButtons();
  }
  function startDrone() {
    stopDrone();
    S.drone = [audio.hold(target(), TIMBRE, { level: 0.55 }), audio.hold(current(), TIMBRE, { level: 0.55 })];
    renderButtons();
  }
  function pluck() { audio.pluck(current(), 'overlap', TIMBRE); S.pluckAt = performance.now(); }
  function playTarget() { audio.chord([target()], { timbre: TIMBRE, duration: 1.6, level: 0.8 }); twinkle(); }
  function setR(r) {
    S.r = clampBridge(r);
    if (S.drone) S.drone[1]?.setHz(current());
  }

  // ---------- 一弦の琴の絵 ----------
  let parts = null;
  const bx = () => X0 + (X1 - X0) * S.r;
  function drawStatic() {
    while (root.firstChild) root.firstChild.remove();
    woodDefs(root);
    // 共鳴の胴（木の板）と目盛り（弦全体を12に分ける）
    root.append(woodBar([X0 - 14, Y + 30], [X1 + 14, Y + 30], root));
    for (let k = 1; k < 12; k++) {
      const x = X0 + ((X1 - X0) * k) / 12;
      root.append(svg('line', { x1: x, y1: Y + 40, x2: x, y2: Y + (k % 3 === 0 ? 52 : 47), class: 'lyre-tick' }));
    }
    // 合格した比を残す
    for (const s of MONOCHORD_STAGES) {
      if (!S.lit.has(s.id)) continue;
      const x = X0 + ((X1 - X0) * s.num) / s.den;
      root.append(svg('line', { x1: x, y1: Y - 34, x2: x, y2: Y + 22, class: 'lyre-mark' }));
      root.append(svg('text', { x, y: Y - 40, 'text-anchor': 'middle', class: 'lyre-mark-text' }, `${s.num}/${s.den}`));
    }
    const muted = svg('line', { x1: X0, y1: Y, x2: X1, y2: Y, class: 'lyre-muted' });
    const string = svg('polyline', { points: '', class: 'lyre-string' });
    const bridge = svg('g', { class: 'lyre-bridge' });
    bridge.append(svg('polygon', { points: '-11,24 11,24 0,-2', class: 'lyre-bridge-body' }));
    bridge.append(svg('rect', { x: -24, y: -34, width: 48, height: 82, fill: 'transparent' }));
    const ratio = svg('text', { x: 0, y: 64, 'text-anchor': 'middle', class: 'lyre-ratio' }, '');
    root.append(part('corner-brass', [X0, Y], 18, '#c9a456'), part('corner-brass', [X1, Y], 18, '#c9a456'));
    root.append(muted, string, part('string-pin', [X0, Y], 9, '#caa25a'), part('string-pin', [X1, Y], 9, '#caa25a'), bridge, ratio);
    root.append(svg('text', { x: X0 - 8, y: Y + 72, class: 'lyre-note' }, '弦全体＝1'));
    parts = { muted, string, bridge, ratio };
  }
  function drawMoving(now) {
    if (!parts) return;
    const xb = bx();
    // 振動：重ねて鳴らしているときは、メーターを出している間だけ、揺れの速さで振れ幅を変える（うなりが目に見える）
    let amp = 0;
    if (S.drone) amp = showMeter() ? 7 * Math.abs(Math.cos(Math.PI * Math.min(beat(), 20) * now / 1000)) + 1 : 4;
    const since = (now - S.pluckAt) / 1000;
    if (since < 2) amp = Math.max(amp, 8 * Math.exp(-since * 2.2));
    if (reduceMotion()) amp = 0;
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const x = X0 + ((xb - X0) * k) / 40;
      pts.push(`${x.toFixed(1)},${(Y + amp * Math.sin((Math.PI * k) / 40) * Math.sin(now / 18)).toFixed(1)}`);
    }
    parts.string.setAttribute('points', pts.join(' '));
    parts.string.classList.toggle('on', !!S.drone);
    parts.muted.setAttribute('x1', xb);
    parts.bridge.setAttribute('transform', `translate(${xb},${Y})`);
    parts.ratio.setAttribute('x', xb);
    parts.ratio.textContent = S.passed ? `${stage().num}/${stage().den}` : '';
  }

  // ---------- 揺れメーターと合格 ----------
  function renderMeter() {
    $('mono-meter').hidden = !showMeter();
    if (!showMeter()) return;
    const dot = $('mono-dot'), text = $('mono-beat');
    const b = beat();
    if (!S.drone) { dot.dataset.level = ''; text.dataset.level = ''; text.textContent = '「重ねて鳴らす」で揺れを表示'; }
    else if (b < PASS_BEAT) { dot.dataset.level = 'clear'; text.dataset.level = 'clear'; text.textContent = `澄んでいる（${b.toFixed(2)} 回/秒）`; }
    else if (b > BEAT_FAR_ABOVE) { dot.dataset.level = 'far'; text.dataset.level = 'far'; text.textContent = 'ざらざら（遠い）'; }
    else { dot.dataset.level = 'near'; text.dataset.level = 'near'; text.textContent = `揺れ ${b.toFixed(1)} 回/秒`; }
    $('mono-hold').style.width = `${(S.passed ? 1 : S.hold / PASS_HOLD) * 100}%`;
  }
  function loop(now) {
    // 1こまで数える時間は0.25秒まで（省電力で描画が減っても合格まで進む。裏に回ったあとの大きな飛びは数えない）
    const dt = Math.min(0.25, (now - (S.last || now)) / 1000);
    S.last = now;
    if (!S.passed) {
      const st = holdStep({ hold: S.hold, passed: S.passed }, { beat: beat(), dt, droning: !!S.drone });
      S.hold = st.hold;
      if (st.passed) passed();
    }
    renderMeter();
    drawMoving(now);
    S.raf = requestAnimationFrame(loop);
  }
  function passed() {
    const s = stage();
    S.passed = true;
    S.lit.add(s.id);
    renderStars(); drawStatic(); twinkle();
    say(`合った！ 弦の ${s.num}/${s.den}。${s.word}。`, 'ok');
    clearTimeout(S.nextTimer);
    S.nextTimer = setTimeout(() => {
      stopDrone();
      const rest = MONOCHORD_STAGES.findIndex((x, k) => k > S.i && !S.lit.has(x.id));
      const any = MONOCHORD_STAGES.findIndex(x => !S.lit.has(x.id));
      if (S.lit.size === MONOCHORD_STAGES.length) chapterEnd();
      else goStage(rest >= 0 ? rest : any);
    }, NEXT_AFTER_PASS_MS);
  }
  function chapterEnd() {
    S.ended = true;
    say('第1章の星がすべて灯りました。弦の長さの比 1/2・2/3・3/4・4/5・5/6 が、澄んだ響きを生みます。', 'ok');
    $('mono-actions').hidden = true;
    $('mono-end').hidden = false;
    $('mono-next').textContent = S.mode.continuous ? '次へ ▶' : '章を選ぶ';
  }

  // ---------- 表示 ----------
  let twinkleTimer = 0;
  function twinkle() {
    const on = $('mono-stars').querySelector('.star.on');
    if (!on) return;
    on.classList.add('twinkle');
    clearTimeout(twinkleTimer);
    twinkleTimer = setTimeout(() => on.classList.remove('twinkle'), 1500);
  }
  function renderStars() {
    const nav = $('mono-stars');
    nav.replaceChildren(...MONOCHORD_STAGES.map((s, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `star${k === S.i ? ' on' : ''}${S.lit.has(s.id) ? ' lit' : ''}`;
      b.dataset.i = k;
      // 連続プレイは順番に通す（灯っていない先の面へは飛べない）
      b.disabled = S.mode.continuous && k > S.i && !S.lit.has(s.id);
      b.innerHTML = `<span class="glyph">✦</span>${s.id}`;
      return b;
    }));
    $('mono-where').innerHTML = `お題：<b>${stage().name}</b>の音`;
    $('mono-count').textContent = `${S.lit.size} / ${MONOCHORD_STAGES.length}`;
  }
  function renderButtons() {
    const b = $('mono-drone');
    b.classList.toggle('on', !!S.drone);
    b.innerHTML = S.drone ? '止める' : '重ねて<br>鳴らす';
    $('mono-meter-toggle').hidden = !meterAllowed();
    $('mono-meter-toggle').innerHTML = S.meterOn ? 'メーター<br>表示' : 'メーター<br>隠す';
    $('mono-meter-toggle').setAttribute('aria-pressed', String(S.meterOn));
  }
  function drawKnob() {
    const k = $('knob');
    while (k.firstChild) k.firstChild.remove();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.append(svg('line', { x1: 50 + 41 * Math.sin(a), y1: 50 - 41 * Math.cos(a), x2: 50 + 46 * Math.sin(a), y2: 50 - 46 * Math.cos(a), class: 'knob-tick' }));
    }
    const face = svg('g', { transform: `rotate(${(S.knob * 180) / Math.PI} 50 50)` });
    face.append(part('corner-brass', [50, 50], 78, '#c9a456'));
    face.append(svg('circle', { cx: 50, cy: 20, r: 5, class: 'knob-dot' }));
    k.append(face);
  }

  function goStage(i) {
    clearTimeout(S.nextTimer);
    stopDrone();
    S.i = i; S.passed = false; S.hold = 0; S.knob = 0; S.ended = false;
    S.r = startPosition(stage().num / stage().den, Math.random);
    $('mono-actions').hidden = false;
    $('mono-end').hidden = true;
    renderStars(); renderButtons(); drawStatic(); drawKnob();
    say(meterAllowed()
      ? '駒（金色の三角）を指で動かし、「重ねて鳴らす」で揺れが消える所を、微調整つまみで探します。'
      : '駒（金色の三角）を指で動かし、「重ねて鳴らす」で揺れが消える所を、耳で探します。');
  }

  // ---------- 操作 ----------
  const svgX = e => {
    const m = root.getScreenCTM();
    if (!m) return 0;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x;
  };
  root.addEventListener('pointerdown', e => {
    audio.unlock();
    const x = svgX(e);
    if (Math.abs(x - bx()) < 30) { S.dragging = true; root.setPointerCapture(e.pointerId); }
    else if (x < bx()) pluck(); // 鳴る側をタップ＝弦をはじく
  });
  root.addEventListener('pointermove', e => {
    if (!S.dragging) return;
    setR((svgX(e) - X0) / (X1 - X0));
  });
  for (const n of ['pointerup', 'pointercancel']) root.addEventListener(n, () => { S.dragging = false; });

  // ◀▶：押している間、少しずつ動く（0.35秒で連続に）
  function holdButton(btn, step) {
    let t = 0, iv = 0;
    const end = () => { clearTimeout(t); clearInterval(iv); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); setR(S.r + step); t = setTimeout(() => { iv = setInterval(() => setR(S.r + step), 40); }, 350); });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(n, end);
  }
  holdButton($('mono-left'), -NUDGE);
  holdButton($('mono-right'), NUDGE);

  // 微調整つまみ：回した角度だけ、駒をゆっくり動かす（1回転で弦の約2.5%）
  const knob = $('knob');
  let lastAngle = null;
  const angleOf = e => { const b = knob.getBoundingClientRect(); return Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))); };
  knob.addEventListener('pointerdown', e => { knob.setPointerCapture(e.pointerId); lastAngle = angleOf(e); });
  knob.addEventListener('pointermove', e => {
    if (lastAngle === null) return;
    const a = angleOf(e);
    let d = a - lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    lastAngle = a;
    S.knob += d;
    setR(S.r + d * KNOB_PER_RADIAN);
    drawKnob();
  });
  for (const n of ['pointerup', 'pointercancel']) knob.addEventListener(n, () => { lastAngle = null; });
  knob.addEventListener('keydown', e => {
    const step = { ArrowRight: NUDGE, ArrowUp: NUDGE, ArrowLeft: -NUDGE, ArrowDown: -NUDGE }[e.key];
    if (step) { setR(S.r + step); S.knob += step / KNOB_PER_RADIAN; drawKnob(); e.preventDefault(); }
  });

  $('mono-target').addEventListener('click', playTarget);
  $('mono-pluck').addEventListener('click', pluck);
  $('mono-drone').addEventListener('click', () => (S.drone ? stopDrone() : startDrone()));
  $('mono-meter-toggle').addEventListener('click', () => { S.meterOn = !S.meterOn; renderButtons(); });
  $('mono-stars').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b && !b.disabled) goStage(Number(b.dataset.i));
  });
  $('mono-title').addEventListener('click', () => { stop(); S.onTitle(); });
  $('mono-end-title').addEventListener('click', () => { stop(); S.onTitle(); });
  $('mono-next').addEventListener('click', () => { stop(); S.onDone(); });

  function stop() {
    clearTimeout(S.nextTimer);
    stopDrone();
    cancelAnimationFrame(S.raf);
    S.raf = 0;
  }

  // 第1章を始める。mode：MODES の名前。onDone：章が終わって「次へ」を押したとき。onTitle：タイトルへ戻るとき
  function start(modeId, { onDone = () => {}, onTitle = () => {} } = {}) {
    stop();
    S.mode = MODES[modeId] ?? MODES.free;
    S.onDone = onDone; S.onTitle = onTitle;
    S.lit = new Set(); S.meterOn = true; S.last = 0;
    $('mono-mode').textContent = S.mode.label;
    goStage(0);
    S.raf = requestAnimationFrame(loop);
  }

  return { start, stop };
}
