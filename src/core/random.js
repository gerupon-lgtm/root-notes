// 種（シード）から作る乱数。同じ種なら、いつも同じ並びになる（選択プレイの固定とテストの再現のため）。
// 計算のしかたは試作と同じ mulberry32（広く使われている短い乱数の作り方）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 並びを混ぜた写しを返す（元の並びは変えない）
export function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pickOne = (items, rng) => items[Math.floor(rng() * items.length)];
