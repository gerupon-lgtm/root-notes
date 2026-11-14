// 音色（A区分。2026-11-14 発案者：FM のストリングス系・オルガン系・エレピ系などを、ステージごとに変える。
// フレーズと1曲は1つの音色で通し、ベースは別の音色）。
// 値は前作から持ってくる（発案者の指定：PRISM のソース、koekit サエズリズム、twist）。
//   - オルガン・ブラス・ベース：twist src/music/fm-presets.js（pipe-organ・brass-lead・bass）
//   - エレピ：PRISM src/ui/voices.js・koekit probe/saezuri/light-voice.js の fm-piano
//   - ストリングス：koekit light-voice.js の strings（のこぎり波＋高音を削る）
// ROOT で外したもの：2本を少しずらして重ねる処理（doubling・detune）と歪み（drive）。
//   ずらした2本の間に自前のうなりが出て、お題とのうなりが聞き分けにくくなるため（要件7.1、Q-05 調査）。
// 搬送波：'sine'・'organ'（倍音1〜8を足した波形）・'saw'。FM の変調の倍率 ratio は整数にして、倍音を整数倍に並べる。
// 時間の値の単位（twist の音源に合わせて読み替えた）：
//   attack＝立ち上がりの秒数、decay・release・modDecay＝減り方の時定数（秒）、sustain・indexSustain＝保つ割合
// オルガンとベースの release は 0.04 秒（0.012・0.015 から変更）。短いと自然に消えるときもプツッと鳴るため（2026-11-14 発案者）
// オルガンの搬送波：倍音1〜8の強さ（twist src/music/fm-tone.js の RANKS）
export const ORGAN_RANKS = Object.freeze([1, 0.65, 0.35, 0.55, 0.18, 0.2, 0.12, 0.35]);

export const TIMBRES = Object.freeze({
  organ: Object.freeze({ name: 'オルガン', carrier: 'organ', ranks: ORGAN_RANKS, ratio: 1, index: 0.08, indexSustain: 1, modDecay: 0.04, attack: 0.004, decay: 0.012, sustain: 0.94, release: 0.04, gain: 0.14 }),
  epiano: Object.freeze({ name: 'エレピ', carrier: 'sine', ratio: 3, index: 3.8 / 3, indexSustain: 0.06, modDecay: 0.35, attack: 0.005, decay: 0.95, sustain: 0.055, release: 0.04, gain: 0.2 }),
  brass: Object.freeze({ name: 'ブラス', carrier: 'sine', ratio: 1, index: 3.1, indexSustain: 0.65, modDecay: 0.085, attack: 0.01, decay: 0.032, sustain: 0.88, release: 0.03, gain: 0.16 }),
  strings: Object.freeze({ name: 'ストリングス', carrier: 'saw', attack: 0.12, decay: 0.5, sustain: 0.82, release: 0.08, cutoff: 5, cutoffFloor: 4, cutoffDecay: 0.15, gain: 0.12 }),
  bass: Object.freeze({ name: 'ベース', carrier: 'sine', ratio: 1, index: 2.1, indexSustain: 0.55, modDecay: 0.1, attack: 0.003, decay: 0.036, sustain: 0.85, release: 0.04, gain: 0.19 })
});

// 三角形のステージで順に使う音色（隣の星は違う音色になる）
export const STAGE_TIMBRES = Object.freeze(['strings', 'organ', 'epiano', 'brass']);
// フレーズと1曲の和音の音色、ベースの音色
export const SONG_TIMBRE = 'epiano';
export const BASS_TIMBRE = 'bass';
