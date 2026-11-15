// 遊び方の段階（要件6.6、docs/design/段階3_三角形ステージの画面.md 4章）。
// 失敗の上限とメーターの回数は【想定】（Q-07、実機で調整）。おとりの本数は要件に記載がなく、試作の値【想定】。
// meter：'button' は使うボタンで表示（meterCount はプレイ全体の回数）、'toggle' は表示／非表示を選ぶ
// continuous：星を1から順に通す（次の星へ）。fixedSong：曲を固定する（選択プレイ。カノン進行・キーC）。
//   選択プレイも、章を選ぶたびにまっさらから、星1から順に通す（2026-11-15 発案者。前は好きな星を選び、灯した星を残していた）
export const MODES = Object.freeze({
  select: Object.freeze({
    id: 'select', name: '選択プレイ', label: '選択プレイ', continuous: true, fixedSong: true,
    lives: Infinity, meter: 'button', meterCount: Infinity, chordBeforeAnswer: false, decoys: 3,
    desc: '星を順番に通します。曲はカノン進行（キーC）で固定です。回答するまで自分の和音は鳴らせません。メーターは使うたびに表示します。'
  }),
  free: Object.freeze({
    id: 'free', name: 'フリー', label: '連続・フリー', continuous: true,
    lives: Infinity, meter: 'toggle', meterCount: Infinity, chordBeforeAnswer: true, decoys: 3,
    desc: '星を順番に通します。遊ぶたびに進行とキーが変わります。制限はなく、和音もメーターも自由です。'
  }),
  normal: Object.freeze({
    id: 'normal', name: 'ノーマル', label: '連続・ノーマル', continuous: true,
    lives: 10, meter: 'button', meterCount: 6, chordBeforeAnswer: false, decoys: 4,
    desc: '星を順番に通します。失敗はプレイ全体で10回まで。回答するまで和音は鳴らせません。メーターは全体で6回。'
  }),
  expert: Object.freeze({
    id: 'expert', name: 'エキスパート', label: '連続・エキスパート', continuous: true,
    lives: 5, meter: 'button', meterCount: 3, chordBeforeAnswer: false, decoys: 5,
    desc: '星を順番に通します。失敗はプレイ全体で5回まで。回答するまで和音は鳴らせません。メーターは全体で3回。'
  })
});

export const MODE_ORDER = Object.freeze(['select', 'free', 'normal', 'expert']);
