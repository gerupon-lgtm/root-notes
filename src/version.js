// 版数と、画面に出す決まった文言。画面とテストの両方から読むので、ほかの部品を読み込まない。
// 版数の正典は package.json。ここは画面に出す写しで、ずれたらテストが落ちる（docs/design/段階0_土台.md 6章）。
export const APP_VERSION = '0.1.0';

// 要件8.2【想定】「© <年> SIKUMI LAB」。前作の画面は年なし。変えるときはここ1か所（A区分）
export const COPYRIGHT = '© 2026 SIKUMI LAB';

// 要件1章・7.1【想定】のシリーズ表記
export const SERIES = 'SIKUMI NOTES | 04';
