// 三角形の描画。三角の木枠の内側に弦を張った、架空の楽器として描く（2026-11-14 発案者。タイトルの絵と同じ考え方）。
// 形は選んだ棒の長さで毎回変わるので、1枚の絵ではなく、Codex の部品（木目・角の金具・ピン）をコードで組み立てる。
// - 閉じるとき：最長辺を底辺にした三角形。外側に木枠、角に丸い金具、内側に少し離して色の弦、弦の両端にピン
// - 閉じないとき：選んだ棒を木の棒として並べ、その上に弦を張る（三角形にならない＝崩れた形。F-002）
// 弦（.side）は光らせたり揺らしたりする対象。なぞりやすいように、太い透明の当たり（.hit）を弦に重ねる。data-k は選んだ棒の何本目か
import { svg } from './svg.js';
import { lengthValue, formatLength } from '../core/length.js';
import { STAGE_RULES } from '../content/stage-rules.js';
import { artPath } from '../content/assets.js';

const W = 320, H = 210;
const FRAME = 12; // 木枠の太さ（SVG の単位）
const WOOD_TILE = 192; // 木目1枚を並べる長さ（Codex の見本と同じ 192×12）
const CORNER = 22, PIN = 8; // 金具とピンの大きさ
const INSET = 17; // 木枠から弦までの間（Codex の見本と同じ）

function clear(root) { while (root.firstChild) root.firstChild.remove(); }

// 木目の模様。描くたびに中身を消すので、そのたびに作る
function woodDefs(root) {
  const defs = svg('defs');
  const pattern = svg('pattern', { id: 'wood', width: WOOD_TILE, height: FRAME, patternUnits: 'userSpaceOnUse', y: -FRAME / 2 });
  const href = artPath('frame-wood');
  if (href) pattern.append(svg('image', { href, width: WOOD_TILE, height: FRAME, preserveAspectRatio: 'none' }));
  else pattern.append(svg('rect', { width: WOOD_TILE, height: FRAME, fill: '#c9a46b' }));
  defs.append(pattern);
  root.append(defs);
}

// p から q へ、木枠1本（長さ方向に木目を繰り返し、辺の向きに回す）
function woodBar(p, q) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const deg = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
  const g = svg('g', { class: 'frame', transform: `translate(${p[0]},${p[1]}) rotate(${deg})`, 'aria-hidden': 'true' });
  g.append(svg('rect', { x: 0, y: -FRAME / 2, width: len, height: FRAME, rx: 2, fill: 'url(#wood)', class: 'frame-bar' }));
  return g;
}

// 中心に置く小さな絵（金具・ピン）。素材がないときは丸で代わりに描く
function part(name, [x, y], size, fallback) {
  const href = artPath(name);
  if (!href) return svg('circle', { cx: x, cy: y, r: size / 2.6, fill: fallback, 'aria-hidden': 'true' });
  return svg('image', { href, x: x - size / 2, y: y - size / 2, width: size, height: size, class: 'part', 'aria-hidden': 'true' });
}

// 色の弦（光の帯＋芯）。.side をまるごと揺らす
function stringLine(k, p, q, color) {
  const g = svg('g', { class: 'side', 'data-k': k });
  g.append(svg('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', class: 'string-glow' }));
  g.append(svg('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', class: 'string' }));
  return g;
}

const hitLine = (k, p, q) => svg('line', { class: 'hit', 'data-k': k, x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'transparent', 'stroke-width': 34, 'stroke-linecap': 'round' });

export function drawEmpty(root, text) {
  clear(root);
  root.append(svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'tri-hint' }, text));
}

// sides：[{ length, color }] を選んだ順に。閉じないときは、木の棒に弦を張ったものを並べる
export function drawOpen(root, sides) {
  clear(root);
  woodDefs(root);
  sides.forEach((side, k) => {
    const w = Math.max(24, (lengthValue(side.length) / STAGE_RULES.maxLength) * 240), y = 52 + k * 52;
    const p = [20, y], q = [20 + w, y];
    // 弦は木の棒の少し上に、両端を少し内側にして張る
    const sp = [p[0] + 8, y - 9], sq = [q[0] - 8, y - 9];
    root.append(woodBar(p, q), stringLine(k, sp, sq, side.color), part('string-pin', sp, PIN, '#caa25a'), part('string-pin', sq, PIN, '#caa25a'));
    root.append(svg('text', { x: q[0] + 12, y: y + 5, fill: side.color, class: 'tri-label' }, formatLength(side.length)));
    root.append(hitLine(k, sp, sq));
  });
}

// 閉じる三角形。最長辺を底辺にして、画面に収まる大きさで描く
// hint：辺（弦）に触れると鳴ることを知らせる印（各弦の真ん中の波紋と、添え書き）を出す
export function drawClosed(root, sides, { hint = false } = {}) {
  clear(root);
  woodDefs(root);
  const order = sides.map((s, k) => ({ ...s, k, v: lengthValue(s.length) })).sort((a, b) => a.v - b.v);
  const [a, b, c] = order; // c が最長（底辺）
  const x = (b.v * b.v + c.v * c.v - a.v * a.v) / (2 * c.v), y = Math.sqrt(Math.max(0, b.v * b.v - x * x));
  const minX = Math.min(0, x), maxX = Math.max(c.v, x);
  // 木枠と金具の分だけ、前より少し小さく描く
  const s = Math.min(250 / (maxX - minX), 150 / Math.max(y, 1e-6));
  const ox = W / 2 - ((minX + maxX) / 2) * s, oy = 188;
  const A = [ox, oy], B = [ox + c.v * s, oy], C = [ox + x * s, oy - y * s];
  // 辺 BC は a、CA は b、AB は c の長さ
  const segs = [[B, C, a], [C, A, b], [A, B, c]];
  // 弦は、木枠から INSET だけ内側に張る（内接円の中心へ縮めた三角形）。細い三角形では、内接円の半径の6割まで
  const la = a.v * s, lb = b.v * s, lc = c.v * s, per = la + lb + lc;
  const I = [(la * A[0] + lb * B[0] + lc * C[0]) / per, (la * A[1] + lb * B[1] + lc * C[1]) / per];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const r = (2 * area) / per;
  const d = Math.min(INSET, r * 0.6), t = r > 0 ? (r - d) / r : 1;
  const inner = P => [I[0] + (P[0] - I[0]) * t, I[1] + (P[1] - I[1]) * t];
  const iA = inner(A), iB = inner(B), iC = inner(C);
  const strings = [[iB, iC, a], [iC, iA, b], [iA, iB, c]];
  const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;

  root.append(svg('polygon', { id: 'tri-fill', points: `${iA} ${iB} ${iC}` }));
  for (const [p, q] of segs) root.append(woodBar(p, q));
  for (const p of [A, B, C]) root.append(part('corner-brass', p, CORNER, '#c9a456'));
  for (const [p, q, side] of strings) root.append(stringLine(side.k, p, q, side.color));
  for (const p of [iA, iB, iC]) root.append(part('string-pin', p, PIN, '#caa25a'));
  for (const [p, q, side] of segs) {
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = mx - cx, dy = my - cy, dd = Math.hypot(dx, dy) || 1;
    root.append(svg('text', { x: mx + (dx / dd) * 17, y: my + (dy / dd) * 17 + 5, 'text-anchor': 'middle', fill: side.color, class: 'tri-label' }, formatLength(side.length)));
  }
  if (hint) {
    const g = svg('g', { class: 'tap-hint', 'aria-hidden': 'true' });
    strings.forEach(([p, q], i) => {
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      g.append(svg('circle', { cx: mx, cy: my, r: 6, class: 'tap-dot' }));
      g.append(svg('circle', { cx: mx, cy: my, r: 6, class: 'tap-ring', style: `animation-delay:${i * 0.25}s` }));
    });
    g.append(svg('text', { x: W / 2, y: 14, 'text-anchor': 'middle', class: 'tap-text' }, '辺に触れると音が鳴ります'));
    root.append(g);
  }
  for (const [p, q, side] of strings) root.append(hitLine(side.k, p, q));
}
