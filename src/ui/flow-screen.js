// 章の流れの画面（段階4。docs/design/段階4_第1章_一弦の琴.md 3章）。流れの順番は src/game/flow.js。
// - 連続プレイ：序 → 第1章 → 謎（仮）→ 第2章 → …… → 最終章（仮）→ タイトル
// - 選択プレイ：章を選ぶ（第1章／第2章）→ その章の面を選ぶ
// 中身がまだない場面は、仮の1画面（見出しと「次へ」）で通り抜ける。序は、絵とセリフ（段階6）ができるまで見出しだけを並べる
import { FLOW, firstStep, nextStep, stepById, playableChapters, PROLOGUE_SCENES } from '../game/flow.js';

export function createFlow({ audio, screens, mono, stage, onTitle }) {
  const card = document.getElementById('interlude-card');
  let mode = 'free';

  const show = name => {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  };
  const toTitle = () => { audio.stopAll(); mono.stop(); show('title'); onTitle(); };

  // 仮の画面を組み立てる。buttons：[文言, 動き, 主ボタンか]
  function interlude({ eyebrow = '', title, lines = [], list = null, buttons }) {
    const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text) x.textContent = text; return x; };
    const parts = [];
    if (eyebrow) parts.push(el('p', 'interlude-eyebrow', eyebrow));
    parts.push(el('h2', 'interlude-title', title));
    for (const line of lines) parts.push(el('p', 'interlude-line', line));
    if (list) {
      const ol = el('ol', 'interlude-list');
      for (const item of list) ol.append(el('li', '', item));
      parts.push(ol);
    }
    const row = el('div', 'interlude-buttons');
    for (const [text, act, primary] of buttons) {
      const b = el('button', primary ? 'btn primary' : 'btn', text);
      b.type = 'button';
      b.addEventListener('click', act);
      row.append(b);
    }
    parts.push(row);
    card.replaceChildren(...parts);
    show('interlude');
    row.querySelector('.primary')?.focus({ preventScroll: true });
  }

  // 連続プレイの1場面へ
  function go(step) {
    audio.stopAll();
    if (!step) {
      interlude({ eyebrow: 'ここまで', title: '今作れている流れはここまでです', lines: ['謎・第3章・最終章・おはなしは、次の段階で作ります。'], buttons: [['タイトルへ', toTitle, true]] });
      return;
    }
    const next = () => go(nextStep(step.id));
    if (step.kind === 'story') {
      interlude({ eyebrow: step.place, title: step.title, lines: ['（絵と語りは、のちの段階で入ります。いまは場面の見出しだけです）'], list: PROLOGUE_SCENES, buttons: [['タイトルへ', toTitle], ['はじめる ▶', next, true]] });
    } else if (step.kind === 'monochord') {
      show('mono');
      mono.start(mode, { onDone: next, onTitle: toTitle });
    } else if (step.kind === 'triangle') {
      show('stage');
      stage.start(mode, { onChapterEnd: next });
    } else {
      interlude({ eyebrow: '準備中', title: step.title, lines: [step.note ?? ''], buttons: [['タイトルへ', toTitle], ['次へ ▶', next, true]] });
    }
  }

  // 選択プレイ：章を選ぶ
  function chooseChapter() {
    audio.stopAll();
    interlude({
      eyebrow: '選択プレイ', title: '章を選ぶ', lines: ['遊びたい章を選んでください。'],
      buttons: [...playableChapters().map(ch => [ch.title, () => playChapter(ch.id), true]), ['タイトルへ', toTitle]]
    });
  }
  function playChapter(id) {
    const step = stepById(id);
    if (step.kind === 'monochord') { show('mono'); mono.start(mode, { onDone: chooseChapter, onTitle: toTitle }); }
    else { show('stage'); stage.start(mode, { onChapterEnd: null }); }
  }

  // タイトルの入口から。'tutorial' はタイトルの「チュートリアル」（前作と同じ入口。ボタンは Codex がタイトルに足す）：
  // 第1章の 1-1 を案内つきで始める（フリーと同じ遊び方）。第1章を最後まで続けたら、タイトルへ戻る（AQUA と同じ）
  function start(modeId) {
    if (modeId === 'tutorial') {
      mode = 'free';
      audio.stopAll();
      show('mono');
      mono.start('free', { tutorial: true, onDone: toTitle, onTitle: toTitle, endLabel: 'タイトルへ' });
      return;
    }
    mode = modeId;
    if (modeId === 'select') chooseChapter();
    else go(firstStep());
  }

  return { start, steps: FLOW };
}
