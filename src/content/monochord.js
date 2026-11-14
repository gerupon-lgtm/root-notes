// 第1章「一弦の琴」の面と値（要件6.2、docs/design/段階4_第1章_一弦の琴.md）。
// 駒で区切った長さ r（弦全体＝1）の部分が鳴る。音の高さは 弦全体の音 ÷ r（長さに反比例。C-01）

// 弦全体の音：試作どおり G3（Q-09 が未決のための仮の値。2026-11-14 発案者 OK）
export const OPEN_HZ = 196;

// 合格：揺れ（2つの音の周波数の差）が1秒に1回未満の状態を、1秒保つ（要件5章）
export const PASS_BEAT = 1;
export const PASS_HOLD = 1;

// 駒の動く範囲（弦全体に対する割合）。すべての答え（1/2〜5/6）がこの中にある
export const BRIDGE_RANGE = Object.freeze([0.3, 0.98]);
// 面に入ったとき、駒を答えからこれだけ離して置く（試作と同じ）
export const START_OFFSET = Object.freeze([0.06, 0.16]);
// 微調整：つまみ1ラジアンで動く量と、◀▶を1回押して動く量（試作と同じ）
export const KNOB_PER_RADIAN = 0.004;
export const NUDGE = 0.0006;

export const MONOCHORD_STAGES = Object.freeze([
  { id: '1-1', num: 1, den: 2, name: '1オクターブ上', word: '半分の長さで、同じ名前の高い音' },
  { id: '1-2', num: 2, den: 3, name: '5度上', word: '2:3。よく響き合う音' },
  { id: '1-3', num: 3, den: 4, name: '4度上', word: '3:4' },
  { id: '1-4', num: 4, den: 5, name: '長3度上', word: '4:5' },
  { id: '1-5', num: 5, den: 6, name: '短3度上', word: '5:6。ここまでの比が、次の章で三角形になる' }
].map(s => Object.freeze(s)));
