// 三角形の描画（試作の描き方を移した）。閉じるときは最長辺を底辺にした三角形、閉じないときは破線の棒を並べる。
// 各辺には、なぞりやすいように太い透明の当たり（.hit）を重ねる。data-k は選んだ棒の何本目か
import { svg } from './svg.js';
import { lengthValue, formatLength } from '../core/length.js';
import { STAGE_RULES } from '../content/stage-rules.js';

const W = 320, H = 210;

function clear(root) { while (root.firstChild) root.firstChild.remove(); }

export function drawEmpty(root, text) {
  clear(root);
  root.append(svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'tri-hint' }, text));
}

// sides：[{ length, color }] を選んだ順に。閉じないときは破線の棒
export function drawOpen(root, sides) {
  clear(root);
  sides.forEach((side, k) => {
    const w = (lengthValue(side.length) / STAGE_RULES.maxLength) * 250, y = 52 + k * 52;
    const g = svg('g', { class: 'side', 'data-k': k });
    g.append(svg('line', { x1: 20, y1: y, x2: 20 + w, y2: y, stroke: side.color, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '2 8' }));
    root.append(g, svg('text', { x: 30 + w, y: y + 5, fill: side.color, class: 'tri-label' }, formatLength(side.length)));
    root.append(svg('line', { class: 'hit', 'data-k': k, x1: 20, y1: y, x2: 20 + w, y2: y, stroke: 'transparent', 'stroke-width': 34, 'stroke-linecap': 'round' }));
  });
}

// 閉じる三角形。最長辺を底辺にして、画面に収まる大きさで描く
export function drawClosed(root, sides) {
  clear(root);
  const order = sides.map((s, k) => ({ ...s, k, v: lengthValue(s.length) })).sort((a, b) => a.v - b.v);
  const [a, b, c] = order; // c が最長（底辺）
  const x = (b.v * b.v + c.v * c.v - a.v * a.v) / (2 * c.v), y = Math.sqrt(Math.max(0, b.v * b.v - x * x));
  const minX = Math.min(0, x), maxX = Math.max(c.v, x);
  const s = Math.min(260 / (maxX - minX), 160 / Math.max(y, 1e-6));
  const ox = W / 2 - ((minX + maxX) / 2) * s, oy = 192;
  const A = [ox, oy], B = [ox + c.v * s, oy], C = [ox + x * s, oy - y * s];
  // 辺 BC は a、CA は b、AB は c の長さ
  const segs = [[B, C, a], [C, A, b], [A, B, c]];
  const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
  root.append(svg('polygon', { id: 'tri-fill', points: `${A} ${B} ${C}` }));
  for (const [p, q, side] of segs) {
    const g = svg('g', { class: 'side', 'data-k': side.k });
    g.append(svg('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: side.color, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
    root.append(g, svg('text', { x: mx + (dx / d) * 15, y: my + (dy / d) * 15 + 5, 'text-anchor': 'middle', fill: side.color, class: 'tri-label' }, formatLength(side.length)));
  }
  for (const p of [A, B, C]) root.append(svg('circle', { cx: p[0], cy: p[1], r: 3, class: 'tri-vertex' }));
  for (const [p, q, side] of segs) root.append(svg('line', { class: 'hit', 'data-k': side.k, x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'transparent', 'stroke-width': 34, 'stroke-linecap': 'round' }));
}
