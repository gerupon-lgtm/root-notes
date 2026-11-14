// 五線譜（大譜表：ト音記号とヘ音記号の2段）。コード進行を鳴らすとき、鳴っている小節の音符を光らせる
// （2026-11-14 発案者。描き方は koekit サエズリズムの probe/saezuri/score.js を参考：音部記号は文字で描き、
//   線の間隔12、調号を置き、調号と違う音にだけ ♯・♭・♮ を付ける）
// - 1オクターブ上に書く（見やすさのため。音部記号の下に「8」＝実音は1オクターブ下。サエズリズムのオクターブ表示と同じ）
// - 4小節で1段。8小節は2段（2026-11-14 発案者）
// - 度数とコードネームは五線のすぐ上（その段でいちばん高い音符より上）に置く
import { svg } from './svg.js';
import { keySignature } from '../core/harmony.js';

const GAP = 12, HALF = GAP / 2;
const STEP_E4 = 30, STEP_G2 = 18, STEP_C4 = 28;
const DISPLAY_OCTAVE = 1; // 譜面は実音より1オクターブ上
const PER_ROW = 4, COL_W = 74;
const STAFF_GAP = 48; // ト音記号の段のいちばん下の線と、ヘ音記号の段のいちばん上の線の間
// 調号の位置（ト音記号の段の step。ヘ音記号の段は14下げる）
const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34], FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

const shown = n => ({ ...n, step: n.step + 7 * DISPLAY_OCTAVE });

function ledgerSteps(step, staff) {
  const out = [];
  if (staff === 'treble') {
    for (let s = STEP_E4 - 2; s >= step; s -= 2) out.push(s);
    for (let s = STEP_E4 + 10; s <= step; s += 2) out.push(s);
  } else {
    for (let s = STEP_G2 - 2; s >= step; s -= 2) out.push(s);
    for (let s = STEP_G2 + 10; s <= step; s += 2) out.push(s);
  }
  return out;
}

// 1段（最大4小節）を描く。y0 はこの段の上端。戻り値はこの段の下端
function drawSystem(root, cols, firstIndex, key, sig, y0, width) {
  const count = Math.abs(sig.fifths);
  const left = 50 + count * 9 + 10;
  const notes = cols.map(c => ({ chord: c.chord.map(shown), bass: shown(c.bass) }));
  // その段でいちばん高い音符に合わせて、ト音記号の段の位置を決める（上に度数とコードネームの2行）
  const highest = Math.max(38, ...notes.flatMap(n => n.chord.map(x => x.step)));
  const lowest = Math.min(STEP_G2, ...notes.map(n => n.bass.step), ...notes.flatMap(n => n.chord.filter(x => x.step < STEP_C4).map(x => x.step)));
  const labelH = 44; // 度数とコードネームの2行と、音符との間
  const T0 = y0 + labelH + 8 + (highest - STEP_E4) * HALF; // ト音記号の段のいちばん下の線（E4）
  const B0 = T0 + STAFF_GAP + 4 * GAP; // ヘ音記号の段のいちばん下の線（G2）
  const yOf = (step, staff) => (staff === 'treble' ? T0 - (step - STEP_E4) * HALF : B0 - (step - STEP_G2) * HALF);
  const bottom = B0 + Math.max(0, STEP_G2 - lowest) * HALF + 14;
  const right = left + cols.length * COL_W;

  for (let i = 0; i < 5; i++) {
    root.append(svg('line', { x1: 6, x2: right, y1: T0 - i * GAP, y2: T0 - i * GAP, class: 'staff-line' }));
    root.append(svg('line', { x1: 6, x2: right, y1: B0 - i * GAP, y2: B0 - i * GAP, class: 'staff-line' }));
  }
  root.append(svg('line', { x1: 6, x2: 6, y1: T0 - 4 * GAP, y2: B0, class: 'bar-line' }));
  root.append(svg('text', { x: 9, y: T0 - 6, class: 'clef treble' }, '𝄞'));
  root.append(svg('text', { x: 10, y: B0 - 2 * GAP + 9, class: 'clef bass' }, '𝄢'));
  // オクターブの印（実音は1オクターブ下）
  root.append(svg('text', { x: 24, y: T0 + 22, class: 'octave' }, '8'));
  root.append(svg('text', { x: 22, y: B0 + 14, class: 'octave' }, '8'));
  const steps = sig.fifths < 0 ? FLAT_STEPS : SHARP_STEPS;
  for (let i = 0; i < count; i++) {
    const x = 48 + i * 9, mark = sig.fifths < 0 ? '♭' : '♯';
    root.append(svg('text', { x, y: yOf(steps[i], 'treble') + 5, class: 'keysig' }, mark));
    root.append(svg('text', { x, y: yOf(steps[i] - 14, 'bass') + 5, class: 'keysig' }, mark));
  }

  // 度数とコードネームは、段の中で同じ高さにそろえる（その段でいちばん高い音符の上。2026-11-14 発案者）
  const colTop = Math.min(T0 - 4 * GAP, ...notes.flatMap(n => n.chord.map(c => yOf(c.step, c.step >= STEP_C4 ? 'treble' : 'bass')))) - 20;
  cols.forEach((col, i) => {
    const x = left + i * COL_W + COL_W / 2, n = notes[i];
    const g = svg('g', { class: 'col', 'data-col': firstIndex + i });
    g.append(svg('rect', { x: x - COL_W / 2 + 4, y: colTop - labelH, width: COL_W - 8, height: bottom - colTop + labelH - 6, rx: 12, class: 'halo' }));
    g.append(svg('text', { x, y: colTop - 16, class: 'deg' }, col.label));
    g.append(svg('text', { x, y: colTop - 2, class: 'name' }, col.name));
    let prev = null;
    for (const c of n.chord) {
      const staff = c.step >= STEP_C4 ? 'treble' : 'bass';
      const shifted = prev && prev.staff === staff && c.step - prev.step === 1 && !prev.shifted;
      note(g, x + (shifted ? 13 : 0), c, staff);
      prev = { staff, step: c.step, shifted };
    }
    note(g, x, n.bass, 'bass');
    root.append(g);
    root.append(svg('line', { x1: left + (i + 1) * COL_W, x2: left + (i + 1) * COL_W, y1: T0 - 4 * GAP, y2: B0, class: 'bar-line' }));
  });

  function note(group, x, n, staff) {
    const y = yOf(n.step, staff);
    for (const s of ledgerSteps(n.step, staff)) group.append(svg('line', { x1: x - 13, x2: x + 13, y1: yOf(s, staff), y2: yOf(s, staff), class: 'ledger' }));
    group.append(svg('ellipse', { cx: x, cy: y, rx: 8, ry: 5.6, transform: `rotate(-20 ${x} ${y})`, class: 'head' }));
    if (n.shift !== sig.alterations[n.letterIndex]) group.append(svg('text', { x: x - 22, y: y + 6, class: 'acc' }, n.shift > 0 ? '♯' : n.shift < 0 ? '♭' : '♮'));
  }
  return bottom;
}

// columns：src/game/notation.js の staffColumn の並び。current は光らせる列（なければ -1）
export function drawStaff(root, columns, key, current = -1) {
  while (root.firstChild) root.firstChild.remove();
  const sig = keySignature(key);
  const width = 50 + Math.abs(sig.fifths) * 9 + 10 + PER_ROW * COL_W + 6;
  let y = 0;
  for (let start = 0; start < columns.length; start += PER_ROW) {
    y = drawSystem(root, columns.slice(start, start + PER_ROW), start, key, sig, y, width) + 6;
  }
  root.setAttribute('viewBox', `0 0 ${width} ${y}`);
  markStaff(root, current);
}

// 光らせる列だけを変える（描き直さない）
export function markStaff(root, current) {
  for (const g of root.querySelectorAll('.col')) g.classList.toggle('now', Number(g.dataset.col) === current);
}
