// 第1章の案内（チュートリアル）の文と手順（2026-11-14 発案者「導線がわからないことが大問題」）。
// 前作にそろえた形（PRISM src/ui/tutorial-content.js・AQUA src/content/tutorial.js）：
// 見出し（目的）・今する1操作・補足・進み具合。実際の操作をすると次へ進む。音を聞く楽しさを先に置く（PRISM 2026-11-06 の改訂の考え方）。
// targets は光らせる場所（要素の id。'bridge' は駒）。demo は指先の輪のお手本（'bridge'：駒を左右に動かす、'knob'：つまみを回す）。
// 文は A区分（発案者の指示ですぐ変えてよい）。
export const CH1_STEPS = Object.freeze([
  { id: 'target', heading: '星の音を聞こう', text: '「お題を聞く」を押そう。', note: '星が鳴らす音が、弦で合わせる目当ての音です。', targets: ['mono-target'], demo: null },
  { id: 'pluck', heading: '自分の弦は？', text: '「弦をはじく」で、星の音と高さを比べよう。', note: '駒より左の弦をタップしても、はじけます。', targets: ['mono-pluck'], demo: null },
  { id: 'move', heading: '駒で高さを変えよう', text: '駒の下の持ち手を、指で左右に動かそう。', note: '駒そのものをつかんでも動かせます。弦が短いほど、高い音になります。', targets: ['bridge', 'mono-left', 'mono-right', 'knob'], demo: 'bridge' },
  { id: 'drone', heading: '重ねて聴こう', text: '「重ねて鳴らす」で、星の音と弦を一緒に鳴らそう。', note: '高さが少しずれていると、音がワウワウと揺れます（うなり）。', targets: ['mono-drone'], demo: null },
  { id: 'tune', heading: '揺れを消そう', text: '揺れがゆっくりになる方へ、微調整つまみを回そう。', note: '揺れが消えて1秒保てば合格。◀▶でも少しずつ動かせます。', targets: ['knob'], demo: 'knob' }
].map(s => Object.freeze({ ...s, targets: Object.freeze(s.targets) })));

export const CH1_CLEAR = Object.freeze({
  heading: 'チュートリアルクリア！',
  text: '弦を半分の長さにすると、1オクターブ上の音になりました。',
  note: '1-2からは、自分で合わせよう。揺れが消えて1秒保てば合格です。'
});

// 1-2〜1-5 の光の導線（案内の文は出さない）。面の始まり → お題を聞いた → 弦をはじいた → 駒を動かした の順に、
// 次にする所を2回光らせる（2026-11-14 発案者。「駒を動かしたあと、重ねて鳴らす」も足す）
export const CH1_FLASH = Object.freeze({
  target: Object.freeze(['mono-target']),
  pluck: Object.freeze(['mono-pluck']),
  move: Object.freeze(['bridge', 'mono-left', 'mono-right', 'knob']),
  drone: Object.freeze(['mono-drone']),
  tune: Object.freeze([])
});

export const STEP_IDS = Object.freeze(CH1_STEPS.map(s => s.id));

// 操作 action（'target'・'pluck'・'move'・'drone'）をしたあとの手順の番号。
// 今の手順か、それより先の手順の操作をしたら、その次へ進む（順番を飛ばして操作しても、戻らない）
export function advanceStep(step, action) {
  const i = STEP_IDS.indexOf(action);
  if (i < 0) throw new Error(`案内の操作「${action}」はありません。`);
  return i >= step ? Math.min(i + 1, STEP_IDS.length - 1) : step;
}
