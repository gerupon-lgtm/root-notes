// 最終章の遊ぶ画面（要件6.4。試作 docs/prototypes/final-chapter.html と同じ流れ。2026-11-15 発案者と決定）。
// 門：門の響きを聞く → 手持ちの辺をタップで聞き比べ（与えられた2辺と重ねて鳴らせるのはフリー・選択プレイだけ）→ 1本を差し出す。
// 扉：同じ長さの扉用2本を選んで「直角に開く」。直角三角形が開き、各辺に正方形を描いて面積の関係（36＋36＝72）を見せる。
// 画面は章末の謎と同じ枠組み（上に絵、下に辺とボタン）。辺はコードで描く木の棒
import { svg } from './svg.js';
import { woodDefs, woodBar, part, PIN } from './instrument-parts.js';
import { storyArt } from '../content/story.js';
import { GATES, FINAL_K } from '../content/final.js';
import { TIMBRES } from '../content/timbres.js';
import { resultDelayMs } from './timing.js';

const W = 320, ROW = 40, TOP = 8;
const hz = n => FINAL_K / n;
const GATE_BG = ['temple-three-gates-000', 'temple-three-gates-100', 'temple-three-gates-110', 'temple-three-gates-111'];

export function createFinalScreen({ audio }) {
  const $ = id => document.getElementById(id);
  const picture = $('final-picture'), bars = $('final-bars'), guide = $('final-guide');
  const listen = $('final-listen'), mine = $('final-mine'), offer = $('final-offer'), open = $('final-open'), next = $('final-next');
  let P = null, opts = null, chosen = [], mode = 'free', after = null, busy = false, waitTimer = 0;
  // 差し出した和音を鳴らし終えてから次の場面へ移るまでの待ち（和音 1.6秒＋判定のあとの待ち（設定）。2026-11-15 発案者「音がブツっと切れる」）
  const offerRingMs = () => 1600 + resultDelayMs();

  const canHearMine = () => mode === 'free' || mode === 'select';
  function picture1(art) {
    const img = document.createElement('img');
    img.src = storyArt(art); img.alt = ''; img.className = 'story-layer'; img.style.left = '0'; img.style.top = '0'; img.style.width = '100%';
    picture.replaceChildren(img);
  }
  // 辺の並び：rows = [{ n, label, given, door }]。given は門の辺（選べない）
  function drawRows(rows) {
    while (bars.firstChild) bars.firstChild.remove();
    woodDefs(bars);
    const max = 24;
    rows.forEach((r, k) => {
      const y = TOP + 18 + k * ROW, w = Math.max(30, (r.n / max) * 210);
      const p = [16, y], q = [16 + w, y], sp = [p[0] + 8, y - 8], sq = [q[0] - 8, y - 8];
      const g = svg('g', { class: `riddle-row${r.given ? ' given' : ''}${r.door ? ' door' : ''}`, 'data-k': r.k ?? -1 });
      g.append(svg('rect', { x: 4, y: y - ROW / 2 + 1, width: W - 8, height: ROW - 4, rx: 8, class: 'riddle-sel' }));
      g.append(woodBar(p, q, bars));
      g.append(svg('line', { x1: sp[0], y1: sp[1], x2: sq[0], y2: sq[1], class: 'riddle-string' }));
      g.append(part('string-pin', sp, PIN * 2, '#caa25a'), part('string-pin', sq, PIN * 2, '#caa25a'));
      g.append(svg('text', { x: q[0] + 10, y: y + 5, class: 'tri-label riddle-label' }, `${r.n}`));
      g.append(svg('text', { x: W - 10, y: y + 5, 'text-anchor': 'end', class: 'final-tag' }, r.label));
      if (!r.given) g.append(svg('rect', { x: 0, y: y - ROW / 2, width: W, height: ROW, class: 'riddle-hit', fill: 'transparent' }));
      bars.append(g);
    });
    bars.setAttribute('viewBox', `0 0 ${W} ${TOP + 18 + rows.length * ROW - 10}`);
  }
  function mark() { for (const row of bars.querySelectorAll('.riddle-row')) row.classList.toggle('chosen', chosen.includes(Number(row.dataset.k))); }

  // ---------- 門 ----------
  function showGate() {
    const g = P.current;
    chosen = [];
    picture1(GATE_BG[P.opened.length]);
    guide.textContent = `${g.name}の門：門の響きを聞いて、同じ和音になる弦を手持ちから1本差し出そう。差し出した弦はなくなります。`;
    const rows = [
      ...g.given.map(n => ({ n, label: '門の辺', given: true })),
      ...P.hand.map((h, k) => ({ n: h.n, label: h.door ? '扉用' : h.tag, door: h.door, k }))
    ];
    drawRows(rows);
    listen.hidden = false; listen.disabled = false; mine.hidden = !canHearMine(); offer.hidden = false; open.hidden = true; next.hidden = true;
    render();
  }
  const gateChord = g => [...g.given, g.answer].map(hz);
  function render() {
    mark();
    if (P.atDoor) { open.disabled = chosen.length !== 2; return; }
    const ok = chosen.length === 1 && !P.hand[chosen[0]]?.door;
    offer.disabled = !ok; mine.disabled = !ok;
  }

  // ---------- 扉 ----------
  function showDoor() {
    chosen = [];
    picture1('temple-final-door-closed');
    guide.textContent = '最後の扉：巻物の言葉「ひとしき二本を、直角に開け」。同じ長さの2本を選んで、直角に開こう。';
    drawRows(P.hand.map((h, k) => ({ n: h.n, label: h.door ? '扉用' : h.tag, door: h.door, k })));
    listen.hidden = true; mine.hidden = true; offer.hidden = true; open.hidden = false; next.hidden = true;
    render();
  }
  // 直角に開いた三角形と、各辺の正方形（F-011）
  function drawRight(n) {
    while (bars.firstChild) bars.firstChild.remove();
    const s = 9, ox = 120, oy = 150; // 1単位の長さ、直角の頂点
    const A = [ox, oy], B = [ox + n * s, oy], C = [ox, oy - n * s];
    const sq = (p, q, cls, label) => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const r = [q[0] - dy, q[1] + dx], t = [p[0] - dy, p[1] + dx];
      bars.append(svg('polygon', { points: `${p} ${q} ${r} ${t}`, class: cls }));
      bars.append(svg('text', { x: (p[0] + r[0]) / 2, y: (p[1] + r[1]) / 2 + 5, 'text-anchor': 'middle', class: 'final-area' }, label));
    };
    // 正方形は三角形の外側へ（p→q の右手側に作る）
    sq(A, B, 'final-sq', `${n * n}`); // 下の辺
    sq(C, A, 'final-sq', `${n * n}`); // 左の辺
    sq(B, C, 'final-sq hyp', `${2 * n * n}`); // 斜辺
    bars.append(svg('polygon', { points: `${A} ${B} ${C}`, class: 'final-tri' }));
    bars.append(svg('text', { x: 160, y: 18, 'text-anchor': 'middle', class: 'final-area' }, `${n * n} ＋ ${n * n} ＝ ${2 * n * n}　斜辺は ${n}√2`));
    bars.setAttribute('viewBox', '0 0 320 260');
  }

  // 揺れ終わったら「揺れ」の印を外す（付けたままだと、画面を出し直したときにもう一度揺れる。遊ぶ画面と同じ直し方）
  picture.addEventListener('animationend', () => picture.classList.remove('shake'));
  bars.addEventListener('pointerdown', e => {
    const row = e.target.closest('.riddle-row');
    if (!row || !P || busy || row.classList.contains('given')) return;
    const k = Number(row.dataset.k);
    if (k < 0) return;
    if (P.atDoor) chosen = chosen.includes(k) ? chosen.filter(x => x !== k) : [...chosen, k].slice(-2);
    else chosen = [k];
    audio.pluckGut(hz(P.hand[k].n), { sustain: 'cut' });
    render();
  });
  listen.addEventListener('click', () => { audio.stopAll(); audio.chord(gateChord(P.current), { timbre: TIMBRES.epiano, duration: 2 }); });
  mine.addEventListener('click', () => {
    if (chosen.length !== 1) return;
    audio.stopAll(); audio.chord([...P.current.given, P.hand[chosen[0]].n].map(hz), { timbre: TIMBRES.epiano, duration: 2 });
  });
  offer.addEventListener('click', () => {
    if (chosen.length !== 1 || busy) return;
    audio.stopAll();
    const g = P.current, r = P.offer(chosen[0]);
    audio.chord([...g.given, r.used.n].map(hz), { timbre: TIMBRES.epiano, duration: 1.6 });
    // 門が開く・ZAP のときは、和音を鳴らし終えてから紙芝居へ移る（紙芝居は始めに音を止めるため、すぐ移ると音が切れていた）
    const then = r.result === 'open' ? () => opts?.onGateOpen(r) : r.zap.length ? () => opts?.onZap(r.zap) : null;
    if (then) {
      busy = true; listen.disabled = mine.disabled = offer.disabled = true;
      guide.textContent = r.result === 'open' ? '門が、響きに応えています……' : '門の響きが、乱れています……';
      waitTimer = setTimeout(() => { busy = false; then(); }, offerRingMs());
      return;
    }
    guide.textContent = `門は応えません。長さ ${r.used.n} の弦は、門に残りました。もう一度、門の響きを聞いてみよう。`;
    picture.classList.remove('shake'); void picture.offsetWidth; picture.classList.add('shake'); // 揺れ終わったら外す（下の animationend）
    showGateRows();
  });
  function showGateRows() {
    const g = P.current; chosen = [];
    drawRows([...g.given.map(n => ({ n, label: '門の辺', given: true })), ...P.hand.map((h, k) => ({ n: h.n, label: h.door ? '扉用' : h.tag, door: h.door, k }))]);
    render();
  }
  open.addEventListener('click', () => {
    if (chosen.length !== 2) return;
    const [i, j] = chosen, n = P.hand[i].n;
    audio.stopAll();
    if (!P.openDoor(i, j)) {
      guide.textContent = '扉は動きません。同じ長さの2本を選ぼう（巻物「ひとしき二本を」）。';
      audio.chord([P.hand[i].n, P.hand[j].n].map(hz), { timbre: TIMBRES.epiano, duration: 1 });
      return;
    }
    drawRight(n);
    guide.textContent = `直角に開くと、2つの辺の正方形を合わせた広さが、新しい辺の正方形と同じになりました（${n * n}＋${n * n}＝${2 * n * n}）。整数では書けない長さ、${n}√2 が生まれました。`;
    audio.chord([hz(n), hz(n), hz(n * Math.SQRT2)], { timbre: TIMBRES.epiano, duration: 2.6, strum: 0.08 });
    open.hidden = true; next.hidden = false;
    after = opts.onDoor;
  });
  next.addEventListener('click', () => { const cb = after; after = null; cb?.(); });
  $('final-title').addEventListener('click', () => { const cb = opts?.onTitle; stop(); cb?.(); });

  // play：FinalPlay。modeId：遊び方（自分の和音を鳴らせるのはフリー・選択プレイだけ）
  function start(play, { modeId, onGateOpen, onZap, onDoor, onTitle }) {
    P = play; mode = modeId; opts = { onGateOpen, onZap, onDoor, onTitle };
    $('final-place').textContent = '最終章　神殿の奥';
    if (P.atDoor) showDoor(); else showGate();
  }
  function stop() { clearTimeout(waitTimer); busy = false; audio.stopAll(); opts = null; }
  return { start, stop };
}
