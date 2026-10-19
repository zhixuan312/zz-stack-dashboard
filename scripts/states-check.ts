/**
 * Every rail route and every detail route drawn in a browser in each of the spec's five states and above every ceiling,
 * as each person: one of verify's `browserChecks` (Tasks I-126 and I-127; spec AC-2.9, AC-2.7 and AC-1.8).
 *
 *   node scripts/states-check.ts [--base http://localhost:3100] [--as superadmin,member] [--states normal,empty]
 *                                [--routes /,/record] [--workers 4]
 *
 * The routes are every rail route the navigation checks in scripts/verify.config.ts name and every address under its
 * `detailRoutes`, for each persona it declares. A state is asked for per request, by the session value
 * `<person>+<state>` (scripts/fake-gateway/states-partial.ts), so this runs beside the audit, the presses and the keyboard
 * walk, which read the normal state of the same fake gateway throughout (reconciliation 79): loading is `slow`, empty
 * `empty`, a transport error `error`, a failed aggregate and a partial success `partial`. Each page is opened at 1440px
 * in the dark theme, from a blank page, and read once nothing on it is still loading, or twelve seconds after it opened.
 *
 * What each state must draw, with what the person is refused drawing the product's refusal or the record's not-found
 * in every state but `error` and `slow`, where it may say the read failed or is on its way. Refused is a rail route not
 * in the persona's `expectedRoutes`, a detail route under one or in its `deniedProbe`, and a detail route the normal
 * state drew as refused, since another team's record is answered as not existing:
 *
 *   normal   the route's own content: the navigation check's `readySelector` (holding its `readyText`), or the detail
 *            route's selector in `DETAIL`; a detail route may be refused instead, as primary-data.ts allows.
 *   empty    words saying what is empty that the normal page does not hold, or more of them; the not-found, for a record
 *            a fresh deployment holds none of; or the normal page itself, where it already says it holds nothing, or
 *            where the route's empty answer is the normal one (`EMPTY_IS_NORMAL`, a closed list). No failure is drawn
 *            for an empty answer.
 *   error    the read's failure said in words: an alert, or a sentence that it did not load or is unavailable.
 *   slow     loading, a refusal or the content in the first frame the main region paints, and an explicit state on
 *            screen before the page is read: the content, a refusal or an error. Whether, never when: twelve seconds is
 *            the window a page is given to settle in, not a bound, since this runs under the other suites' load. The
 *            five-second bound is scripts/states-timed.ts's, which verify runs alone in its timed tier.
 *   partial  every part that answered still drawn: the normal page's headings the page lost are one run, the part that
 *            failed, and not all of them; and, where the page changed at all, words saying what is unavailable.
 *   extreme  a busy platform, every answer past its ceiling (scripts/fake-gateway/states-extreme.ts): the route's own
 *            content as in `normal`; no table drawing more than ten rows a page, and none drawing ten with no total, a
 *            pager's or its own words' "of N", which is a total clipped to the page; a year stepper on Record, whose
 *            record holds days in five years; and Other among the parts of Usage's calls by team, which more than four
 *            teams made (`EXTREME_EXPECTS`).
 *
 * In every state no page is still loading once read, none is the console's error page, and none raised an uncaught
 * exception. In `normal`, `empty` and `partial` no figure the answer sent as null is drawn as a zero: each page is opened
 * a second time with the fake answering every such figure as a number no fixture holds (`__nulls`), and a zero that
 * turns into a number between the two is a zero the page made up. As the member, no page body in any state holds the
 * fake's second team, `beacon`, any of its initiatives or of its documents' own titles, or any `deniedProbe` string.
 *
 * One line per route, person and state, then the failures. Exits 1 when any failed or nothing was opened.
 */
import { NULL_STANDIN } from './fake-gateway/states-partial.ts';
import { TEAMS } from './fake-gateway/platform-teams.ts';
import { INITIATIVES, initiativeDetail } from './fake-gateway/work.ts';
import type { Page } from './lib/chrome.ts';
import config, { DETAIL } from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const list = (k: string) => (opt(k, '') ? new Set(opt(k, '').split(',')) : null);
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STATES = ['normal', 'empty', 'error', 'slow', 'partial', 'extreme'] as const;
type State = (typeof STATES)[number];
const states = STATES.filter((s) => !list('--states') || list('--states')!.has(s));
export const people = Object.entries(config.personas ?? {}).filter(([name]) => !list('--as') || list('--as')!.has(name));
const workers = Math.max(1, Number(opt('--workers', '4')) || 4);

export type Target = { path: string; ready: string; text: string; rail: boolean };
export const undeclared = config.detailRoutes.filter((r) => !DETAIL[r]);
export const targets: Target[] = [
  ...(config.navigationChecks ?? []).map((c) => ({ path: c.path, ready: c.readySelector, text: (c.readyText ?? '').toLowerCase(), rail: true })),
  ...config.detailRoutes.filter((r) => DETAIL[r]).map((r) => ({ path: r, ready: DETAIL[r], text: '', rail: false })),
].filter((t) => !list('--routes') || list('--routes')!.has(t.path));

/** The fake's second team, which the member is in no way of: its slug, its name, its initiatives and its documents' own titles. */
const OTHER = 'beacon';
const ownTitles = new Set(INITIATIVES.filter((i) => i.team !== OTHER).flatMap((i) => initiativeDetail(i.team, i.slug)?.documents.map((d) => d.title) ?? []));
const theirs = INITIATIVES.filter((i) => i.team === OTHER);
const LEAKS = [
  TEAMS.find((t) => t.slug === OTHER)!.name,
  ...theirs.map((i) => i.slug),
  ...theirs.flatMap((i) => initiativeDetail(i.team, i.slug)?.documents.map((d) => d.title) ?? []).filter((t): t is string => !!t && !ownTitles.has(t)),
];

/** How long a page has to settle once opened: the window it is read in, which is no bound on any state. */
export const SETTLE_MS = 12_000;

/** The page's own words for its states, read in the page. COUPLED: the console's views' sentences. */
export const LIB = String.raw`
// The page's main region: never the shell's own placeholder (ShellPending in src/console/frame.tsx), which a route with
// an unknown address paints, hidden, before its own loading state streams in.
const main = () => [...document.querySelectorAll('main')].find((m) => !m.closest('[aria-hidden="true"]')) ?? null;
const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const some = (sel, test = shown) => [...document.querySelectorAll(sel)].some(test);
const readable = (el) => shown(el) && !el.closest('.shimmer, [aria-busy="true"]') && (el.textContent || '').trim() !== '';
const loading = () => some('main [aria-busy="true"], main .shimmer');
const busy = () => { const el = [...document.querySelectorAll('main [aria-busy="true"], main .shimmer')].find(shown); return el ? (el.getAttribute('aria-label') || el.className).slice(0, 60) : ''; };
const content = (spec) => some(spec.ready, (el) => readable(el) && (!spec.text || el.textContent.toLowerCase().includes(spec.text)));
const refusal = () => some('main [data-no-access], main [data-missing-page]')
  || some('main p.t-card', (el) => shown(el) && / does not exist$|^No initiative called |^No (release of this version|report of this id) is recorded$/.test(el.textContent.trim()));
const alert = () => some('main [role="alert"]');
// Each table the page draws, by its caption: its rows on the page, its pager's words and the rest of its card's words.
// A chart's own table is for a screen reader alone and is not one.
const tables = () => [...document.querySelectorAll('main section.card[aria-label]')].filter(shown).flatMap((s) => {
  const t = s.querySelector('table:not(.sr-only)');
  const body = t?.querySelector('tbody');
  if (!t || !body) return [];
  const pager = s.querySelector('nav[aria-label="Pagination"]')?.textContent ?? '';
  return [{ caption: s.getAttribute('aria-label'), rows: body.querySelectorAll(':scope > tr').length, pager, words: (s.textContent || '').replace(body.textContent || '', '') }];
});
const years = () => document.querySelector('main [aria-label="Year"]')?.querySelectorAll('[role="radio"]').length ?? 0;
// Each item is its own label: a legend's text read whole runs a long label flush into the next one's.
const legend = () => [...document.querySelectorAll('main [data-legend] li')].map((l) => (l.textContent || '').trim());
const errorPage = () => /^(The server could not draw this page|This page failed to render)$/.test((document.querySelector('main h1')?.textContent || '').trim());
`;

/** Installed before the page's own scripts: the first frame the main region paints, and the first with an explicit state. */
export const observe = (t: Target) => `(() => {
  ${LIB}
  const spec = ${JSON.stringify({ ready: t.ready, text: t.text, cap: SETTLE_MS })};
  const p = window.__states = { placeholder: null, main: null, loadingAtMain: false, contentAtMain: false, refusedAtMain: false, explicit: null };
  const tick = () => {
    const now = performance.now();
    const m = main();
    if (p.placeholder === null && !m && document.querySelector('main')?.getBoundingClientRect().height > 0) p.placeholder = now;
    if (p.main === null && m && m.getBoundingClientRect().height > 0) { p.main = now; p.loadingAtMain = loading(); p.contentAtMain = content(spec); p.refusedAtMain = refusal(); }
    if (p.explicit === null && m && (content(spec) || refusal() || alert() || errorPage())) p.explicit = now;
    if (now < spec.cap) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

type Table = { caption: string; rows: number; pager: string; words: string };
/** What the observer recorded of one page, each time against navigation start: `window.__states`. */
export type Frames = { placeholder: number | null; main: number | null; loadingAtMain: boolean; contentAtMain: boolean; refusedAtMain: boolean; explicit: number | null };
type Seen = {
  text: string; body: string; headings: string[]; loading: boolean; busy: string; content: boolean; refusal: boolean; alert: boolean; errorPage: boolean;
  tables: Table[]; years: number; legend: string[];
  frames: Frames;
  exceptions: string[];
};

/**
 * One page as one session value, read once it has stopped loading or the settle time has passed. Each is opened from a
 * blank page: the page before it in this tab may still hold reads open (src/lib/live.ts), and those take the browser's
 * connections to the console, so the next page's first request would wait for one and its first frame be late.
 */
async function visit(page: Page, t: Target, value: string): Promise<Seen> {
  await page.send('Page.navigate', { url: 'about:blank' });
  const { identifier } = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: observe(t) })).result;
  try {
    await page.open(base + t.path, { width: 1440, height: 900, theme: 'dark', wait: 300, cookie: { name: 'zz_console', value } });
    const read = () => page.eval<Omit<Seen, 'exceptions'> & { now: number }>(`(() => { ${LIB}
      const spec = ${JSON.stringify({ ready: t.ready, text: t.text })};
      return { now: performance.now(), text: main()?.innerText ?? '', body: document.body.innerText, loading: loading(), busy: busy(), content: content(spec), refusal: refusal(), alert: alert(), errorPage: errorPage(),
        tables: tables(), years: years(), legend: legend(),
        headings: [...document.querySelectorAll('main h2, main h3')].filter(shown).map((h) => h.textContent.trim()).filter(Boolean), frames: window.__states };
    })()`);
    let seen = await read();
    // Settled is two reads in a row with nothing loading, a quarter of a second apart.
    for (let calm = 0; calm < 2 && seen.now < SETTLE_MS; ) { await sleep(250); seen = await read(); calm = seen.loading ? 0 : calm + 1; }
    return { ...seen, exceptions: page.errors.filter((e) => e.startsWith('exception:')) };
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
}

/** A session value's unread figures answered as the stand-in, or as null again. */
const standIn = (value: string, on: boolean) => fetch(`${base}/api/console/__nulls?session=${encodeURIComponent(value)}&on=${on ? 1 : 0}`).then((r) => { if (!r.ok) throw new Error(`__nulls answered ${r.status}`); });

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
/** Lines `x` holds that `normal` does not and that match `words`. */
const added = (x: Pick<Seen, 'text'>, normal: Pick<Seen, 'text'> | undefined, words: RegExp) => { const had = new Set(lines(normal?.text ?? '')); return lines(x.text).filter((l) => words.test(l) && !had.has(l)); };
const EMPTY = /^(No|Nothing|Nobody|None)\b|\bnever\b|\bnot yet\b|\bnothing\b|\bhas no\b|\bno (data|week|call|lesson|run|document|initiative|search|question|record|one|report|release|token|finding|member|change|entr|score)/i;
const UNAVAILABLE = /unavailable|did not load|could not be read|could not read|not read|did not answer|could not reach/i;
const digitless = (s: string) => s.replace(/\d[\d,.:]*/g, '#');
/** The first line where two texts part, digits aside, so a failure names what changed rather than only that something did. */
function firstDifference(a: string, b: string) {
  const [la, lb] = [lines(digitless(a)), lines(digitless(b))];
  const i = la.findIndex((l, n) => l !== lb[n]);
  const at = i === -1 ? la.length : i;
  return `line ${at + 1}: normal "${(la[at] ?? '').slice(0, 60)}", partial "${(lb[at] ?? '').slice(0, 60)}"`;
}

const ZERO = /^[-+−]?0(?:[.,]0+)?(?:%|ms|s|h|d|×)?$/;
const token = (s: string) => s.replace(/^[(["“'‘]+|[)\]"”'’,;:.]+$/g, '');
/**
 * The zeros `a` draws that `b`, the same page with every unread figure standing in as a number, draws as some other
 * number: a zero that was made up from a null. Words compared after their common start and end, then by their longest
 * common run, so a figure drawn differently elsewhere moves nothing around it.
 */
function madeUpZeros(a: string, b: string): string[] {
  const x = a.split(/\s+/).filter(Boolean), y = b.split(/\s+/).filter(Boolean);
  let s = 0;
  while (s < x.length && s < y.length && x[s] === y[s]) s++;
  let e = 0;
  while (e < x.length - s && e < y.length - s && x[x.length - 1 - e] === y[y.length - 1 - e]) e++;
  const xs = x.slice(s, x.length - e), ys = y.slice(s, y.length - e);
  if (!xs.length || xs.length * ys.length > 25_000_000) return xs.length ? [`(${xs.length} by ${ys.length} words: too many to compare)`] : [];
  const w = ys.length + 1;
  const len = new Uint32Array((xs.length + 1) * w);
  for (let i = xs.length - 1; i >= 0; i--) for (let j = ys.length - 1; j >= 0; j--) len[i * w + j] = xs[i] === ys[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
  const found: string[] = [];
  let i = 0, j = 0;
  while (i < xs.length || j < ys.length) {
    if (i < xs.length && j < ys.length && xs[i] === ys[j]) { i++; j++; continue; }
    const [i0, j0] = [i, j];
    while ((i < xs.length || j < ys.length) && !(i < xs.length && j < ys.length && xs[i] === ys[j])) {
      if (j >= ys.length || (i < xs.length && len[(i + 1) * w + j] >= len[i * w + j + 1])) i++; else j++;
    }
    const zero = xs.slice(i0, i).findIndex((t) => ZERO.test(token(t)));
    if (zero >= 0 && ys.slice(j0, j).some((t) => /\d/.test(t) && !ZERO.test(token(t)))) found.push(`"${x.slice(Math.max(0, s + i0 + zero - 4), s + i0 + zero + 5).join(' ')}"`);
  }
  return found;
}

/** The places in `a` its longest common run with `b`, in order, leaves out. */
function unmatched(a: string[], b: string[]): number[] {
  const w = b.length + 1;
  const len = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) len[i * w + j] = a[i] === b[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
  const out: number[] = [];
  for (let i = 0, j = 0; i < a.length;) {
    if (j < b.length && a[i] === b[j]) { i++; j++; } else if (j < b.length && len[i * w + j + 1] > len[(i + 1) * w + j]) j++; else out.push(i++);
  }
  return out;
}

/**
 * The routes whose `empty` answer is the normal one, each with its reason: what they draw is the catalog's shipped
 * content, not recorded data, so a fresh deployment holds it as every other does and the fake answers it unchanged in
 * `empty` (`plugins/:plugin/skills/:name` in scripts/fake-gateway/states.ts). An empty catalog is not a state a
 * deployment reaches, so such a page has no empty words to say, and is held to the normal page instead. Closed: every
 * other route keeps the empty-words rule.
 */
export const EMPTY_IS_NORMAL: Record<string, string> = {
  '/plugins/sdlc/sdlc-spec?view=read': "the skill's own text, which the plugin ships",
  '/plugins/sdlc/sdlc-spec?view=references': 'the references the skill ships beside its text',
};

/** What the `empty` rule reads of a page: its main region's words, and whether it drew an alert or a refusal. */
type Drawn = Pick<Seen, 'text' | 'alert' | 'refusal'>;

/**
 * The `empty` state of one route, judged against the same route's normal page: words saying what is empty that the
 * normal page does not hold, or more of them than it holds; or, for a record a fresh deployment has none of, its
 * not-found; or, for a route in `EMPTY_IS_NORMAL`, the normal page itself. No failure is drawn for an empty answer.
 */
export function emptyRule(t: Pick<Target, 'path' | 'rail'>, x: Drawn, normal: Drawn | undefined): { problems: string[]; said: string[] } {
  const problems: string[] = [];
  const said: string[] = [];
  if (Object.hasOwn(EMPTY_IS_NORMAL, t.path)) {
    // The same words, figures aside, as a time on the page moves between two reads.
    if (!normal) problems.push(`no normal page to compare with, and its empty answer is the normal one (${EMPTY_IS_NORMAL[t.path]})`);
    else if (digitless(x.text) !== digitless(normal.text)) problems.push(`is not the normal page, and its empty answer is the normal one (${EMPTY_IS_NORMAL[t.path]})`);
    else said.push(`the normal page, its empty answer (${EMPTY_IS_NORMAL[t.path]})`);
  } else {
    const words = added(x, normal, EMPTY);
    const more = lines(x.text).filter((l) => EMPTY.test(l)).length > lines(normal?.text ?? '').filter((l) => EMPTY.test(l)).length;
    // A record the normal state already draws as holding nothing (a plugin never run) is drawn the same when nothing is.
    const already = digitless(x.text) === digitless(normal?.text ?? '') && lines(x.text).some((l) => EMPTY.test(l));
    if (!words.length && !more && !already && !(x.refusal && !t.rail)) problems.push('no words saying what is empty that the normal page does not hold');
    else said.push(words.length ? `empty: "${words[0].slice(0, 60)}"` : more ? 'empty: more of what the normal page says is empty' : already ? 'empty, as the normal record already is' : 'not recorded');
  }
  const failed = added(x, normal, UNAVAILABLE);
  if (x.alert && !normal?.alert) problems.push('draws an empty answer as a failure (an alert)');
  if (failed.length) problems.push(`says an empty answer failed: "${failed[0].slice(0, 60)}"`);
  return { problems, said };
}

/**
 * What a busy platform draws past a ceiling that only one route has, by route: Record's days stepped a year at a time,
 * and Usage's calls by team with Other as the fourth part, for the person whose answer splits them (the superadmin's;
 * a member's names no team). COUPLED: scripts/fake-gateway/states-extreme.ts, which answers both.
 */
export const EXTREME_EXPECTS: Record<string, { stepper?: true; other?: string }> = {
  '/record': { stepper: true },
  '/platform/usage': { other: 'superadmin' },
};

/** A table's total as its pager or its own words say it, `of 1,240`; NaN when it says none. */
const totalOf = (words: string) => Number(/\bof ([\d,]+)\b/.exec(words)?.[1].replace(/,/g, '') ?? Number.NaN);

/**
 * The `extreme` state of one route as one person: every table at ten rows a page or fewer, none of ten without its total,
 * and the route's own ceiling drawn where `EXTREME_EXPECTS` names one.
 */
export function extremeRule(t: Pick<Target, 'path'>, who: string, x: Pick<Seen, 'tables' | 'years' | 'legend'>): { problems: string[]; said: string[] } {
  const problems: string[] = [];
  for (const table of x.tables) {
    if (table.rows > 10) problems.push(`"${table.caption}" draws ${table.rows} rows on one page, past ten`);
    else if (table.rows === 10 && Number.isNaN(totalOf(table.pager)) && Number.isNaN(totalOf(table.words))) problems.push(`"${table.caption}" draws ten rows and no total, so the total is clipped to the page`);
  }
  const expects = EXTREME_EXPECTS[t.path];
  if (expects?.stepper && x.years < 2) problems.push('no year stepper, though the record holds days in more than one year');
  if (expects?.other === who && !x.legend.includes('Other')) problems.push('no Other among the parts of the calls by team, though more than four teams called');
  const paged = x.tables.filter((table) => !Number.isNaN(totalOf(table.pager)));
  return { problems, said: problems.length ? [] : [`${x.tables.length} ${x.tables.length === 1 ? 'table' : 'tables'}, ${paged.length} paged${expects?.stepper ? ', a year stepper' : ''}${expects?.other === who ? ', Other' : ''}`] };
}

/**
 * The `slow` state of one page, judged by whether and never by when: loading, a refusal or the content in the first
 * frame its main region paints, an explicit state on screen within the window the page is given to settle, and its
 * content, a refusal or an error once read. The frames' times are not read here; scripts/states-timed.ts holds them to
 * five seconds, alone.
 */
export function slowRule(x: Pick<Seen, 'content' | 'refusal' | 'alert' | 'frames'>): { problems: string[]; said: string[] } {
  const f = x.frames;
  const problems: string[] = [];
  const said: string[] = [];
  if (f.main === null) problems.push('the main region never painted');
  else if (!f.loadingAtMain && !f.contentAtMain && !f.refusedAtMain) problems.push('no loading state in the first frame the main region painted');
  if (f.explicit === null) problems.push(`no explicit state within the ${SETTLE_MS / 1000} s a page is given to settle`);
  else said.push(`${f.refusedAtMain ? 'refused at once' : 'loading at once'}${f.placeholder !== null && f.main !== null ? " (after the shell's placeholder)" : ''}, then an explicit state`);
  if (!x.content && !x.refusal && !x.alert) problems.push('ends with neither its content, a refusal nor an error');
  return { problems, said };
}

type Row = { who: string; state: State; t: Target; problems: string[]; said: string };
const rows: Row[] = [];
const normals = new Map<string, Seen>();

/** What one route, person and state drew, judged. */
function judge(who: string, state: State, t: Target, x: Seen, standing: Seen | null): Row {
  const persona = config.personas![who];
  const normal = normals.get(`${who} ${t.path}`);
  // Refused: a rail route the person is not expected to open, a detail route under one or named in their deniedProbe,
  // and any other detail route the normal state drew as refused, since another team's record is answered as not existing.
  const under = (config.navigationChecks ?? []).map((c) => c.path).filter((r) => r !== '/' && t.path.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  const known = t.rail ? !persona.expectedRoutes.includes(t.path) : Object.hasOwn(persona.deniedProbe ?? {}, t.path) || (under !== undefined && !persona.expectedRoutes.includes(under));
  const denied = known || (!t.rail && state !== 'normal' && !!normal?.refusal);
  const problems: string[] = [];
  const said: string[] = [];
  if (x.exceptions.length) problems.push(`raised ${x.exceptions.slice(0, 2).join(' | ')}`);
  if (x.errorPage) problems.push('drew the console\'s error page');
  if (x.loading) problems.push(`still loading ${SETTLE_MS / 1000} s after it opened (${x.busy})`);
  if (who === 'member') {
    // What the address itself names is the person's own typing echoed back, not something the page revealed.
    const asked = decodeURIComponent(t.path).toLowerCase();
    const leaked = [...LEAKS, ...Object.values(persona.deniedProbe ?? {})].filter((l) => x.body.includes(l) && !asked.includes(l.toLowerCase()));
    if (!asked.includes(OTHER) && new RegExp(`\\b${OTHER}\\b`, 'i').test(x.body)) leaked.unshift(OTHER);
    if (leaked.length) problems.push(`the page holds ${leaked.map((l) => `"${l}"`).join(', ')}`);
  }
  if (denied && state !== 'error' && state !== 'slow') {
    if (!x.refusal) problems.push('is refused this person, and draws no refusal or not-found');
    else said.push('refused');
  } else if (state === 'normal' || state === 'extreme') {
    if (!x.content && !(x.refusal && !t.rail)) problems.push(`no content (${t.ready}${t.text ? ` holding "${t.text}"` : ''})`);
    else said.push(x.content ? 'content' : 'refused');
    if (state === 'extreme') {
      const r = extremeRule(t, who, x);
      problems.push(...r.problems);
      said.push(...r.said);
    }
  } else if (state === 'empty') {
    const r = emptyRule(t, x, normal);
    problems.push(...r.problems);
    said.push(...r.said);
  } else if (state === 'error') {
    const words = lines(x.text).filter((l) => UNAVAILABLE.test(l));
    if (!x.alert && !words.length && !(denied && x.refusal)) problems.push('says nothing of the failed read: no alert and no sentence that it did not load');
    else said.push(x.alert ? 'alert' : denied && x.refusal ? 'refused' : `"${words[0].slice(0, 60)}"`);
  } else if (state === 'slow') {
    const r = slowRule(x);
    problems.push(...r.problems);
    said.push(...r.said);
  } else if (state === 'partial') {
    // The part that failed is one part, so what it took with it is one run of the normal page's headings, in its order;
    // a heading missing outside that run is a part that answered and is not drawn.
    const was = normal?.headings ?? [];
    const gone = unmatched(was, x.headings);
    const run = gone.length ? gone[gone.length - 1] - gone[0] + 1 : 0;
    if (run > gone.length || (gone.length && gone.length === was.length && was.length > 1)) problems.push(`parts that answered are not drawn: ${gone.map((i) => `"${was[i]}"`).join(', ')}`);
    const changed = digitless(x.text) !== digitless(normal?.text ?? x.text);
    const words = added(x, normal, UNAVAILABLE);
    if (changed && !words.length && !(x.alert && !normal?.alert)) problems.push(`a part is missing and nothing says it is unavailable (${firstDifference(normal?.text ?? '', x.text)})`);
    else said.push(changed ? `unavailable: "${(words[0] ?? 'alert').slice(0, 60)}"` : 'no part on this page');
  }
  if (standing && !denied) {
    const zeros = madeUpZeros(x.text, standing.text);
    if (zeros.length) problems.push(`draws 0 where the answer sent null: ${zeros.slice(0, 3).join('; ')}`);
  }
  return { who, state, t, problems, said: said.join(' · ') };
}

/**
 * One session value, every route: a page, its stand-in reading where nulls are judged, and its line. Each session starts
 * at its own place in the routes, so no two browsers ask the console for one address at the same moment.
 */
async function session(page: Page, who: string, state: State, start: number) {
  const value = `${config.personas![who].cookie.value}+${state}`;
  for (const t of [...targets.slice(start), ...targets.slice(0, start)]) {
    let row: Row;
    try {
      const x = await visit(page, t, value);
      if (state === 'normal') normals.set(`${who} ${t.path}`, x);
      let standing: Seen | null = null;
      if (state === 'normal' || state === 'empty' || state === 'partial') {
        await standIn(value, true);
        try { standing = await visit(page, t, value); } finally { await standIn(value, false); }
      }
      row = judge(who, state, t, x, standing);
    } catch (e) {
      row = { who, state, t, problems: [(e as Error).message], said: '' };
    }
    rows.push(row);
    console.log(`${row.problems.length ? 'FAIL' : 'ok  '} ${who.padEnd(10)} ${state.padEnd(7)} ${t.path.padEnd(64)} ${row.problems.length ? row.problems.join('; ') : row.said}`);
  }
}

/** Run `jobs` on at most `workers` browsers at once, each browser one job at a time. */
async function pool(jobs: [string, State][]) {
  // Imported here, so a test of the rules above loads no browser and none of its process handlers.
  const { launch } = await import('./lib/chrome.ts');
  const queue = jobs.map((job, i) => [...job, Math.floor((i * targets.length) / jobs.length)] as const);
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
    const page = await launch();
    try { for (let job = queue.shift(); job; job = queue.shift()) await session(page, ...job); } finally { page.close(); }
  }));
}

if (import.meta.main) {
  console.log(`states: ${targets.length} routes as ${people.map(([p]) => p).join(', ')} in ${states.join(', ')}; ${NULL_STANDIN} stands in for an unread figure`);
  const failures: string[] = undeclared.length ? [`no content selector declared for ${undeclared.join(', ')}`] : [];
  // The normal state first: the other states are read against what it drew.
  if (states.includes('normal') || states.some((s) => s === 'empty' || s === 'partial')) await pool(people.map(([who]) => [who, 'normal'] as [string, State]));
  await pool(states.filter((s) => s !== 'normal').flatMap((s) => people.map(([who]) => [who, s] as [string, State])));

  for (const r of rows) for (const p of r.problems) failures.push(`${r.t.path} as ${r.who} in ${r.state}: ${p}`);
  for (const f of failures) console.log(`FAIL  ${f}`);
  console.log(`\nstates: ${rows.length} route, person and state rows; ${rows.filter((r) => r.problems.length).length} failed`);
  process.exit(failures.length || !rows.length ? 1 : 0);
}
