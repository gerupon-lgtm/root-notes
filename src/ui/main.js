// 起動。版数・©・シリーズ表記を差し込み、タイトルと各画面（章の流れ：src/ui/flow-screen.js）を行き来させる
import { APP_VERSION, COPYRIGHT, SERIES } from '../version.js';
import { StringAudio } from '../audio/engine.js';
import { createStageScreen } from './stage-screen.js';
import { createMonochordScreen } from './monochord-screen.js';
import { createFlow } from './flow-screen.js';
import { createStoryScreen } from './story-screen.js';
import { createRiddleScreen } from './riddle-screen.js';
import { createFinalScreen } from './final-screen.js';
import { createMirrorScreen } from './mirror-screen.js';
import { storyArt } from '../content/story.js';
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
  final: document.getElementById('final-screen'),
  mirror: document.getElementById('mirror-screen')
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
  const mirror = createMirrorScreen({ audio });
  document.getElementById('mirror-bg').src = storyArt('temple-entrance-corridor');
  const flow = createFlow({ audio, screens, mono, stage, story, riddle, final, mirror, onTitle: showTitle });

  // 共通の消音（全画面のヘッダの右上の端。どの画面で押しても同じ状態。端末に記録する。2026-11-15 発案者）
  const SOUND_KEY = 'root-notes-sound-v1';
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch { /* 記録できない端末 */ }
  const icon = off => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>${off ? '<path d="m16 9 5 6m0-6-5 6"/>' : '<path d="M16 8q5 4 0 8 M18 5q8 7 0 14"/>'}</svg>`;
  const renderMute = () => {
    const label = muted ? '音を出す' : '音を消す';
    for (const b of document.querySelectorAll('.mute-btn')) { b.innerHTML = icon(muted); b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-pressed', String(muted)); }
  };
  audio.setMuted(muted);
  renderMute();
  document.addEventListener('click', e => {
    if (!e.target.closest('.mute-btn')) return;
    muted = !muted;
    audio.setMuted(muted);
    try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch { /* 記録できない端末 */ }
    renderMute();
  });

  screens.title.addEventListener('click', e => {
    const b = e.target.closest('button[data-start]');
    if (!b) return;
    audio.unlock();
    flow.start(b.dataset.start);
  });
}

// 通信なしで遊ぶ仕組みと、新しい版の知らせ（段階7）。公開用にまとめた版だけで動く
setupOffline({ document, navigator, location, version: APP_VERSION });
