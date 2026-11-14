// 楽器の部品（Codex の素材 プレイ画面部品 v1.0.0）をSVGで組み立てる小さな関数。三角形（triangle-view.js）と一弦の琴（monochord-screen.js）で使う。
// 絵の場所は src/content/assets.js の表から取る。素材がないときは、色の図形で代わりに描く
import { svg } from './svg.js';
import { artPath } from '../content/assets.js';

export const FRAME = 12; // 木枠の太さ（SVG の単位）
const WOOD_TILE = 192; // 木目1枚を並べる長さ（Codex の見本と同じ 192×12）
export const CORNER = 22, PIN = 8; // 金具とピンの大きさ

// 木目の模様。描くたびに中身を消すので、そのたびに作る。名前は図ごとに分ける
// （同じ名前が2つあると、隠れている画面の模様を参照して描けないことがある）
export const woodId = root => `wood-${root.id || 'svg'}`;
export function woodDefs(root) {
  const defs = svg('defs');
  const pattern = svg('pattern', { id: woodId(root), width: WOOD_TILE, height: FRAME, patternUnits: 'userSpaceOnUse', y: -FRAME / 2 });
  const href = artPath('frame-wood');
  if (href) pattern.append(svg('image', { href, width: WOOD_TILE, height: FRAME, preserveAspectRatio: 'none' }));
  else pattern.append(svg('rect', { width: WOOD_TILE, height: FRAME, fill: '#c9a46b' }));
  defs.append(pattern);
  root.append(defs);
}

// p から q へ、木枠1本（長さ方向に木目を繰り返し、辺の向きに回す）。thick は枠の太さ
export function woodBar(p, q, root, thick = FRAME) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const deg = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
  const g = svg('g', { class: 'frame', transform: `translate(${p[0]},${p[1]}) rotate(${deg})`, 'aria-hidden': 'true' });
  g.append(svg('rect', { x: 0, y: -thick / 2, width: len, height: thick, rx: Math.min(2, thick / 4), fill: `url(#${woodId(root)})`, class: 'frame-bar' }));
  return g;
}

// 中心に置く小さな絵（金具・ピン）。素材がないときは丸で代わりに描く
export function part(name, [x, y], size, fallback) {
  const href = artPath(name);
  if (!href) return svg('circle', { cx: x, cy: y, r: size / 2.6, fill: fallback, 'aria-hidden': 'true' });
  return svg('image', { href, x: x - size / 2, y: y - size / 2, width: size, height: size, class: 'part', 'aria-hidden': 'true' });
}
