// 前作 AQUA の tests/update-manager.test.js を移した（段階7）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { newerVersion } from '../src/ui/update-manager.js';
import { setupOffline } from '../src/ui/offline.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 25));
class Worker extends EventTarget {
  constructor(version, ready = true) { super(); this.version = version; this.ready = ready; this.state = 'installed'; this.activationRequests = 0; }
  postMessage(message, ports) {
    if (message === 'activate-update') this.activationRequests++;
    else if (message.type === 'ROOT_UPDATE_STATUS') ports[0].postMessage({ version: this.version, ready: this.ready });
  }
}
// ROOT の更新の知らせ（src/ui/offline.js）を、模型の document・serviceWorker で動かす。
// AQUA のテストはタイトルの更新ボタンも見ていた。ROOT は画面の下の知らせだけ
async function fixture({ candidate = null, phase = 'edit', meta = true } = {}) {
  const notice = { hidden: true }, apply = { disabled: false }, later = {};
  const elements = { 'update-notice': notice, 'update-apply': apply, 'update-later': later };
  const registration = Object.assign(new EventTarget(), { waiting: candidate, installing: null, async update() {} });
  const serviceWorker = Object.assign(new EventTarget(), { controller: new Worker('0.14.11'), async register() { return registration; } });
  let reloads = 0;
  const state = { phase };
  const updates = setupOffline({
    document: { getElementById: id => elements[id], querySelector: selector => (selector === 'meta[name="root-offline"]' && meta ? {} : null) },
    navigator: { serviceWorker }, location: { reload() { reloads++; } }, version: '0.14.12',
    canApply: () => state.phase !== 'running', timeoutMs: 15
  });
  await settle();
  const context = { state, updates };
  return { notice, apply, later, registration, serviceWorker, context, updates, get reloads() { return reloads; } };
}

test('最新の画面で同じ版のworkerが待機していても、下部と右上の更新を表示しない', async () => {
  const f = await fixture({ candidate: new Worker('0.14.12') });
  assert.equal(f.notice.hidden, true, '画面と同じ版なのに下部の更新案内が出ている');
 
});
test('古い版の待機と更新なしでも更新ボタンを出さない', async () => {
  for (const candidate of [null, new Worker('0.14.9')]) {
    const f = await fixture({ candidate });
    assert.equal(f.notice.hidden, true);
  }
});
test('新しい版でも資材が不足している間は更新を勧めない', async () => {
  const f = await fixture({ candidate: new Worker('0.14.13', false) });
  assert.equal(f.notice.hidden, true);
});
test('準備済みの新しい版だけ両方のボタンから適用できる', async () => {
  const candidate = new Worker('0.14.13'), f = await fixture({ candidate });
  assert.equal(f.notice.hidden, false);
  await f.apply.onclick();
  assert.equal(candidate.activationRequests, 1);
});
test('切り替えてはいけない間は更新を適用しない', async () => {
  const candidate = new Worker('0.14.13'), f = await fixture({ candidate, phase: 'running' });
  assert.equal(f.apply.disabled, true);
  await f.apply.onclick();
  assert.equal(candidate.activationRequests, 0);
});
test('同じ版のworkerへ切り替わっても、最新の画面を再読込しない', async () => {
  const f = await fixture();
  f.serviceWorker.controller = new Worker('0.14.12');
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  await settle(); assert.equal(f.reloads, 0);
});
test('表示していない新しい版へ切り替わったときは再読込する', async () => {
  const f = await fixture();
  f.serviceWorker.controller = new Worker('0.14.13');
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  await settle(); assert.equal(f.reloads, 1);
});
test('旧形式で版を答えられないworkerを、新しい版と決めつけない', async () => {
  const candidate = new Worker('0.14.13'); candidate.postMessage = () => {};
  const f = await fixture({ candidate });
  assert.equal(f.notice.hidden, true);
});
test('版は文字列順ではなく数字で比較し、不正な版は勧めない', () => {
  assert.equal(newerVersion('0.14.13', '0.14.12'), true);
  assert.equal(newerVersion('0.14.9', '0.14.12'), false);
  assert.equal(newerVersion('0.14.12', '0.14.12'), false);
  assert.equal(newerVersion('unknown', '0.14.12'), false);
});
test('ページを開いたあとに新しい版の準備が終わった場合も案内する', async () => {
  const f = await fixture(), candidate = new Worker('0.14.13');
  candidate.state = 'installing'; f.registration.installing = candidate;
  f.registration.dispatchEvent(new Event('updatefound'));
  await settle(); assert.equal(f.notice.hidden, true);
  candidate.state = 'installed'; f.registration.installing = null; f.registration.waiting = candidate;
  candidate.dispatchEvent(new Event('statechange'));
  await settle(); assert.equal(f.notice.hidden, false);
});
test('表示したあとに資材が失われた場合、更新ボタンを押しても適用しない', async () => {
  const candidate = new Worker('0.14.13'), f = await fixture({ candidate });
  candidate.ready = false;
  await f.apply.onclick();
  assert.equal(candidate.activationRequests, 0); assert.equal(f.notice.hidden, true);
});
test('別タブによる新しいworkerへの切替でも、切り替えてよい時まで再読込を待つ', async () => {
  const f = await fixture({ phase: 'running' });
  f.serviceWorker.controller = new Worker('0.14.13');
  f.serviceWorker.dispatchEvent(new Event('controllerchange')); await settle();
  assert.equal(f.reloads, 0);
  f.context.state.phase = 'result';
  f.updates.refreshControls();
  assert.equal(f.reloads, 1);
});
test('同じ版の待機とは別に新版を取得している間は、最新版と断定しない', async () => {
  const f = await fixture({ candidate: new Worker('0.14.12') }), next = new Worker('0.14.13');
  next.state = 'installing'; f.registration.installing = next;
  f.registration.dispatchEvent(new Event('updatefound')); await settle();
  assert.equal(f.updates.state.status, 'checking');
  assert.equal(f.notice.hidden, true);
});

test('開発中（印がない）は worker を登録せず、知らせも出さない。「あとで」で知らせを隠す', async () => {
  const dev = await fixture({ candidate: new Worker('0.14.13'), meta: false });
  assert.equal(dev.updates, null);
  assert.equal(dev.notice.hidden, true);
  const f = await fixture({ candidate: new Worker('0.14.13') });
  assert.equal(f.notice.hidden, false);
  f.later.onclick();
  assert.equal(f.notice.hidden, true);
});
