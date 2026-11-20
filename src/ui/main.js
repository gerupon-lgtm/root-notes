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
import { createEndingScreen } from './ending-screen.js';
import { storyArt } from '../content/story.js';
import { setupOffline } from './offline.js';
import { artPath } from '../content/assets.js';
import { LAUNCH_DELAY_MS, resultDelayMs, setResultDelayMs } from './timing.js';

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
  mirror: document.getElementById('mirror-screen'),
  ending: document.getElementById('ending-screen')
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
  const ending = createEndingScreen({ audio, onTitle: () => flow.toTitle() });
  put('ending-version', `${COPYRIGHT}　v${APP_VERSION}`);
  document.getElementById('mirror-bg').src = storyArt('temple-entrance-corridor');
  const flow = createFlow({ audio, screens, mono, stage, story, riddle, final, mirror, ending, onTitle: showTitle });

  // 共通の消音（全画面のヘッダの右上の端。どの画面で押しても同じ状態。端末に記録する。2026-11-15 発案者）
  const SOUND_KEY = 'root-notes-sound-v1';
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch { /* 記録できない端末 */ }
  const icon = off => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>${off ? '<path d="m16 9 5 6m0-6-5 6"/>' : '<path d="M16 8q5 4 0 8 M18 5q8 7 0 14"/>'}</svg>`;
  const renderMute = () => {
    const label = muted ? '音を出す' : '音を消す';
    for (const b of document.querySelectorAll('.mute-btn')) { b.innerHTML = icon(muted); b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-pressed', String(muted)); }
    // メニューの「音」（鳴らす／消す）も同じ状態を見せる
    for (const b of document.querySelectorAll('[data-sound]')) b.classList.toggle('on', (b.dataset.sound === 'off') === muted);
  };
  audio.setMuted(muted);
  ending.setMuted(muted);
  renderMute();
  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-sound]');
    if (!pick && !e.target.closest('.mute-btn')) return;
    muted = pick ? pick.dataset.sound === 'off' : !muted;
    audio.setMuted(muted);
    ending.setMuted(muted);
    try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch { /* 記録できない端末 */ }
    renderMute();
  });

  // 「遊び方と概要」：開いている間にカードの外をタップしたら閉じる（2026-11-15 発案者）。
  // 閉じるだけにして、そのタップでほかのボタン（連続プレイなど）は動かさない
  const help = document.querySelector('.title-help');
  document.addEventListener('click', e => {
    if (!help?.open || e.target.closest('.title-help-body') || e.target.closest('.title-help summary')) return;
    help.open = false;
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });

  // タイトルのボタンを押したら、少し待ってから最初の画面（序章・第1章など）を始める（PRISM の LAUNCH_DELAY_MS と同じ 0.25秒。2026-11-15 発案者）。
  // 待つ間に重ねて押されても、1回だけ始める
  let launching = false;
  // 結果を出すまでの待ち（設定。0〜5秒・0.1秒きざみ。どのメニューで変えても同じ値。2026-11-15 発案者）
  const renderDelay = () => {
    const sec = resultDelayMs() / 1000;
    for (const r of document.querySelectorAll('.result-delay')) r.value = String(sec);
    for (const o of document.querySelectorAll('.result-delay-value')) o.textContent = `${sec.toFixed(1)}秒`;
  };
  renderDelay();
  document.addEventListener('input', e => {
    if (!e.target.classList?.contains('result-delay')) return;
    setResultDelayMs(Number(e.target.value) * 1000);
    renderDelay();
  });
  document.getElementById('menu-button').addEventListener('click', renderDelay);

  // 遊ぶ画面以外のメニュー（☰）：音・結果を出すまでの待ち・タイトルへ（2026-11-15 発案者）。遊ぶ画面は今までどおり自分のメニュー
  const mini = document.getElementById('mini-sheet');
  document.getElementById('mini-version').textContent = `v${APP_VERSION}`;
  document.getElementById('mini-copyright').textContent = COPYRIGHT;
  const closeMini = () => { mini.hidden = true; };
  document.addEventListener('click', e => { if (e.target.closest('.menu-btn')) { renderMute(); renderDelay(); mini.hidden = false; } });
  document.getElementById('mini-sheet-back').addEventListener('click', closeMini);
  document.getElementById('mini-close').addEventListener('click', closeMini);
  document.getElementById('mini-title').addEventListener('click', () => { closeMini(); flow.toTitle(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMini(); });

  screens.title.addEventListener('click', e => {
    const b = e.target.closest('button[data-start]');
    if (!b || launching) return;
    audio.unlock();
    launching = true;
    setTimeout(() => { launching = false; flow.start(b.dataset.start); }, LAUNCH_DELAY_MS);
  });
  // 実機確認用。保存済みの連続プレイとは別の手持ちで、最後の扉から通せる。
  if (new URLSearchParams(location.search).get('check') === 'ending') {
    flow.checkEnding();
  }
}

// 通信なしで遊ぶ仕組みと、新しい版の知らせ（段階7）。公開用にまとめた版だけで動く
setupOffline({ document, navigator, location, version: APP_VERSION });
