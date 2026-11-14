// 起動。版数・©・シリーズ表記を差し込み、タイトルと遊ぶ画面を行き来させる
import { APP_VERSION, COPYRIGHT, SERIES } from '../version.js';
import { StringAudio } from '../audio/engine.js';
import { createStageScreen } from './stage-screen.js';
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

const titleScreen = document.getElementById('title-screen');
const stageScreen = document.getElementById('stage-screen');

if (titleScreen && stageScreen) {
  const audio = new StringAudio();
  // スマホは最初の操作まで音を出せないので、最初のタップで音を準備する（要件8章）
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

  const showTitle = () => { stageScreen.hidden = true; titleScreen.hidden = false; };
  const stage = createStageScreen({ audio, onTitle: showTitle });

  titleScreen.addEventListener('click', e => {
    const b = e.target.closest('button[data-start]');
    if (!b) return;
    audio.unlock();
    titleScreen.hidden = true;
    stageScreen.hidden = false;
    stage.start(b.dataset.start);
  });
}
