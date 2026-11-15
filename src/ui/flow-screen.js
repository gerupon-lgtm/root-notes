// 章の流れの画面（段階4。docs/design/段階4_第1章_一弦の琴.md 3章）。流れの順番は src/game/flow.js。
// - 連続プレイ：タイトルの「連続プレイ」→ 序 → 遊び方を選ぶ（フリー／ノーマル／エキスパート）→ 第1章 → 謎（仮）→ 第2章 → …… → 最終章（仮）→ タイトル。
//   フロート・ノーツと同じ導線（FLOAT src/ui/app.js：序章の flow() の最後に levels() で遊び方を選ぶ。2026-11-14 発案者）
// - 選択プレイ：章を選ぶ（第1章／第2章）→ その章の面を選ぶ
// 中身がまだない場面は、仮の1画面（見出しと「次へ」）で通り抜ける。序章は紙芝居（src/ui/story-screen.js）
import { FLOW, firstStep, nextStep, stepById, playableChapters } from '../game/flow.js';
import { PROLOGUE, endBefore, endAfter, FINAL_INTRO, gateBefore, gateOpened, zapSlide, DOOR_BEFORE, ENDING } from '../content/story.js';
import { GATES, DECOY_BY_CHAPTER, FINAL_K } from '../content/final.js';
import { FinalPlay } from '../game/final-play.js';
import { riddleHz } from '../content/riddles.js';
import { buildRun } from '../core/stage-gen.js';
import { buildScore } from '../game/song.js';
import { TIMBRES, SONG_TIMBRE, BASS_TIMBRE } from '../content/timbres.js';
import { RIDDLES } from '../content/riddles.js';
import { MODES } from '../content/modes.js';
import { TutorialBook } from '../game/tutorial-book.js';
import { ProgressBook } from '../game/progress.js';
import { BARS } from '../content/progressions.js';
import { MONOCHORD_STAGES } from '../content/monochord.js';

// 連続プレイの遊び方（FLOAT の levels() と同じく、名前と一言）。一言は MODES の値から作る
const LEVEL_IDS = ['free', 'normal', 'expert'];
const levelNote = m => (m.lives === Infinity ? '制限なし。和音もメーターも自由' : `失敗${m.lives}回まで・メーター${m.meterCount}回`);
function localStore() { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function createFlow({ audio, screens, mono, stage, story, riddle, final, mirror, onTitle }) {
  const card = document.getElementById('interlude-card');
  let mode = 'free';
  // 序を見たかの記録（2回目からは飛ばせる。要件6.10）。案内の記録と同じ場所に 'prologue' として残す
  const book = new TutorialBook(localStore());
  // 連続プレイで、序のあとに遊び方を選ぶか（タイトルの「連続プレイ」から入ったとき）
  let chooseAfterPrologue = false;
  // 進み具合の記録（段階7。端末の中だけ）。run は今の連続プレイの続き（第1章に入ってから保存する）
  const progress = new ProgressBook(localStore());
  let run = null;
  const saveRun = () => { if (run) progress.saveContinuous(run); };
  // 章の終わり（第2章・第3章）で、その連続プレイの曲を8小節通しでもう一度鳴らす（なければ鳴らさない。2026-11-15 発案者：最後の4小節から変更）
  const songOf = chapter => () => {
    const spec = run?.[chapter]?.spec;
    if (!spec) return;
    const stages = buildRun(spec).stages;
    audio.playScore(buildScore(stages, 0, stages.length - 1), { chordTimbre: TIMBRES[SONG_TIMBRE], bassTimbre: TIMBRES[BASS_TIMBRE] });
  };


  const show = name => {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  };
  const toTitle = () => { audio.stopAll(); mono.stop(); story.stop(); riddle.stop(); final.stop(); mirror.stop(); show('title'); onTitle(); };
  // 第3章「光の響きから影の琴へ」（鏡写しの説明）。毎回出し、2回目からは「飛ばす」。終わったら遊ぶ画面へ戻る
  const showMirror = (pair, done) => {
    const seen = !book.shouldAuto('mirror');
    show('mirror');
    mirror.play(pair, { canSkip: seen, endLabel: '星へもどる', onDone: () => { book.complete('mirror'); show('stage'); done(); } });
  };

  // 仮の画面を組み立てる。buttons：[文言, 動き, 主ボタンか, 一言（小さく添える）]
  function interlude({ eyebrow = '', title, lines = [], list = null, buttons, stack = false }) {
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
    // stack：選ぶボタンを縦に1列、同じ大きさで並べる（遊び方を選ぶ。2026-11-15 発案者）
    const row = el('div', stack ? 'interlude-buttons stack' : 'interlude-buttons');
    for (const [text, act, primary, note] of buttons) {
      const b = el('button', primary ? 'btn primary' : 'btn', text);
      b.type = 'button';
      if (note) b.append(el('small', '', note));
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
    // 連続プレイの続きを保存（どの章にいるか）。最後まで通したら消す
    if (run && step && step.kind !== 'story') { run.step = step.id; saveRun(); }
    if (run && !step) { progress.clearContinuous(); run = null; }
    if (!step) {
      interlude({ eyebrow: 'ここまで', title: '今作れている流れはここまでです', lines: ['謎・第3章・最終章・おはなしは、次の段階で作ります。'], buttons: [['タイトルへ', toTitle, true]] });
      return;
    }
    const next = () => go(nextStep(step.id));
    if (step.kind === 'story') {
      // 序のあとは、連続プレイなら遊び方を選ぶ（FLOAT と同じ）。見たことがあれば「飛ばす」も出す
      const seen = !book.shouldAuto('prologue');
      const after = () => { book.complete('prologue'); if (chooseAfterPrologue) chooseLevel(begin); else begin(); };
      // 第1章に入るときに、新しい連続プレイの続きを作る
      const begin = () => { run = { mode, step: 'ch1', ch1: [], ch2: null, ch3: null, artifacts: {}, decoys: [] }; next(); };
      // 紙芝居（段階6）。最後の「はじめる」か、2回目からの「飛ばす」で次へ
      show('story');
      story.play(PROLOGUE, { title: step.title, canSkip: seen, endLabel: 'はじめる', onDone: after });
    } else if (step.kind === 'riddle') {
      // 章の終わり（段階6）：紙芝居の終1・終2 → 章末の謎（段階5）→ 終4 → 次の章。
      // 謎で選んだ長さを武具として続きに残す（正誤は見ない。要件6.3）。揺れメーターはフリーだけ。
      // 紙芝居は2回目から「飛ばす」を出す（序章と同じ。章ごとに 'end-shield' などで記録）
      const R = RIDDLES[step.riddle], key = `end-${step.riddle}`, title = `${R.chapter}の終わり`;
      const seen = !book.shouldAuto(key);
      // 第2・3章の終わりでは、精霊が「もう1本、落ちていた弦」（おとりの辺 7・10）を拾う（Q-13）
      const decoy = DECOY_BY_CHAPTER[step.riddle] ?? null;
      const after = length => {
        if (run) {
          run.artifacts = { ...(run.artifacts ?? {}), [step.riddle]: length };
          if (decoy && !(run.decoys ?? []).includes(decoy)) run.decoys = [...(run.decoys ?? []), decoy];
          saveRun();
        }
        show('story');
        story.play(endAfter(step.riddle, R.name, riddleHz(length), decoy ? riddleHz(decoy) : null), { title, canSkip: seen, endLabel: '次へ', onDone: () => { book.complete(key); next(); } });
      };
      const toRiddle = () => { show('riddle'); riddle.start(R, { meter: mode === 'free', onTitle: toTitle, onDone: after }); };
      show('story');
      story.play(endBefore(step.riddle, R.name), { title, canSkip: seen, endLabel: '謎へ', onDone: toRiddle, phrase: songOf(step.riddle === 'armor' ? 'ch3' : 'ch2') });
    } else if (step.kind === 'final') {
      enterFinal(step);
    } else if (step.kind === 'monochord') {
      show('mono');
      mono.start(mode, { onDone: next, onTitle: toTitle, lit: run?.ch1 ?? [], onLit: lit => { if (run) { run.ch1 = lit; saveRun(); } } });
    } else if (step.kind === 'triangle') {
      // 三角形の章（第2章・第3章）。続きは章ごとに run.ch2・run.ch3 に残す
      const id = step.id;
      show('stage');
      stage.start(mode, {
        chapter: id, onChapterEnd: next, restore: run?.[id] ?? null, found: progress.found(), onMirror: showMirror,
        onChange: p => {
          progress.addFound(p.found);
          if (!run) return;
          // ゲームオーバーで連続プレイの続きは終わり（「最初から」で新しい曲を始めると、また保存する）
          if (p.over) { progress.clearContinuous(); return; }
          run[id] = p.snapshot(); run.step = id; saveRun();
        }
      });
    } else {
      interlude({ eyebrow: '準備中', title: step.title, lines: [step.note ?? ''], buttons: [['タイトルへ', toTitle], ['次へ ▶', next, true]] });
    }
  }

  // ---------- 最終章（要件6.4。2026-11-15 発案者と決めた形） ----------
  // 門の前の紙芝居 → 門（遊ぶ）→ 開いた門と小部屋の紙芝居 → …… → 最後の扉 → 直角に開く → 結末。
  // 足りない武具があれば ZAP：合わない声の紙芝居 → 足りない武具の謎だけ解き直し → 最終章を初めから。ZAP のたびに失敗の残りを1つ使う
  function enterFinal(step) {
    const play = new FinalPlay({ artifacts: run?.artifacts ?? {}, decoys: run?.decoys ?? [] });
    const seen = !book.shouldAuto('final');
    const title = '最終章';
    const startGates = () => { const miss = play.missing(); if (miss.length) zap(step, play, miss); else gateLoop(step, play); };
    show('story');
    story.play(FINAL_INTRO, { title, canSkip: seen, endLabel: '門へ', onDone: () => { book.complete('final'); startGates(); } });
  }
  function gateLoop(step, play) {
    const title = '最終章';
    if (play.atDoor) {
      show('story');
      story.play(DOOR_BEFORE, { title, endLabel: '扉へ', onDone: () => playFinal(step, play) });
      return;
    }
    const g = play.current;
    show('story');
    story.play(gateBefore(g.art, g.name, play.opened.length), { title, endLabel: '門へ', onDone: () => playFinal(step, play) });
  }
  function playFinal(step, play) {
    show('final');
    final.start(play, {
      modeId: mode, onTitle: toTitle,
      onGateOpen: r => {
        const k = GATES.indexOf(r.gate);
        show('story');
        story.play(gateOpened(k, r.gate.art, r.gate.name, [...r.gate.given, r.gate.answer].map(n => FINAL_K / n), k === GATES.length - 1),
          { title: '最終章', endLabel: '次へ', onDone: () => gateLoop(step, play) });
      },
      onZap: miss => zap(step, play, miss),
      onDoor: () => {
        show('story');
        story.play(ENDING, { title: '結末', endLabel: 'おわり', phrase: songOf('ch2'), onDone: () => { if (run) { progress.clearContinuous(); run = null; } finishedAll(); } });
      }
    });
  }
  // ZAP：失敗の残り（ノーマル・エキスパート）を1つ使い、足りない武具の謎へ。名前を教えるのはフリーだけ（要件6.6）
  function zap(step, play, miss) {
    const names = mode === 'free' ? miss.map(a => GATES.find(g => g.art === a).name).join('と') : null;
    if (run) {
      const lives = run.finalLives ?? (run.ch3 ?? run.ch2)?.livesLeft ?? null;
      if (lives !== null) {
        run.finalLives = Math.max(0, lives - 1);
        saveRun();
        if (run.finalLives <= 0) {
          progress.clearContinuous(); run = null;
          interlude({ eyebrow: '最終章', title: 'ゲームオーバー', lines: ['失敗の上限に達しました。連続プレイを最初から始められます。'], buttons: [['タイトルへ', toTitle, true]] });
          return;
        }
      }
    }
    show('story');
    story.play(zapSlide(play.opened.length, names), {
      title: '最終章', endLabel: '謎へ戻る',
      onDone: () => {
        const queue = [...miss];
        const one = () => {
          const art = queue.shift();
          if (!art) { enterFinal(step); return; }
          show('riddle');
          riddle.start(RIDDLES[art], { meter: mode === 'free', onTitle: toTitle, onDone: length => { if (run) { run.artifacts = { ...(run.artifacts ?? {}), [art]: length }; saveRun(); } one(); } });
        };
        one();
      }
    });
  }
  // 最後まで通したとき
  function finishedAll() {
    audio.stopAll();
    interlude({ eyebrow: 'ROOT NOTES', title: 'おしまい', lines: ['最後まで遊んでくれて、ありがとうございました。'], buttons: [['タイトルへ', toTitle, true]] });
  }

  // 連続プレイ：遊び方を選ぶ（FLOAT の levels() と同じ形：説明文と、名前に一言を添えた3つのボタン）
  function chooseLevel(then) {
    audio.stopAll();
    interlude({
      eyebrow: '連続プレイ', title: '遊び方を選ぶ',
      lines: ['第1章から順に進みます。ノーマルとエキスパートでは、回答するまで自分の和音は鳴らせず、失敗とメーターの回数に上限があります。'],
      buttons: [...LEVEL_IDS.map(id => [MODES[id].name, () => { mode = id; then(); }, id === 'free', levelNote(MODES[id])]), ['タイトルへ', toTitle]],
      stack: true
    });
  }

  // 選択プレイ：章を選ぶ
  function chooseChapter() {
    audio.stopAll();
    interlude({
      eyebrow: '選択プレイ', title: '章を選ぶ', lines: ['遊びたい章を選んでください。'],
      buttons: [...playableChapters().map(ch => [ch.title, () => playChapter(ch.id), true]), ['タイトルへ', toTitle]]
    });
  }
  // 選択プレイで灯した星は残す（段階7。2026-11-14 発案者）
  function playChapter(id) {
    run = null;
    const step = stepById(id);
    if (step.kind === 'monochord') {
      show('mono');
      mono.start(mode, { onDone: chooseChapter, onTitle: toTitle, lit: progress.selectLit('ch1'), onLit: lit => progress.addSelectLit('ch1', lit) });
    } else {
      show('stage');
      stage.start(mode, {
        chapter: id, onChapterEnd: null, lit: progress.selectLit(id), found: progress.found(), onMirror: showMirror,
        onChange: p => { progress.addFound(p.found); progress.addSelectLit(id, [...p.lit]); }
      });
    }
  }

  // 連続プレイの続きがあるとき：続きから／最初からを選ぶ（2026-11-14 発案者）。最初からを選ぶと、続きは消える（選んだときだけ）
  function offerResume(saved, fresh) {
    const where = stepById(saved.step);
    const detail = [MODES[saved.mode].name, where?.title ?? ''];
    if (saved.step === 'ch1') detail.push(`${saved.ch1.length} / ${MONOCHORD_STAGES.length}`);
    const tri = saved[saved.step];
    if (tri && (saved.step === 'ch2' || saved.step === 'ch3')) detail.push(`星 ${tri.lit.length} / ${BARS}`);
    const lives = (saved.ch3 ?? saved.ch2)?.livesLeft;
    if (lives != null) detail.push(`失敗あと${lives}回`);
    interlude({
      eyebrow: '連続プレイ', title: '続きがあります', lines: [detail.filter(Boolean).join('・')],
      buttons: [
        ['続きから ▶', () => { run = saved; mode = saved.mode; chooseAfterPrologue = false; go(where ?? firstStep()); }, true],
        ['最初から', () => { progress.clearContinuous(); run = null; fresh(); }, false, '今の続きは消えます'],
        ['タイトルへ', toTitle]
      ],
      stack: true // 遊び方を選ぶ画面と同じ並び（縦は1列・同じ大きさ、横は横並び。2026-11-15 発案者）
    });
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
    // 'continuous'：タイトルの「連続プレイ」。序のあとに遊び方を選ぶ（Codex がタイトルのボタンを減らしたあとの入口）。
    // 'free'・'normal'・'expert' は、遊び方を決めて序から始める（今までの入口。タイトルから外れても動く）
    run = null;
    if (modeId === 'select') { mode = 'select'; chooseChapter(); return; }
    const fresh = () => {
      chooseAfterPrologue = modeId === 'continuous';
      mode = modeId === 'continuous' ? 'free' : modeId;
      go(firstStep());
    };
    // 連続プレイの続きがあれば、勝手に上書きせず、続きから／最初からを選んでもらう（C-04）
    const saved = progress.continuous();
    if (saved) offerResume(saved, fresh); else fresh();
  }

  return { start, steps: FLOW };
}
