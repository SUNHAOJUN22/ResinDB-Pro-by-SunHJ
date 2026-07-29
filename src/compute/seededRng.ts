export const SEEDED_RNG_ALGORITHM_VERSION = 'xorshift32-v1';

export interface SeededRngState {
  seed: number;
}

export function normalizeSeed(seed: number): number {
  const value = Number.isFinite(seed) ? Math.trunc(seed) : 1;
  return (value >>> 0) || 1;
}

export function createSeededRng(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function createNormalSampler(seed: number): () => number {
  const rng = createSeededRng(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const radius = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    spare = radius * Math.sin(theta);
    return radius * Math.cos(theta);
  };
}
