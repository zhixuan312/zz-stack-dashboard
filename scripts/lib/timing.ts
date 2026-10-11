/** The timing rule: one sample per metric, two more when it is over, a gate on the median of three. */

export type Verdict = 'pass' | 'retake' | 'fail';

const sorted = (samples: number[]): number[] => [...samples].sort((a, b) => a - b);

function median(samples: number[]): number {
  const s = sorted(samples);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * One sample passes within its limit and asks for a retake over it. Three are gated on their median, never on the
 * best one, and are noisy when they straddle the limit. Any other count is a caller mistake.
 */
export function judge(samples: number[], limit: number): { verdict: Verdict; median: number; noisy: boolean } {
  if (samples.length === 1) return { verdict: samples[0] <= limit ? 'pass' : 'retake', median: samples[0], noisy: false };
  if (samples.length !== 3) throw new Error(`timing: expected 1 or 3 samples, got ${samples.length}`);
  const m = median(samples);
  const over = samples.filter((s) => s > limit).length;
  return { verdict: m <= limit ? 'pass' : 'fail', median: m, noisy: over > 0 && over < samples.length };
}

/** Nearest-rank p95: the smallest sample with at least 95% of the samples at or below it. */
export function p95(samples: number[]): number {
  if (samples.length === 0) throw new Error('timing: p95 of no samples');
  return sorted(samples)[Math.ceil((samples.length * 95) / 100) - 1];
}

export function summary(samples: number[]): { median: number; p95: number; max: number } {
  return { median: median(samples), p95: p95(samples), max: Math.max(...samples) };
}
