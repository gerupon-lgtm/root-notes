// 最終章の進み方（要件6.4）。画面・音に触れない。
// 手持ち：章末の謎で持ち帰った武具（選んだ長さ）＋おとりの辺。門で1本使うとなくなる（使った武具は門の先の小部屋に残る）。
// 正しければ門が開き報酬をもらう（辺6は「扉用」で門には使えない）。間違えた辺もなくなる（辺がなくなること自体が罰。失敗の上限は使わない）。
// この先の門が解けなくなったら ZAP：足りない武具の謎へだけ戻り、解き直したら最終章を初めから（要件6.4）
import { GATES, DOOR_EDGE } from '../content/final.js';
import { len, closes } from '../core/length.js';

// 手持ちの辺 { n, tag, door }。tag は表示名（盾・剣・鎧・拾った弦・扉用）、door は扉用（門に使えない）
export function startHand(artifacts, decoys = []) {
  const hand = [];
  for (const g of GATES) if (Number.isInteger(artifacts?.[g.art])) hand.push({ n: artifacts[g.art], tag: g.name, art: g.art, door: false });
  for (const n of decoys) hand.push({ n, tag: '拾った弦', door: false });
  return hand;
}

// 門 from から先を解くのに、手持ちに足りない武具（門ごとに1本使う）。足りていれば []
export function missingFrom(from, hand) {
  const rest = hand.filter(h => !h.door).map(h => h.n), miss = [];
  for (let i = from; i < GATES.length; i++) {
    const k = rest.indexOf(GATES[i].answer);
    if (k < 0) miss.push(GATES[i].art); else rest.splice(k, 1);
  }
  return miss;
}

export class FinalPlay {
  constructor({ artifacts, decoys = [] }) {
    this.hand = startHand(artifacts, decoys);
    this.gate = 0; // 今の門（GATES の番号）。3なら扉
    this.scroll = false;
    this.opened = []; // 開いた門の番号
    this.doorOpen = false;
  }
  get atDoor() { return this.gate >= GATES.length; }
  get current() { return GATES[this.gate] ?? null; }
  // 最終章に入った時点で足りない武具（あれば ZAP）
  missing() { return missingFrom(this.gate, this.hand); }
  // 門で使える手持ち（扉用は使えない）
  usable() { return this.hand.map((h, i) => ({ ...h, i })).filter(h => !h.door); }
  // 手持ちの i 番目を差し出す。{ result: 'open'|'wrong', zap: [足りない武具] }
  offer(i) {
    const g = this.current;
    if (!g) throw new Error('もう門はありません。');
    const h = this.hand[i];
    if (!h || h.door) throw new Error('その辺は門に使えません。');
    this.hand.splice(i, 1);
    if (h.n === g.answer) {
      this.opened.push(this.gate);
      if (g.reward === 'scroll') this.scroll = true;
      else this.hand.push({ n: g.reward, tag: '扉用', door: true });
      this.gate++;
      return { result: 'open', gate: g, used: h, zap: [] };
    }
    return { result: 'wrong', gate: g, used: h, zap: missingFrom(this.gate, this.hand) };
  }
  // 扉：手持ちの i・j を直角に開く。同じ長さの扉用2本なら開く
  openDoor(i, j) {
    if (!this.atDoor) throw new Error('まだ扉ではありません。');
    const a = this.hand[i], b = this.hand[j];
    const ok = i !== j && a && b && a.n === b.n && a.n === DOOR_EDGE;
    if (ok) this.doorOpen = true;
    return ok;
  }
}

// 機械検査（C-03。2026-11-15 合意）：各門で、正しい武具を使えば三角形が閉じ、手持ちのうち正解は各門でちょうど1本
export function checkGates(hand) {
  return GATES.map((g, k) => {
    const usable = hand.filter(h => !h.door);
    const answers = usable.filter(h => h.n === g.answer).length;
    return { gate: k, closes: closes([...g.given, g.answer].map(n => len(n))), answers };
  });
}
