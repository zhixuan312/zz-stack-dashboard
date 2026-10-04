/**
 * Core Web Vitals on a mid-range phone, measured in the browser the audit uses: LCP, CLS and INP per page, and the
 * frames an animation dropped while a person used it.
 *
 *   node scripts/vitals.ts [--base http://localhost:3314] [--routes /,/teams]
 *
 * The phone is Lighthouse's mobile profile: CPU slowed four times, Slow 4G (150 ms round trip, 1.6 Mbps down,
 * 750 kbps up), a 390 px touch screen at 3x, motion not reduced. LCP and CLS come from PerformanceObservers installed
 * before the page loads. INP is the slowest interaction among real taps on the page's controls (the period, the
 * workspace menu, the alerts, the command palette), from Event Timing. A dropped frame is a gap over 50 ms between
 * animation frames during those taps. Run it against a production build (`next start`), never `next dev`.
 *
 * Fails (exit 1) when a page's LCP is 2.5 s or more, INP 200 ms or more, or CLS 0.1 or more.
 */
import { launch } from './lib/chrome.ts';
import { DETAIL_ROUTES } from './fake-gateway/routes.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', 'http://localhost:3314');
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : ['/', '/teams', '/initiatives', '/knowledge', '/plugins', '/runs', '/activity', '/people', '/settings', '/login', ...DETAIL_ROUTES];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Installed before any page script: every vital the page produces lands on window.__v. */
const OBSERVE = `(() => {
  const v = window.__v = { lcp: 0, cls: 0, session: 0, last: 0, inp: 0, frames: [], recording: false };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  // CLS as the web-vitals library defines it: the largest session window of shifts not caused by input.
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    v.session = e.startTime - v.last < 1000 && v.session ? v.session + e.value : e.value;
    v.last = e.startTime; v.cls = Math.max(v.cls, v.session);
  } }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) v.inp = Math.max(v.inp, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  let prev = 0;
  const tick = (t) => { if (v.recording && prev) v.frames.push(t - prev); prev = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})()`;

/** The controls tapped for INP, in order; whichever exist on the page are used. */
const TAPS = [
  '[role="radiogroup"][aria-label="Reporting period"] [role="radio"]:not([aria-checked="true"])',
  'button[aria-label^="Alerts"]',
  'button[aria-label$="workspace menu"]',
  '[role="radiogroup"] [role="radio"]:not([aria-checked="true"])',
  'button[aria-label="Open navigation"]',
];

const page = await launch();
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
await page.send('Network.enable');
const rows: string[] = [];
let failures = 0;
for (const route of ROUTES) {
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.open(base + route, { width: 390, height: 844, theme: 'dark', reduced: false, wait: 7000 });
  await page.eval('window.__v.recording = true');
  let slowest = { ms: 0, tap: '' };
  for (const sel of TAPS) {
    const at = await page.eval<{ x: number; y: number } | null>(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!at) continue;
    const before = await page.eval<number>('window.__v.inp');
    await page.eval('window.__v.inp = 0');
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(900);
    const ms = await page.eval<number>('window.__v.inp');
    if (ms > slowest.ms) slowest = { ms, tap: sel.replace(/\[aria-label[$^]?="?([^"\]]*)"?\]/, '$1').slice(0, 40) };
    await page.eval(`window.__v.inp = Math.max(${before}, ${ms})`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
  }
  const v = await page.eval<{ lcp: number; cls: number; inp: number; frames: number[] }>('window.__v');
  const dropped = v.frames.filter((f) => f > 50).length;
  const bad = v.lcp >= 2500 || v.inp >= 200 || v.cls >= 0.1;
  if (bad) failures++;
  rows.push(`${bad ? 'FAIL' : 'ok  '} ${route.padEnd(46)} LCP ${(v.lcp / 1000).toFixed(2)} s · INP ${Math.round(v.inp)} ms · CLS ${v.cls.toFixed(3)} · frames over 50 ms: ${dropped} of ${v.frames.length}${slowest.ms >= 100 ? ` · slowest tap: ${slowest.tap}` : ''}`);
  console.log(rows.at(-1));
}
await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
page.close();
console.log(`\nvitals: ${ROUTES.length - failures} of ${ROUTES.length} pages under LCP 2.5 s, INP 200 ms and CLS 0.1 on a mid-range phone`);
process.exit(failures ? 1 : 0);
