// ゲームの流れの骨組み（要件6.10、docs/design/段階4_第1章_一弦の琴.md 3章）。
// 連続プレイは序から最終章まで順に進む。中身がまだない場面（placeholder）は、仮の1画面で通り抜ける。
// 選択プレイは、遊べる章（playable）を選んで、その章の面を選ぶ。
export const FLOW = Object.freeze([
  { id: 'prologue', kind: 'story', title: '序', place: '鍛冶場（伝承の時代）→ 星空（今）' },
  { id: 'ch1', kind: 'monochord', title: '第1章 一弦の琴', place: '鍛冶場の跡', playable: true },
  { id: 'riddle-shield', kind: 'placeholder', title: '第1章の終わり：謎（盾）', note: '装備から漏れる声と同じ高さの弦を選ぶ謎は、段階5で作ります。' },
  { id: 'ch2', kind: 'triangle', title: '第2章 三角形で和音', place: '星空', playable: true },
  { id: 'riddle-sword', kind: 'placeholder', title: '第2章の終わり：謎（剣）', note: '段階5で作ります。' },
  { id: 'ch3', kind: 'placeholder', title: '第3章 長調と短調', note: '夜の神殿。中身は段階5で作ります。' },
  { id: 'riddle-armor', kind: 'placeholder', title: '第3章の終わり：謎（鎧）', note: '段階5で作ります。' },
  { id: 'final', kind: 'placeholder', title: '最終章 門と扉', note: '門の課題と「直角に開く」は段階5で作ります。' }
].map(x => Object.freeze(x)));

export const firstStep = () => FLOW[0];
export const stepById = id => FLOW.find(x => x.id === id) ?? null;
// 次の場面。最後なら null（タイトルへ戻る）
export function nextStep(id) {
  const i = FLOW.findIndex(x => x.id === id);
  if (i < 0) throw new Error(`流れに「${id}」がありません。`);
  return FLOW[i + 1] ?? null;
}
export const playableChapters = () => FLOW.filter(x => x.playable);

// 序の8場面の見出し（要件6.10）。絵とセリフは段階6で作るまで、見出しだけを並べる
export const PROLOGUE_SCENES = Object.freeze([
  '昔、鍛冶場でハンマーが鐘を打っていたと伝えられる',
  '2つずつ重ねると、澄んだ響きが生まれた',
  '9と8を重ねたときだけ、響きが濁った',
  '教団はそれを「不浄の響き」と呼び、装備に封じて散らした',
  '長い時が流れた。打たれた鐘たちは、遠い祭壇で星の光に鳴らされているという',
  '天の歌が欠け、星の巡りが鈍っている',
  '弦の精霊が現れ、封じられた音を探してほしいと頼む',
  'まず、澄んだ響きを思い出すところから'
]);
