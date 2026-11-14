// ステージの生成の機械検査（AC-11・C-03・F-014。docs/design/段階2_ステージの生成.md 6章）。
// どの進行・キー・おとりの本数・種でも、生成した全ステージで
// 「正解の組が棒の中にちょうど1組あり、その三角形が閉じる」ことなどを確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import { closes, sameLengths, sortLengths, formatLength } from '../src/core/length.js';
import { frequency } from '../src/core/pitch.js';
import { chordOf } from '../src/core/chord.js';
import { parseChord, degreePc, midiToHz } from '../src/core/harmony.js';
import { pureTriangles } from '../src/core/voicing.js';
import { buildRun, placeVoicing, soundAlikes, seventhKind } from '../src/core/stage-gen.js';
import { PROGRESSIONS, SELECT_PLAY, BARS } from '../src/content/progressions.js';
import { STAGE_RULES } from '../src/content/stage-rules.js';

const TRIAD_TONES = { major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6] };
const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919);
const triples = xs => {
  const out = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) for (let k = j + 1; k < xs.length; k++) out.push([xs[i], xs[j], xs[k]]);
  return out;
};
const show = ls => ls.map(formatLength).join('·');
// 正解以外で、純正な三角形（閉じる・三和音・純正さ・広がりの条件を満たす）になる3本の数
const pureKeys = new Set(pureTriangles({ maxOffsetCents: Infinity }).map(v => v.target.map(l => l.n).join()));
const lookalikes = (sticks, target) => triples(sticks).filter(t => !sameLengths(t, target) && pureKeys.has(sortLengths(t).map(l => l.n).join())).length;

function checkStage(stage, { key, decoys, where }) {
  const { sticks, target, K } = stage;
  // 棒：本数、2〜24、重ならない、短い順
  assert.equal(sticks.length, 3 + decoys, where);
  const ns = sticks.map(l => l.n);
  assert.ok(sticks.every(l => !l.r2 && l.n >= STAGE_RULES.minLength && l.n <= STAGE_RULES.maxLength), where);
  assert.equal(new Set(ns).size, ns.length, `${where} 長さが重なる`);
  assert.deepEqual(ns, [...ns].sort((a, b) => a - b), where);
  // 正解の組がちょうど1組、閉じる
  assert.equal(triples(sticks).filter(t => sameLengths(t, target)).length, 1, `${where} 正解の組の数`);
  assert.ok(closes(target), `${where} 閉じない`);
  // 和音の種類・転回形が小節の和音どおり
  const ch = chordOf(target);
  assert.equal(ch.quality, stage.chord.quality, where);
  assert.equal(ch.inversion, stage.inversion, where);
  // 最低音：キー・度数・転回形どおりの音名で、音域の中
  const bassPc = (degreePc(key, stage.chord.degree) + stage.chord.shift + TRIAD_TONES[stage.chord.quality][stage.inversion] + 12) % 12;
  assert.equal(stage.lowMidi % 12, bassPc, `${where} 最低音の音名`);
  assert.ok(stage.lowMidi >= STAGE_RULES.lowMidi[0] && stage.lowMidi <= STAGE_RULES.lowMidi[1], where);
  // 根音を平均律に置く（v0.16。要件5章「根音とベースラインは12平均律」）：K で計算した根音の周波数が平均律と一致。
  // 最低音は平均律から20セント以内（譜面には一番近い平均律の音を書く）
  const rootPc = (degreePc(key, stage.chord.degree) + stage.chord.shift + 12) % 12;
  assert.equal(stage.rootMidi % 12, rootPc, `${where} 根音の音名`);
  // 七の和音（v0.19）は、三角形を tuneCents だけずらして、ベースから見て純正にする
  const fr = frequency(stage.rootLength, K), wantRoot = midiToHz(stage.rootMidi) * 2 ** (stage.tuneCents / 1200);
  assert.ok(Math.abs(fr - wantRoot) / wantRoot < 1e-12, `${where} K（根音）`);
  const longest = sortLengths(target)[2];
  const lowCents = 1200 * Math.log2(frequency(longest, K) / midiToHz(stage.lowMidi)) - stage.tuneCents;
  assert.ok(Math.abs(lowCents) <= STAGE_RULES.maxOffsetCents + 1e-9, `${where} 最低音のずれ ${lowCents.toFixed(1)}セント`);
  const kind = seventhKind(stage.chordName); // キーのコードネーム（Dm7・G7・Fmaj7 など）から種類を判定
  if (kind) {
    // ベースから見た三角形の音（セント、オクターブを畳む）
    const fromBass = target.map(l => ((1200 * Math.log2(frequency(l, K) / midiToHz(stage.bassMidi))) % 1200 + 1200) % 1200).sort((a, b) => a - b);
    const near = (c, want) => fromBass.some(x => Math.abs(x - want) < 1e-6);
    const c = r => 1200 * Math.log2(r);
    if (kind === 'm7') assert.ok(near(0, c(6 / 5)) && near(0, c(3 / 2)) && near(0, c(9 / 5)), `${where} m7 が純正 ${fromBass}`);
    if (kind === 'maj7') assert.ok(near(0, c(5 / 4)) && near(0, c(3 / 2)) && near(0, c(15 / 8)), `${where} maj7 が純正 ${fromBass}`);
    if (kind === 'dom7') {
      // 3度と5度の、純正からのずれが同じ大きさ（約24セント）で向きが逆
      const e3 = fromBass[0] - c(5 / 4), e5 = fromBass[1] - c(3 / 2);
      assert.ok(Math.abs(e3 + e5) < 1e-6 && Math.abs(e3) < 25, `${where} 属七のずれ ${e3.toFixed(1)} ${e5.toFixed(1)}`);
    }
  } else assert.equal(stage.tuneCents, 0, where);
  // ベースが根音のとき、ベースと三角形の根音はちょうどオクターヴ（うならない）
  if (stage.bassDegree === stage.chord.degree && stage.bassShift === stage.chord.shift) {
    const octaves = Math.log2(fr / midiToHz(stage.bassMidi));
    assert.ok(Math.abs(octaves - Math.round(octaves)) < 1e-9, `${where} ベースと根音のオクターヴ`);
  }
  // 並び：棒を見せる順は混ぜてある（短い順の隣り合いで正解が分からないように。2026-11-14 発案者）
  assert.deepEqual([...stage.order].sort((x, y) => x - y), sticks.map((_, i) => i), `${where} 並び`);
  const pos = target.map(t => stage.order.indexOf(sticks.findIndex(x => x.n === t.n))).sort((x, y) => x - y);
  assert.ok(pos[2] - pos[0] > 2, `${where} 正解の3本が隣り合って見える`);
  // ひっかけ：正解とは別に、純正な三角形が棒の中に少なくとも1つある（数字のパターンだけでは決められないように）
  assert.ok(lookalikes(sticks, target) >= 1, `${where} ひっかけの三角形がない`);
  // トップノート（三角形の一番高い音）は C5（MIDI 72）以下（2026-11-14 発案者）
  assert.ok(stage.topMidi <= STAGE_RULES.maxTopMidi, `${where} トップノート ${stage.topMidi}`);
  // ベース：小節のベースの度数どおりの音名で、音域の中
  assert.equal(stage.bassMidi % 12, (degreePc(key, stage.bassDegree) + stage.bassShift + 12) % 12, where);
  assert.ok(stage.bassMidi >= STAGE_RULES.bassMidi[0] && stage.bassMidi <= STAGE_RULES.bassMidi[1], where);
  // おとりの選び方（5章）：避けると決めた「同じ和音に聞こえる三角形」が無い
  const bad = soundAlikes(sticks, target, STAGE_RULES.avoidSoundAlike);
  assert.equal(bad.length, 0, `${where} ${bad.map(show).join(' / ')}`);
}

test('機械検査：すべての進行 × 12キー × おとり3〜5本 × 種12通りの全ステージ（AC-11・C-03）', () => {
  let count = 0;
  for (const progression of PROGRESSIONS) {
    for (let key = 0; key < 12; key++) {
      for (const decoys of [3, 4, 5]) {
        for (const seed of SEEDS) {
          const run = buildRun({ progression: progression.id, key, seed, decoys });
          assert.equal(run.stages.length, BARS);
          run.stages.forEach((stage, bar) => {
            const want = progression.chords[bar % progression.chords.length];
            assert.equal(stage.label, want.display ?? want.label);
            checkStage(stage, { key, decoys, where: `${progression.name} key${key} おとり${decoys} 種${seed} ${bar + 1}小節` });
            count++;
          });
        }
      }
    }
  }
  assert.equal(count, PROGRESSIONS.length * 12 * 3 * SEEDS.length * BARS);
});

test('機械検査：すべての純正な三角形を、すべてのキーと度数に置いても、最低音と根音と K が正しい', () => {
  for (const voicing of pureTriangles()) {
    for (let key = 0; key < 12; key++) {
      for (let degree = 0; degree < 7; degree++) {
        const placed = placeVoicing({ key, chord: { degree, quality: voicing.quality }, voicing });
        const bassPc = (degreePc(key, degree) + TRIAD_TONES[voicing.quality][voicing.inversion]) % 12;
        assert.equal(placed.lowMidi % 12, bassPc);
        const f = frequency(placed.rootLength, placed.K), want = midiToHz(placed.rootMidi);
        assert.ok(Math.abs(f - want) / want < 1e-12);
        assert.equal(placed.rootMidi % 12, degreePc(key, degree));
      }
    }
  }
});

test('進行に出てくる和音の種類には、選べる三角形が必ずある', () => {
  const qualities = new Set(PROGRESSIONS.flatMap(p => p.chords.map(c => parseChord(c.chord).quality)));
  for (const q of qualities) assert.ok(pureTriangles().some(v => v.quality === q), q);
});

test('同じ進行・キー・種・おとりの本数なら、同じステージになる（選択プレイの固定）', () => {
  const a = buildRun(SELECT_PLAY), b = buildRun(SELECT_PLAY);
  assert.deepEqual(a, b);
  assert.equal(a.progression.name, 'カノン進行');
  assert.equal(a.key, 0);
  const c = buildRun({ ...SELECT_PLAY, seed: SELECT_PLAY.seed + 1 });
  assert.notDeepEqual(a.stages.map(s => show(s.sticks)), c.stages.map(s => show(s.sticks)));
});

test('同じ和音に聞こえる三角形の見分け：最低音まで同じもの、転回形違い', () => {
  const L = (...ns) => ns.map(n => ({ n, r2: false }));
  // 正解 10·12·15 に 6 → 6·10·15 は最低音（15）まで同じ
  assert.deepEqual(soundAlikes(L(6, 10, 12, 15), L(10, 12, 15), 'same-bass').map(show), ['6·10·15']);
  // 正解 3·4·5 に 6 → 4·5·6 は最低音が違う（転回形違い）。same-bass では数えない、all では数える
  assert.deepEqual(soundAlikes(L(3, 4, 5, 6), L(3, 4, 5), 'same-bass'), []);
  assert.deepEqual(soundAlikes(L(3, 4, 5, 6), L(3, 4, 5), 'all').map(show), ['4·5·6']);
  // 避けない設定では何も数えない
  assert.deepEqual(soundAlikes(L(6, 10, 12, 15), L(10, 12, 15), 'none'), []);
});

test('知らない進行や、多すぎるおとりは止める', () => {
  assert.throws(() => buildRun({ progression: 'no-such', key: 0, seed: 1, decoys: 3 }), /進行/);
  assert.throws(() => buildRun({ progression: PROGRESSIONS[0].id, key: 12, seed: 1, decoys: 3 }), /キー/);
  assert.throws(() => buildRun({ progression: PROGRESSIONS[0].id, key: 0, seed: 1, decoys: 30 }), /おとり/);
});
