// ステージの生成（F-023。docs/design/段階2_ステージの生成.md 2章）。
// 進行・キー・種・おとりの本数から、8小節（8つの星）のステージを作る。
// 各小節：和音に合う純正な三角形を選び、最低音（最長辺）が平均律の音になるように K を決め、おとりの棒を足す。
import { len, closes, compareLength, sameLengths, sortLengths, lengthValue } from './length.js';
import { TRIADS } from './chord.js';
import { parseChord, degreePc, midiToHz, chordName } from './harmony.js';
import { pureTriangles } from './voicing.js';
import { mulberry32, shuffle, pickOne } from './random.js';
import { PROGRESSIONS, BARS } from '../content/progressions.js';
import { STAGE_RULES } from '../content/stage-rules.js';

// 音域 [low, high] の中で、その音名（0〜11）になるいちばん低い MIDI 番号
const midiInRange = (pc, [low]) => low + (((pc - low) % 12) + 12) % 12;

// 三角形をキーと和音に置く：最低音の MIDI 番号と、基準の音 K（f ＝ K ÷ 長さ。C-01）
export function placeVoicing({ key, chord, voicing }) {
  const bassPc = (degreePc(key, chord.degree) + (chord.shift ?? 0) + TRIADS[chord.quality][voicing.inversion] + 12) % 12;
  const lowMidi = midiInRange(bassPc, STAGE_RULES.lowMidi);
  const longest = sortLengths(voicing.target)[2];
  return { lowMidi, K: midiToHz(lowMidi) * lengthValue(longest) };
}

// 正解の最低音を基準にした、その長さの音名（0〜11）。平均律からのずれが上限を超える音は null
function noteOf(base, l) {
  const cents = 1200 * Math.log2(lengthValue(base) / lengthValue(l));
  const semi = Math.round(cents / 100);
  return Math.abs(cents - 100 * semi) <= STAGE_RULES.maxOffsetCents ? ((semi % 12) + 12) % 12 : null;
}
const nameSet = notes => [...new Set(notes)].sort((a, b) => a - b).join(',');

function* triples(xs) {
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) for (let k = j + 1; k < xs.length; k++) yield [xs[i], xs[j], xs[k]];
}

// 棒の中で、正解とは別に「同じ和音に聞こえる、閉じる三角形」（設計メモ5章）を短い順の3本で返す。
// mode：'all' は同じ音名の組をすべて、'same-bass' は最低音まで同じものだけ、'none' は数えない
export function soundAlikes(sticks, target, mode = STAGE_RULES.avoidSoundAlike, { mustInclude = null } = {}) {
  if (mode === 'none') return [];
  if (mode !== 'all' && mode !== 'same-bass') throw new Error(`おとりの避け方「${mode}」は使えません。`);
  const base = sortLengths(target)[2];
  const want = nameSet(target.map(l => noteOf(base, l)));
  const found = [];
  for (const t of triples(sticks)) {
    if (mustInclude && !t.includes(mustInclude)) continue;
    if (sameLengths(t, target) || !closes(t)) continue;
    const notes = t.map(l => noteOf(base, l));
    if (notes.includes(null) || nameSet(notes) !== want) continue;
    const sorted = sortLengths(t);
    if (mode === 'same-bass' && compareLength(sorted[2], base) !== 0) continue;
    found.push(sorted);
  }
  return found;
}

// おとりの棒を選ぶ：正解と違う長さを混ぜて順に見て、避ける三角形ができないものだけを足す
function chooseSticks(target, count, rng) {
  const { minLength, maxLength } = STAGE_RULES;
  const used = new Set(target.map(l => l.n));
  const pool = [];
  for (let n = minLength; n <= maxLength; n++) if (!used.has(n)) pool.push(len(n));
  if (!Number.isInteger(count) || count < 0 || count > pool.length) throw new Error(`おとりの本数は0〜${pool.length}本にしてください：${count}`);
  const sticks = [...target];
  for (const candidate of shuffle(pool, rng)) {
    if (sticks.length === target.length + count) break;
    const trial = [...sticks, candidate];
    if (soundAlikes(trial, target, STAGE_RULES.avoidSoundAlike, { mustInclude: candidate }).length === 0) sticks.push(candidate);
  }
  if (sticks.length < target.length + count) throw new Error(`おとりの棒を${count}本選べませんでした。`);
  return Object.freeze(sortLengths(sticks));
}

export function buildRun({ progression, key, seed, decoys }) {
  const prog = PROGRESSIONS.find(p => p.id === progression);
  if (!prog) throw new Error(`進行「${progression}」がありません。`);
  if (!Number.isInteger(key) || key < 0 || key > 11) throw new Error(`キーは0〜11で指定してください：${key}`);
  const rng = mulberry32(seed);
  const stages = Array.from({ length: BARS }, (_, bar) => {
    const entry = prog.chords[bar % prog.chords.length];
    const chord = Object.freeze(parseChord(entry.chord));
    const options = pureTriangles().filter(v => v.quality === chord.quality);
    if (!options.length) throw new Error(`${entry.chord} に合う三角形がありません。`);
    const voicing = pickOne(options, rng);
    const { lowMidi, K } = placeVoicing({ key, chord, voicing });
    const bass = entry.bass ? parseChord(entry.bass) : chord;
    const bassDegree = bass.degree, bassShift = bass.shift ?? 0;
    const bassMidi = midiInRange((degreePc(key, bassDegree) + bassShift + 12) % 12, STAGE_RULES.bassMidi);
    const sticks = chooseSticks(voicing.target, decoys, rng);
    // label は画面に出す度数（短調の進行は短調の度数）、chordName はキーのコードネーム
    return Object.freeze({ bar, label: entry.display ?? entry.label, chordName: chordName(entry.label, key), chord, bassDegree, bassShift, target: voicing.target, inversion: voicing.inversion, lowMidi, K, bassMidi, sticks });
  });
  return Object.freeze({ progression: Object.freeze({ id: prog.id, name: prog.name, mode: prog.mode ?? 'major' }), key, seed, decoys, stages: Object.freeze(stages) });
}
