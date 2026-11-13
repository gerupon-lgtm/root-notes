// 起動。段階0は、シリーズ表記・版数・© を画面に差し込むだけ
import { APP_VERSION, COPYRIGHT, SERIES } from '../version.js';

const put = (id, text) => {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
};

put('app-series', SERIES);
put('app-copyright', COPYRIGHT);
put('app-version', `v${APP_VERSION}`);
