/**
 * Core Web Vitals on a mid-range phone, per page: LCP, CLS and INP, and the frames dropped while a person used it.
 *
 *   node scripts/vitals.ts [--base http://localhost:3100] [--routes /,/requests] [--extra /requests/req_1]
 *
 * The phone is Lighthouse's mobile profile: CPU slowed four times, Slow 4G (150 ms round trip, 1.6 Mbps down,
 * 750 kbps up), a 390px touch screen, motion not reduced. LCP and CLS come from PerformanceObservers installed before
 * the page loads (CLS as web-vitals defines it: the largest session window of shifts no input caused). INP is the
 * slowest of real taps on controls that change the screen (a period, the alerts, the workspace menu, the drawer), from
 * Event Timing, counting only the tap's own pointer, touch and click events: the Escape that closes what a tap opened
 * is not a person's interaction, and a headless browser can hold a no-op key event open until something else paints.
 * A dropped frame is a gap over 50 ms between animation frames while those taps play out.
 *
 * Every static page and the detail pages in scripts/verify.config.ts are measured; the Atlas is not a product page.
 * Run it against a production build (`next start`), never `next dev`. Fails (exit 1) when a page's LCP is 2.5 s or more,
 * INP 200 ms or more, or CLS 0.1 or more.
 */
import { launch } from './lib/chrome.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const extra = opt('--extra', '').split(',').filter(Boolean);
const ROUTES = opt('--routes', '')
  ? opt('--routes', '').split(',')
  : [...discover().filter((r) => !r.startsWith('/system')), ...(extra.length ? extra : config.detailRoutes)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Installed before any page script: every vital the page produces lands on window.__v. */
const OBSERVE = `(() => {
  const v = window.__v = { lcp: 0, cls: 0, session: 0, last: 0, taps: [], frames: [], recording: false, since: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    v.session = e.startTime - v.last < 1000 && v.session ? v.session + e.value : e.value;
    v.last = e.startTime; v.cls = Math.max(v.cls, v.session);
  } }).observe({ type: 'layout-shift', buffered: true });
  const TAP = /^(pointer|touch|mouse|click|gesture)/;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId && TAP.test(e.name) && e.startTime >= v.since) v.taps.push(e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  let prev = 0;
  const tick = (t) => { if (v.recording && prev) v.frames.push(t - prev); prev = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})()`;

/** Controls that change the screen when tapped; whichever a page has are used, in this order. */
const TAPS = [
  '[role="radiogroup"][aria-label="Reporting period"] [role="radio"]:not([aria-checked="true"])',
  'button[aria-label^="Alerts"]',
  'button[aria-label$="workspace menu"]',
  'button[aria-label="Open navigation"]',
  '[role="radiogroup"] [role="radio"]:not([aria-checked="true"])',
];

const page = await launch();
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
await page.send('Network.enable');
let failures = 0;
for (const route of ROUTES) {
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.open(base + route, { width: 390, height: 844, theme: 'dark', reduced: false, wait: 7000 });
  await page.eval('window.__v.recording = true');
  let inp = 0, slowest = '';
  for (const sel of TAPS) {
    const at = await page.eval<{ x: number; y: number } | null>(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!at) continue;
    await page.eval('(window.__v.taps = [], window.__v.since = performance.now(), true)');
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(1200);
    const ms = await page.eval<number>('Math.max(0, ...window.__v.taps)');
    if (ms > inp) { inp = ms; slowest = sel.replace(/\[aria-label[$^]?="?([^"\]]*)"?\]/, '$1').slice(0, 40); }
    // Close whatever the tap opened; its own events are not counted.
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
  }
  const v = await page.eval<{ lcp: number; cls: number; frames: number[] }>('window.__v');
  const dropped = v.frames.filter((f) => f > 50).length;
  const bad = v.lcp >= 2500 || inp >= 200 || v.cls >= 0.1;
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${route.padEnd(36)} LCP ${(v.lcp / 1000).toFixed(2)} s · INP ${Math.round(inp)} ms · CLS ${v.cls.toFixed(3)} · frames over 50 ms: ${dropped} of ${v.frames.length}${inp >= 100 ? ` · slowest tap: ${slowest}` : ''}`);
}
await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
page.close();
console.log(`\nvitals: ${ROUTES.length - failures} of ${ROUTES.length} pages under LCP 2.5 s, INP 200 ms and CLS 0.1 on a mid-range phone`);
process.exit(failures ? 1 : 0);
