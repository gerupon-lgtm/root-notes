// 章末の謎（段階5。要件6.3・F-018。docs/design/段階5_章末の謎.md）。
// 武具から漏れる封音の声を聞き、同じ高さの弦を選ぶ。選んだ長さの辺が、そのまま武具（アーティファクト）になる。
// その場では正誤を出さない（間違えていたら最終章の ZAP で戻る。要件6.4）。
// 2026-11-15 発案者が決めたこと（設計メモ 2章）：
// 1. 声の高さの基準は序章の鐘と同じ（大きさ12の鐘＝ファ。src/content/story.js の BELL_BASE_HZ）。周波数 ＝ K ÷ 長さ
//    → 盾 9 ＝ 鐘9と同じシ♭、鎧 4 ＝ 鐘8の1オクターブ上のド、剣 5 ＝ ラ♭（要件6.8）
// 2. 声と弦は同じ高さ（オクターブ違いにしない）
// 3. 声の出方：盾は何度も途切れる、剣は短く一度（暗い音色）、鎧は長く静かに
// 4. 選ぶ弦は答えを含む4本。答えの近くの高さで、答えのオクターブ違いは入れない
// 5. 比べ方：弦をタップで単音、「声を聞く」、「重ねて聞く」（声と弦を同時に鳴らし、うなりで合わせる）
// 6. フリー・選択プレイは揺れメーターを使える。ノーマル・エキスパートは耳だけ
// 7. 「この弦を持ち帰る」で決める。謎は連続プレイの物語の中だけ
import { BELL_BASE_HZ } from './story.js';

export const RIDDLE_K = BELL_BASE_HZ * 12;
export const riddleHz = n => RIDDLE_K / n;

// 声の出方：[鳴り始め（秒）, 長さ（秒）] の並び。音量 level（0〜1）、音色 tone（'clear'：澄んだ、'dark'：暗い）
export const RIDDLES = Object.freeze({
  shield: Object.freeze({
    id: 'shield', name: '盾', answer: 9, choices: Object.freeze([8, 9, 10, 12]),
    voice: Object.freeze({ notes: Object.freeze([[0, 0.22], [0.36, 0.18], [0.7, 0.26], [1.15, 0.16], [1.45, 0.3]]), level: 0.8, tone: 'clear' }),
    place: '鍛冶場の跡', background: 'forge-ruins', chapter: '第1章'
  }),
  sword: Object.freeze({
    id: 'sword', name: '剣', answer: 5, choices: Object.freeze([4, 5, 6, 7]),
    voice: Object.freeze({ notes: Object.freeze([[0, 0.55]]), level: 0.9, tone: 'dark' }),
    place: '星空', background: 'stars-night-empty', chapter: '第2章'
  }),
  armor: Object.freeze({
    id: 'armor', name: '鎧', answer: 4, choices: Object.freeze([3, 4, 5, 6]),
    voice: Object.freeze({ notes: Object.freeze([[0, 2.6]]), level: 0.55, tone: 'clear' }),
    place: '夜の神殿', background: 'temple-entrance-corridor', chapter: '第3章'
  })
});
export const RIDDLE_IDS = Object.freeze(Object.keys(RIDDLES));

// 揺れ（うなり）の速さ：同じ高さの2音の差（回/秒）。合わせる目安は第1章と同じく 1回/秒 未満
export const beatRate = (a, b) => Math.abs(a - b);
