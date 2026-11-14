// 実際の描画関数が出した弦を、後から描く留め具の画像が覆い尽くさないことを確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawClosed } from '../src/ui/triangle-view.js';
import { len, closes } from '../src/core/length.js';

class Node {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  get firstChild() { return this.children[0]; }
  remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
}

// 線分のうち、画像の四角い領域に入る区間。透明な余白も覆うものとみなし、安全側で検査する。
function coveredInterval(p, q, box) {
  let start = 0, end = 1;
  for (let axis = 0; axis < 2; axis++) {
    const d = q[axis] - p[axis];
    if (Math.abs(d) < 1e-10) { if (p[axis] < box[axis] || p[axis] > box[axis + 2]) return null; }
    else {
      const a = (box[axis] - p[axis]) / d, b = (box[axis + 2] - p[axis]) / d;
      start = Math.max(start, Math.min(a, b)); end = Math.min(end, Math.max(a, b));
      if (start >= end) return null;
    }
  }
  return [start, end];
}

function longestVisible(line, boxes) {
  const a = line.attrs, p = [+a.x1, +a.y1], q = [+a.x2, +a.y2];
  const intervals = boxes.map(b => coveredInterval(p, q, b)).filter(Boolean).sort((a, b) => a[0] - b[0]);
  let cursor = 0, visible = 0;
  for (const [start, end] of intervals) { visible = Math.max(visible, start - cursor); cursor = Math.max(cursor, end); }
  return Math.max(visible, 1 - cursor) * Math.hypot(q[0] - p[0], q[1] - p[1]);
}

test('閉じる全整数三角形と√2の代表形で、留め具を除いて弦の芯幅以上の線が残る', t => {
  const original = globalThis.document;
  globalThis.document = { createElementNS: (_ns, tag) => new Node(tag) };
  try {
    const cases = [];
    for (let a = 2; a <= 24; a++) for (let b = a; b <= 24; b++) for (let c = b; c <= 24; c++) {
      const sides = [len(a), len(b), len(c)];
      if (closes(sides)) cases.push(sides);
    }
    cases.push([len(6), len(6), len(6, true)], [len(2), len(2), len(2, true)], [len(12), len(15), len(12, true)]);
    let minimum = Infinity, worst = '', count = 0;
    const failures = [];
    for (const lengths of cases) {
      const root = new Node('svg'); root.id = 'tri';
      drawClosed(root, lengths.map(length => ({ length, color: '#abcdef' })));
      const pins = root.children.filter(n => n.tag === 'image' && n.attrs.href.includes('string-pin'));
      const boxes = pins.map(n => { const a = n.attrs; return [+a.x, +a.y, +a.x + +a.width, +a.y + +a.height]; });
      const groups = root.children.filter(n => n.attrs.class === 'side');
      assert.equal(groups.length, 3);
      for (const group of groups) {
        const line = group.children.find(n => n.attrs.class === 'string');
        const visible = longestVisible(line, boxes);
        const label = lengths.map(l => `${l.n}${l.r2 ? '√2' : ''}`).join(':');
        if (visible < minimum) { minimum = visible; worst = label; }
        if (visible < +line.attrs['stroke-width']) failures.push(`${label} exposed=${visible.toFixed(3)}`);
        count++;
      }
    }
    t.diagnostic(`${cases.length} shapes / ${count} strings, min=${minimum.toFixed(3)}, worst=${worst}`);
    assert.equal(failures.length, 0, `${failures.length} hidden or too-short strings: ${failures.slice(0, 5).join(', ')}`);
  } finally {
    if (original === undefined) delete globalThis.document; else globalThis.document = original;
  }
});
