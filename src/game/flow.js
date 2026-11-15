// ゲームの流れの骨組み（要件6.10、docs/design/段階4_第1章_一弦の琴.md 3章）。
// 連続プレイは序から最終章まで順に進む。中身がまだない場面（placeholder）は、仮の1画面で通り抜ける。
// 選択プレイは、遊べる章（playable）を選んで、その章の面を選ぶ。
export const FLOW = Object.freeze([
  { id: 'prologue', kind: 'story', title: '序章', place: '鍛冶場（伝承の時代）→ 星空（今）' },
  { id: 'ch1', kind: 'monochord', title: '第1章 一弦の琴', place: '鍛冶場の跡', playable: true },
  { id: 'riddle-shield', kind: 'riddle', riddle: 'shield', title: '第1章の終わり：謎（盾）' },
  { id: 'ch2', kind: 'triangle', title: '第2章 三角形で和音', place: '星空', playable: true },
  { id: 'riddle-sword', kind: 'riddle', riddle: 'sword', title: '第2章の終わり：謎（剣）' },
  { id: 'ch3', kind: 'triangle', title: '第3章 長調と短調', place: '夜の神殿', playable: true },
  { id: 'riddle-armor', kind: 'riddle', riddle: 'armor', title: '第3章の終わり：謎（鎧）' },
  { id: 'final', kind: 'final', title: '最終章 門と扉', place: '神殿の奥' }
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
// 序章の8場面（絵・語り・音）は src/content/story.js の PROLOGUE（段階6）
