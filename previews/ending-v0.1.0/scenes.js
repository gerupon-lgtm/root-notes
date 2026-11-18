'use strict';
const endingStars = [[23,22],[30,15],[38,20],[46,12],[54,15],[62,9],[71,15],[80,20]];
const layer = (file, x, y, width, extra = {}) => ({file, x, y, width, ...extra});
const opening = {
  id:'door', place:'扉の向こう', title:'ふたつの弦のあいだに',
  words:'直角に開いた二本の弦のあいだに、新しい響きが生まれました。まだ、少し落ち着かない響きです。',
  bg:'temple-final-door-open.webp', alt:'開いた扉の向こうで新たな響きを聴く弦の精霊。',
  art:[layer('spirit-confused.webp',12,48,19),layer('root2-resonance.webp',47,21,35)]
};
const songSlides = [
  {id:'bells', at:0, place:'鍛冶場の記憶', title:'四つの鐘', words:'あの鍛冶場で打たれた鐘が、ひとつずつ応えます。',
   bg:'forge-legend.webp', alt:'鍛冶場の台に並ぶ大きさの異なる四つの鐘。',
   art:[layer('bell-12.webp',16,30,22,{strike:0}),layer('bell-9.webp',37,39,16.5,{strike:2.2}),
        layer('bell-8.webp',55,42,14.67,{strike:4.4}),layer('bell-6.webp',72,48,11,{strike:6.6})]},
  {id:'theme', at:8.3, place:'祭壇の部屋', title:'天の歌', words:'ばらばらだった響きが、ひとつずつ、歌の中へ戻っていきます。',
   sky:true, alt:'天井に夜空が開いた神殿の祭壇。星が少しずつ灯る。'},
  {id:'shield', at:29, place:'解かれた封音', title:'盾', words:'守りきれなかった記憶を抱えながら、次の響きが来るまで、そばにいる。',
   sky:true, alt:'封印を解かれた盾。', art:[layer('shield-released.webp',32,7,36)]},
  {id:'sword', at:49, place:'解かれた封音', title:'剣', words:'傷つけた記憶を抱えながら、静かに、その影を引き受ける。',
   sky:true, alt:'封印を解かれた剣。', art:[layer('sword-released.webp',32,7,36)]},
  {id:'armor', at:69, place:'解かれた封音', title:'鎧', words:'受け止めてきた幾つもの傷。その響きが、最後に帰る場所になる。',
   sky:true, alt:'封印を解かれた鎧。', art:[layer('armor-released.webp',28,6,44)]},
  {id:'string', at:89, place:'この旅を導いたもの', title:'弦の精霊', words:'途切れた声に耳を澄まし、ひとつずつ、その響きの行き先を探した。',
   sky:true, alt:'祭壇で耳を澄ます弦の精霊。', art:[layer('spirit-listening.webp',30,6,40)]},
  {id:'resonance', at:110, place:'天の歌の中で', title:'次の音へ', words:'あの落ち着かない響きが加わると、歌は、その先へ進んでいきました。',
   sky:true, alt:'祭壇の上に浮かぶ√2の響き。', art:[layer('root2-resonance.webp',24,5,52)]},
  {id:'star', at:130, place:'遠い祭壇', title:'星の精霊', words:'星の光と鐘の余韻をたどってきた精霊も、その歌に耳を澄ませていました。',
   bg:'altar-bell-distant.webp', alt:'星の光が届く遠い祭壇と、星の精霊。', art:[layer('star-spirit.png',62,14,29)]},
  {id:'credits', at:150, place:'スタッフロール', title:'ROOT NOTES', credit:true, words:'企画・制作　SIKUMI LAB',
   bg:'stars-night-empty.webp', alt:'スタッフクレジット。夜空に浮かぶROOT NOTESの文字。'},
  {id:'thanks', at:166, place:'スタッフロール', title:'旅をともにした、あなたへ', credit:true, words:'最後まで遊んでくださり、ありがとうございました。',
   bg:'stars-night-empty.webp', alt:'静かな夜空に八つの星。'},
  {id:'coda', at:179, place:'祭壇の部屋', title:'天の歌の余韻', words:'',
   sky:true, alt:'星がそろった神殿。祭壇の光がゆっくり静まる。'}
];
const afterSong = [
  {id:'distant', place:'曲のあと・遠い祭壇', title:'鐘の余韻', words:'かつて星の光を受けて鳴った鐘。その余韻が、今夜はいつもと少し違う重なり方をしました。',
   bg:'altar-bell-distant.webp', alt:'星の光が降り注ぐ、遠い祭壇の鐘。'},
  {id:'memory', place:'祭壇の部屋', title:'思い出した言葉', speaker:'星の精霊', words:'「その響きにも、居場所がある」。あのとき、あなたは何度もそう言いましたね。',
   sky:true, alt:'祭壇の前で、星の精霊が弦の精霊に語りかける。',
   art:[layer('spirit-listening.webp',18,38,24),layer('star-spirit.png',60,29,23)]},
  {id:'hearing', place:'祭壇の部屋', title:'一音の、その先', speaker:'星の精霊', words:'わたしは、その響きだけを聴いていました。さっきの歌では、あの響きが次の音へ導いていたのですね。',
   sky:true, alt:'星の精霊が弦の精霊に向き合い、天の歌で聴いたことを話す。',
   art:[layer('spirit-listening.webp',17,38,24),layer('star-spirit.png',59,28,25)]},
  {id:'together', place:'祭壇の部屋', title:'今度は', speaker:'弦の精霊', words:'ええ。今度は、一緒に聴けますね。',
   sky:true, alt:'祭壇と夜空の前で並ぶ弦の精霊と星の精霊。',
   art:[layer('spirit-smiling.webp',23,33,27),layer('star-spirit.png',53,27,25)]}
];
