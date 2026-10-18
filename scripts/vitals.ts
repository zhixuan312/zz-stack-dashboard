/**
 * Core Web Vitals on a mid-range phone, per page: LCP, CLS and INP, and the frames dropped while a person used it.
 *
 *   node scripts/vitals.ts [--base http://localhost:3100] [--routes /,/requests] [--atlas] [--list]
 *
 * The phone is Lighthouse's mobile profile: the device of benchmark index 800, the CPU slowed by the host's own index
 * over 800 (scripts/lib/phone.ts), Slow 4G (150 ms round trip, 1.6 Mbps down, 750 kbps up), a 390px touch screen,
 * motion not reduced. LCP and CLS come from PerformanceObservers installed before the page loads (CLS as web-vitals
 * defines it: the largest session window of shifts no input caused). INP is the slowest of real taps on controls that
 * change the screen (a period, the alerts, the workspace menu, the drawer), from Event Timing, counting only the tap's
 * own pointer, touch and click events: the Escape that closes what a tap opened is not a person's interaction, and a
 * headless browser can hold a no-op key event open until something else paints. A dropped frame is a gap over 50 ms
 * between animation frames, and it is read in the same window as the tap that caused it and no other, for the same
 * reason INP is: counting frames from the moment the page opened charged a page for the Escape and the settle between
 * taps, which are the check's own work and not the person's. Each line says how many controls it tapped, found through
 * open shadow roots (scripts/lib/deep.ts), so a page whose INP rests on no tap says so, and a page that dropped a frame
 * names the control it dropped it on. A page that drops one is measured a second time before it is failed, and a page
 * that drops one twice is a page that stutters. The line also says where the longest gap went, from the Long Animation
 * Frames API (scripts/lib/frame-cause.ts): script, style and layout, and render, or that no long frame covered it.
 *
 * Every static page and the detail pages in scripts/verify.config.ts are measured, the Atlas's among them: its front
 * page and one card page, the sample every other suite takes. `--atlas` measures every Atlas entry instead (the guides,
 * the token views, the cards and the page specs, about fifteen minutes), and is not part of `pnpm verify`. The Atlas was
 * left out as "not a product page" until it was measured once: every card page shifted 0.3 to 0.6 against the 0.1
 * floor, and nothing had been looking. `--list` prints the routes a run would visit and exits without a browser.
 *
 * Run it against a production build (`next start`), never `next dev`. Fails (exit 1) when a page's LCP is 2.5 s or more,
 * INP 200 ms or more, CLS 0.1 or more, or drops a frame. The frames are a floor and not a figure to read: a person
 * tapping the phone drawer is the app's most repeated gesture, and one 50 ms frame in it is the whole cost of the
 * drawer arriving late. It was reported and not failed until the rail stopped measuring itself inside that tap.
 */
import { atlasCoverage, atlasEntries } from './lib/atlas.ts';
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { frameCause, loafOf, type LoafEntry } from './lib/frame-cause.ts';
import { measurePhone } from './lib/phone.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
// verify.config.ts is the team's, so read the one field this needs through its own type.
const detailRoutes = (config as { detailRoutes?: string[] }).detailRoutes ?? [];
const ATLAS = args.includes('--atlas');
const entries = ATLAS ? await atlasEntries().catch((e: Error) => { console.error(`vitals --atlas: ${e.message}`); process.exit(1); }) : [];
const ROUTES = ATLAS ? entries.map((e) => e.href) : opt('--routes', '') ? opt('--routes', '').split(',') : [...discover(), ...detailRoutes];
if (args.includes('--list')) {
  console.log(ROUTES.join('\n'));
  if (ATLAS) console.log(`atlas: ${atlasCoverage(entries)}`);
  process.exit(0);
}
if (ATLAS) console.log(`atlas: ${atlasCoverage(entries)}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Installed before any page script: every vital the page produces lands on window.__v. */
const OBSERVE = `(() => {
  const v = window.__v = { lcp: 0, cls: 0, session: 0, last: 0, taps: [], frames: [], loafs: [], recording: false, since: 0, moved: {} };
  const named = (n) => !n || n.nodeType !== 1 ? 'an element since removed' : n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    v.session = e.startTime - v.last < 1000 && v.session ? v.session + e.value : e.value;
    v.last = e.startTime; v.cls = Math.max(v.cls, v.session);
    for (const s of e.sources || []) { const k = named(s.node); v.moved[k] = (v.moved[k] || 0) + e.value; }
  } }).observe({ type: 'layout-shift', buffered: true });
  const TAP = /^(pointer|touch|mouse|click|gesture)/;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId && TAP.test(e.name) && e.startTime >= v.since) v.taps.push(e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  let prev = 0;
  const tick = (t) => { if (v.recording && prev) v.frames.push(t - prev); prev = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // The long animation frames of the same window, raw: scripts/lib/frame-cause.ts splits them. A browser without the entry type leaves none.
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (v.recording && e.duration > 50) v.loafs.push({ startTime: e.startTime, duration: e.duration, renderStart: e.renderStart, styleAndLayoutStart: e.styleAndLayoutStart, scripts: (e.scripts || []).map((s) => ({ invoker: s.invoker || '', duration: s.duration, forcedStyleAndLayoutDuration: s.forcedStyleAndLayoutDuration || 0 })) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
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
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: DEEP_SOURCE });
await page.send('Network.enable');

/** One page measured once: what LCP, CLS and INP were, how many controls answered, and the frames that dropped on them. */
type Measured = { lcp: number; cls: number; moved: string; inp: number; slowest: string; tapped: number; frames: number; dropped: number; droppedBy: string; cause: string };

async function measure(route: string): Promise<Measured> {
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Emulation.setCPUThrottlingRate', { rate: (await measurePhone(page)).rate });
  await page.open(base + route, { width: 390, height: 844, theme: 'dark', reduced: false, wait: 7000 });
  await page.eval('window.__v.recording = true');
  let inp = 0, slowest = '', tapped = 0, frames = 0, dropped = 0, droppedBy = '', cause = '', worst = 0;
  for (const sel of TAPS) {
    const at = await page.eval<{ x: number; y: number } | null>(`(() => { const el = deepQuery(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!at) continue;
    tapped++;
    await page.eval('(window.__v.taps = [], window.__v.frames = [], window.__v.loafs = [], window.__v.since = performance.now(), true)');
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(1200);
    const ms = await page.eval<number>('Math.max(0, ...window.__v.taps)');
    const gaps = await page.eval<number[]>('window.__v.frames');
    const loafs = await page.eval<LoafEntry[]>('window.__v.loafs');
    const name = sel.replace(/\[aria-label[$^]?="?([^"\]]*)"?\]/, '$1').slice(0, 40);
    if (ms > inp) { inp = ms; slowest = name; }
    const here = gaps.filter((f) => f > 50).length;
    frames += gaps.length;
    dropped += here;
    if (here) {
      droppedBy = name;
      const gap = Math.max(...gaps);
      if (gap > worst) { worst = gap; cause = frameCause(Math.round(gap), loafs.map(loafOf)); }
    }
    // Close whatever the tap opened; its own events and its own frames are not counted.
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
  }
  const v = await page.eval<{ lcp: number; cls: number; moved: Record<string, number> }>('window.__v');
  // A page over the CLS floor says what moved: the three elements whose shifts sum highest (a shift counts for each element it moved).
  const moved = v.cls >= 0.1 ? Object.entries(v.moved).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n.toFixed(3)}`).join(', ') : '';
  return { lcp: v.lcp, cls: v.cls, moved, inp, slowest, tapped, frames, dropped, droppedBy, cause };
}

let failures = 0;
for (const route of ROUTES) {
  let m = await measure(route);
  // One dropped frame among two hundred is inside the noise of the machine this measures on, and the frame is not always
  // the page's: the same route, measured again on the same build, reads zero (a throttled CPU measures
  // the host too, which is why this suite runs alone last). The floor is still no frames over 50 ms — so a page that
  // drops one is measured a second time before it is failed, and a page that drops one twice is a page that stutters.
  const again = m.dropped > 0;
  if (again) m = await measure(route);
  const bad = m.lcp >= 2500 || m.inp >= 200 || m.cls >= 0.1 || m.dropped > 0;
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${route.padEnd(36)} LCP ${(m.lcp / 1000).toFixed(2)} s · INP ${Math.round(m.inp)} ms · CLS ${m.cls.toFixed(3)} · frames over 50 ms: ${m.dropped} of ${m.frames}${again ? ' (second measure)' : ''} · taps: ${m.tapped}${m.dropped ? ` · dropped by: ${m.droppedBy} · ${m.cause}` : ''}${m.inp >= 100 ? ` · slowest tap: ${m.slowest}` : ''}${m.moved ? ` · moved most: ${m.moved}` : ''}`);
}
await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
page.close();
console.log(`\nvitals: ${ROUTES.length - failures} of ${ROUTES.length} pages under LCP 2.5 s, INP 200 ms, CLS 0.1 and no dropped frame on a mid-range phone`);
process.exit(failures ? 1 : 0);
