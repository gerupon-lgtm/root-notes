// 第1章「一弦の琴」の画面（要件6.2、F-017、AC-09。docs/design/段階4_第1章_一弦の琴.md 4章）。
// 試作 docs/prototypes/chapter1-monochord.html の配置と操作を移した。計算は src/core/monochord.js。
// - 駒（金色の三角）を指で大まかに動かし、微調整つまみ（と ◀▶）でゆっくり詰める。張りは変えない（C-01）
// - 「重ねて鳴らす」で、お題の単音と自分の弦を同時に鳴らし続ける。揺れが1秒に1回未満を1秒保ったら合格
// - 選択プレイ・フリーは揺れメーターを使える。ノーマル・エキスパートは耳で合わせる【想定】（要件6.6）
// - 導線（2026-11-14 発案者）：1-1 は案内つきの練習（チュートリアル。前作 PRISM・AQUA の形：案内の帯、光の縁、指先の輪のお手本）。
//   初めての1回は自動で出し、見出しの「案内」とタイトルの「チュートリアル」から見直せる。
//   1-2〜1-5 は、次にする所を2回光らせる（お題 → はじく → 駒・つまみ → 重ねて鳴らす）
import { svg } from './svg.js';
import { woodDefs, woodBar, part } from './instrument-parts.js';
import { MONOCHORD_STAGES, OPEN_HZ, KNOB_PER_RADIAN, NUDGE, PASS_BEAT, PASS_HOLD } from '../content/monochord.js';
import { stringHz, targetHz, beatHz, holdStep, startPosition, clampBridge } from '../core/monochord.js';
import { MODES } from '../content/modes.js';
import { TIMBRES } from '../content/timbres.js';
import { BEAT_FAR_ABOVE } from '../core/pitch.js';
import { CH1_STEPS, CH1_CLEAR, CH1_FLASH, STEP_IDS, ACTIONS, FINE_BEAT, advanceStep, readNext, nextAction } from '../content/tutorial.js';
import { TutorialBook } from '../game/tutorial-book.js';
import { artPath } from '../content/assets.js';

// 端末の保存場所（使えない端末では null。案内の記録は保存できなくても遊べる）
function localStore() { try { return globalThis.localStorage ?? null; } catch { return null; } }

// 重ねて鳴らすときの音色：音量が落ちず、揺れを聞き取りやすいオルガン（仮。2026-11-14 発案者 OK。A区分）
const TIMBRE = TIMBRES.organ;
const X0 = 30, X1 = 290, Y = 92; // 弦の左端・右端・高さ（SVG の単位。viewBox 320×210）
// 駒の持ち手：駒から軸を下へ伸ばし、胴と目盛りより下に丸い持ち手を付ける（2026-11-14 発案者「指でコマを動かすと位置が隠れて見づらい。
// 少し下にもつかめるものを付けて、位置を見ながら操作できるように。コマ自体でも動かせるように」）。弦の高さからの距離
const GRIP_DY = 86, GRIP_SIZE = 24;
// 合格したら、揺れの消えた星の音と弦の音を一度だけ鳴らし、結果のトーストを出す。次の面へは「次の星へ」を押したときだけ進む
// （2026-11-14 発案者：第2章と同じ「トースト表示して、次へ進む形」。旧：2.6秒で自動で次の面へ）
const PASS_CHORD_SECONDS = 1.8;

export function createMonochordScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const root = $('lyre');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = {
    mode: MODES.free, i: 0, r: 0.8, lit: new Set(), drone: null, meterOn: true,
    hold: 0, passed: false, pluckAt: -1e9, knob: 0, dragging: false, raf: 0, last: 0,
    onDone: () => {}, onTitle: () => {}, nextTimer: 0, ended: false,
    // 導線：step は今の手順（CH1_STEPS の番号）。tutorial は案内つきのとき 'auto'（初めて）・'replay'（「案内」）・'title'（タイトルから）
    step: 0, tutorial: null, touching: false, endLabel: null, pendingMove: false, grabDx: 0, guideMin: 0,
    // fine：手順「揺れを消そう」で、揺れが遅くなってつまみの仕上げに切り替えたか。flashDone：光の導線で済んだ操作の数（ACTIONS の番号）
    fine: false, flashDone: 0
  };
  const book = new TutorialBook(localStore());
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
    reach('drone');
  }
  function pluck() { audio.pluck(current(), 'overlap', TIMBRE); S.pluckAt = performance.now(); reach('pluck'); }
  function playTarget() {
    audio.chord([target()], { timbre: TIMBRE, duration: 1.6, level: 0.8 });
    twinkle();
    $('mono-target').classList.remove('guide');
    reach('target');
  }
  // 駒を動かした（ドラッグ・◀▶・つまみ・キー）
  const moved = () => reach('move');
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
    // 合格した比を残す。ただし、いま遊んでいる面の印は出さない（合格前は見直しで答えが見えてしまうため。合格後は駒の上の比の表示と重なるため）
    for (const s of MONOCHORD_STAGES) {
      if (!S.lit.has(s.id) || s.id === stage().id) continue;
      const x = X0 + ((X1 - X0) * s.num) / s.den;
      root.append(svg('line', { x1: x, y1: Y - 34, x2: x, y2: Y + 22, class: 'lyre-mark' }));
      root.append(svg('text', { x, y: Y - 40, 'text-anchor': 'middle', class: 'lyre-mark-text' }, `${s.num}/${s.den}`));
    }
    const muted = svg('line', { x1: X0, y1: Y, x2: X1, y2: Y, class: 'lyre-muted' });
    const string = svg('polyline', { points: '', class: 'lyre-string' });
    const bridge = svg('g', { class: 'lyre-bridge', id: 'mono-bridge' });
    bridge.append(svg('circle', { cx: 0, cy: 10, r: 20, class: 'lyre-bridge-halo' }));
    bridge.append(svg('circle', { cx: 0, cy: GRIP_DY, r: 18, class: 'lyre-bridge-halo' }));
    // 持ち手の軸（駒の下から持ち手まで）と、持ち手（既存の真鍮の金具の絵。新しい絵は作らない）
    bridge.append(svg('line', { x1: 0, y1: 24, x2: 0, y2: GRIP_DY - GRIP_SIZE / 2 + 2, stroke: '#b19a73', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    bridge.append(svg('polygon', { points: '-11,24 11,24 0,-2', class: 'lyre-bridge-body' }));
    bridge.append(part('corner-brass', [0, GRIP_DY], GRIP_SIZE, '#c9a456'));
    bridge.append(svg('rect', { x: -24, y: -34, width: 48, height: 82, fill: 'transparent' }));
    bridge.append(svg('rect', { x: -28, y: GRIP_DY - 26, width: 56, height: 52, fill: 'transparent' }));
    const ratio = svg('text', { x: 0, y: 64, 'text-anchor': 'middle', class: 'lyre-ratio' }, '');
    root.append(part('corner-brass', [X0, Y], 18, '#c9a456'), part('corner-brass', [X1, Y], 18, '#c9a456'));
    root.append(muted, string, part('string-pin', [X0, Y], 9, '#caa25a'), part('string-pin', [X1, Y], 9, '#caa25a'), bridge, ratio);
    root.append(svg('text', { x: X0 - 8, y: Y + 72, class: 'lyre-note' }, '弦全体＝1'));
    parts = { muted, string, bridge, ratio };
    drawMoving(performance.now());
    renderCoach();
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
    // 案内：揺れが遅くなってきたら、つまみの仕上げの案内に切り替える（一度切り替えたら戻さない。文が行き来しないように）
    if (S.tutorial && !S.passed && !S.fine && S.drone && STEP_IDS[S.step] === 'move' && beat() < FINE_BEAT) {
      S.fine = true; renderGuide(); renderCoach();
    }
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
    S.onLit?.([...S.lit]); // 保存（段階7）
    // 重ねた音を止め、合った2音を一度だけ鳴らす
    const both = [target(), current()];
    stopDrone();
    audio.chord(both, { timbre: TIMBRE, duration: PASS_CHORD_SECONDS, strum: 0, level: 0.7 });
    renderStars(); drawStatic(); twinkle();
    say(`合った！ 弦の ${s.num}/${s.den}。`, 'ok');
    clearTimeout(S.nextTimer);
    // 案内つきの練習：帯は「チュートリアルクリア！」の表示だけにし、「次へ」はトーストにそろえる（2026-11-14 発案者）
    if (S.tutorial) { book.complete('ch1'); renderGuide(); renderCoach(); }
    showToast();
  }
  // 結果のトースト。buttons は [動き, 文言, 主ボタンか]
  function showToast() {
    const s = stage(), all = S.lit.size === MONOCHORD_STAGES.length;
    const toEnd = S.endLabel ?? (S.mode.continuous ? '次へ ▶' : '章を選ぶ');
    let head = '星が灯った', lines = [`${s.id} は ${s.name} ＝ 弦の ${s.num}/${s.den}`, `${s.word}。`], buttons;
    if (S.tutorial === 'title' && !all) buttons = [['next', '第1章を続ける ▶', true], ['title', 'タイトルへ']];
    else if (all) {
      head = '第1章の星がすべて灯った';
      lines = [...lines, '弦の長さの比 1/2・2/3・3/4・4/5・5/6 が、澄んだ響きを生みます。'];
      buttons = toEnd === 'タイトルへ' ? [['done', 'タイトルへ', true]] : [['done', toEnd, true], ['title', 'タイトルへ']];
    } else if (S.mode.continuous) buttons = [['next', '次の星へ ▶', true]];
    else buttons = [['next', '次の星へ ▶', true], ['close', 'この星に残る']];
    // チュートリアル：何をやっていたかのまとめ（チューニング・一つにまとまる）と、1-2からの手がかり
    if (S.tutorial) lines = [lines[0], CH1_CLEAR.text, CH1_CLEAR.note];
    const el = (tag, attrs = {}, ...kids) => {
      const x = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
      x.append(...kids);
      return x;
    };
    const t = $('mono-toast');
    t.replaceChildren(
      el('div', { class: 'result-head' },
        el('div', { class: 'result-title' }, el('h3', {}, head)),
        el('button', { type: 'button', class: 'close', 'data-act': 'close', 'aria-label': '閉じる' }, '×')),
      el('p', { class: 'first-line' }, lines[0]),
      ...lines.slice(1).map(line => el('p', { class: 'sub-line' }, line)),
      el('div', { class: 'result-actions' }, ...buttons.map(([act, text, primary]) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', 'data-act': act }, text))));
    t.hidden = false;
    placeToast();
  }
  // 操作欄（微調整と下のボタン）に重ねて出す（第2章の結果のトーストと同じ置き方）
  function placeToast() {
    const t = $('mono-toast');
    if (t.hidden) return;
    const top = document.querySelector('#mono-screen .tune').getBoundingClientRect(), bottom = $('mono-actions').getBoundingClientRect();
    t.style.left = `${top.left}px`;
    t.style.width = `${top.width}px`;
    t.style.bottom = `${Math.max(0, innerHeight - bottom.bottom)}px`;
    t.style.maxHeight = `${bottom.bottom - top.top + 40}px`;
  }
  const hideToast = () => { $('mono-toast').hidden = true; };
  // 章の終わり（保存から、全部灯った第1章に戻ったとき）
  function chapterEnd() {
    S.ended = true;
    S.passed = true;
    showToast();
  }
  // 次の面（今より後ろで灯っていない面。なければ前から）
  function nextUnlit() {
    const rest = MONOCHORD_STAGES.findIndex((x, k) => k > S.i && !S.lit.has(x.id));
    return rest >= 0 ? rest : MONOCHORD_STAGES.findIndex(x => !S.lit.has(x.id));
  }

  // ---------- 導線（案内の帯・光の縁・お手本・光らせる） ----------
  const targetEl = id => (id === 'bridge' ? parts?.bridge : $(id));
  const guiding = () => !!S.tutorial && !S.passed;
  // 今の手順の文と光らせる所（「揺れを消そう」は、仕上げに切り替えたら fine の文に）
  const stepCopy = () => { const st = CH1_STEPS[S.step]; return S.fine && st.fine ? { ...st, ...st.fine } : st; };
  // 帯に文を入れる。clear はクリアの文
  function fillGuide(copy, { count, clear = false, read = false }) {
    $('mono-guide-count').textContent = count;
    $('mono-guide-heading').textContent = copy.heading;
    $('mono-guide-text').textContent = copy.text;
    $('mono-guide-note').textContent = copy.note;
    $('mono-guide-skip').hidden = clear;
    $('mono-guide-next').hidden = !read; // 解説の手順だけ「次へ」（クリアの「次へ」はトースト）
    $('mono-guide-next').textContent = '次へ ▶';
    $('mono-guide-title').hidden = true;
  }
  // 帯の高さ：全部の手順（仕上げ・クリアを含む）の中でいちばん高い高さに固定する。手順が変わっても盤面が動かないように
  // （PRISM の案内の帯と同じ考え方。2026-11-14 発案者「画面の位置が急に変わる」）。画面の大きさが変わったら測り直す
  function lockGuideHeight() {
    const bar = $('mono-guide');
    bar.style.minHeight = '';
    const copies = [...CH1_STEPS.map(st => [st, st.kind === 'read']), ...CH1_STEPS.filter(st => st.fine).map(st => [{ ...st, ...st.fine }, false]), [CH1_CLEAR, false]];
    let max = 0;
    for (const [copy, read] of copies) {
      fillGuide(copy, { count: '0 / 0', read });
      max = Math.max(max, bar.offsetHeight);
    }
    S.guideMin = max;
    bar.style.minHeight = `${max}px`;
  }
  // 案内の帯
  function renderGuide() {
    const bar = $('mono-guide');
    bar.hidden = !S.tutorial;
    if (!S.tutorial) return;
    const progress = $('mono-guide-progress');
    if (progress.children.length !== CH1_STEPS.length) progress.replaceChildren(...CH1_STEPS.map(() => document.createElement('i')));
    $('mono-guide-text').style.minHeight = '';
    $('mono-guide-note').style.minHeight = '';
    // 精霊（重ねて聞く・うなりの解説・揺れを消す は「耳を澄ます」、クリアは「ほほえむ」）は、高さを測る前に出す（精霊の幅の分だけ文の行数が変わるため）
    const id = STEP_IDS[S.step];
    const clear = S.passed;
    const spirit = artPath(clear ? 'guide-spirit-smiling' : ['drone', 'about-beat', 'move'].includes(id) ? 'guide-spirit-listening' : 'guide-spirit-normal');
    const img = $('mono-guide-spirit');
    img.hidden = !spirit;
    if (spirit && img.getAttribute('src') !== spirit) img.src = spirit;
    if (!S.guideMin) lockGuideHeight();
    const copy = clear ? CH1_CLEAR : stepCopy();
    bar.classList.toggle('clear', clear);
    fillGuide(copy, { count: clear ? 'CLEAR' : `${S.step + 1} / ${CH1_STEPS.length}`, clear, read: !clear && copy.kind === 'read' });
    [...progress.children].forEach((seg, k) => {
      seg.className = clear || k < S.step ? 'done' : k === S.step ? 'current' : '';
    });
  }
  // 案内で今触る所に、光の縁を出し続ける
  function renderCoach() {
    for (const el of document.querySelectorAll('#mono-screen .coach-target')) el.classList.remove('coach-target');
    if (guiding()) for (const id of stepCopy().targets) targetEl(id)?.classList.add('coach-target');
    renderDemo();
  }
  // 指先の輪のお手本（PRISM の tutorial-guide.js と同じ考え方）。触っている間は止め、離したら戻す。動きを減らす設定では止まった印
  function renderDemo() {
    for (const el of document.querySelectorAll('#mono-screen .demo-finger')) el.remove();
    const demo = guiding() && !S.touching ? stepCopy().demo : null;
    if (!demo) return;
    const still = reduceMotion();
    const dur = demo === 'bridge' ? '3.2s' : '2.4s';
    const finger = (host, d, at) => {
      const g = svg('g', { class: 'demo-finger', 'aria-hidden': 'true' });
      g.append(svg('path', { d, class: 'demo-path' }));
      const ring = svg('g', still ? { transform: `translate(${at[0]} ${at[1]})` } : {});
      ring.append(svg('circle', { r: 11, class: 'demo-ring' }), svg('circle', { r: 3.5, class: 'demo-center' }));
      if (!still) {
        ring.append(svg('animateMotion', { path: d, dur, repeatCount: 'indefinite' }));
        ring.append(svg('animate', { attributeName: 'opacity', values: '0;1;1;1;0', keyTimes: '0;0.1;0.5;0.85;1', dur, repeatCount: 'indefinite' }));
      }
      g.append(ring);
      host.append(g);
    };
    if (demo === 'bridge' && parts) {
      // 持ち手の上で、指が左右へ動かすお手本（答えの向きは示さない）
      const xb = bx(), y = Y + GRIP_DY;
      finger(root, `M${xb} ${y} L${Math.min(X1, xb + 45)} ${y} L${Math.max(X0, xb - 45)} ${y} L${xb} ${y}`, [xb, y]);
    } else if (demo === 'knob') {
      // つまみの縁に沿って回すお手本
      finger($('knob'), 'M50 16 A34 34 0 0 1 84 50 A34 34 0 0 1 50 84', [50, 16]);
    }
  }
  // 操作をしたら次の手順へ。案内つきなら帯と縁を更新し、そうでなければ次にする所を2回光らせる
  function reach(action) {
    if (S.passed) return;
    // 駒やつまみを触っている間は、次の手順へ切り替えない（案内が変わって画面が動くと、指の下の駒がずれるため。2026-11-14 発案者）。
    // 指を離したときに進める
    if (action === 'move' && S.touching) { S.pendingMove = true; return; }
    // 光の導線（案内なしの面）：今の操作か、それより先の操作をしたら、次の操作の場所を光らせる
    const done = ACTIONS.indexOf(action);
    const flashNext = done >= S.flashDone;
    if (flashNext) S.flashDone = done + 1;
    const before = S.step;
    S.step = advanceStep(S.step, action);
    if (S.tutorial) { if (S.step !== before) { renderGuide(); renderCoach(); } }
    else if (flashNext) { const next = nextAction(action); if (next) flash(CH1_FLASH[next]); }
  }
  let flashTimer = 0;
  function flash(ids) {
    for (const el of document.querySelectorAll('#mono-screen .flash')) el.classList.remove('flash');
    parts?.bridge.classList.remove('flash-bridge');
    clearTimeout(flashTimer);
    const els = ids.map(id => [id, targetEl(id)]).filter(([, el]) => el);
    for (const [id, el] of els) {
      const cls = id === 'bridge' ? 'flash-bridge' : 'flash';
      el.classList.remove(cls);
      void el.getBoundingClientRect();
      el.classList.add(cls);
    }
    flashTimer = setTimeout(() => { for (const [, el] of els) el.classList.remove('flash', 'flash-bridge'); }, 2000);
  }
  // 面の始まりの合図：「お題を聞く」を2回光らせ、聞くまで金色の縁を残す（三角形の章と同じ）。案内つきのときは光の縁で示す
  function startCue() {
    const b = $('mono-target');
    b.classList.add('guide');
    b.classList.remove('cue');
    void b.offsetWidth;
    if (!reduceMotion() && !S.tutorial) b.classList.add('cue');
  }
  function startTutorial(kind) {
    goStage(0, { tutorial: kind });
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
    renderDemo();
  }

  // tutorial：この面を案内つきにするか（1-1 だけ）。渡さなければ案内なし
  function goStage(i, { tutorial = null } = {}) {
    hideToast();
    clearTimeout(S.nextTimer);
    stopDrone();
    S.i = i; S.passed = false; S.hold = 0; S.knob = 0; S.ended = false; S.step = 0; S.fine = false; S.flashDone = 0;
    S.tutorial = i === 0 ? tutorial : null;
    S.r = startPosition(stage().num / stage().den, Math.random);
    $('mono-actions').hidden = false;
    $('mono-end').hidden = true;
    renderStars(); renderButtons(); renderGuide(); drawStatic(); drawKnob();
    if (S.tutorial) say('');
    else say(meterAllowed()
      ? 'お題を聞き、弦をはじき、「重ねて鳴らす」。駒を動かして揺れが消え、2つの音が一つにまとまる所を探します（メーターも使えます）。'
      : 'お題を聞き、弦をはじき、「重ねて鳴らす」。駒を動かして揺れが消え、2つの音が一つにまとまる所を、耳で探します。');
    startCue();
  }

  // ---------- 操作 ----------
  const svgPoint = e => {
    const m = root.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  };
  const touch = on => {
    S.touching = on;
    if (!on && S.pendingMove) { S.pendingMove = false; reach('move'); }
    renderDemo();
  };
  addEventListener('resize', () => { S.guideMin = 0; if (S.tutorial) renderGuide(); });
  root.addEventListener('pointerdown', e => {
    audio.unlock();
    const { x, y } = svgPoint(e);
    const dx = x - bx();
    const onBridge = Math.abs(dx) < 30 && y > Y - 34 && y < Y + 48;
    const onGrip = Math.abs(dx) < 30 && Math.abs(y - (Y + GRIP_DY)) < 28;
    if (onBridge || onGrip) {
      // つかんだ所と駒の差を保って動かす（つかんだ瞬間に駒が指の位置へ飛ばないように）
      S.dragging = true; S.grabDx = dx;
      root.setPointerCapture(e.pointerId);
      touch(true);
    } else if (x < bx() && y < Y + 40) pluck(); // 駒より左の弦の近くをタップ＝弦をはじく
  });
  root.addEventListener('pointermove', e => {
    if (!S.dragging) return;
    setR((svgPoint(e).x - S.grabDx - X0) / (X1 - X0));
    moved();
  });
  for (const n of ['pointerup', 'pointercancel']) root.addEventListener(n, () => { if (S.dragging) { S.dragging = false; touch(false); } });

  // ◀▶：押している間、少しずつ動く（0.35秒で連続に）
  function holdButton(btn, step) {
    let t = 0, iv = 0;
    const end = () => { clearTimeout(t); clearInterval(iv); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      // 指が少しずれても押し続けられるように、離すまで受け取る
      try { btn.setPointerCapture(e.pointerId); } catch { /* 受け取れない端末 */ }
      setR(S.r + step); moved();
      t = setTimeout(() => { iv = setInterval(() => setR(S.r + step), 40); }, 350);
    });
    for (const n of ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture']) btn.addEventListener(n, end);
    btn.addEventListener('contextmenu', e => e.preventDefault()); // 長押しのメニューを出さない
  }
  holdButton($('mono-left'), -NUDGE);
  holdButton($('mono-right'), NUDGE);

  // 微調整つまみ：回した角度だけ、駒をゆっくり動かす（1回転で弦の約2.5%）
  const knob = $('knob');
  let lastAngle = null;
  const angleOf = e => { const b = knob.getBoundingClientRect(); return Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))); };
  knob.addEventListener('pointerdown', e => { knob.setPointerCapture(e.pointerId); lastAngle = angleOf(e); touch(true); });
  knob.addEventListener('pointermove', e => {
    if (lastAngle === null) return;
    const a = angleOf(e);
    let d = a - lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    lastAngle = a;
    S.knob += d;
    setR(S.r + d * KNOB_PER_RADIAN);
    moved();
    drawKnob();
  });
  for (const n of ['pointerup', 'pointercancel']) knob.addEventListener(n, () => { if (lastAngle !== null) { lastAngle = null; touch(false); } });
  knob.addEventListener('keydown', e => {
    const step = { ArrowRight: NUDGE, ArrowUp: NUDGE, ArrowLeft: -NUDGE, ArrowDown: -NUDGE }[e.key];
    if (step) { setR(S.r + step); S.knob += step / KNOB_PER_RADIAN; moved(); drawKnob(); e.preventDefault(); }
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
  $('mono-guide-open').addEventListener('click', () => startTutorial('replay'));
  $('mono-guide-skip').addEventListener('click', () => {
    book.skip('ch1');
    S.tutorial = null;
    renderGuide(); renderCoach();
    say('案内をスキップしました。見出しの「案内」から、いつでも見直せます。');
    const next = ACTIONS[S.flashDone];
    if (next && !S.passed) flash(CH1_FLASH[next]);
  });
  // 解説の手順の「次へ」
  $('mono-guide-next').addEventListener('click', () => {
    if (!S.tutorial || S.passed) return;
    S.step = readNext(S.step);
    renderGuide(); renderCoach();
  });
  $('mono-guide-title').addEventListener('click', () => { stop(); S.onTitle(); });
  $('mono-toast').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    if (act === 'close') { hideToast(); return; }
    if (act === 'title') { hideToast(); stop(); S.onTitle(); return; }
    if (act === 'done') { hideToast(); stop(); S.onDone(); return; }
    if (act === 'next') {
      hideToast();
      S.tutorial = null;
      const next = nextUnlit();
      if (next < 0) chapterEnd(); else goStage(next);
    }
  });
  addEventListener('resize', placeToast);
  $('mono-end-title').addEventListener('click', () => { stop(); S.onTitle(); });
  $('mono-next').addEventListener('click', () => { stop(); S.onDone(); });

  function stop() {
    hideToast();
    clearTimeout(S.nextTimer);
    stopDrone();
    cancelAnimationFrame(S.raf);
    S.raf = 0;
  }

  // 第1章を始める。mode：MODES の名前。onDone：章が終わって「次へ」を押したとき。onTitle：タイトルへ戻るとき。
  // tutorial：タイトルの「チュートリアル」から入ったとき true（1-1 を案内つきで始める）。endLabel：章の終わりのボタンの文言
  // lit：前に灯した面（保存から。段階7）。onLit：面が灯ったとき（保存へ）。灯っていない最初の面から始め、全部灯っていれば章の終わり
  function start(modeId, { onDone = () => {}, onTitle = () => {}, tutorial = false, endLabel = null, lit = [], onLit = null } = {}) {
    stop();
    S.mode = MODES[modeId] ?? MODES.free;
    S.onDone = onDone; S.onTitle = onTitle; S.endLabel = endLabel; S.onLit = onLit;
    S.lit = new Set(tutorial ? [] : lit.filter(id => MONOCHORD_STAGES.some(s => s.id === id)));
    S.meterOn = true; S.last = 0; S.touching = false;
    $('mono-mode').textContent = tutorial ? 'チュートリアル' : S.mode.label;
    const first = MONOCHORD_STAGES.findIndex(s => !S.lit.has(s.id));
    if (first > 0 || first < 0) goStage(Math.max(0, first));
    else goStage(0, { tutorial: tutorial ? 'title' : book.shouldAuto('ch1') ? 'auto' : null });
    if (first < 0) chapterEnd();
    S.raf = requestAnimationFrame(loop);
  }

  return { start, stop };
}
