// ステージの生成（F-023。docs/design/段階2_ステージの生成.md 2章）。
// 進行・キー・種・おとりの本数から、8小節（8つの星）のステージを作る。
// 各小節：和音に合う純正な三角形を選び、最低音（最長辺）が平均律の音になるように K を決め、おとりの棒を足す。
import { len, closes, compareLength, sameLengths, sortLengths, lengthValue } from './length.js';
import { TRIADS, chordOf } from './chord.js';
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

// 七の和音（三角形の三和音＋ベース）の置き方（v0.19。2026-11-14 発案者「F♯m7 が歪む」）。
// 和音の根音はベースで、平均律に置く。三角形は、ベースから見て純正になる高さへずらす（セント）。
//   m7  ：三角形の根音はベースの短3度上（6/5、316c）→ 5度 3/2・7度 9/5 も純正になる
//   maj7：三角形の根音はベースの長3度上（5/4、386c）→ 5度 3/2・7度 15/8 も純正になる
//   7   ：減三和音の三角形は音程の並び（7/6 の上に 6/5）が純正な属七（6/5 の上に 7/6）と逆で、純正にはできない
//         （純正な属七には長さ 30·35·42 が要り、棒の範囲 2〜24 を超える）。3度と5度のずれが同じ大きさ（約±24c）になる高さに置く（発案者：ずれを3音に分ける）
//   m7(♭5)：三角形の根音はベースの短3度上（6/5）。ベースから見て 3度 6/5・♭5度 36/25・7度 9/5（25：30：36：45）になる
//         （2026-11-15 発案者。旧：三角形の根音を平均律に置き、ベースとの短3度が約16セントずれてうなっていた）
//   分数コードは、今までどおり三角形の根音を平均律に置く
const cents = r => 1200 * Math.log2(r);
export const SEVENTH_TUNING = Object.freeze({
  m7: Object.freeze({ above: 3, cents: cents(6 / 5) }),
  m7b5: Object.freeze({ above: 3, cents: cents(6 / 5) }),
  maj7: Object.freeze({ above: 4, cents: cents(5 / 4) }),
  dom7: Object.freeze({ above: 4, cents: (cents(5 / 4) + cents(3 / 2) - cents(7 / 6)) / 2 })
});
// 表示名から七の和音の種類（分数コードは null）
export function seventhKind(label) {
  if (label.includes('/')) return null;
  if (label.endsWith('m7(♭5)')) return 'm7b5';
  if (label.endsWith('maj7')) return 'maj7';
  if (label.endsWith('m7')) return 'm7';
  if (label.endsWith('7')) return 'dom7';
  return null;
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
  if (progression === MIRROR.id) return buildMirrorRun({ key, seed, decoys });
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
    const placed = placeVoicing({ key, chord, voicing });
    const { lowMidi, rootMidi, rootLength, topMidi } = placed;
    const bass = entry.bass ? parseChord(entry.bass) : chord;
    const bassDegree = bass.degree, bassShift = bass.shift ?? 0;
    const bassPc = (degreePc(key, bassDegree) + bassShift + 12) % 12;
    const bassMidi = midiInRange(bassPc, STAGE_RULES.bassMidi);
    // 七の和音は、三角形をベースから見て純正になる高さへずらす（上の SEVENTH_TUNING）
    const kind = seventhKind(entry.label);
    let K = placed.K, tuneCents = 0;
    if (kind) {
      const t = SEVENTH_TUNING[kind];
      const above = (((rootMidi - bassPc) % 12) + 12) % 12;
      if (above !== t.above) throw new Error(`${entry.label}：三角形の根音がベースの${t.above}半音上にありません（${above}半音）。`);
      tuneCents = t.cents - 100 * t.above;
      K *= 2 ** (tuneCents / 1200);
    }
    // 分数コードでベースが和音の3度のとき（G/B・C/E など）は、ベースを三角形の3度にちょうど合わせる（v0.19。発案者：A）。
    // 三角形の3度は根音から純正律で積むので平均律から約14セントずれ、平均律のベースとオクターブ違いでうなっていた。
    // 三角形（和音の根音）は平均律のまま、その小節のベースだけを動かす。ベースが5度のとき（C/G）はずれが2セントなので動かさない
    let bassCents = 0;
    if (entry.label.includes('/') && bassPc === (rootMidi + TRIADS[chord.quality][1]) % 12) {
      const thirdLength = voicing.target.find(l => (((Math.round(12 * Math.log2(lengthValue(rootLength) / lengthValue(l))) % 12) + 12) % 12) === TRIADS[chord.quality][1]);
      const c = 1200 * Math.log2((K / lengthValue(thirdLength)) / midiToHz(bassMidi));
      bassCents = c - 1200 * Math.round(c / 1200);
    }
    const sticks = chooseSticks(voicing.target, decoys, rng);
    // 棒を見せる並び（短い順の番号を混ぜたもの）。隣り合う3本で正解が分からないように（2026-11-14 発案者）。
    // 偶然でも正解の3本が隣り合って見えると並びで分かると感じさせるので、そのときは混ぜ直す
    const answerAt = voicing.target.map(t => sticks.findIndex(x => x.n === t.n));
    const together = ord => { const pos = answerAt.map(i => ord.indexOf(i)).sort((x, y) => x - y); return pos[2] - pos[0] === 2; };
    let shuffled = shuffle(sticks.map((_, i) => i), rng);
    for (let tries = 0; tries < 30 && together(shuffled); tries++) shuffled = shuffle(shuffled, rng);
    const order = Object.freeze(shuffled);
    // label は画面に出す度数（短調の進行は短調の度数）、chordName はキーのコードネーム
    return Object.freeze({ bar, label: entry.display ?? entry.label, chordName: chordName(entry.label, key), chord, bassDegree, bassShift, target: voicing.target, inversion: voicing.inversion, lowMidi, rootMidi, rootLength, topMidi, K, tuneCents, bassMidi, bassCents, sticks, order });
  });
  return Object.freeze({ progression: Object.freeze({ id: prog.id, name: prog.name, mode: prog.mode ?? 'major' }), key, seed, decoys, stages: Object.freeze(stages) });
}

// ---------- 第3章「長調と短調」：光と影の組（2026-11-15 発案者：A案） ----------
// 2面で1組。光＝長調の三角形、影＝光の三角形の「周波数の比」をそのまま辺の比にした三角形（鏡写し）。
// 長さと音の高さは反比例するので、鏡写しの三角形は短調になる。基準の音 K を光と同じにすると、影は光の平行調の短調
// （例 ハ長調 10・12・15 → イ短調 12・15・18）になり、2本は同じ棒（同じ高さ）のまま、1本を替えるだけで明るい響きが影になる。
// 曲は「光 → その平行調の影」を4回：I → VIm → IV → IIm → V → IIIm → I → VIm（8小節）
export const MIRROR = Object.freeze({ id: 'mirror', name: '光と影', pairs: Object.freeze([['I', 'VIm'], ['IV', 'IIm'], ['V', 'IIIm'], ['I', 'VIm']]) });

// 長さの組 ns（整数）の鏡写しの候補すべて：c ÷ n が整数で、元の組と2本を共有するもの（棒の範囲の中）。
// 1つの組に2つあることがある（例 10・12・15 → 8・10・12（3度上の短調）と 12・15・18（平行調））。どれを使うかは呼ぶ側で決める
export function mirrorLengths(ns) {
  const { minLength, maxLength } = STAGE_RULES, out = [];
  for (let c = 1; c <= maxLength * maxLength; c++) {
    const m = ns.map(n => c / n);
    if (!m.every(x => Number.isInteger(x) && x >= minLength && x <= maxLength)) continue;
    if (m.filter(x => ns.includes(x)).length === 2) out.push(m.sort((a, b) => a - b));
  }
  return out;
}
// 鏡写しのうち、短調で、根音が平行調（影の度数）になるもの。K は光と同じ。なければ null
function relativeMirror(lightTarget, K, wantPc) {
  for (const m of mirrorLengths(lightTarget.map(l => l.n))) {
    const target = Object.freeze(m.map(n => len(n)));
    if (!closes(target)) continue; // 三角形にならない鏡写し（例 6・9・15）は使わない
    const info = chordOf(target);
    if (info?.quality !== 'minor') continue;
    const sorted = sortLengths(target), longest = sorted[2];
    const semis = sorted.map(l => Math.round(12 * Math.log2(lengthValue(longest) / lengthValue(l))));
    const rootRel = (12 - TRIADS.minor[info.inversion]) % 12;
    const rootLength = sorted[semis.findIndex(x => x % 12 === rootRel)];
    const rootHz = K / lengthValue(rootLength);
    if (((nearestMidi(rootHz) % 12) + 12) % 12 === wantPc) return { target, info, sorted, rootLength, rootHz };
  }
  return null;
}

const centsOf = r => 1200 * Math.log2(r);
const nearestMidi = hz => Math.round(69 + 12 * Math.log2(hz / 440));

function buildMirrorRun({ key, seed, decoys }) {
  if (!Number.isInteger(key) || key < 0 || key > 11) throw new Error(`キーは0〜11で指定してください：${key}`);
  const rng = mulberry32(seed);
  const stages = [];
  const finish = (bar, label, chord, target, placed, bassFor, extra) => {
    const sticks = chooseSticks(target, decoys, rng);
    const answerAt = target.map(t => sticks.findIndex(x => x.n === t.n));
    const together = ord => { const pos = answerAt.map(i => ord.indexOf(i)).sort((x, y) => x - y); return pos[2] - pos[0] === 2; };
    let shuffled = shuffle(sticks.map((_, i) => i), rng);
    for (let tries = 0; tries < 30 && together(shuffled); tries++) shuffled = shuffle(shuffled, rng);
    const bassPc = (degreePc(key, chord.degree) + (chord.shift ?? 0) + 12) % 12;
    const bassMidi = midiInRange(bassPc, STAGE_RULES.bassMidi);
    const bassCents = bassFor ? bassFor(bassMidi) : 0;
    return Object.freeze({ bar, label, chordName: chordName(label, key), chord, bassDegree: chord.degree, bassShift: chord.shift ?? 0, target, ...placed, bassMidi, bassCents, sticks, order: Object.freeze(shuffled), ...extra });
  };
  MIRROR.pairs.forEach(([lightLabel, shadowLabel], i) => {
    const light = Object.freeze(parseChord(lightLabel)), shadow = Object.freeze(parseChord(shadowLabel));
    // 光：長調の三角形のうち、鏡写しが棒の範囲にあり、どちらもトップノートが上限を超えないもの
    const shadowPc = degreePc(key, shadow.degree);
    const options = pureTriangles().filter(v => {
      if (v.quality !== light.quality) return false;
      const pl = placeVoicing({ key, chord: light, voicing: v });
      if (pl.topMidi > STAGE_RULES.maxTopMidi) return false;
      const m = relativeMirror(v.target, pl.K, shadowPc);
      return m !== null && nearestMidi(pl.K / lengthValue(m.sorted[0])) <= STAGE_RULES.maxTopMidi; // 影のトップノートも上限まで
    });
    if (!options.length) throw new Error(`${lightLabel} の光と影の三角形がありません。`);
    const voicing = pickOne(options, rng);
    const placed = placeVoicing({ key, chord: light, voicing });
    const lightTarget = voicing.target;
    stages.push(finish(i * 2, lightLabel, light, lightTarget,
      { inversion: voicing.inversion, lowMidi: placed.lowMidi, rootMidi: placed.rootMidi, rootLength: placed.rootLength, topMidi: placed.topMidi, K: placed.K, tuneCents: 0 },
      null, { side: 'light' }));
    // 影：同じ K で鏡写しの長さ。根音（短調の根音）は純正律で積んだ高さなので、平均律から少しずれる。ベースはその根音にちょうど合わせる
    const K = placed.K;
    const { target: shadowTarget, info, sorted, rootLength, rootHz } = relativeMirror(lightTarget, K, shadowPc);
    const longest = sorted[2];
    const rootMidi = nearestMidi(rootHz);
    stages.push(finish(i * 2 + 1, shadowLabel, shadow, shadowTarget,
      { inversion: info.inversion, lowMidi: nearestMidi(K / lengthValue(longest)), rootMidi, rootLength, topMidi: nearestMidi(K / lengthValue(sorted[0])), K, tuneCents: centsOf(rootHz / midiToHz(rootMidi)) },
      bassMidi => { const c = centsOf(rootHz / midiToHz(bassMidi)); return c - 1200 * Math.round(c / 1200); },
      { side: 'shadow', mirrorOf: i * 2 }));
  });
  return Object.freeze({ progression: Object.freeze({ id: MIRROR.id, name: MIRROR.name, mode: 'major' }), key, seed, decoys, stages: Object.freeze(stages) });
}

// ---------- 9小節目の締め（2026-11-15 発案者：8小節の演奏のあとは、すべてキーの主和音で締める） ----------
// 長調の進行は I、短調で表示する進行（平行調の II–V–I）は Im（長調の度数では VIm）。
// 進行の中に、その和音の三角形をベースが根音で鳴らす小節があれば、その小節をそのまま使う（同じ三角形・同じ基準の音・同じベース）。
// なければ（王道進行・II–V–I など）、今の決まり（根音を平均律、和音の中を純正律）で新しく三角形を選ぶ。種から決まるので、毎回同じになる
export function closingStage(run) {
  const tonic = Object.freeze(parseChord(run.progression.mode === 'minor' ? 'VIm' : 'I'));
  const same = run.stages.find(st => st.chord.degree === tonic.degree && st.chord.quality === tonic.quality && !(st.chord.shift ?? 0)
    && st.bassDegree === tonic.degree && !(st.bassShift ?? 0) && !st.tuneCents);
  if (same) return Object.freeze({ target: same.target, K: same.K, bassMidi: same.bassMidi, bassCents: same.bassCents ?? 0 });
  const options = pureTriangles().filter(v => v.quality === tonic.quality && placeVoicing({ key: run.key, chord: tonic, voicing: v }).topMidi <= STAGE_RULES.maxTopMidi);
  if (!options.length) throw new Error('主和音の三角形がありません。');
  const voicing = pickOne(options, mulberry32((run.seed ?? 0) + 9));
  const placed = placeVoicing({ key: run.key, chord: tonic, voicing });
  const bassMidi = midiInRange(degreePc(run.key, tonic.degree), STAGE_RULES.bassMidi);
  return Object.freeze({ target: voicing.target, K: placed.K, bassMidi, bassCents: 0 });
}
