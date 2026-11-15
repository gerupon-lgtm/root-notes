// おはなしの紙芝居の中身（段階6。docs/design/段階6_おはなしのスライド.md）。画面は src/ui/story-screen.js。
// 1枚の絵は 1280×960（4:3）の座標で組む。layers は奥から順に重ねる絵：
//   art（public/art/story/ のファイル名）、x・y（左上）、w（幅。高さは絵の縦横比のまま）、id（光らせるときの名前）、cls（見え方の種類）
// cues は鳴らす音と光らせる絵（at 秒後）。bells：鐘（大きさ 12・9・8・6）、chord：和音（Hz）、pluck：弦の音（Hz）
// 語り（narration・say）は仮（要件6.10。最終の文は発案者と決める。A区分）。
// 絵は Codex 物語素材（v0.2.0・v0.3.1・v0.4.1・v0.7.0。2026-11-15 発案者が全部採用）。配置の数値は Codex の見本（v0.7.0 finish-assets.mjs）から

export const STORY_ART_DIR = 'public/art/story/';
export const storyArt = name => new URL(`../../${STORY_ART_DIR}${name}.webp`, import.meta.url).href;

// 鐘の高さ：大きさ 12 を F4 とし、9・8・6 は伝承の比（4/3・3/2・2倍。要件6.8）。結末の Fsus4（F・B♭・C・F）と同じ並び
export const BELL_BASE_HZ = 349.23;
export const BELL_HZ = Object.freeze({ 12: BELL_BASE_HZ, 9: BELL_BASE_HZ * 4 / 3, 8: BELL_BASE_HZ * 3 / 2, 6: BELL_BASE_HZ * 2 });

// 鐘の置き方（Codex 見本：左 130 から、幅は原画の 0.45 倍、間 20、下をそろえて 770）。4つは同じ倍率なので 12：9：8：6 の大きさのまま
const BELL_W = { 12: 324, 9: 243, 8: 216, 6: 162 };
const BELL_RATIO = 1.2; // 縦 / 横
const bells = (dim = []) => {
  let x = 130;
  return [12, 9, 8, 6].map(n => {
    const w = BELL_W[n], layer = { art: `bell-${n}`, id: `bell-${n}`, x, y: 770 - w * BELL_RATIO, w, ...(dim.includes(n) ? { cls: 'dim' } : {}) };
    x += w + 20;
    return layer;
  });
};
const forge = { art: 'forge-legend', x: 0, y: 0, w: 1280 };
const hammer = { art: 'hammer', x: 70, y: 760, w: 194 };
const night = { art: 'stars-night-empty', x: 0, y: 0, w: 1280 };
const ring = (at, ...ns) => ({ at, bells: ns });

// 天の歌の星（コードで描く。星のない夜空に重ねる）。gone は欠けている星（序章6）。
// きらめくのは2〜3個だけで、間隔は不定期（2026-11-15 発案者「星が大きい。全部ではなく2〜3個がキラキラ」）
export const SKY_STARS = Object.freeze([
  [150, 210], [250, 140], [370, 190], [470, 110], [580, 160], [690, 95], [800, 150], [910, 105], [1020, 170], [1130, 130],
  [310, 300], [530, 270], [760, 260], [980, 290]
].map(([x, y]) => Object.freeze({ x, y })));
export const GONE_STARS = Object.freeze([3, 6, 8, 11]);
export const SPARKLE_STARS = Object.freeze([1, 7, 12]);

export const PROLOGUE = Object.freeze([
  {
    id: 'p1', place: '伝承の時代　鍛冶場',
    layers: [forge, ...bells(), hammer],
    narration: 'むかし、ある鍛冶場で、ハンマーが鐘を打っていたと伝えられています。',
    cues: [ring(0.3, 12), ring(1.3, 9), ring(2.3, 8), ring(3.3, 6)]
  },
  {
    id: 'p2', place: '伝承の時代　鍛冶場',
    layers: [forge, ...bells(), hammer],
    narration: '2つずつ重ねて鳴らすと、澄んだ響きが生まれました。',
    cues: [ring(0.3, 12, 6), ring(2.1, 12, 8), ring(3.9, 12, 9)]
  },
  {
    id: 'p3', place: '伝承の時代　鍛冶場',
    layers: [forge, { art: 'shadow-order', x: 180, y: 270, w: 920, cls: 'shade' }, ...bells([12, 6])],
    narration: 'ただ、大きさの近い2つの鐘を重ねたときだけ、響きが濁ったのです。',
    cues: [ring(0.4, 9, 8), ring(2.6, 9, 8)]
  },
  {
    // 武具は浮かせて封印の術を見せる（2026-11-15 発案者「浮かせて試す」。教団は下へ手をかざしている）
    id: 'p4', place: '伝承の時代　鍛冶場',
    layers: [
      forge,
      { art: 'order-sealing-people', x: 160, y: 130, w: 960 },
      { art: 'shield-sealed', x: 385, y: 455, w: 170, cls: 'float' },
      { art: 'sword-sealed', x: 555, y: 440, w: 170, cls: 'float late' },
      { art: 'armor-sealed', x: 725, y: 455, w: 170, cls: 'float later' }
    ],
    narration: '教団はそれを「不浄の響き」と呼び、盾・剣・鎧に封じて散らしました。',
    cues: []
  },
  {
    // 色が戻り、人影が消える：伝承の鍛冶場（セピア）が薄れて、遠い祭壇が現れる
    id: 'p5', place: '時が流れて　遠い祭壇',
    layers: [
      { art: 'altar-bell-distant', x: 0, y: 0, w: 1280 },
      { art: 'forge-legend', x: 0, y: 0, w: 1280, cls: 'fade-out' },
      { art: 'shadow-order', x: 180, y: 270, w: 920, cls: 'shade fade-out' }
    ],
    narration: '長い時が流れました。打たれた鐘たちは、遠い祭壇で星の光に鳴らされているといいます。ひとつひとつは澄んだ一音。重なるのは、余韻だけ。',
    cues: [ring(2.2, 12), ring(2.9, 8), ring(3.6, 6)]
  },
  {
    id: 'p6', place: '今　星空',
    layers: [night], stars: 'broken',
    narration: 'いま、天の歌が欠け、星の巡りが鈍っています。',
    cues: [{ at: 0.4, chord: [174.61, 261.63] }]
  },
  {
    id: 'p7', place: '今　星空',
    // 精霊は右へ手を差し出す絵なので、左に置いて画面の中を向かせる（2026-11-15 発案者「向いている方向がおかしい」）
    layers: [night, { art: 'spirit-normal', x: 170, y: 250, w: 330 }], stars: 'broken',
    speaker: '弦の精霊', say: 'わたしは弦の精霊。封じられた音を、一緒に探してくれますか。',
    cues: [{ at: 0.3, pluck: 349.23 }]
  },
  {
    id: 'p8', place: '今　鍛冶場の跡',
    layers: [{ art: 'forge-ruins', x: 0, y: 0, w: 1280 }, { art: 'monochord-story', x: 250, y: 390, w: 780 }],
    speaker: '弦の精霊', say: 'まず、澄んだ響きを思い出すところから。この琴で。',
    cues: [{ at: 0.3, pluck: 349.23 }, { at: 1.1, pluck: 698.46 }]
  }
].map(s => Object.freeze(s)));
