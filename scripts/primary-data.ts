/**
 * The time until a page's own data can be read, beside its largest paint, per route and per person, on a mid-range
 * phone: one of verify's `browserChecks`.
 *
 *   node scripts/primary-data.ts [--base http://localhost:3100] [--routes /,/teams] [--as superadmin,member]
 *
 * The phone is scripts/vitals.ts's: CPU slowed four times, Slow 4G (150 ms round trip, 1.6 Mbps down, 750 kbps up), the
 * cache off, a 390px touch screen in the dark theme, motion not reduced, each page given seven seconds and its load
 * event. The routes are every rail route the navigation checks in scripts/verify.config.ts name, then every address
 * under its `detailRoutes`, for each persona it declares, signed in by the persona's cookie.
 *
 * Time to primary data is navigation start to the first animation frame in which the route's own content is on screen.
 * A rail route's content is its navigation check's `readySelector` (holding `readyText` when it names one); a detail
 * route's is the selector declared beside it in `DETAIL` below: the record's own table, figures or document body, never
 * its heading. An element counts when it has a box, holds text and is neither a skeleton nor inside one (`.shimmer`,
 * `[aria-busy="true"]`), the rule scripts/navigate.ts reads data by. Both numbers are taken inside the page, from one
 * script installed before any of the page's own: the largest paint from its PerformanceObserver, the data from a frame
 * loop, so neither waits on a round trip to this process.
 *
 * A route the person may not open is recorded as refused, not as a time: the gate's refusal (`[data-no-access]` under
 * `refusal: 'explain'`, the missing page's `[data-missing-page]` under `absent`), or a record the gateway answers as
 * not existing, which is how it refuses another team's record without confirming it is there (`Query` in
 * src/console/query.tsx). A rail route's refusal must match the persona's hand-written `expectedRoutes`.
 *
 * No budget is enforced on the time: the stakeholder sets it from this table (spec AC-8.7). Each row carries its place
 * in the run, `#n`, because a measurement carries its history: one browser opens every page in the order printed, with
 * no warm-up load, so row #n is the n-th page that browser opened, against a server that has served every row before it.
 *
 * Then a delayed read, for each rail route as the first persona: every read the page makes from the browser under
 * `/api/console` (the live stream aside) is held for eight seconds inside this browser alone, never in the fake gateway,
 * which the audit, the presses and the keyboard walk read at the same time. The page must show loading in the first
 * frame its main region paints, and on screen within five seconds of its first held read either its content or an
 * explicit state: an error, a refusal. No allowance for drawing it: the console gives up on a read at 4.5 s
 * (`READ_BOUND_MS` in src/lib/api.ts) so that what a person sees is there by five. Five seconds from the read, not from
 * navigation; a page that sends no read from the browser is held to five seconds from navigation. A read the
 * console's server makes for itself (the gate's `/me`, Status's figure) is not held here.
 *
 * One line per route and persona, then one per delayed read. Exits 1 when a delayed read shows no loading at once or no
 * explicit state within five seconds, when a route shows neither its content nor a refusal within twenty seconds, when a
 * rail route's refusal disagrees with the persona's expected routes, or when a detail route has no selector declared.
 */
import { launch, type Page } from './lib/chrome.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const only = opt('--routes', '') ? new Set(opt('--routes', '').split(',')) : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A table's rows: the record's own list. */
const TABLE = 'main table tbody tr';
/** A document's text: the renderer's blocks, or the same words as plain text while the renderer's chunk is on its way (src/console/reading.tsx). */
const BODY = 'main div.text-ink-2.break-words > *, main [data-split="2/3"] > .card:first-child pre';
/** A skill's cost record: its figures. */
const FIGURES = 'main .t-figure';
/** A skill the active team never ran: the page's sentence saying so is its record, since the figures are the team's. */
const NEVER_RUN = 'main [data-never-run]';

/**
 * What counts as each detail route's primary data, read off the built app served against the fake gateway on
 * 2026-10-14. COUPLED: `detailRoutes` in scripts/verify.config.ts; an address there with no entry here fails the run.
 */
const DETAIL: Record<string, string> = {
  '/platform/releases/0.97.0': BODY,
  '/platform/releases/0.31.1': BODY,
  '/platform/teams/atlas': TABLE,
  '/platform/teams/dune': TABLE,
  '/teams/atlas': TABLE,
  // No initiative yet, which the page says; its members are the table.
  '/teams/dune': TABLE,
  '/initiatives/atlas/2026-09-28-search-relevance': TABLE,
  '/initiatives/cinder/2026-08-20-incident-runbooks': TABLE,
  '/initiatives/beacon/2026-09-22-payout-schedule': TABLE,
  '/initiatives/atlas/2026-09-05-research-notes': TABLE,
  '/initiatives/atlas/2026-09-28-search-relevance/spec.md': BODY,
  '/initiatives/atlas/2026-09-28-search-relevance/plan.md': BODY,
  '/initiatives/atlas/2026-09-12-onboarding-revamp/review.md': BODY,
  '/initiatives/beacon/2026-09-22-payout-schedule/review.md': BODY,
  '/initiatives/atlas/2026-10-02-query-latency/spec.md': BODY,
  '/initiatives/atlas/2026-10-04-index-rebuild/spec.md': BODY,
  '/knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md': BODY,
  '/knowledge/atlas/nodes/0004-rank-by-recency-first.md': BODY,
  '/plugins/sdlc': TABLE,
  '/plugins/zz-access': TABLE,
  '/plugins/research-kit': TABLE,
  '/plugins/sdlc/sdlc-spec': FIGURES,
  '/plugins/sdlc/sdlc-spec?view=read': BODY,
  '/plugins/sdlc/sdlc-spec?view=references': TABLE,
  '/plugins/research-kit/research-scan': NEVER_RUN,
};

type Target = { path: string; ready: string; text: string; rail: boolean };
const rail: Target[] = (config.navigationChecks ?? []).map((c) => ({ path: c.path, ready: c.readySelector, text: (c.readyText ?? '').toLowerCase(), rail: true }));
const undeclared = config.detailRoutes.filter((r) => !DETAIL[r]);
const detail: Target[] = config.detailRoutes.filter((r) => DETAIL[r]).map((r) => ({ path: r, ready: DETAIL[r], text: '', rail: false }));
const targets = [...rail, ...detail].filter((t) => !only || only.has(t.path));
const personas = Object.entries(config.personas ?? {}).filter(([name]) => !args.includes('--as') || opt('--as', '').split(',').includes(name));

/** How long a route has to show its content or a refusal, and how long a delayed read is held. */
const CAP_MS = 20_000;
const HOLD_MS = 8_000;
const BOUND_MS = 5_000;

/**
 * Installed before the page's own scripts, once per route: the largest paint, and the first frame in which the route's
 * content, a refusal, a loading state or an explicit state is on screen, each against navigation start.
 */
const observe = (t: Target, hold: number) => `(() => {
  const spec = ${JSON.stringify({ ready: t.ready, text: t.text, cap: CAP_MS, hold })};
  const p = window.__pd = { lcp: 0, data: null, refused: null, why: '', main: null, loadingAtMain: false, contentAtMain: false, explicit: null, held: null };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) p.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  if (spec.hold) {
    const real = window.fetch;
    const url = (i) => typeof i === 'string' ? i : i instanceof URL ? i.href : i.url;
    window.fetch = (input, init) => {
      if (!/\\/api\\/console\\//.test(url(input)) || /\\/api\\/console\\/live/.test(url(input))) return real(input, init);
      if (p.held === null) p.held = performance.now();
      return new Promise((r) => setTimeout(r, spec.hold)).then(() => real(input, init));
    };
  }
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const readable = (el) => shown(el) && !el.closest('.shimmer, [aria-busy="true"]') && !el.querySelector('.shimmer') && (el.textContent || '').trim() !== '';
  const some = (sel, test) => [...document.querySelectorAll(sel)].some(test);
  const content = () => some(spec.ready, (el) => readable(el) && (!spec.text || el.textContent.toLowerCase().includes(spec.text)));
  // The gate's refusal under either setting, or a record answered as not existing: Query's 404 title, "<what> does not exist".
  const refusal = () => some('main [data-no-access], main [data-missing-page]', shown) ? 'no access'
    : some('main p.t-card', (el) => shown(el) && / does not exist$/.test(el.textContent.trim())) ? 'answered as not existing' : '';
  const tick = () => {
    const now = performance.now();
    const main = document.querySelector('main');
    if (p.main === null && main && main.getBoundingClientRect().height > 0) {
      p.main = now;
      p.loadingAtMain = some('main [aria-busy="true"], main .shimmer', shown);
      p.contentAtMain = content();
    }
    if (p.data === null && p.refused === null) {
      if (content()) p.data = now;
      else { const why = refusal(); if (why) { p.refused = now; p.why = why; } }
    }
    if (p.explicit === null && (p.data !== null || p.refused !== null || some('main [role="alert"], main [data-no-access], main [data-missing-page]', shown))) p.explicit = now;
    if (now < spec.cap) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

type Seen = { lcp: number; data: number | null; refused: number | null; why: string; main: number | null; loadingAtMain: boolean; contentAtMain: boolean; explicit: number | null; held: number | null };

/** The phone, re-applied before every page as vitals.ts does: an open() resets nothing it set. */
async function phone(page: Page) {
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/** One page as one person, with its observer installed for this page alone. */
async function visit(page: Page, t: Target, cookie: { name: string; value: string }, hold: number, wait: number): Promise<Seen> {
  const { identifier } = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: observe(t, hold) })).result;
  try {
    await phone(page);
    await page.open(base + t.path, { width: 390, height: 844, theme: 'dark', reduced: false, wait, cookie });
    return await page.eval<Seen>('window.__pd');
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
}

/** Polls the page until it has an answer for its data or refusal, or until the cap has passed since navigation. */
async function answered(page: Page): Promise<Seen> {
  for (;;) {
    const s = await page.eval<Seen & { now: number }>('({ ...window.__pd, now: performance.now() })');
    if (s.data !== null || s.refused !== null || s.now >= CAP_MS) return s;
    await sleep(250);
  }
}

const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const failures: string[] = [];
const page = await launch();
let n = 0;

if (undeclared.length) failures.push(`no primary-data selector declared for ${undeclared.join(', ')}`);
console.log(`primary data: ${targets.length} routes as ${personas.map(([p]) => p).join(', ')}, in the order printed; one browser, cache off, no warm-up load`);

for (const [who, persona] of personas) {
  for (const t of targets) {
    n++;
    let seen: Seen;
    try {
      await visit(page, t, persona.cookie, 0, 7000);
      seen = await answered(page);
    } catch (e) {
      failures.push(`${t.path} as ${who}: ${(e as Error).message}`);
      console.log(`FAIL #${String(n).padEnd(3)} ${who.padEnd(10)} ${t.path}: ${(e as Error).message}`);
      continue;
    }
    // Both in milliseconds, so the two can be read against each other and against the 2,500 ms bar without rounding.
    const head = `#${String(n).padEnd(3)} ${who.padEnd(10)} ${t.path.padEnd(64)} LCP ${Math.round(seen.lcp)} ms ·`;
    // A rail route's refusal is checked against the persona's own hand-written list; a detail route's is recorded.
    const expected = !t.rail || persona.expectedRoutes.includes(t.path);
    if (seen.refused !== null) {
      const wrong = t.rail && expected;
      if (wrong) failures.push(`${t.path} as ${who}: refused (${seen.why}), and ${who} is expected to open it`);
      console.log(`${wrong ? 'FAIL' : 'ok  '} ${head} refused (${seen.why})`);
    } else if (seen.data !== null) {
      const wrong = !expected;
      if (wrong) failures.push(`${t.path} as ${who}: opened, and ${who} is expected to be refused it`);
      console.log(`${wrong ? 'FAIL' : 'ok  '} ${head} primary data ${Math.round(seen.data)} ms`);
    } else {
      failures.push(`${t.path} as ${who}: neither its content (${t.ready}) nor a refusal within ${s(CAP_MS)}`);
      console.log(`FAIL ${head} neither its content (${t.ready}) nor a refusal within ${s(CAP_MS)}`);
    }
  }
}

// The delayed read, as the first persona, on every rail route that persona may open.
const [first] = personas;
let delayed = 0;
if (first) {
  const [who, persona] = first;
  for (const t of targets.filter((x) => x.rail && persona.expectedRoutes.includes(x.path))) {
    delayed++;
    n++;
    try {
      // The bound runs from the first held read, the origin Status's own bound has (STATUS_BOUND_MS), or from navigation
      // on a page that sent none from the browser. The page is read as soon as it has passed: no seven-second wait.
      await visit(page, t, persona.cookie, HOLD_MS, 0);
      const read = () => page.eval<Seen & { now: number }>('({ ...window.__pd, now: performance.now() })');
      let p = await read();
      while (p.now < (p.held ?? 0) + BOUND_MS + 100) { await sleep(100); p = await read(); }
      const from = p.held ?? 0;
      const atOnce = p.main !== null && (p.loadingAtMain || p.contentAtMain);
      const bounded = p.explicit !== null && p.explicit <= from + BOUND_MS;
      const origin = p.held === null ? 'no read held, from navigation' : `first read sent at ${Math.round(p.held)} ms`;
      const when = p.explicit === null ? 'still loading'
        : p.explicit < from ? `at ${Math.round(p.explicit)} ms, before the read was sent`
        : `at ${Math.round(p.explicit)} ms, ${Math.round(p.explicit - from)} ms after ${p.held === null ? 'navigation' : 'the read'}`;
      const said = `${origin} · loading at once: ${p.main === null ? 'main never painted' : p.loadingAtMain ? 'yes' : p.contentAtMain ? 'content at once' : 'no'} · explicit state on screen within ${s(BOUND_MS)}: ${bounded ? 'yes' : 'no'}, ${when}`;
      if (!atOnce || !bounded) failures.push(`delayed read on ${t.path}: ${said}`);
      console.log(`${atOnce && bounded ? 'ok  ' : 'FAIL'} #${String(n).padEnd(3)} ${who.padEnd(10)} ${t.path.padEnd(64)} reads held ${s(HOLD_MS)} · ${said}`);
    } catch (e) {
      failures.push(`delayed read on ${t.path}: ${(e as Error).message}`);
      console.log(`FAIL #${String(n).padEnd(3)} ${who.padEnd(10)} ${t.path}: ${(e as Error).message}`);
    }
  }
}

await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
page.close();
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\nprimary data: ${targets.length * personas.length} route and persona rows, ${delayed} delayed reads; ${failures.length} failed`);
process.exit(failures.length || !targets.length ? 1 : 0);
