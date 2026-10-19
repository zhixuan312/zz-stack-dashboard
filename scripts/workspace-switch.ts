/**
 * The workspace menu, walked as each person walks it, against the built app and the fake gateway: one of verify's
 * `browserChecks`.
 *
 *   node scripts/workspace-switch.ts [--base http://localhost:3100]
 *
 * For every persona `scripts/verify.config.ts` declares, signed in by its cookie: open `/`, choose Platform in the rail's
 * workspace menu, read Status's figure, choose Work and arrive back at `/`; then open `/platform` by its address, read
 * the figure again, and open `/` from there. The figure is the fake gateway's last whole week
 * (`scripts/fake-gateway/platform-status.ts`): its rate to one decimal place, and its counts in words.
 *
 * A step finds what it presses by role and accessible name and presses it with a real pointer at its centre, because
 * the menu opens on the pointer going down. The workspace in view is read from the menu's own name, the product's name
 * and then the workspace, which is how the release's journeys read it.
 *
 * One line per step, `ok` or `FAIL` with what was expected and what was found. Exits 1 when a step failed or a page
 * raised an error.
 */
import { app, workspaces } from '../src/app.config.ts';
import { PLATFORM_STATUS } from './fake-gateway/platform-status.ts';
import { launch, type Page } from './lib/chrome.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const last = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.last!;
/**
 * The day a week begins on, as `formatDay` in `src/lib/format-date.ts` writes it (`6 Oct`, in the console's zone).
 * Written here because that module imports without extensions, which plain `node` cannot load.
 */
const formatDay = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: app.timezone, day: '2-digit', month: 'short' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${p.month}`;
};
/** What Status must say, in the words the page draws them in. */
const FIGURE = [
  'Malformed calls per 1,000',
  last.figure.value!.toFixed(1),
  `Real-work calls, week of ${formatDay(last.window.from)}`,
];

/** What a page is asked, sent with each question: find a control by role and accessible name, and say where it is. */
const LIB = String.raw`
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const shown = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
const roleOf = (el) => el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : el.tagName === 'A' && el.hasAttribute('href') ? 'link' : '');
const nameOf = (el) => (el.getAttribute('aria-label') || text(el)).trim();
const find = (spec) => [...document.querySelectorAll('a[href],button,[role]')].filter((el) =>
  roleOf(el) === spec.role && shown(el) && (spec.re ? new RegExp(spec.re).test(nameOf(el)) : nameOf(el) === spec.name));
`;
const ask = <T>(page: Page, body: string) => page.eval<T>(`(() => { ${LIB}\n${body}\n})()`);

type Spec = { role: string; name?: string; re?: string };
const described = (s: Spec) => `${s.role} ${s.name !== undefined ? `"${s.name}"` : `/${s.re}/`}`;

/** Poll until `probe` answers, or say what was last found once `ms` has passed. */
async function until<T>(what: string, probe: () => Promise<T | null | false>, found: () => Promise<string>, ms = 15_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await probe().catch(() => null);
    if (v) return v;
    if (Date.now() > end) throw new Error(`expected ${what}; found ${await found().catch(() => 'nothing readable')}`);
    await sleep(100);
  }
}

/** Press a control with a real pointer, once it is on screen and nothing covers it. */
async function press(page: Page, spec: Spec) {
  const at = await until(`${described(spec)} to press`, () => ask<{ x: number; y: number } | null>(page, `
    const el = find(${JSON.stringify(spec)})[0]; if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return top && (el === top || el.contains(top)) ? { x, y } : null;`), async () => 'no such control on screen');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
}

type Seen = { path: string; workspace: string | null; text: string };
const MENU = ': workspace menu';
/** Where the page is, the workspace its rail names, and the text of the page itself. */
const seen = (page: Page) => ask<Seen>(page, `
  const trigger = find({ role: 'button', re: '${MENU}$' })[0];
  const name = trigger ? nameOf(trigger) : '';
  const head = ${JSON.stringify(`${app.name}, `)};
  return { path: location.pathname, workspace: name.startsWith(head) ? name.slice(head.length, -${MENU.length}) : null, text: document.querySelector('main')?.innerText ?? '' };`);
const describe = (s: Seen) => `${s.path} with the rail on ${s.workspace ?? 'no workspace menu'}`;

/** Wait until the page is at `path` with the rail on `workspace`, and, for Status, until it shows the figure. */
async function arrive(page: Page, path: string, workspace: string, figure: boolean) {
  const want = `${path} with the rail on ${workspace}${figure ? ` showing ${FIGURE.join(' | ')}` : ''}`;
  await until(want, async () => {
    const s = await seen(page);
    return s.path === path && s.workspace === workspace && (!figure || FIGURE.every((f) => s.text.includes(f)));
  }, async () => {
    const s = await seen(page);
    return figure ? `${describe(s)}, missing ${FIGURE.filter((f) => !s.text.includes(f)).join(' | ') || 'nothing'}` : describe(s);
  });
}

async function choose(page: Page, label: string) {
  await press(page, { role: 'button', re: `${MENU}$` });
  await press(page, { role: 'menuitemradio', name: label });
}

const WORK = workspaces.main;
const PLATFORM = workspaces.platform;
const failures: string[] = [];
let steps = 0;
const page = await launch();

async function step(name: string, does: () => Promise<void>) {
  steps++;
  try {
    await does();
    if (page.errors.length) throw new Error(`the page raised ${page.errors.slice(0, 2).join(' | ')}`);
    console.log(`ok    ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL  ${name}: ${(e as Error).message}`);
  }
}

for (const [who, persona] of Object.entries(config.personas ?? {})) {
  const at = (path: string) => page.open(base + path, { width: 1440, theme: 'dark', cookie: persona.cookie });
  await step(`${who}: ${WORK.label} to ${PLATFORM.label} in the workspace menu, and the figure`, async () => {
    await at(WORK.homeHref);
    await arrive(page, WORK.homeHref, WORK.label, false);
    await choose(page, PLATFORM.label);
    await arrive(page, PLATFORM.homeHref, PLATFORM.label, true);
  });
  await step(`${who}: back to ${WORK.label} in the workspace menu`, async () => {
    await choose(page, WORK.label);
    await arrive(page, WORK.homeHref, WORK.label, false);
  });
  await step(`${who}: ${PLATFORM.homeHref} from its address, and the figure`, async () => {
    await at(PLATFORM.homeHref);
    await arrive(page, PLATFORM.homeHref, PLATFORM.label, true);
  });
  await step(`${who}: ${WORK.homeHref} from there returns to ${WORK.label}`, async () => {
    await at(WORK.homeHref);
    await arrive(page, WORK.homeHref, WORK.label, false);
  });
}

page.close();
console.log(`\nworkspace switch: ${steps} steps as ${Object.keys(config.personas ?? {}).length} personas; ${failures.length} failed`);
process.exit(failures.length || !steps ? 1 : 0);
