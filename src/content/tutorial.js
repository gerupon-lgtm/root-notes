// 第1章の案内（チュートリアル）の文と手順。楽器のチューニングと同じ順番：お手本を聞く → 自分の弦を鳴らす → 重ねて聞く → 駒を動かす
// （2026-11-14 発案者「完全にギターのチューニング。ギターを知らない人にも伝わるように。間に『なにをやっているか』に触れて理解を深める」）。
// 前作にそろえた形（PRISM src/ui/tutorial-content.js・AQUA src/content/tutorial.js の練習面）：
// 見出し（目的）・今すること・補足（何をやっているか）・進み具合。操作の手順（kind: 'action'）は実際に操作すると進み、
// 解説の手順（kind: 'read'）は読んで「次へ」で進む（AQUA の練習面と同じ）。
// targets は光らせる場所（要素の id。'bridge' は駒と持ち手）。demo は指先の輪のお手本（'bridge'：持ち手を左右に、'knob'：つまみを回す）。
// きれいな和音では揺れが分かりにくいので、「ぴったり合うと2つの音が一つにまとまって聞こえる」も手がかりにする（2026-11-14 発案者）。
// 文は A区分（発案者の指示ですぐ変えてよい）。「|」は文節の区切り（画面ではまとまりの途中で改行しない。AQUA の phrases と同じ）。
export const plain = text => text.replaceAll('|', '');
export const CH1_STEPS = Object.freeze([
  { id: 'target', kind: 'action', heading: 'お手本の音を聞こう', text: '「お題を聞く」を|押そう。', note: '星が鳴らすのが|お手本の音。|自分の弦を、|この高さに|合わせます。', targets: ['mono-target'], demo: null },
  { id: 'pluck', kind: 'action', heading: '自分の弦を鳴らそう', text: '「弦をはじく」を|押そう。', note: 'これが|今の弦の音。|お手本より|高い？ 低い？|分からなくても|大丈夫。', targets: ['mono-pluck'], demo: null },
  { id: 'about-tuning', kind: 'read', heading: 'チューニングって？', text: '楽器の音合わせ|（チューニング）は、|お手本の音に、|自分の弦の高さを|そろえること。', note: '高い・低いが|耳で分からなくても|大丈夫。|次のやり方で|合わせられます。', targets: [], demo: null },
  { id: 'drone', kind: 'action', heading: '2つを重ねて聞こう', text: '「重ねて鳴らす」を|押そう。', note: 'お手本と|自分の弦を、|同時に|鳴らし続けます。', targets: ['mono-drone'], demo: null },
  { id: 'about-beat', kind: 'read', heading: '音が揺れている', text: 'ワウワウと|揺れるのが|「うなり」。|ずれが大きいほど|速く、|近づくほど|ゆっくりになります。', note: 'ぴったり合うと|揺れが消え、|2つの音が|一つにまとまって|聞こえます。', targets: [], demo: null },
  {
    id: 'move', kind: 'action', heading: '揺れを消そう', text: '駒の下の|持ち手を|動かそう。|揺れが|ゆっくりになる方が、|正解の向き。', note: '弦を短くすると|高く、|長くすると|低くなります。', targets: ['bridge', 'mono-left', 'mono-right'], demo: 'bridge',
    // 揺れが遅くなってきたら（FINE_BEAT より遅い）、つまみで仕上げる案内に切り替える
    fine: { text: '揺れが|ゆっくりに|なってきた。|つまみで|仕上げよう。', note: '揺れが消えて、|2つの音が|一つにまとまったら|合格（1秒保つ）。', targets: ['knob', 'mono-left', 'mono-right'], demo: 'knob' }
  }
].map(s => Object.freeze({ ...s, targets: Object.freeze(s.targets), ...(s.fine ? { fine: Object.freeze({ ...s.fine, targets: Object.freeze(s.fine.targets) }) } : {}) })));

// 手順「揺れを消そう」で、つまみの仕上げに切り替える揺れの速さ（回/秒）
export const FINE_BEAT = 4;

export const CH1_CLEAR = Object.freeze({
  heading: 'チュートリアルクリア！',
  text: '今やったのが|チューニング。|うなりが消えて、|2つの音が|一つにまとまりました。',
  note: '1-2からは|5度や4度。|揺れが|分かりにくいときは、|2つの音が|一つにまとまって|聞こえる所を|探そう。'
});

// 操作の順番（1-2〜1-5 の光の導線もこの順）：お題 → はじく → 重ねて鳴らす → 駒
export const ACTIONS = Object.freeze(['target', 'pluck', 'drone', 'move']);

// 1-2〜1-5 の光の導線（案内の文は出さない）。次にする操作の場所を2回光らせる（2026-11-14 発案者）
export const CH1_FLASH = Object.freeze({
  target: Object.freeze(['mono-target']),
  pluck: Object.freeze(['mono-pluck']),
  drone: Object.freeze(['mono-drone']),
  move: Object.freeze(['bridge', 'mono-left', 'mono-right', 'knob'])
});

export const STEP_IDS = Object.freeze(CH1_STEPS.map(s => s.id));

// 操作 action（ACTIONS のどれか）をしたあとの手順の番号。今の手順か、それより先の手順の操作をしたら、その次へ進む
// （順番を飛ばして操作しても、戻らない）。最後の手順（揺れを消そう）は合格で終わるので、それより先へは進まない
export function advanceStep(step, action) {
  if (!ACTIONS.includes(action)) throw new Error(`案内の操作「${action}」はありません。`);
  const i = STEP_IDS.indexOf(action);
  return i >= step ? Math.min(i + 1, STEP_IDS.length - 1) : step;
}
// 解説の手順で「次へ」を押したあとの手順の番号
export function readNext(step) {
  if (CH1_STEPS[step]?.kind !== 'read') return step;
  return Math.min(step + 1, STEP_IDS.length - 1);
}
// 光の導線：操作 action をしたあと、次に光らせる操作（最後なら null）
export function nextAction(action) {
  const i = ACTIONS.indexOf(action);
  if (i < 0) throw new Error(`案内の操作「${action}」はありません。`);
  return ACTIONS[i + 1] ?? null;
}
