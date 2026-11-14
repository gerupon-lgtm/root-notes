// 通信なしで遊ぶ仕組みと、新しい版の知らせ（段階7。docs/design/段階7_PWA.md）。前作 AQUA の setupOffline（src/ui/app.js）と同じ動き。
// - 公開用にまとめた版（index.html に <meta name="root-offline"> がある）だけで worker を登録する。開発中（npm run dev）は登録しない
// - 新しい版の資材がそろったら、画面の下に「新しい版を使えます。」と「更新する」を出す。押したときだけ切り替える（遊びを勝手に途切れさせない）
// - 「あとで」で、その画面を開いている間は知らせを隠す
import { createUpdateManager } from './update-manager.js';

export function setupOffline({ document, navigator, location, version, canApply = () => true, timeoutMs }) {
  const notice = document.getElementById('update-notice');
  const apply = document.getElementById('update-apply');
  const later = document.getElementById('update-later');
  if (!notice || !apply) return null;
  let dismissed = false;
  const sync = info => {
    notice.hidden = dismissed || info?.status !== 'ready';
    apply.disabled = !canApply();
  };
  sync(null);
  if (!document.querySelector('meta[name="root-offline"]') || !navigator?.serviceWorker) return null;
  const updates = createUpdateManager({
    serviceWorker: navigator.serviceWorker, currentVersion: version,
    onChange: sync, canApply, reload: () => location.reload(), timeoutMs
  });
  apply.onclick = () => updates.apply();
  if (later) later.onclick = () => { dismissed = true; sync(updates.state); };
  updates.start().catch(() => { /* 登録できない環境では、通信ありでそのまま遊べる */ });
  return updates;
}
