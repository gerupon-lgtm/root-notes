// 整数の小さな道具（最大公約数・最小公倍数・いちばん大きい素因数）。判定を整数のまま行うために使う
export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a, b) => (a / gcd(a, b)) * b;

// 正の整数の、いちばん大きい素因数（1 のときは 1）
export function largestPrimeFactor(n) {
  let largest = 1;
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) { largest = p; n /= p; }
  }
  return n > 1 ? n : largest;
}
