// 音の高さの色（要件5章【想定】、F-008）。周波数から色相を決め、1オクターブ違う音は同じ色。
// 和音は3つの色を混ぜる。式は試作と同じ（ド＝261.63Hz を色相200度に置く）
const C4 = 261.63;

export function hueOf(hz) {
  const octaves = Math.log2(hz / C4);
  const frac = octaves - Math.floor(octaves);
  return Math.round((frac * 360 + 200) % 360);
}

export const colorOf = hz => `hsl(${hueOf(hz)} 75% 66%)`;

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// 3つ（いくつでも）の周波数の色を、同じ割合で混ぜる
export function blendOf(hzs) {
  const sum = hzs.map(hz => hslToRgb(hueOf(hz), 75, 62)).reduce((acc, rgb) => acc.map((v, i) => v + rgb[i] / hzs.length), [0, 0, 0]);
  return `rgb(${sum.map(v => Math.round(v)).join(' ')})`;
}
