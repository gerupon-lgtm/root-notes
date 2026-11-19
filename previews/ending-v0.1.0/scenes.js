'use strict';
const endingStars = [[23,22],[30,15],[38,20],[46,12],[54,15],[62,9],[71,15],[80,20]];
const layer = (file, x, y, width, extra = {}) => ({file, x, y, width, ...extra});
const opening = {
  id:'door', place:'扉の向こう', title:'ふたつの弦のあいだに',
  words:'直角に開いた二本の弦のあいだに、新しい響きが生まれました。まだ、少し落ち着かない響きです。',
  bg:'temple-final-door-open.webp', alt:'開いた扉の向こうで新たな響きを聴く弦の精霊。',
  art:[layer('spirit-confused.webp',12,48,19),layer('root2-resonance.webp',47,21,35)]
};
const reunion = {
  place:'祭壇の部屋', sky:true, pictureKey:'reunion',
  art:[layer('spirit-smiling.webp',23,33,27),layer('star-spirit.png',53,27,25)]
};
const songSlides = [
  {id:'bells', at:0, place:'鍛冶場の記憶', title:'ひとつの鐘', words:'あの鍛冶場で打たれた鐘が、ふたたび応えます。',
   bg:'forge-legend.webp', alt:'鍛冶場の台に置かれた、青と金の飾り枠に収まる一つの鐘。',
   art:[layer('prism-bell.png',34,8,32,{strikes:[0,2.2,4.4,6.6]})]},
  {id:'theme', at:8.3, place:'祭壇の部屋', title:'天の歌', words:'ばらばらだった響きが、ひとつずつ、歌の中へ戻っていきます。',
   sky:true, alt:'天井に夜空が開いた神殿の祭壇。星が少しずつ灯る。'},
  {id:'shield', at:29, place:'解かれた封音', title:'盾', words:'守りきれなかった記憶を抱えながら、次の響きが来るまで、そばにいる。',
   sky:true, alt:'封印を解かれた盾。', art:[layer('shield-released.webp',32,37,36)]},
  {id:'sword', at:49, place:'解かれた封音', title:'剣', words:'傷つけた記憶を抱えながら、静かに、その影を引き受ける。',
   sky:true, alt:'封印を解かれた剣。', art:[layer('sword-released.webp',32,36,36)]},
  {id:'armor', at:69, place:'解かれた封音', title:'鎧', words:'受け止めてきた幾つもの傷。その響きが、最後に帰る場所になる。',
   sky:true, alt:'封印を解かれた鎧。', art:[layer('armor-released.webp',28,31,44)]},
  {id:'string', at:89, place:'この旅を導いたもの', title:'弦の精霊', words:'途切れた声に耳を澄まし、ひとつずつ、その響きの行き先を探した。',
   sky:true, alt:'祭壇で耳を澄ます弦の精霊。', art:[layer('spirit-listening.webp',30,21,40)]},
  {id:'resonance', at:110, place:'天の歌の中で', title:'次の音へ', words:'あの落ち着かない響きが加わると、歌は、その先へ進んでいきました。',
   sky:true, alt:'祭壇の上に浮かぶ√2の響き。', art:[layer('root2-resonance.webp',24,12,52)]},
  {id:'star', at:130, place:'遠い祭壇', title:'星の精霊', words:'星の光と鐘の余韻をたどってきた精霊も、その歌に耳を澄ませていました。',
   bg:'altar-bell-distant.webp', alt:'星の光が届く遠い祭壇と、星の精霊。', art:[layer('star-spirit.png',62,21,29)]},
  {id:'distant', at:150, place:'遠い祭壇', title:'鐘の余韻', words:'かつて星の光で鳴った鐘。その余韻が、今夜の歌と重なります。',
   bg:'altar-bell-distant.webp', alt:'星の光が降り注ぐ、遠い祭壇の鐘。'},
  {...reunion, id:'reunion', at:166, title:'ふたたび', words:'鐘の余韻をたどって、星の精霊が弦の精霊のそばへ。',
   alt:'夜空の下の祭壇で、二人の精霊が再会する。'},
  {...reunion, id:'memory', at:179, title:'思い出した言葉', speaker:'星の精霊',
   words:'「その響きにも、居場所がある」。あの響きが、次の音へ導いていたのですね。',
   alt:'祭壇の前で、星の精霊が弦の精霊に語りかける。'},
  {...reunion, id:'together', at:189.6, title:'今度は', speaker:'弦の精霊', words:'ええ。今度は、一緒に聴けますね。',
   alt:'祭壇と夜空の前で並ぶ二人の精霊。弦の精霊が答える。'}
];
const credits = {
  id:'credits', place:'クレジット', title:'旅をともにした、あなたへ', credit:true,
  words:'最後まで遊んでくださり、ありがとうございました。',
  alt:'夜空に浮かぶ SIKUMI LAB と ROOT NOTES の文字。'
};
