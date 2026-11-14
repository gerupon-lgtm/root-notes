// コード進行のデータ（要件6.5。種類と数は試作の5種【想定】、Q-10 で未決）。
// 和音はキーを固定しない度数で書く。bass はベースの度数（分数コードのとき）、label は表示名
const c = (chord, { bass = null, label = chord } = {}) => Object.freeze({ chord, bass, label });

// 1曲は8小節（8つの星）、4小節で1フレーズ（要件6.5）
export const BARS = 8;
export const PHRASE = 4;

export const PROGRESSIONS = Object.freeze([
  { id: 'one-three-five-six', name: '1→3m→5→6m', chords: [c('I'), c('IIIm'), c('V'), c('VIm')] },
  { id: 'royal-road', name: '王道進行', chords: [c('VIm', { bass: 'IV', label: 'IVmaj7' }), c('V'), c('V', { bass: 'III', label: 'IIIm7' }), c('VIm')] },
  { id: 'canon', name: 'カノン進行', chords: ['I', 'V', 'VIm', 'IIIm', 'IV', 'I', 'IV', 'V'].map(x => c(x)) },
  { id: 'komuro', name: 'TK進行', chords: [c('VIm'), c('IV'), c('V'), c('I')] },
  { id: 'marusa', name: '丸サ進行', chords: [c('VIm', { bass: 'IV', label: 'IVmaj7' }), c('III'), c('I', { bass: 'VI', label: 'VIm7' }), c('I')] }
].map(p => Object.freeze({ ...p, chords: Object.freeze(p.chords) })));

// 選択プレイの固定（要件6.5【想定】：試作と同じカノン進行・キーC・種）。おとりの本数は試作の値
export const SELECT_PLAY = Object.freeze({ progression: 'canon', key: 0, seed: 20261113, decoys: 3 });
