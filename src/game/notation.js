// 五線譜に書く音符（2026-11-14 発案者：コード進行を鳴らすとき、五線譜で鳴っている音符を見せる）。画面に触れない。
// - 高さ：和音の中は純正律だが、譜面には一番近い平均律の音を書く（最低音は平均律に置いてある）
// - 綴り：和音の音は根音の文字から3度・5度で数える。ベースはキーの音階の文字で綴る（例：キー F♯ の VII は E♯）
// - step：五線の上の位置（C0 を0として、白鍵1つで1上がる）。譜面の高さの計算に使う
import { frequencies } from '../core/pitch.js';
import { TRIADS } from '../core/chord.js';
import { chordName, degreePc, degreeLetter, spellFromRoot, LETTER_NAMES } from '../core/harmony.js';

const NATURAL = [0, 2, 4, 5, 7, 9, 11];

function note(midi, letter, shift) {
  const natural = midi - shift;
  const octave = Math.floor(natural / 12) - 1;
  return { midi, letter: LETTER_NAMES[letter], letterIndex: letter, shift, accidental: shift > 0 ? '♯'.repeat(shift) : '♭'.repeat(-shift), natural, octave, step: octave * 7 + letter };
}

// 綴りが決まらない音（和音の音でないとき）は、キーの向き（♯系か♭系か）で近い文字を選ぶ
function fallback(midi, preferFlat) {
  const pc = ((midi % 12) + 12) % 12;
  for (const shift of preferFlat ? [0, -1, 1] : [0, 1, -1]) {
    const letter = NATURAL.indexOf((pc - shift + 12) % 12);
    if (letter >= 0) return note(midi, letter, shift);
  }
  throw new Error(`音を綴れません：${midi}`);
}

export const noteName = n => `${n.letter}${n.accidental}${n.octave}`;

// 1小節ぶんの音符：三角形の3音（低い順）とベース。label は度数、name はキーのコードネーム
export function staffColumn(stage, key) {
  const fs = frequencies(stage.target, stage.K);
  const rootLetter = degreeLetter(key, stage.chord.degree), rootPc = (degreePc(key, stage.chord.degree) + (stage.chord.shift ?? 0) + 12) % 12;
  const tones = TRIADS[stage.chord.quality];
  const preferFlat = [1, 3, 5, 8, 10].includes(key);
  const chord = fs.map(f => {
    const midi = stage.lowMidi + Math.round(12 * Math.log2(f / fs[0]));
    const semitones = (((midi - rootPc) % 12) + 12) % 12;
    if (!tones.includes(semitones)) return fallback(midi, preferFlat);
    const { letter, shift } = spellFromRoot(rootLetter, rootPc, semitones);
    return note(midi, letter, shift);
  });
  const bassLetter = degreeLetter(key, stage.bassDegree);
  const bassShift = ((((stage.bassMidi % 12) - NATURAL[bassLetter]) + 18) % 12) - 6;
  return { label: stage.label, name: stage.chordName ?? chordName(stage.label, key), chord, bass: note(stage.bassMidi, bassLetter, bassShift) };
}
