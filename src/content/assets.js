// 絵の素材（Codex 担当）のパスを、コード側で1か所にまとめる表（docs/design/段階0_土台.md 7章）。
// 画面のコードは名前で呼び、パスを直接書かない。
//
// 名前は Codex の素材版 v0.1.0 のファイル名にそろえる。
// 値が null の名前は、まだ採用していない絵。画面は仮の図形で描く。
// 採用が決まったら、Codex の delivery/ の画像を ART_BASE のフォルダへ写し、ここにファイル名を書く。

// 素材のフォルダ（リポジトリの一番上から見た場所）。置き場所が変わったらこの1行を直す
export const ART_BASE = 'public/art/';

export const ART = Object.freeze({
  // 弦の精霊：ふつう・耳を澄ます・ほほえむ
  'spirit-normal': null,
  'spirit-listening': null,
  'spirit-smiling': null,
  // 装備：封印中・解放後。章末の謎の正誤で絵や状態を切り替えない（要件6.3）
  'shield-sealed': null,
  'shield-released': null,
  'sword-sealed': null,
  'sword-released': null,
  'armor-sealed': null,
  'armor-released': null,
  // 鐘：大きさ12・9・8・6。4つは同じ倍率で表示する（別々の枠に引き伸ばすと大きさの比が消える）
  'bell-12': null,
  'bell-9': null,
  'bell-8': null,
  'bell-6': null,
  // 見本の場面：序「鍛冶場で鐘が鳴る」
  'scene-forge-legend': null,
  // 採用済みのタイトル背景。文字・ボタンを含めず、縦横比を保つ。
  'title-workshop-portrait': 'title-workshop-portrait.webp',
  'title-workshop-landscape': 'title-workshop-landscape.webp',
  'title-workshop-landscape-short': 'title-workshop-landscape-short.webp',
  // 遊ぶ画面の部品（Codex 素材 プレイ画面部品 v1.0.0）。三角形の形は毎回変わるので、枠と弦はコードで描き、部品の質感を貼る
  'play-felt': 'play-felt.webp', // 背景の布。上下左右に繰り返せる
  'frame-wood': 'frame-wood.webp', // 木枠の1辺。左右に繰り返せる（木目は横向き）
  'corner-brass': 'corner-brass.webp', // 角の丸い金具（背景透明。角度に左右されない形）
  'string-pin': 'string-pin.webp' // 弦を留める小さなピン（背景透明）
});

// 名前から、絵の場所（URL）を返す。まだ採用していない絵は null。
// このファイルの場所から求めるので、公開用のまとめで版のフォルダ（v0.1.1/ など）に入っても場所がずれない
export function artPath(name) {
  if (!Object.hasOwn(ART, name)) throw new Error(`素材の名前「${name}」は表にありません。`);
  const file = ART[name];
  return file === null ? null : new URL(`../../${ART_BASE}${file}`, import.meta.url).href;
}
