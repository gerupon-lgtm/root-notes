// 度数と音名（要件6.5：進行はキーを固定しない度数で持つ）。根音とベースは12平均律に置く（要件5章）
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// 長音階の度数 → 主音からの半音の数
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
// キーの表示名（表示は段階3で見直す。A区分）
const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

// 'VIm' → { degree: 5, quality: 'minor' }（degree は 0 始まり）
export function parseChord(text) {
  const m = /^(VII|VI|V|IV|III|II|I)(m|dim)?$/.exec(text);
  if (!m) throw new Error(`和音の書き方が読めません：${text}`);
  return { degree: ROMAN.indexOf(m[1]), quality: m[2] === 'm' ? 'minor' : m[2] === 'dim' ? 'diminished' : 'major' };
}

// キー（0＝C … 11＝B）と度数から、その音名（0〜11）
export const degreePc = (key, degree) => (key + MAJOR_SCALE[degree]) % 12;

// 平均律の周波数（ラ＝MIDI 69＝440Hz）
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);

export const keyName = key => KEY_NAMES[key];
