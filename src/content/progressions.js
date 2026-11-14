// コード進行のデータ（要件6.5。種類と数は試作の5種【想定】、Q-10 で未決）。
// 和音はキーを固定しない度数で書く。bass はベースの度数（分数コードのとき）、label は表示名
// display は画面に出す度数（短調の進行で、短調の度数を出すとき）。和音は長調の度数で組む
const c = (chord, { bass = null, label = chord, display = null } = {}) => Object.freeze({ chord, bass, label, display });
// 三角形＋ベースで作る和音（2026-11-14 発案者の進行の追加で使う）
const m7 = (deg, tri) => c(tri, { bass: deg, label: `${deg}m7` }); // 例 IIm7 ＝ 三角形 IV ＋ ベース II
const dom7 = (deg, tri) => c(tri, { bass: deg, label: `${deg}7` }); // 例 V7 ＝ 三角形 VIIdim ＋ ベース V
const maj7 = (deg, tri) => c(tri, { bass: deg, label: `${deg}maj7` }); // 例 Imaj7 ＝ 三角形 IIIm ＋ ベース I
const slash = (tri, bass) => c(tri, { bass, label: `${tri}/${bass}` }); // 分数コード 例 V/VII
const as = (entry, display) => Object.freeze({ ...entry, display }); // 短調の度数で出す

// 1曲は8小節（8つの星）、4小節で1フレーズ（要件6.5）
export const BARS = 8;
export const PHRASE = 4;

export const PROGRESSIONS = Object.freeze([
  { id: 'one-three-five-six', name: '1→3m→5→6m', chords: [c('I'), c('IIIm'), c('V'), c('VIm')] },
  { id: 'royal-road', name: '王道進行', chords: [c('VIm', { bass: 'IV', label: 'IVmaj7' }), c('V'), c('V', { bass: 'III', label: 'IIIm7' }), c('VIm')] },
  { id: 'canon', name: 'カノン進行', chords: ['I', 'V', 'VIm', 'IIIm', 'IV', 'I', 'IV', 'V'].map(x => c(x)) },
  { id: 'komuro', name: 'TK進行', chords: [c('VIm'), c('IV'), c('V'), c('I')] },
  { id: 'marusa', name: '丸サ進行', chords: [c('VIm', { bass: 'IV', label: 'IVmaj7' }), c('III'), c('I', { bass: 'VI', label: 'VIm7' }), c('I')] },
  // ここから 2026-11-14 発案者が調べた進行（docs/design/コード進行の候補_Q-10.md）。mood は発案者の資料の雰囲気
  { id: 'jpop-royal', name: '王道J-POP展開', mood: '爽やか・ドラマチック', chords: [c('IV'), c('V'), c('IIIm'), c('VIm'), c('IIm'), c('V'), c('I'), dom7('I', 'IIIdim')] },
  { id: 'emo', name: '切ない・エモい展開', mood: 'バラード・哀愁', chords: ['VIm', 'IV', 'I', 'V', 'VIm', 'IIIm', 'IV', 'V'].map(x => c(x)) },
  { id: 'cliche', name: 'ベース下降・クリシェ', mood: 'おしゃれ・物語風', chords: [c('I'), slash('V', 'VII'), c('VIm'), slash('I', 'V'), c('IV'), slash('I', 'III'), c('IIm'), c('V')] },
  { id: 'b-melo', name: '盛り上げ・Bメロ定番', mood: '期待感・サビ前', chords: [c('IV'), c('V'), c('IIIm'), c('VIm'), c('IV'), c('V'), dom7('III', '♯Vdim'), c('VIm')] },
  { id: 'seishun', name: '切なさ＋希望', mood: '青春・アニソン系', chords: ['VIm', 'V', 'IV', 'I', 'IIm', 'IIIm', 'IV', 'V'].map(x => c(x)) },
  { id: 'ii-v-i', name: 'II–V–I', mood: 'ジャズ', chords: [m7('II', 'IV'), dom7('V', 'VIIdim'), maj7('I', 'IIIm'), maj7('I', 'IIIm')] },
  { id: 'i-vi-ii-v', name: 'I–VI–II–V', mood: 'ジャズ', chords: [maj7('I', 'IIIm'), dom7('VI', '♯Idim'), m7('II', 'IV'), dom7('V', 'VIIdim')] },
  // 平行調の II–V–I：長調の II-V-I-IV から、平行調の短調の II-V-I へ（例 キー Gm：Cm7 F7 B♭maj7 E♭maj7 ／ Am7(♭5) D7 Gm7 Gm7）。
  // 和音は平行調の長調の度数で組み、画面は短調のキーと度数で出す
  { id: 'relative-ii-v-i', name: '平行調の II–V–I', mood: 'ジャズ', mode: 'minor', chords: [
    as(m7('II', 'IV'), 'IVm7'), as(dom7('V', 'VIIdim'), '♭VII7'), as(maj7('I', 'IIIm'), '♭IIImaj7'), as(maj7('IV', 'VIm'), '♭VImaj7'),
    as(c('IIm', { bass: 'VII', label: 'VIIm7(♭5)' }), 'IIm7(♭5)'), as(dom7('III', '♯Vdim'), 'V7'), as(c('I', { bass: 'VI', label: 'VIm7' }), 'Im7'), as(c('I', { bass: 'VI', label: 'VIm7' }), 'Im7')] }
].map(p => Object.freeze({ ...p, chords: Object.freeze(p.chords) })));

// 選択プレイの固定（要件6.5【想定】：試作と同じカノン進行・キーC・種）。おとりの本数は試作の値
export const SELECT_PLAY = Object.freeze({ progression: 'canon', key: 0, seed: 20261113, decoys: 3 });
