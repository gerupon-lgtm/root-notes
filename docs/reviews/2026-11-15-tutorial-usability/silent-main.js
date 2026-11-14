// 音を出さず実際の画面部品を操作する検証専用。公開用ビルドには含めない。
// 起動。版数・©・シリーズ表記を差し込み、タイトルと各画面（章の流れ：src/ui/flow-screen.js）を行き来させる
import { APP_VERSION, COPYRIGHT, SERIES } from '/src/version.js';
class StringAudio { unlock() {} stopAll() {} hold() { return { stop() {}, setHz() {} }; } pluck() { return { stop() {} }; } chord() {} playScore(score, options) { options?.onEnd?.(); } }
import { createStageScreen } from '/src/ui/stage-screen.js';
import { createMonochordScreen } from '/src/ui/monochord-screen.js';
import { createFlow } from '/src/ui/flow-screen.js';
import { setupOffline } from '/src/ui/offline.js';
import { artPath } from '/src/content/assets.js';

const put = (id, text) => {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
};

put('app-series', SERIES);
put('app-copyright', COPYRIGHT);
put('app-version', `v${APP_VERSION}`);

// 遊ぶ画面の布の背景（style.css の --play-felt）。絵の場所は assets.js の表から取る
const felt = artPath('play-felt');
if (felt) document.documentElement.style.setProperty('--play-felt', `url("${felt}")`);

const screens = {
  title: document.getElementById('title-screen'),
  stage: document.getElementById('stage-screen'),
  mono: document.getElementById('mono-screen'),
  interlude: document.getElementById('interlude-screen')
};

if (Object.values(screens).every(Boolean)) {
  const audio = new StringAudio();
  // スマホは最初の操作まで音を出せないので、最初のタップで音を準備する（要件8章）
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

  const showTitle = () => { for (const [key, el] of Object.entries(screens)) el.hidden = key !== 'title'; };
  const stage = createStageScreen({ audio, onTitle: () => { mono.stop(); showTitle(); } });
  const mono = createMonochordScreen({ audio });
  const flow = createFlow({ audio, screens, mono, stage, onTitle: showTitle });

  screens.title.addEventListener('click', e => {
    const b = e.target.closest('button[data-start]');
    if (!b) return;
    audio.unlock();
    flow.start(b.dataset.start);
  });
}

// 通信なしで遊ぶ仕組みと、新しい版の知らせ（段階7）。公開用にまとめた版だけで動く
setupOffline({ document, navigator, location, version: APP_VERSION });
