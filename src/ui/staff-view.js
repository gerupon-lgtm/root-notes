// 五線譜（大譜表：ト音記号とヘ音記号の2段）。コード進行を鳴らすとき、鳴っている小節の音符を光らせる
// （2026-11-14 発案者。描き方は koekit サエズリズムの probe/saezuri/score.js を参考：音部記号は文字で描き、
//   線の間隔12、調号を置き、調号と違う音にだけ ♯・♭・♮ を付ける）
import { svg } from './svg.js';
import { keySignature } from '../core/harmony.js';

const GAP = 12, HALF = GAP / 2;
const T0 = 120; // ト音記号の段のいちばん下の線（E4）の y
const B0 = T0 + 96; // ヘ音記号の段のいちばん下の線（G2）の y
const STEP_E4 = 30, STEP_G2 = 18, STEP_C4 = 28;
// 調号の位置（ト音記号の段の step。ヘ音記号の段は14下げる）
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34], FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

const trebleY = step => T0 - (step - STEP_E4) * HALF;
const bassY = step => B0 - (step - STEP_G2) * HALF;
const yOf = (step, staff) => (staff === 'treble' ? trebleY(step) : bassY(step));

function ledgers(group, x, step, staff) {
  const lines = [];
  if (staff === 'treble') {
    for (let s = STEP_E4 - 2; s >= step; s -= 2) lines.push(s); // C4・A3…
    for (let s = STEP_E4 + 10; s <= step; s += 2) lines.push(s); // A5…
  } else {
    for (let s = STEP_G2 - 2; s >= step; s -= 2) lines.push(s); // E2・C2…
    for (let s = STEP_G2 + 10; s <= step; s += 2) lines.push(s); // C4
  }
  for (const s of lines) group.append(svg('line', { x1: x - 12, x2: x + 12, y1: yOf(s, staff), y2: yOf(s, staff), class: 'ledger' }));
}

function drawNote(group, x, n, staff, alterations) {
  const y = yOf(n.step, staff);
  ledgers(group, x, n.step, staff);
  group.append(svg('ellipse', { cx: x, cy: y, rx: 7.5, ry: 5.2, transform: `rotate(-20 ${x} ${y})`, class: 'head' }));
  const expected = alterations[n.letterIndex];
  if (n.shift !== expected) group.append(svg('text', { x: x - 21, y: y + 5, class: 'acc' }, n.shift > 0 ? '♯' : n.shift < 0 ? '♭' : '♮'));
}

// columns：src/game/notation.js の staffColumn の並び。current は光らせる列（なければ -1）
export function drawStaff(root, columns, key, current = -1) {
  while (root.firstChild) root.firstChild.remove();
  const sig = keySignature(key), count = Math.abs(sig.fifths);
  const left = 48 + count * 9 + 8, colW = 58;
  const width = left + columns.length * colW + 8;
  const top = T0 - 8 * GAP - 26, bottom = B0 + 3 * GAP + 8;
  root.setAttribute('viewBox', `0 ${top} ${width} ${bottom - top}`);
  // 五線と音部記号
  for (let i = 0; i < 5; i++) {
    root.append(svg('line', { x1: 6, x2: width - 6, y1: T0 - i * GAP, y2: T0 - i * GAP, class: 'staff-line' }));
    root.append(svg('line', { x1: 6, x2: width - 6, y1: B0 - i * GAP, y2: B0 - i * GAP, class: 'staff-line' }));
  }
  root.append(svg('line', { x1: 6, x2: 6, y1: T0 - 4 * GAP, y2: B0, class: 'bar-line' }));
  root.append(svg('text', { x: 9, y: T0 - 6, class: 'clef treble' }, '𝄞'));
  root.append(svg('text', { x: 10, y: B0 - 2 * GAP + 9, class: 'clef bass' }, '𝄢'));
  // 調号
  const steps = sig.fifths < 0 ? FLAT_STEPS : SHARP_STEPS;
  for (let i = 0; i < count; i++) {
    const x = 46 + i * 9, mark = sig.fifths < 0 ? '♭' : '♯';
    root.append(svg('text', { x, y: trebleY(steps[i]) + 5, class: 'keysig' }, mark));
    root.append(svg('text', { x, y: bassY(steps[i] - 14) + 5, class: 'keysig' }, mark));
  }
  // 小節ごとの音符
  columns.forEach((col, i) => {
    const x = left + i * colW + colW / 2;
    const g = svg('g', { class: i === current ? 'col now' : 'col', 'data-col': i });
    g.append(svg('rect', { x: x - 26, y: top + 2, width: 52, height: bottom - top - 4, rx: 12, class: 'halo' }));
    g.append(svg('text', { x, y: top + 14, class: 'deg' }, col.label));
    g.append(svg('text', { x, y: top + 28, class: 'name' }, col.name));
    // 和音の音：C4 より下はヘ音記号の段。隣り合う高さ（2度）は右へずらす
    let prev = null;
    for (const n of col.chord) {
      const staff = n.step >= STEP_C4 ? 'treble' : 'bass';
      const shifted = prev && prev.staff === staff && n.step - prev.step === 1 && !prev.shifted;
      drawNote(g, x + (shifted ? 13 : 0), n, staff, sig.alterations);
      prev = { staff, step: n.step, shifted };
    }
    drawNote(g, x, col.bass, 'bass', sig.alterations);
    root.append(g);
    root.append(svg('line', { x1: left + (i + 1) * colW, x2: left + (i + 1) * colW, y1: T0 - 4 * GAP, y2: B0, class: 'bar-line' }));
  });
}

// 光らせる列だけを変える（描き直さない）
export function markStaff(root, current) {
  for (const g of root.querySelectorAll('.col')) g.classList.toggle('now', Number(g.dataset.col) === current);
}
