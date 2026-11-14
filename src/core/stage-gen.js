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

// 三角形をキーと和音に置く：最低音の MIDI 番号、根音の MIDI 番号と辺、基準の音 K（f ＝ K ÷ 長さ。C-01）。
// 根音を平均律に置き、和音の中は根音から純正律で積む（v0.16。要件5章「根音とベースラインは12平均律」）。
// 旧：最低音を平均律に置いていた。転回形では根音と5度が平均律から最大約16セントずれ、曲のベースとうなった（2026-11-14 発案者の実機テスト）
export function placeVoicing({ key, chord, voicing }) {
  const shift = chord.shift ?? 0;
  const bassPc = (degreePc(key, chord.degree) + shift + TRIADS[chord.quality][voicing.inversion] + 12) % 12;
  const lowMidi = midiInRange(bassPc, STAGE_RULES.lowMidi); // 譜面と音域のための、最低音に一番近い平均律の音
  const sides = sortLengths(voicing.target);
  const longest = sides[2];
  // 最低音から見た各辺の半音の数と、根音の辺
  const semis = sides.map(l => Math.round(12 * Math.log2(lengthValue(longest) / lengthValue(l))));
  const rootRel = (12 - TRIADS[chord.quality][voicing.inversion]) % 12;
  const at = semis.findIndex(x => x % 12 === rootRel);
  const rootLength = sides[at], rootMidi = lowMidi + semis[at];
  const topMidi = lowMidi + semis[0]; // 一番高い音（一番短い辺）に一番近い平均律の音
  return { lowMidi, rootMidi, rootLength, topMidi, K: midiToHz(rootMidi) * lengthValue(rootLength) };
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
  // ひっかけ：正解とは別の純正な三角形（響きの違う和音）を、少なくとも1つ作れるようにする。
  // 数字のパターン（4·5·6 など）や並びだけでは決められず、音を聞いて選ぶようにするため（2026-11-14 発案者）。
  // 同じ音名の組の三角形は作らない決まり（B案）を守るので、ひっかけは必ず響きが違う。足す棒が少ないものを優先する
  const have = new Set(target.map(l => l.n));
  const plans = shuffle(pureTriangles().filter(v => !sameLengths(v.target, target)), rng)
    .map(v => v.target.filter(l => !have.has(l.n)))
    .filter(add => add.length >= 1 && add.length <= count)
    .sort((a, b) => a.length - b.length);
  for (const add of plans) {
    const trial = [...sticks, ...add];
    if (soundAlikes(trial, target, STAGE_RULES.avoidSoundAlike).length === 0) { sticks.push(...add); break; }
  }
  for (const candidate of shuffle(pool.filter(l => !sticks.some(x => x.n === l.n)), rng)) {
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
    // その和音に合う三角形のうち、置いたときにトップノートが上限（C5）を超えないもの
    const options = pureTriangles().filter(v => v.quality === chord.quality && placeVoicing({ key, chord, voicing: v }).topMidi <= STAGE_RULES.maxTopMidi);
    if (!options.length) throw new Error(`${entry.chord} に合う三角形がありません。`);
    const voicing = pickOne(options, rng);
    const { lowMidi, rootMidi, rootLength, topMidi, K } = placeVoicing({ key, chord, voicing });
    const bass = entry.bass ? parseChord(entry.bass) : chord;
    const bassDegree = bass.degree, bassShift = bass.shift ?? 0;
    const bassMidi = midiInRange((degreePc(key, bassDegree) + bassShift + 12) % 12, STAGE_RULES.bassMidi);
    const sticks = chooseSticks(voicing.target, decoys, rng);
    // 棒を見せる並び（短い順の番号を混ぜたもの）。隣り合う3本で正解が分からないように（2026-11-14 発案者）。
    // 偶然でも正解の3本が隣り合って見えると並びで分かると感じさせるので、そのときは混ぜ直す
    const answerAt = voicing.target.map(t => sticks.findIndex(x => x.n === t.n));
    const together = ord => { const pos = answerAt.map(i => ord.indexOf(i)).sort((x, y) => x - y); return pos[2] - pos[0] === 2; };
    let shuffled = shuffle(sticks.map((_, i) => i), rng);
    for (let tries = 0; tries < 30 && together(shuffled); tries++) shuffled = shuffle(shuffled, rng);
    const order = Object.freeze(shuffled);
    // label は画面に出す度数（短調の進行は短調の度数）、chordName はキーのコードネーム
    return Object.freeze({ bar, label: entry.display ?? entry.label, chordName: chordName(entry.label, key), chord, bassDegree, bassShift, target: voicing.target, inversion: voicing.inversion, lowMidi, rootMidi, rootLength, topMidi, K, bassMidi, sticks, order });
  });
  return Object.freeze({ progression: Object.freeze({ id: prog.id, name: prog.name, mode: prog.mode ?? 'major' }), key, seed, decoys, stages: Object.freeze(stages) });
}
