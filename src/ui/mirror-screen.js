// 第3章「光の響きから影の琴へ」の画面（Codex 試作 v0.5.0 の動きと文を本体へ。2026-11-15 発案者と決定）。
// 形は紙芝居の画面にそろえる（上・左に絵、下・右に精霊の語りとボタン）。絵の中は試作と同じく SVG で描く（480×360）。
// 音はグラスハープ（各段1秒、消えずに。2026-11-15 発案者）。自動では次の場面へ進まず「つづき ▶」。停止・場面移動・タイトルで音と予約を止める
import { MIRROR_STAGES, MIRROR_SHADOW_SIDE, mirrorModel } from '../content/mirror-explain.js';
import { storyArt } from '../content/story.js';
import { TIMBRES } from '../content/timbres.js';
import { drawClosed } from './triangle-view.js';
import { svg } from './svg.js';
import { len } from '../core/length.js';

// 影の琴（最後の場面）：棒が三角形に集まったあと、第2章と同じ三角形の表示（木枠・金具・弦・辺の長さ）へフェードで変える
// （2026-11-15 発案者）。第2章の絵（320×210）を TRI_SCALE 倍にして、この画面（480×360）の中に置く。棒はその三角形の木枠の位置へ集まる
const TRI_W = 320, TRI_SCALE = 1.15, TRI_X = 240 - (TRI_W / 2) * TRI_SCALE, TRI_Y = 280 - 188 * TRI_SCALE;
// drawClosed と同じ置き方（最長辺を底辺、幅 250・高さ 150 に収める、底辺の高さ 188）で、3つの角をこの画面の座標で返す
function closedCorners(lengths) {
  const [a, b, c] = [...lengths].sort((x, y) => x - y);
  const x = (b * b + c * c - a * a) / (2 * c), y = Math.sqrt(Math.max(0, b * b - x * x));
  const minX = Math.min(0, x), maxX = Math.max(c, x);
  const sc = Math.min(250 / (maxX - minX), 150 / Math.max(y, 1e-6));
  const ox = TRI_W / 2 - ((minX + maxX) / 2) * sc, oy = 188;
  const at = (px, py) => ({ x: TRI_X + px * TRI_SCALE, y: TRI_Y + py * TRI_SCALE });
  // A・B は底辺（長さ c）、C は頂点。辺 BC が a、CA が b
  return { a, b, c, A: at(ox, oy), B: at(ox + c * sc, oy), C: at(ox + x * sc, oy - y * sc) };
}

const YS = [105, 185, 265];
const clamp = x => Math.min(1, Math.max(0, x));
const ease = x => x * x * (3 - 2 * x);
const txt = (x, y, v, size = 21, color = '#f2e9d8', anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${v}</text>`;
const mark = (i, y) => `<path class="attention-mark" data-row="${i}" d="M18 ${y - 10} l14 10 -14 10 Z" fill="#dfc98f" stroke="#fff0bf" stroke-width=".7"/>`;
function star(x, y, c, on = true, i = -1) {
  const a = on ? 1 : 0.06;
  return `<g class="star" data-row="${i}" data-lit="${on}" transform="translate(${x} ${y})"><circle r="24" fill="${c}" opacity="${on ? 0.2 : 0.015}"/><path d="M0 -15 L4 -4 L15 0 L4 4 L0 15 L-4 4 L-15 0 L-4 -4 Z" fill="${c}" opacity="${a}"/></g>`;
}

export function createMirrorScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const stageSvg = $('mirror-stage'), startBtn = $('mirror-start'), stopBtn = $('mirror-stop'), nextBtn = $('mirror-next');
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let m = null, rows = [], phase = 0, side = 0, progress = 0, running = false, raf = 0, runId = 0, phaseStart = 0, opts = null;

  function moment(i, t) {
    const local = t - 0.35 - i * 1.5, n = rows[i].ticks;
    const counting = local >= 0 && local < 1, active = local >= 0 && local < 1.5;
    const count = local < 0 ? 0 : local >= 1 ? n : Math.min(n, Math.floor(local * n) + 1);
    const on = counting && (local * n) % 1 < 0.48;
    return { count, active, on };
  }

  // 第2章と同じ三角形の表示（影の琴の弦）。場面ごとに1回だけ組み立てて、描き直しのたびに重ねる
  let triView = null, triFor = null, fade = 0;
  function closedView() {
    if (triView && triFor === m) return triView;
    const box = svg('svg', { id: 'mirror-tri', x: TRI_X, y: TRI_Y, width: TRI_W * TRI_SCALE, height: 210 * TRI_SCALE, viewBox: `0 0 ${TRI_W} 210`, overflow: 'visible', class: 'mirror-tri' });
    drawClosed(box, rows.map((r, k) => ({ length: len(r.target.length), color: r.color, k })));
    const fill = box.querySelector('#tri-fill'); // 遊ぶ画面の三角形と同じ名前にしない（色は style.css の .mirror-tri-fill）
    fill?.removeAttribute('id'); fill?.setAttribute('class', 'mirror-tri-fill');
    triView = box; triFor = m;
    return box;
  }

  function render() {
    fade = 0;
    const st = MIRROR_STAGES[phase], t = (progress * st.duration) / 1000;
    const comparison = phase === 3, isShadow = comparison && side === 1;
    const heading = phase === 0 ? '星の響き' : phase === 1 ? '光の響き' : phase === 2 ? '星のかけらを弦へ' : comparison ? (isShadow ? '弦の長さの比' : '音の高さの比') : '影の琴';
    let s = '<defs><linearGradient id="mirror-wood" x2="0" y2="1"><stop stop-color="#efdbad"/><stop offset="1" stop-color="#9f713c"/></linearGradient></defs>';
    s += '<rect width="480" height="360" fill="#031d1a" opacity=".62"/>';
    s += txt(240, 32, heading, 24, '#e5ce94', 'middle');
    if (comparison) s += txt(240, 62, m.ticks.join('：'), 23, '#e5ce94', 'middle');
    const W = Math.min(33, 230 / Math.max(...m.ticks)); // かけら1つの幅（数が多いときは詰める）
    if (phase <= 1 || (comparison && !isShadow)) {
      rows.forEach((r, i) => {
        const mo = moment(i, t), selected = phase !== 1 && mo.active, on = phase === 1 || calm() ? true : mo.on;
        if (selected) s += mark(i, YS[i]);
        s += star(65, YS[i], r.color, on, i) + txt(102, YS[i] + 7, `${r.note}の星`, 22, r.color);
        s += txt(340, YS[i] + 8, phase === 0 ? `${mo.count} / ${r.ticks}` : r.ticks, 27, r.color);
        if (phase === 1) s += `<path d="M210 ${YS[i]} q12 -14 24 0 t24 0 t24 0" fill="none" stroke="${r.color}" stroke-width="2"/>`;
      });
      s += txt(240, 338, phase === 0 ? '一つずつ、同じ1秒間で' : phase === 1 ? '同じ刻みの比から、光の響きへ' : `${rows.map(r => r.note).join('・')}　— 光の響き`, 18, '#b8ccbb', 'middle');
    } else if (phase === 2 || isShadow) {
      rows.forEach((r, i) => {
        const mo = moment(i, t), n = phase === 2 ? mo.count : r.ticks, y = YS[i];
        if (mo.active) s += mark(i, y);
        if (phase === 2) {
          s += star(60, y, r.color, calm() || mo.on, i) + txt(90, y + 6, r.note, 20, r.color);
          for (let k = 0; k < n; k++) s += `<rect class="piece" x="${145 + k * W}" y="${y - 9}" width="${W - 3}" height="18" rx="3" fill="url(#mirror-wood)" stroke="${r.color}"/>`;
          s += txt(435, y + 7, `${n}個`, 18, r.color);
        } else {
          s += txt(50, y + 7, r.ticks, 27, r.color);
          s += `<line x1="105" y1="${y}" x2="${105 + r.ticks * W}" y2="${y}" stroke="#b38b54" stroke-width="10" stroke-linecap="round"/><line x1="105" y1="${y}" x2="${105 + r.ticks * W}" y2="${y}" stroke="${r.color}" stroke-width="2"/>`;
          s += txt(370, y - 8, r.target.note, 24, r.color) + txt(370, y + 18, `長さ${r.target.length}`, 15, '#bdcfbd');
        }
      });
      s += txt(240, 338, phase === 2 ? 'かけらの数を、そのまま長さに' : `${rows.map(r => r.target.note).join('・')}　— 影の響き`, 18, '#b8ccbb', 'middle');
    } else {
      const { a, b, A, B, C } = closedCorners(rows.map(r => r.target.length));
      const mix = calm() ? (progress > 0.5 ? 1 : 0) : ease(clamp((progress - 0.12) / 0.5));
      // 集まりきったら、第2章の三角形の表示へフェードで変える（動きを減らす設定では、すぐ変える）
      fade = calm() ? (progress > 0.5 ? 1 : 0) : ease(clamp((progress - 0.66) / 0.18));
      s += `<g opacity="${1 - fade}">`;
      s += `<path d="M${A.x} ${A.y} L${B.x} ${B.y} L${C.x} ${C.y} Z" fill="#d8c8ed" opacity="${0.13 * mix}"/>`;
      rows.forEach((r, i) => {
        const ends = r.target.length === a ? [B, C] : r.target.length === b ? [C, A] : [A, B], lerp = (p, q) => p + (q - p) * mix;
        const x1 = lerp(145, ends[0].x), x2 = lerp(145 + r.ticks * W, ends[1].x), y1 = lerp(YS[i], ends[0].y), y2 = lerp(YS[i], ends[1].y);
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b38b54" stroke-width="11" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${r.color}" stroke-width="3"/>`;
      });
      s += '</g>';
      s += txt(240, 338, `${rows.map(r => r.target.note).join('・')}　— 影の響き`, 21, '#e4cd94', 'middle');
    }
    stageSvg.innerHTML = s;
    if (phase === 4 && fade > 0) { const tri = closedView(); tri.setAttribute('opacity', fade); stageSvg.append(tri); }
    stageSvg.setAttribute('aria-label', heading);
    $('mirror-place').textContent = `光から影へ　${phase + 1} / 5${comparison ? `・${side === 0 ? '光' : '影'}` : ''}`;
    $('mirror-spirit').src = storyArt(phase === 1 ? 'spirit-listening' : phase === 4 ? 'spirit-smiling' : 'spirit-normal');
    $('mirror-title').textContent = isShadow ? MIRROR_SHADOW_SIDE.title : st.title;
    $('mirror-text').textContent = isShadow ? MIRROR_SHADOW_SIDE.text : st.text(m);
    $('mirror-hint').textContent = isShadow ? MIRROR_SHADOW_SIDE.hint(m) : st.hint(m);
    $('mirror-compare').hidden = phase !== 4 || running;
    for (const [i, b] of [...document.querySelectorAll('#mirror-steps button')].entries()) b.setAttribute('aria-current', i === phase ? 'step' : 'false');
    const last = phase === 4 && progress >= 1 && !running;
    startBtn.innerHTML = running ? 'もう一度' : progress >= 1 ? 'つづき <span aria-hidden="true">▶</span>' : '響きをたどる <span aria-hidden="true">▶</span>';
    startBtn.hidden = last;
    nextBtn.hidden = !last;
    stopBtn.disabled = !running;
  }

  function stopRun() { running = false; runId++; cancelAnimationFrame(raf); audio.stopAll(); }
  function schedule() {
    audio.stopAll();
    const sustain = (hz, at) => audio.chord([hz], { timbre: TIMBRES.glass, delay: 0.06 + at, duration: 1, strum: 0, level: 0.7 });
    if (phase === 0 || phase === 2 || phase === 3) rows.forEach((r, i) => sustain(phase === 3 && side === 1 ? r.target.frequency : r.frequency, 0.35 + i * 1.5));
    if (phase === 1) audio.mirrorPulses(m.ticks, m.accelerationFactor);
    if (phase === 4) audio.chord(m.shadowFrequencies, { timbre: TIMBRES.glass, delay: 1.8, duration: 1.25, strum: 0.04, level: 0.6 });
  }
  function frame(now, id) {
    if (!running || id !== runId) return;
    progress = clamp((now - phaseStart) / MIRROR_STAGES[phase].duration);
    render();
    if (progress >= 1) { running = false; audio.stopAll(); render(); return; }
    raf = requestAnimationFrame(tm => frame(tm, id));
  }
  function startRun() {
    let next = phase, nextSide = side;
    if (!running && progress >= 1) { if (phase === 3 && side === 0) nextSide = 1; else { next = Math.min(4, phase + 1); nextSide = 0; } }
    stopRun();
    const id = runId;
    phase = next; side = nextSide; progress = 0; running = true; phaseStart = performance.now() + 60;
    schedule(); render();
    raf = requestAnimationFrame(tm => frame(tm, id));
  }
  function seek(n) { stopRun(); phase = n; side = 0; progress = 0; render(); }

  startBtn.addEventListener('click', () => { if (opts) startRun(); });
  stopBtn.addEventListener('click', () => { stopRun(); render(); });
  $('mirror-steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b && opts) seek(Number(b.dataset.index)); });
  $('mirror-light').addEventListener('click', () => { audio.stopAll(); audio.chord(m.lightFrequencies, { timbre: TIMBRES.glass, duration: 1.2, strum: 0.04, level: 0.6 }); });
  $('mirror-shadow').addEventListener('click', () => { audio.stopAll(); audio.chord(m.shadowFrequencies, { timbre: TIMBRES.glass, duration: 1.2, strum: 0.04, level: 0.6 }); });
  const finish = () => { if (!opts) return; const cb = opts.onDone; stop(); cb(); };
  nextBtn.addEventListener('click', finish);
  $('mirror-skip').addEventListener('click', finish);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { stopRun(); render(); } });

  // light・shadow：辺の長さ、K：基準の音。canSkip：「飛ばす」を出すか。endLabel：最後のボタン
  function play({ light, shadow, K }, { canSkip = false, endLabel = '星へもどる', onDone }) {
    m = mirrorModel(light, shadow, K);
    rows = m.rows;
    opts = { onDone };
    $('mirror-steps').innerHTML = MIRROR_STAGES.map((st, i) => `<button type="button" data-index="${i}">${st.label}</button>`).join('');
    $('mirror-skip').hidden = !canSkip;
    nextBtn.innerHTML = `${endLabel} <span aria-hidden="true">▶</span>`;
    phase = 0; side = 0; progress = 0; running = false;
    render();
  }
  function stop() { stopRun(); opts = null; }
  return { play, stop };
}
