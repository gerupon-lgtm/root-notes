// 第3章「光の響きから影の琴へ」（鏡写しの説明。Codex 試作 v0.5.0 を本体へ。2026-11-15 発案者と決定）。
// 1組目の光と影を解いたあとに出す。数字は、その1組目で実際に使った光と影（違う音程でも同じ決まりが成り立つと気づけるように）。
// 5つの場面：星の響き（6・5・4回の点滅）→ 光の響き（刻みが速まって和音に）→ 弦に写す（点滅のたびにかけら）→ 変化を聴く（音の高さの比 → 弦の長さの比）→ 影の琴へ
// 上から高い順（例 6・5・4）に並べ、並びは入れ替えない。語りは仮（A区分）

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;
// 音名（固定ド。平均律のいちばん近い音）
const NAMES = ['ド', 'ド♯', 'レ', 'ミ♭', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ラ♭', 'ラ', 'シ♭', 'シ'];
export const noteName = hz => NAMES[((Math.round(69 + 12 * Math.log2(hz / 440)) % 12) + 12) % 12];
// 段の色（試作と同じ。上から高い順）
const COLORS = ['#e4c575', '#9ad0b7', '#a9c6eb'];

// light・shadow：辺の長さ（整数3つ）、K：基準の音（周波数 ＝ K ÷ 長さ。光と影で同じ）
export function mirrorModel(light, shadow, K) {
  const L = [...light].sort((a, b) => a - b); // 短い順＝高い順
  const S = [...shadow].sort((a, b) => a - b);
  const common = L.reduce((n, x) => lcm(n, x), 1);
  let ticks = L.map(x => common / x);
  const d = ticks.reduce(gcd);
  ticks = ticks.map(n => n / d); // 高い順に 6・5・4 など（音の高さの比）
  // 影：ticks を弦の長さの比にしたもの（同じ比の並び）。上の段（いちばん多い）がいちばん長い
  const Sdesc = [...S].sort((a, b) => b - a);
  const unit = Sdesc[0] / ticks[0];
  if (!Sdesc.every((x, i) => Math.abs(x / ticks[i] - unit) < 1e-9)) throw new Error('影の弦長が、光の音の高さの比と合いません。');
  const rows = L.map((len, i) => ({
    length: len, frequency: K / len, note: noteName(K / len), ticks: ticks[i], color: COLORS[i],
    target: { length: Sdesc[i], frequency: K / Sdesc[i], note: noteName(K / Sdesc[i]) }
  }));
  return {
    rows, ticks, unit,
    lightFrequencies: rows.map(r => r.frequency),
    shadowFrequencies: rows.map(r => r.target.frequency),
    accelerationFactor: rows[0].frequency / ticks[0]
  };
}

// 場面の文（仮）。m は mirrorModel の結果
export const MIRROR_STAGES = Object.freeze([
  { label: '星の響き', title: '星の瞬きに、耳を澄ませて。', text: () => 'いま奏でた三つの音です。ひとつずつ、星の瞬きで見てみましょう。', hint: m => `${m.rows.map(r => `${r.note}は${r.ticks}回`).join('、')}。音の震えを、ゆっくり映しています。`, duration: 5000 },
  { label: '光の響き', title: '星の刻みが、響きに。', text: () => 'この刻みを、同じ割合で速めていくと……。聴こえますか。さきほどの響きです。', hint: () => '星の数の比は、そのままです。', duration: 6200 },
  { label: '弦に写す', title: '瞬きを、弦の長さへ。', text: () => 'ひとつ光るたび、かけらをひとつ。今度は、その数を弦の長さに写しましょう。', hint: m => `${m.ticks.join('・')}のかけらから、${m.rows.map(r => r.target.length).join('・')}の弦へ。`, duration: 5000 },
  { label: '変化を聴く', title: '光の響きを、ひとつずつ。', text: () => 'まずは、音の高さの比として。上の星から、ひとつずつ聴いてみてください。', hint: m => `音の高さの比 ${m.ticks.join('：')}。${m.rows.map(r => r.note).join('・')}です。`, duration: 5000 },
  { label: '影の琴へ', title: 'もうひとつの響きです。', text: () => '二本を残して、もう一本を替えると……。光と違う、影の響き。あなたには、どう聴こえますか。', hint: () => 'どうぞ、ふたつを聴き比べてみてください。', duration: 5000 }
]);
// 「変化を聴く」の後半（弦の長さの比）の文
export const MIRROR_SHADOW_SIDE = Object.freeze({
  title: '同じ数を、弦の長さに。',
  text: 'いちばん高かった星が、いちばん長い弦に。長い弦ほど、低く響くのです。',
  hint: m => `弦の長さの比 ${m.ticks.join('：')}。今度は、${m.rows.map(r => r.target.note).join('・')}ですね。`
});
