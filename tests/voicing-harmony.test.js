// 純正な三角形の一覧、度数と音名、乱数（docs/design/段階2_ステージの生成.md 3・4章）
import test from 'node:test';
import assert from 'node:assert/strict';
import { closes, formatLength } from '../src/core/length.js';
import { pureTriangles } from '../src/core/voicing.js';
import { parseChord, degreePc, midiToHz, keyName, chordName } from '../src/core/harmony.js';
import { mulberry32, shuffle } from '../src/core/random.js';

const names = list => list.map(v => v.target.map(formatLength).join('·'));
const pick = (list, quality, inversion) => list.filter(v => v.quality === quality && v.inversion === inversion);

test('純正な三角形の一覧：転回形ごとの数が要件5章と一致する', () => {
  const list = pureTriangles();
  assert.deepEqual(names(pick(list, 'major', 0)), ['6·10·15', '10·12·15']);
  assert.deepEqual(names(pick(list, 'major', 1)), ['10·15·24', '15·20·24']);
  assert.deepEqual(names(pick(list, 'major', 2)), ['12·15·20']);
  assert.equal(pick(list, 'minor', 0).length, 6);
  assert.deepEqual(names(pick(list, 'minor', 1)), ['3·4·5', '6·8·10', '9·12·15', '12·16·20']);
  assert.equal(pick(list, 'minor', 2).length, 3);
  assert.deepEqual(names(pick(list, 'diminished', 2)), ['6·7·10', '12·14·20']);
  assert.equal(pick(list, 'diminished', 0).length + pick(list, 'diminished', 1).length, 0);
  assert.equal(list.length, 20);
});

test('純正な三角形の一覧：すべて2〜24・長さが重ならない・閉じる・広がり16半音以内', () => {
  for (const v of pureTriangles()) {
    const ns = v.target.map(l => l.n);
    assert.ok(ns.every(n => n >= 2 && n <= 24), ns.join());
    assert.equal(new Set(ns).size, 3);
    assert.ok(ns[0] < ns[1] && ns[1] < ns[2], '短い順');
    assert.ok(closes(v.target));
    assert.ok(v.span <= 16);
    assert.ok(v.quality === 'diminished' ? v.limit <= 7 : v.limit <= 5);
  }
});

test('20セントの条件を外すと、減三和音の基本形・第1転回形も入る（4章の確認）', () => {
  const loose = pureTriangles({ maxOffsetCents: Infinity });
  assert.ok(pick(loose, 'diminished', 0).length > 0);
  assert.ok(names(loose).includes('3·5·7'));
  // 長三和音・短三和音の数は変わらない
  for (const q of ['major', 'minor']) {
    assert.equal(loose.filter(v => v.quality === q).length, pureTriangles().filter(v => v.quality === q).length);
  }
});

test('度数の読み取り：ローマ数字と和音の種類', () => {
  assert.deepEqual(parseChord('I'), { degree: 0, quality: 'major' });
  assert.deepEqual(parseChord('IIIm'), { degree: 2, quality: 'minor' });
  assert.deepEqual(parseChord('VIm'), { degree: 5, quality: 'minor' });
  assert.deepEqual(parseChord('VIIdim'), { degree: 6, quality: 'diminished' });
  assert.deepEqual(parseChord('III'), { degree: 2, quality: 'major' });
  assert.throws(() => parseChord('VIII'), /読めません/);
});

test('キーと度数から音名（長音階）。キーC の I・IIIm・IV・V・VIm はド・ミ・ファ・ソ・ラ', () => {
  assert.deepEqual(['I', 'IIIm', 'IV', 'V', 'VIm'].map(c => degreePc(0, parseChord(c).degree)), [0, 4, 5, 7, 9]);
  assert.equal(degreePc(7, parseChord('IV').degree), 0); // キーG の IV は C
  assert.equal(keyName(0), 'C');
  assert.equal(keyName(10), 'B♭');
});

test('平均律の周波数：ラ（MIDI 69）＝440Hz、1オクターブ下は220Hz', () => {
  assert.equal(midiToHz(69), 440);
  assert.equal(midiToHz(57), 220);
  assert.ok(Math.abs(midiToHz(60) - 261.6255653) < 1e-6);
});

test('乱数：同じ種なら同じ並び。値は0以上1未満', () => {
  const a = mulberry32(20261113), b = mulberry32(20261113);
  const xs = Array.from({ length: 50 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, mulberry32(1)));
  const s = shuffle([1, 2, 3, 4, 5, 6], mulberry32(7));
  assert.deepEqual([...s].sort(), [1, 2, 3, 4, 5, 6]);
});

test('コードネーム：度数をキーのコードネームにする（キー C）', () => {
  const names = ['I', 'IIIm', 'IV', 'V', 'VIm', 'III', 'IVmaj7', 'IIIm7', 'VIm7'].map(l => chordName(l, 0));
  assert.deepEqual(names, ['C', 'Em', 'F', 'G', 'Am', 'E', 'Fmaj7', 'Em7', 'Am7']);
});

test('コードネーム：キーに合わせて正しく綴る（同じ高さでも、キーの音階の文字で書く）', () => {
  assert.equal(chordName('V', 10), 'F'); // キー B♭
  assert.equal(chordName('VIm', 10), 'Gm');
  assert.equal(chordName('IV', 1), 'G♭'); // キー D♭
  assert.equal(chordName('IIIm', 4), 'G♯m'); // キー E
  assert.equal(chordName('VII', 6), 'E♯'); // キー F♯ の VII は F ではなく E♯
  assert.equal(chordName('IIIm', 6), 'A♯m');
  assert.equal(chordName('III', 8), 'C'); // キー A♭ の III
  assert.throws(() => chordName('VIII', 0), /読めません/);
});

test('キーの名前：12キーはよく使う綴り（C♯ でなく D♭）', () => {
  assert.deepEqual(Array.from({ length: 12 }, (_, k) => keyName(k)), ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']);
});

test('コードネーム：進行に出てくる書き方は、12キーすべてで綴れる', async () => {
  const { PROGRESSIONS } = await import('../src/content/progressions.js');
  for (const p of PROGRESSIONS) for (const c of p.chords) for (let key = 0; key < 12; key++) assert.match(chordName(c.label, key), /^[A-G][♯♭]{0,2}/);
});
