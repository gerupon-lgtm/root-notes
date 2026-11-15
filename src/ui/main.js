// 起動。版数・©・シリーズ表記を差し込み、タイトルと各画面（章の流れ：src/ui/flow-screen.js）を行き来させる
import { APP_VERSION, COPYRIGHT, SERIES } from '../version.js';
import { StringAudio } from '../audio/engine.js';
import { createStageScreen } from './stage-screen.js';
import { createMonochordScreen } from './monochord-screen.js';
import { createFlow } from './flow-screen.js';
import { createStoryScreen } from './story-screen.js';
import { createRiddleScreen } from './riddle-screen.js';
import { createFinalScreen } from './final-screen.js';
import { setupOffline } from './offline.js';
import { artPath } from '../content/assets.js';

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
  interlude: document.getElementById('interlude-screen'),
  story: document.getElementById('story-screen'),
  riddle: document.getElementById('riddle-screen'),
  final: document.getElementById('final-screen')
};

if (Object.values(screens).every(Boolean)) {
  const audio = new StringAudio();
  // スマホは最初の操作まで音を出せないので、最初のタップで音を準備する（要件8章）
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

  const showTitle = () => { for (const [key, el] of Object.entries(screens)) el.hidden = key !== 'title'; };
  const stage = createStageScreen({ audio, onTitle: () => { mono.stop(); showTitle(); } });
  const mono = createMonochordScreen({ audio });
  const story = createStoryScreen({ audio });
  const riddle = createRiddleScreen({ audio });
  const final = createFinalScreen({ audio });
  const flow = createFlow({ audio, screens, mono, stage, story, riddle, final, onTitle: showTitle });

  screens.title.addEventListener('click', e => {
    const b = e.target.closest('button[data-start]');
    if (!b) return;
    audio.unlock();
    flow.start(b.dataset.start);
  });
}

// 通信なしで遊ぶ仕組みと、新しい版の知らせ（段階7）。公開用にまとめた版だけで動く
setupOffline({ document, navigator, location, version: APP_VERSION });
