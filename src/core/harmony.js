// 度数と音名（要件6.5：進行はキーを固定しない度数で持つ）。根音とベースは12平均律に置く（要件5章）
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// 長音階の度数 → 主音からの半音の数
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
// キーの書き方：主音の文字と変化記号（よく使う綴り。C♯ でなく D♭、G♭ でなく F♯）
const KEY_SPELL = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const accidental = n => (n > 0 ? '♯'.repeat(n) : '♭'.repeat(-n));

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

export const keyName = key => KEY_SPELL[key][0] + accidental(KEY_SPELL[key][1]);

// キーの音階の度数の音名を、キーの音階の文字で綴る（例：キー F♯ の VII は E♯）
export function spellDegree(key, degree) {
  const letter = (LETTERS.indexOf(KEY_SPELL[key][0]) + degree) % 7;
  const pc = degreePc(key, degree);
  const shift = ((pc - NATURAL[letter] + 18) % 12) - 6;
  return LETTERS[letter] + accidental(shift);
}

// 度数の書き方（I、IIIm、IVmaj7、VIm7 など）を、キーのコードネームにする（例：キー C の IVmaj7 → Fmaj7）
export function chordName(label, key) {
  const m = /^(VII|VI|V|IV|III|II|I)(|m|dim|maj7|m7|7)$/.exec(label);
  if (!m) throw new Error(`和音の書き方が読めません：${label}`);
  return spellDegree(key, ROMAN.indexOf(m[1])) + m[2];
}

// キーの調号：♯・♭の数（♯が正、♭が負）と、文字ごとの変化（C D E F G A B の順に −1・0・1）
const KEY_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
export function keySignature(key) {
  const fifths = KEY_FIFTHS[key];
  const alterations = new Array(7).fill(0);
  for (const letter of (fifths < 0 ? FLAT_ORDER : SHARP_ORDER).slice(0, Math.abs(fifths))) alterations[letter] = Math.sign(fifths);
  return { fifths, alterations };
}

// 音名の文字（0＝C … 6＝B）と、ずれ（♯が正）を、根音の文字から数えて決める
export function spellFromRoot(rootLetter, rootPc, semitones) {
  const letter = (rootLetter + (semitones === 0 ? 0 : semitones <= 4 ? 2 : 4)) % 7;
  const pc = (rootPc + semitones) % 12;
  return { letter, shift: ((pc - NATURAL[letter] + 18) % 12) - 6 };
}

// キーの音階の度数の、文字の番号（0＝C … 6＝B）
export const degreeLetter = (key, degree) => (LETTERS.indexOf(KEY_SPELL[key][0]) + degree) % 7;
export const LETTER_NAMES = LETTERS;
