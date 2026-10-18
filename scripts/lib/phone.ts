/**
 * The phone every timed suite emulates: one device on every host.
 *
 * The device is the one whose Lighthouse benchmarkIndex is 800, the top of Lighthouse's Mid-Tier Mobile bracket (125 to
 * 800, docs/throttling.md as of Chrome m86). The benchmarkIndex, its brackets and the advice to fit the CPU multiplier
 * to the host are Lighthouse's; scaling the rate automatically from the index is Meridian's. A host slower than the
 * phone is slowed less, a host faster is slowed more, so the same page costs the same on a laptop and on a runner.
 */
import type { Page } from './chrome.ts';

/**
 * Lighthouse's computeBenchmarkIndex, as one in-page expression: the mean of a GC-heavy string loop and an array-copy
 * loop over 100,000 elements, each run for 500 ms, iterations per second divided by 10, so an index here is the number
 * Lighthouse reports as the host's CPU/Memory Power.
 * Adapted from https://github.com/GoogleChrome/lighthouse/blob/main/core/lib/page-functions.js (Apache-2.0,
 * Copyright 2018 Google LLC).
 */
export const BENCHMARK = `(() => {
  function gc() { const start = Date.now(); let it = 0; while (Date.now() - start < 500) { let s = ''; for (let j = 0; j < 10000; j++) s += 'a'; if (s.length === 1) throw new Error('never'); it++; } return Math.round(it / 10 / ((Date.now() - start) / 1000)); }
  function nogc() { const a = [], b = []; for (let i = 0; i < 100000; i++) a[i] = b[i] = i; const start = Date.now(); let it = 0; while (it % 10 !== 0 || Date.now() - start < 500) { const src = it % 2 === 0 ? a : b; const tgt = it % 2 === 0 ? b : a; for (let j = 0; j < src.length; j++) tgt[j] = src[j]; it++; } return Math.round(it / 10 / ((Date.now() - start) / 1000)); }
  return (gc() + nogc()) / 2;
})()`;

/**
 * The phone's index: the top of Lighthouse's Mid-Tier Mobile bracket, fixed by the stakeholder's decision that the
 * standard's phone is that device. A different bracket is a decision, not an edit.
 */
export const TARGET_INDEX = 800;

/** The CPU slowdown that makes a host of this index the phone: its index over the phone's, to one decimal, at least 1. */
export function phoneRate(index: number): number {
  if (!Number.isFinite(index) || index <= 0) throw new Error(`phoneRate: a benchmark index must be a positive finite number, got ${index}`);
  return Math.round(Math.max(1, index / TARGET_INDEX) * 10) / 10;
}

let reading: { index: number; rate: number } | undefined;

/**
 * The host's index (the median of three readings in a blank page, un-throttled) and the rate that makes it the phone.
 * The first call in a process measures and prints one line; every later call returns the same reading, so one run
 * judges every page on one device. Run it before the suite's first phone page, never between a page's load and its measure.
 */
export async function measurePhone(page: Page): Promise<{ index: number; rate: number }> {
  if (reading) return reading;
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.open('about:blank', { width: 390, height: 844, wait: 200 });
  const readings: number[] = [];
  for (let i = 0; i < 3; i++) readings.push(await page.eval<number>(BENCHMARK));
  const index = [...readings].sort((a, b) => a - b)[1];
  const rate = phoneRate(index);
  console.error(`phone: this host slowed ${rate}x (benchmark index ${index} from ${readings.join(', ')}; the phone is index ${TARGET_INDEX})`);
  reading = { index, rate };
  return reading;
}
