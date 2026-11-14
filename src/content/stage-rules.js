// ステージを作る決まり（docs/design/段階2_ステージの生成.md 4・5・7章）。
// 数を変えたいときはここだけを直す。変えたら機械検査（tests/stage-gen.test.js）で確かめる
export const STAGE_RULES = Object.freeze({
  // 棒の長さ（要件5章）
  minLength: 2,
  maxLength: 24,
  // 和音の広がり：最低音から最高音までの半音の数（要件5章【想定】）
  maxSpan: 16,
  // 純正さ：整数比に使う素数の上限。長短は2・3・5だけ、減は7まで（要件5章【想定】）
  limits: Object.freeze({ major: 5, minor: 5, diminished: 7 }),
  // 各音の、平均律の半音からのずれの上限（セント）。試作の条件【要確認】
  maxOffsetCents: 20,
  // 三角形の最低音の音域（MIDI 50〜61 ＝ D3〜C♯4）。試作の値
  lowMidi: Object.freeze([50, 61]),
  // 三角形のトップノート（一番高い音）の上限：C5（MIDI 72）。2026-11-14 発案者（高すぎてキツく聞こえたため）
  maxTopMidi: 72,
  // ベースラインの音域（MIDI 36〜47 ＝ C2〜B2）。試作の値
  bassMidi: Object.freeze([36, 47]),
  // おとりの棒で「同じ和音に聞こえる別の三角形」を作らせない範囲（設計メモ5章）。
  // 'all'：同じ音名の組は転回形違いも含めてすべて避ける（2026-11-14 発案者：B案）
  // 'same-bass'：最低音まで同じものだけ避ける（A案）、'none'：避けない（C案・試作）
  avoidSoundAlike: 'all'
});
