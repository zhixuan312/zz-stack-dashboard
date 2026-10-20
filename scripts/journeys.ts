/**
 * The guides' tasks to try, carried out in a browser as the right person: one of verify's `browserChecks` (Task I-128,
 * spec AC-8.3).
 *
 *   node scripts/journeys.ts [--base http://localhost:3100] [--tasks work-1,platform-6]
 *
 * The tasks are the Work guide's eight and the Platform guide's ten, kept with each guide's words, its source and, where
 * the spec defines the page differently from the guide's example, that definition, in tests/fixtures/guide-tasks.json.
 * Each is one journey below, which carries the task out as the spec defines the page: Work's as the member, Platform's
 * as the superadmin but where a task names the member, and Knowledge health's as both, since its questions are the
 * superadmin's alone.
 *
 * Each person is signed in as a journey session, `<person>+journey`, whose writes the fake gateway keeps for that
 * session alone (scripts/fake-gateway/journey.ts, reconciliation 80): an approval, a close, a bug's resolution, a person
 * added and a token issued each show on that session's next reads, and the audit, the presses and the keyboard walk
 * beside this read the normal state throughout. So a fake gateway answers these journeys once: a run against a process
 * whose journey sessions have written already stops before its first task, saying so.
 *
 * Work's task 4 asks the assistant on Knowledge, and the fake model answers the guide's phrase with a call to the search
 * (`fakeModel` in scripts/verify.config.ts), so that task needs a console with an assistant, as `pnpm verify --full`
 * serves the browser checks: one pointed at the fake model with those steps.
 *
 * A step reads the page as a person would and checks it against the session's own read of the same route, fetched
 * through the app's origin with the same cookie, so a figure the page draws is a figure the gateway answered. A control
 * is a write: a button, link or field that resolves, creates, adds, archives, deactivates, removes, revokes, issues,
 * approves, closes, records, confirms, signs out or acts as another team (`WRITES`); a filter, a pager, a tab, an
 * info button, the search and the bell read, and are not one. A page says it withholds something when its words name
 * a role or say what the reader may not do (`SAYS`).
 *
 * One line per task, eighteen in all, each with its id, the person, the page and what it found; a task that cannot be
 * carried out fails naming the task, the person and the step. Exits 1 when any failed, 2 when the tasks cannot be read or
 * the journey sessions have written in this fake gateway already.
 */
import fs from 'node:fs';
import path from 'node:path';
import { localDay } from './fake-gateway/clock.ts';
import type { Page } from './lib/chrome.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const only = opt('--tasks', '') ? new Set(opt('--tasks', '').split(',')) : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** How long a step waits for the page: past states-check's `SETTLE_MS`, eighteen seconds to settle, since the suites run
 *  side by side. */
const STEP_MS = 30_000;

/** The guides' tasks, as tests/fixtures/guide-tasks.json keeps them. */
type GuideTask = { id: string; guide: 'work' | 'platform'; source: string; task: string; words: string; definition?: string; phrase?: string };
const TASKS_FILE = path.join(import.meta.dirname, '..', 'tests', 'fixtures', 'guide-tasks.json');
export const readTasks = (): GuideTask[] => (JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) as { tasks: GuideTask[] }).tasks;

type Who = 'superadmin' | 'member';
/** A session's own read, checked field by field where a step reads it. */
type Json = Record<string, any>;

/** Read in the page before every step. The page's main region, never the shell's hidden placeholder (states-check's). */
const LIB = String.raw`
const main = () => [...document.querySelectorAll('main')].find((m) => !m.closest('[aria-hidden="true"]')) ?? document.body;
const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const words = (el) => (el?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const find = (sel, re, root = main()) => [...root.querySelectorAll(sel)].find((e) => shown(e) && (re === undefined || (typeof re === 'string' ? words(e) === re : re.test(words(e))))) ?? null;
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].find(shown) ?? null;
const busy = () => !!find('[aria-busy="true"], .shimmer');
const table = (re) => {
  const t = [...main().querySelectorAll('table:not(.sr-only)')].find((t) => shown(t) && re.test(t.querySelector('caption')?.textContent || t.closest('[aria-label]')?.getAttribute('aria-label') || ''));
  return t ? [...t.querySelectorAll('tbody > tr')].filter(shown).map((r) => [...r.children].map(words)) : null;
};
const bell = () => { const b = document.querySelector('button[aria-label^="Alerts"]'); return b ? Number(/(\d+)/.exec(b.getAttribute('aria-label'))?.[1] ?? 0) : null; };
const text = () => words(main());
// A tile's figure, by its label: the nearest figure up from the label's own element.
const tile = (label) => { for (let c = find('*', label); c; c = c.parentElement) { const v = c.querySelector('[data-value], .t-figure'); if (v) return words(v); } return null; };
`;

/** What a write control says on it. COUPLED: the console's own labels for its writes. */
const WRITES = /^(Resolve|Create|Add|Archive|Deactivate|Remove|Revoke|Issue|Approve|Close|Record|Confirm|Sign out|Act as|Enrolment link|Save|Delete|Invite)\b/i;
/** Words that say what the reader may not see or do, or name a role. */
const SAYS = /read-only|read only|superadmin|\badmin|administrator|not permitted|you cannot|you can't|only a |ask a |no access/i;
/** Refusal owners as the console labels them. COUPLED: `OWNER_LABEL` in src/views/activity-context.ts. */
const OWNERS: Record<string, string> = { guardrail: 'A guardrail held', ours: 'Malformed call', theirs: 'Tool failure', other: 'Other' };
const count = (n: number) => n.toLocaleString('en-US');
/** A size as the console prints one, back to bytes: `1.7 MB`. */
const bytesOf = (s: string) => { const m = /([\d.]+)\s*(KB|MB|GB|B)\b/.exec(s); return m ? Number(m[1]) * { B: 1, KB: 1e3, MB: 1e6, GB: 1e9 }[m[2] as 'B'] : Number.NaN; };

/**
 * The address an assistant's answer cites: the `Evidence:` a view's insight carries (`contextText` in
 * src/lib/shared-context.ts), which the fake model quotes with the insight; null when it cites none.
 */
export const citedAddress = (answer: string): string | null => /\bEvidence: (\/\S+)/.exec(answer)?.[1].replace(/[.,;:)]+$/, '') ?? null;

/** The assistant's panel and its latest answer, in the page. Outside `main`: the panel is the shell's third column. */
const PANEL = `document.querySelector('aside[data-assistant]')`;
const LAST_ANSWER = `([...(${PANEL}?.querySelectorAll('[data-assistant-text]') ?? [])].at(-1)?.textContent ?? '').trim()`;

/** One person's walk through the console: the page, their journey session, and the steps a task is made of. */
class Walk {
  readonly page: Page;
  who: Who;
  constructor(page: Page, who: Who) { this.page = page; this.who = who; }
  /** The page a task acted on, where the journey's own `page` names it by its kind. */
  at: string | null = null;
  session = (who: Who = this.who) => `${config.personas![who].cookie.value}+journey`;

  /** Open `to` as `who`, from a blank page, and wait for it to stop loading. */
  async open(to: string, who: Who = this.who) {
    await this.page.send('Page.navigate', { url: 'about:blank' });
    await this.page.open(base + to, { width: 1440, height: 900, theme: 'dark', wait: 400, cookie: { name: 'zz_console', value: this.session(who) } });
    await this.until(`open ${to}`, `!busy() && document.querySelector('h1') && location.pathname`);
  }

  /** The value of `expr` in the page once it is truthy; the step fails, named `what`, when it is not within `ms`. */
  async until<T = unknown>(what: string, expr: string, ms = STEP_MS): Promise<T> {
    const end = Date.now() + ms;
    // A page between two addresses has no document to read, and is read again; what it last threw is said at the end.
    let threw = '';
    for (;;) {
      let last: unknown = null;
      try { last = await this.page.eval(`(() => { ${LIB} return (${expr}); })()`); threw = ''; } catch (e) { threw = (e as Error).message.split('\n')[0]; }
      if (last) return last as T;
      if (Date.now() > end) fail(what, `not within ${ms / 1000} s${threw ? ` (${threw})` : ''}`);
      await sleep(200);
    }
  }

  /** Press the element `finder` finds, once it is there. */
  async press(what: string, finder: string) {
    await this.until(what, `!!(${finder})`);
    await this.page.eval(`(() => { ${LIB} (${finder}).click(); })()`);
  }

  /** Type `words` into the field `finder` finds, as a keyboard would. */
  async type(what: string, finder: string, words: string) {
    await this.until(what, `!!(${finder})`);
    await this.page.eval(`(() => { ${LIB} (${finder}).focus(); })()`);
    await this.page.send('Input.insertText', { text: words });
  }

  /** Enter, in the field that has focus. */
  async enter() {
    for (const type of ['keyDown', 'keyUp']) await this.page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) });
  }

  /** The session's own read of `route`, through the app's origin, as `who`. */
  async read<T = Json>(route: string, who: Who = this.who): Promise<T> {
    const res = await fetch(`${base}/api/console${route}`, { headers: { cookie: `zz_console=${this.session(who)}` } });
    if (!res.ok) throw new Error(`step "read ${route}": the gateway answered ${res.status}`);
    return (await res.json()) as T;
  }

  /** Fail the step `what` unless `ok`. */
  check(what: string, ok: unknown, said: string) { if (!ok) fail(what, said); }
}

/** A step that cannot be carried out. */
const fail = (what: string, said: string): never => { throw new Error(`step "${what}": ${said}`); };

type Journey = { task: string; who: Who | 'superadmin and member'; page: string; run: (w: Walk) => Promise<string> };
const part = (p: Json) => (p?.state === 'ok' ? p.data : null);

/** The newest revision waiting: the queue's older three are the fixture's out-of-date and unrecordable states, by design. */
const newest = (rows: Json[]) => rows.at(-1)!;

export const JOURNEYS: Journey[] = [
  { task: 'work-1', who: 'member', page: '/', run: async (w) => {
    const home = await w.read('/home');
    await w.open('/');
    const title = await w.until<string>('read the title', `words(document.querySelector('h1'))`);
    w.check('read the title', title.endsWith(home.title.sentence), `the title is "${title}", not the week's "${home.title.sentence}"`);
    const said: string[] = [];
    for (const [key, chart] of [['words', 'Words added by week'], ['approvals', 'Approvals in your name by week']] as const) {
      const half = part(home[key]);
      const whole = half.weeks.filter((x: Json) => x.window.complete);
      const [before, last] = [whole.at(-2), whole.at(-1)].map((x: Json) => x.figure.value as number | null);
      const page = await w.until<string>(`read ${chart}`, `[...main().querySelectorAll('table')].find((t) => /${chart}/.test(t.textContent))?.textContent`);
      for (const v of [before, last]) if (v !== null) w.check(`read ${chart}`, page.includes(count(v)), `the chart does not hold ${count(v)}`);
      if (half.finding) await w.until(`read ${chart}'s finding, "${half.finding.text}"`, `text().includes(${JSON.stringify(half.finding.text)})`);
      said.push(`${key} ${last === null ? 'none' : count(last)} against ${before === null ? 'none' : count(before)} the week before${half.finding ? ` ("${half.finding.text}")` : ''}`);
    }
    return `the week's title "${home.title.sentence}"; ${said.join('; ')}`;
  } },

  { task: 'work-2', who: 'member', page: '/', run: async (w) => {
    const waiting = part((await w.read('/approvals?tab=waiting')).waiting);
    const history = part((await w.read('/approvals?tab=history')).history);
    const target = newest(waiting.rows);
    await w.open('/');
    const rang = waiting.total as number;
    await w.until(`see the bell count ${rang}`, `bell() === ${rang}`);
    await w.press("press the strip's action", `find('a, button', /^(Review|Open Approvals)$/)`);
    if (waiting.total > 1) {
      await w.until('reach Approvals', `location.pathname === '/approvals'`);
      await w.press(`press Review on ${target.path} of ${target.initiative}`, `[...main().querySelectorAll('a')].find((a) => a.getAttribute('aria-label') === 'Review ${target.path} v${target.version} of ${target.initiative}')`);
    }
    await w.until('open the document', `location.pathname.endsWith('/${target.initiative}/${target.path}')`);
    await w.press('press Approve', `[...main().querySelectorAll('button')].find((b) => words(b) === 'Approve' && !b.disabled)`);
    await w.press('confirm the approval', `find('button', 'Confirm')`);
    await w.until('see it approved', `!find('button', 'Approve') && !find('button', 'Confirm')`);
    const after = await w.until<number>('the bell drops', `bell() === ${rang - 1} && String(bell())`).then(Number);
    await w.open('/approvals?tab=history');
    const row = await w.until<string[]>('read History', `table(/approved in your name|history/i)?.[0]`);
    w.check('read History', row.join(' ').includes(target.initiative) && row.join(' ').includes(target.path), `its first row is "${row.join(' | ')}"`);
    const tab = await w.until<string>('read the History tab', `words(find('a', /^History/))`);
    w.check('read the History tab', Number(/^History\s*([\d,]+)$/.exec(tab)?.[1].replace(/,/g, '')) === history.total + 1, `the tab says "${tab}", not ${history.total + 1}`);
    await w.open('/');
    const strip = await w.until<string>("read Home's strip", `text()`);
    const left = rang - 1;
    w.check("read Home's strip", left ? strip.includes(`${left} ${left === 1 ? 'revision waits' : 'revisions wait'}`) : !/revisions? waits?/.test(strip), 'the strip does not say what is left');
    return `approved ${target.path} of ${target.initiative} from Home's strip: the bell went from ${rang} to ${after}, History gained its row (${history.total} to ${history.total + 1}), and the strip ${left ? `says ${left} ${left === 1 ? 'revision waits' : 'revisions wait'}` : 'went'}`;
  } },

  { task: 'work-3', who: 'member', page: '/record', run: async (w) => {
    const stub = `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });`;
    const { identifier } = (await w.page.send('Page.addScriptToEvaluateOnNewDocument', { source: stub })).result;
    try {
      await w.open('/record');
      await w.press('pick This quarter', `find('[role="radio"]', 'Quarter')`);
      await w.until('read the quarter', `/period=quarter/.test(location.search) && find('[role="radio"]', 'Quarter')?.getAttribute('aria-checked') === 'true' && !busy()`);
      // The quarter's record replaces the whole record's after the control turns, and Copy copies the one drawn.
      await w.until("see the whole record's period gone", `!/All of the record/.test(text())`);
      await w.press('press Copy as text', `[...main().querySelectorAll('button')].find((b) => words(b) === 'Copy as text' && !b.disabled)`);
      const copied = await w.until<string>('read what was copied', `window.__copied`);
      // Compared without spaces or case: a card sets a unit beside its figure, `312h`, where the sentence says `312 h`.
      const bare = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      const page = bare(await w.until<string>('read the page', 'text()'));
      const figures = copied.split('\n').filter((l) => l.startsWith('- '));
      const missing = figures.filter((l) => {
        const [label, ...rest] = l.slice(2).split(': ');
        return !page.includes(bare(label)) || !page.includes(bare(rest.join(': ').replace(/ \(.*\)$/, '')));
      });
      w.check('compare the text with the page', figures.length > 0 && !missing.length, `${missing.length} of ${figures.length} copied figures are not drawn: ${missing.slice(0, 3).join(' | ')}`);
      const period = localDay(Date.parse((await w.read('/record?period=quarter')).meta.period.from));
      return `This quarter, from ${period}, copied as ${copied.split('\n').length} lines: each of its ${figures.length} figures is one the page draws`;
    } finally {
      await w.page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    }
  } },

  { task: 'work-4', who: 'member', page: '/knowledge', run: async (w) => {
    const phrase = readTasks().find((t) => t.id === 'work-4')!.phrase!;
    const answer = await w.read(`/search?${new URLSearchParams({ q: phrase, limit: '10' })}`);
    const first = answer.results[0];
    w.check('search the gateway', first?.kind === 'document', `"${phrase}" finds no document`);
    const address = `/initiatives/${first.team}/${first.initiative}/${first.path}`;
    await w.open('/knowledge');
    await w.type('type the phrase', `main().querySelector('input[type="search"]')`, phrase);
    await w.enter();
    const hit = await w.until<string>('read the first hit', `main().querySelector('[data-result] a.hit')?.getAttribute('href')`);
    w.check('read the first hit', hit === address, `the first hit links ${hit}, the search's first result is ${address}`);
    // Then the assistant, asked the same thing on the same page: the fake model answers the phrase with the search
    // (`fakeModel` in scripts/verify.config.ts) and quotes its first result, with the address that result cites.
    await w.until('open the assistant', `!!document.querySelector('button[aria-label="Assistant"]')`, 5_000)
      .catch(() => fail('open the assistant', 'no launcher on /knowledge: this console has no assistant (pnpm verify --full points one at the fake model)'));
    await w.press('open the assistant', `document.querySelector('button[aria-label="Assistant"]')`);
    const before = Number(await w.until<string>('see the panel', `${PANEL} && String(${PANEL}.querySelectorAll('[data-assistant-text]').length)`));
    await w.type('ask the assistant', `${PANEL}.querySelector('textarea[aria-label="Message"]')`, phrase);
    await w.press('send the question', `[...${PANEL}.querySelectorAll('button[aria-label="Send"]')].find((b) => !b.disabled)`);
    const reply = await w.until<string>('read the answer', `${PANEL}.querySelectorAll('[data-assistant-text]').length > ${before} && /\\bEvidence: \\//.test(${LAST_ANSWER}) && ${LAST_ANSWER}`)
      .catch(async (e: Error) => fail('read the answer', `${e.message.replace(/^step "read the answer": /, '')}; the last answer reads "${(await w.page.eval<string>(LAST_ANSWER).catch(() => '')).slice(0, 200)}"`));
    const cited = citedAddress(reply);
    w.check('compare the citation', cited === hit, `the assistant cites ${cited}, the page's first hit is ${hit}`);
    return `"${phrase}" found ${answer.ranked_total} results; the first hit is ${hit}, ${first.title}, and the assistant asked the same cites ${cited}`;
  } },

  { task: 'work-5', who: 'member', page: '/activity', run: async (w) => {
    const group = part((await w.read('/activity/summary')).groups).rows[0];
    await w.open('/activity');
    const row = await w.until<string[]>('read the first group', `table(/Refusals by owner, tool and message/)?.[0]`);
    const said = row.join(' | ');
    w.check('read the first group', row[0] === OWNERS[group.owner] && row[1] === group.tool && row[3] === `${group.count}×` && (group.message ? said.includes(group.message) : /No message recorded/.test(said)), `its first row is "${said}"`);
    return `the first group: ${OWNERS[group.owner].toLowerCase()} on ${group.tool}, "${group.message ?? 'no message recorded'}", ${group.count} times`;
  } },

  { task: 'work-6', who: 'member', page: '/runs', run: async (w) => {
    const rows = part((await w.read('/runs')).bySkill).rows;
    await w.open('/runs');
    const page = await w.until<string[][]>('read By skill', `table(/Runs by skill/)`);
    const sizes = page.map((r) => bytesOf(r[4]));
    w.check('read By skill', page[0]?.[0] === rows[0].skill, `the first row is ${page[0]?.[0]}, the heaviest by output per run ${rows[0].skill}`);
    w.check('read the order', sizes.every((s, i) => i === 0 || Number.isNaN(s) || s <= sizes[i - 1]), `output per run is not in descending order: ${page.map((r) => r[4]).join(', ')}`);
    return `the heaviest skill by observed output per run is ${page[0][0]}, ${page[0][4]} a run over ${page[0][1]} runs; ${page.length} skills on the page, in descending order`;
  } },

  { task: 'work-7', who: 'member', page: '/initiatives', run: async (w) => {
    const ready = (await w.read('/initiatives?state=open&limit=100')).rows.find((r: Json) => r.nextMove.action === 'close');
    w.check('find one to close', ready, 'no open initiative has every gate passed');
    const before = (await w.read('/record')).foot.closed.value as number;
    await w.open('/record');
    await w.until(`see Record's work closed at ${before}`, `/work closed ${count(before)} of /i.test(text())`);
    w.at = `/initiatives/atlas/${ready.slug}`;
    await w.open(w.at);
    await w.press('press Close initiative', `find('button', 'Close initiative')`);
    await w.press('choose Accepted', `dialog()?.querySelector('[role="radio"][value="accepted"]')`);
    await w.press('record the close', `[...(dialog()?.querySelectorAll('button') ?? [])].find((b) => words(b) === 'Record the close' && !b.disabled)`);
    const result = await w.until<string>('read the result', `words(dialog()?.querySelector('[data-close-result]'))`);
    w.check('read the result', /^Closed as accepted\b/.test(result), `the dialog says "${result}"`);
    await w.press('press Done', `[...(dialog()?.querySelectorAll('button') ?? [])].find((b) => words(b) === 'Done')`);
    await w.open('/record');
    const after = (await w.read('/record')).foot.closed.value as number;
    w.check("read Record's total", after === before + 1, `Record's closed count went from ${before} to ${after}`);
    await w.until(`see Record's work closed at ${after}`, `/work closed ${count(after)} of /i.test(text())`);
    return `closed ${ready.slug} as accepted; Record's work closed went from ${before} to ${after}`;
  } },

  { task: 'work-8', who: 'member', page: '/access', run: async (w) => {
    const label = 'journey laptop';
    await w.open('/access');
    await w.type('name the token', `[...main().querySelectorAll('input')].find((i) => /What it is for/.test(i.placeholder))`, label);
    await w.press('press Issue token', `find('button', 'Issue token')`);
    const value = await w.until<string>('read the value', `dialog() && /zz_pat_\\S+/.exec(words(dialog()))?.[0]`);
    await w.press('dismiss it', `[...dialog().querySelectorAll('button')].find((b) => /stored it/.test(words(b)))`);
    await w.until('see the value gone', `!dialog() && !document.body.innerText.includes('${value}') && table(/Your tokens/)?.some((r) => r[0].startsWith('${label}'))`);
    await w.open('/access');
    await w.until('see it gone on a reload', `!document.body.innerText.includes('${value}') && table(/Your tokens/)?.some((r) => r[0].startsWith('${label}'))`);
    const setup = ((await w.read('/access')).setup.config as string).split('\n').filter((l) => /^claude /.test(l));
    const page = await w.until<string>('read Client setup', 'text()');
    const missing = setup.filter((c) => !page.includes(c));
    w.check('read Client setup', setup.length && !missing.length, `Client setup lacks ${missing.join(', ')}`);
    return `issued "${label}": its value shown once, gone when the dialog closed and on a reload; Client setup holds the ${setup.length} commands to run`;
  } },

  { task: 'platform-1', who: 'superadmin', page: '/platform', run: async (w) => {
    const { needs } = await w.read('/platform/status');
    await w.open('/platform');
    await w.until('read the count line', `text().includes(${JSON.stringify(needs.headline)})`);
    const linked = needs.rows.filter((r: Json) => r.href);
    for (const r of linked) await w.until(`find "${r.title}"`, `[...main().querySelectorAll('a')].some((a) => a.getAttribute('href') === '${r.href}' && words(a).startsWith(${JSON.stringify(r.title)}))`);
    for (const href of [...new Set<string>(linked.map((r: Json) => r.href))]) {
      await w.open(href);
      await w.until(`open ${href}`, `!main().querySelector('[data-no-access], [data-missing-page]')`);
    }
    return `"${needs.headline}": ${needs.rows.length} lines, each opening the page where it is handled (${linked.map((r: Json) => r.href).join(', ')})`;
  } },

  { task: 'platform-2', who: 'superadmin', page: '/platform', run: async (w) => {
    await w.open('/platform');
    const directional = await w.until<string[][]>('read the scoreboard', `table(/Five measures with a direction/)`);
    const activity = await w.until<string[][]>('read the activity measures', `table(/Three activity measures/)`);
    const rate = await w.until<string>('read the rate', `text().includes('MALFORMED CALLS PER 1,000') || /malformed calls per 1,000/i.test(text()) ? 'malformed calls per 1,000' : ''`);
    w.check('count the measures', directional.length === 5 && activity.length === 3, `${directional.length} directional and ${activity.length} activity measures`);
    for (const r of [...directional, ...activity]) w.check(`read ${r[0]}`, /Week of/.test(r[1]) && /\b(up|down|flat|no change|not comparable)\b/i.test(r.join(' ')), `"${r.join(' | ')}" says no first week or no change`);
    return `the rate, ${rate}, beside refusals put right; ${directional.length + activity.length} measures, each with its first week, its best (or high and low) and last week's change: ${[...directional, ...activity].map((r) => r[0]).join(', ')}`;
  } },

  { task: 'platform-3', who: 'superadmin', page: '/platform/usage', run: async (w) => {
    await w.open('/platform/usage');
    const put = await w.until<string>('read refusals put right', `/within 120 seconds/.test(text()) && /Put right ([\\d.]+% of [\\d,]+ followable)/.exec(text())?.[1]`);
    const tools = await w.until<string[][]>("read each tool's median", `table(/Each tool's median call/)`);
    const slower = tools.filter((r) => /\bup\b/.test(r[3]));
    w.check('find the slower tools', tools.length > 0, 'no tool is drawn');
    return `${put} refusals put right within 120 seconds; slower: ${slower.map((r) => `${r[0]} (${r[1].split(' ').slice(0, 2).join(' ')} to ${r[2].split(' ').slice(0, 2).join(' ')})`).join(', ') || 'none'}`;
  } },

  { task: 'platform-4', who: 'member', page: '/platform/releases', run: async (w) => {
    const rows = part((await w.read('/platform/releases')).rows).rows as Json[];
    await w.open('/platform/releases');
    const page = await w.until<string[][]>('read the releases', `table(/Releases with what was observed/)`);
    // A release with no action recorded is one the platform knows needs none. COUPLED: `clientActionOf` in
    // src/views/platform-releases-context.ts.
    for (const [i, r] of rows.slice(0, 2).entries()) w.check(`read ${r.version}`, page[i]?.[3] === (r.clientAction ?? 'Nothing to do'), `row ${i + 1} says "${page[i]?.[3]}" for its clients, the release ${JSON.stringify(r.clientAction)}`);
    const offered = await w.until<string>('look for a control', `String([...main().querySelectorAll('button, [role="button"], textarea')].filter(shown).filter((b) => ${WRITES}.test(words(b))).length)`);
    w.check('look for a control', offered === '0', `${offered} write controls offered`);
    return `for your clients, the latest rows: ${rows.slice(0, 2).map((r, i) => `${r.version} "${page[i][3]}"`).join(', ')}`;
  } },

  { task: 'platform-5', who: 'superadmin', page: '/platform/releases', run: async (w) => {
    const rows = part((await w.read('/platform/releases')).rows).rows as Json[];
    // The newest release whose notes ask something of clients.
    let found: Json | undefined;
    for (const r of rows) if (!found && (await w.read(`/platform/releases/${r.version}`)).upgradeNotes) found = r;
    const release = found ?? fail('find a release with notes', 'no release has upgrade notes');
    await w.open('/platform/releases');
    const row = await w.until<string[]>('read its windows', `table(/Releases with what was observed/)?.find((r) => r.join(' ').includes(${JSON.stringify(release.summary ?? '')}))`);
    w.check('read its windows', /Before/.test(row[4]) && /After/.test(row[4]), `its row says "${row[4]}"`);
    w.at = `/platform/releases/${release.version}`;
    await w.press(`open ${release.version}`, `[...main().querySelectorAll('a')].find((a) => a.getAttribute('href') === '/platform/releases/${release.version}')`);
    await w.until(`reach ${release.version}`, `location.pathname === '/platform/releases/${release.version}' && /Upgrade notes/.test(text())`);
    // Window, observed, calls, malformed, per 1,000, tool failures, p95: the platform's faults are its tool failures.
    const windows = await w.until<string[][]>('read the 72 hours either side', `table(/72 hours either side/)`);
    const faults = [release.before, release.after].map((x: Json) => (x.toolFailures.value === null ? null : count(x.toolFailures.value)));
    w.check('read the 72 hours either side', windows.length === 2 && /^Before/.test(windows[0][0]) && /^After/.test(windows[1][0]), 'no window before and after');
    for (const [i, f] of faults.entries()) if (f !== null) w.check('read the tool failures', windows[i][5] === f, `the ${i ? 'after' : 'before'} window says ${windows[i][5]} tool failures, the release ${f}`);
    return `${release.version}: ${row[4]} malformed per 1,000; its page has its upgrade notes ("${release.clientAction}"), and ${windows[0][5]} tool failures in the 72 hours before and ${windows[1][5]} after`;
  } },

  { task: 'platform-6', who: 'superadmin', page: '/platform/bugs', run: async (w) => {
    const bugs = await w.read('/platform/bugs');
    const report = part(bugs.queue).rows.find((r: Json) => r.status === 'open');
    const open = part(bugs.counts).open as number;
    const status = await w.read('/platform/status');
    const line = (s: Json) => s.needs.rows.find((r: Json) => r.kind === 'bugs')?.detail ?? 'no bugs line';
    w.at = `/platform/bugs/${report.id}`;
    await w.open(w.at);
    await w.press('choose Fixed', `main().querySelector('[role="radio"][value="fixed"]')`);
    await w.type('write what was decided', `main().querySelector('textarea')`, 'Fixed in the next release: the stakeholder is read from the frontmatter.');
    await w.press('press Resolve report', `[...main().querySelectorAll('button')].find((b) => words(b) === 'Resolve report' && !b.disabled)`);
    await w.until('see it resolved', `!find('button', 'Resolve report')`);
    const now = part((await w.read('/platform/bugs')).counts).open as number;
    w.check('read the queue', now === open - 1, `the queue's open count went from ${open} to ${now}`);
    await w.open('/platform/bugs');
    await w.until(`see the queue's Open tile at ${now}`, `tile('Open') === '${now}'`);
    const after = await w.read('/platform/status');
    w.check('read Status', line(after) !== line(status), `Status's bugs line stayed "${line(status)}"`);
    await w.open('/platform');
    await w.until("read Status's line", `text().includes(${JSON.stringify(line(after))}) || ${line(after) === 'no bugs line'}`);
    return `resolved "${report.internalTitle}" as fixed: the queue's open reports went from ${open} to ${now}, and Status's line from "${line(status)}" to "${line(after)}"`;
  } },

  { task: 'platform-7', who: 'superadmin', page: '/platform/teams', run: async (w) => {
    const teams = (await w.read('/teams')).teams as Json[];
    await w.open('/platform/teams');
    const page = await w.until<string[][]>('read Teams', `table(/^Teams$/)`);
    const order = teams.map((t) => t.lastActive ?? '');
    w.check('read the order', order.every((t, i) => i === 0 || !t || t <= order[i - 1]), 'the read is not latest call first');
    for (const [i, t] of teams.entries()) w.check(`read ${t.slug}`, page[i]?.[0].startsWith(t.slug) && page[i]?.[3] === String(t.waiting), `row ${i + 1} is "${page[i]?.join(' | ')}", not ${t.slug} with ${t.waiting} waiting`);
    return `latest call first: ${teams.map((t) => `${t.slug} (${t.waiting} waiting)`).join(', ')}`;
  } },

  { task: 'platform-8', who: 'superadmin', page: '/platform/people', run: async (w) => {
    const email = 'journey.person@example.com';
    const before = (await w.read('/people')).tiles.people as number;
    await w.open('/platform/people');
    await w.press('press Add a person', `find('button', 'Add a person')`);
    await w.type('type the email', `dialog()?.querySelector('input[type="email"]')`, email);
    await w.type('type the name', `[...(dialog()?.querySelectorAll('input') ?? [])].find((i) => i.type !== 'email')`, 'Journey Person');
    await w.press('press Add person', `[...(dialog()?.querySelectorAll('button') ?? [])].find((b) => words(b) === 'Add person' && !b.disabled)`);
    await w.until('see the dialog close', `!dialog()`);
    const after = (await w.read('/people')).tiles.people as number;
    w.check('count the people', after === before + 1, `People counted ${before} and now ${after}`);
    await w.type('find the person', `main().querySelector('input[type="search"]')`, email);
    await w.until('see their row', `table(/^People$/)?.length === 1 && table(/^People$/)[0][0].includes('${email}')`);
    await w.press('press Enrolment link', `find('button', 'Enrolment link')`);
    const link = await w.until<string>('read the link', `dialog() && /https?:\\/\\/\\S+/.exec(words(dialog()))?.[0]`);
    await w.press('dismiss it', `[...dialog().querySelectorAll('button')].find((b) => /sent it/.test(words(b)))`);
    await w.until('see the link gone', `!dialog() && !document.body.innerText.includes('${link}')`);
    return `added ${email}, People counts ${after}; an enrolment link was shown once and is gone once dismissed`;
  } },

  { task: 'platform-9', who: 'superadmin and member', page: '/platform/knowledge', run: async (w) => {
    await w.open('/platform/knowledge', 'superadmin');
    const questions = await w.until<string[][]>('read the questions', `table(/Questions the searches that found nothing asked/)`);
    const asked = questions.map((q) => Number(q[2]));
    w.check('read the order', asked.every((n, i) => i === 0 || n <= asked[i - 1]), `asked ${asked.join(', ')}: not most asked first`);
    await w.open('/platform/knowledge', 'member');
    const page = await w.until<string>("read the member's page", `!busy() && text()`);
    const leaked = questions.filter((q) => page.includes(q[0]));
    w.check("read the member's page", !leaked.length && !/Questions with no result/.test(page) && !SAYS.test(page), leaked.length ? `the member reads "${leaked[0][0]}"` : 'the member is told of the questions');
    return `the superadmin reads ${questions.length} questions, most asked first ("${questions[0]?.[0]}", ${questions[0]?.[2]}); the member reads none, and nothing says so`;
  } },

  { task: 'platform-10', who: 'member', page: '/platform', run: async (w) => {
    const six = config.personas!.member.expectedRoutes.filter((r) => r.startsWith('/platform'));
    await w.open('/platform');
    const rail = await w.until<string[]>('read the rail', `[...document.querySelectorAll('nav[aria-label="Main"] a[href]')].map((a) => a.getAttribute('href'))`);
    w.check('read the rail', rail.length === 6 && six.every((r) => rail.includes(r)), `the rail lists ${rail.join(', ')}`);
    for (const route of six) {
      await w.open(route);
      const offered = await w.until<string>(`look for a control on ${route}`, `'_' + [...main().querySelectorAll('button, a, textarea, input:not([type="search"])')].filter(shown).filter((b) => ${WRITES}.test(words(b) || b.getAttribute('aria-label') || '') || b.tagName === 'TEXTAREA').map(words).join(', ')`);
      w.check(`look for a control on ${route}`, offered === '_', `offers ${offered.slice(1)}`);
      const said = (await w.until<string>(`read ${route}`, 'text()')).match(SAYS);
      w.check(`read ${route}`, !said, `says "${said?.[0]}"`);
    }
    return `the rail lists ${rail.length}: ${rail.join(', ')}; none offers a control, and none says so`;
  } },
];

/**
 * The writes each journey session has kept in this fake gateway's life, by the fake's own count (`__journey`): any is a
 * run that has written already, whose approval, close and resolution a second walk could not make again.
 */
async function written(): Promise<string[]> {
  const out: string[] = [];
  for (const who of ['member', 'superadmin'] as Who[]) {
    const value = `${config.personas![who].cookie.value}+journey`;
    const res = await fetch(`${base}/api/console/__journey?session=${encodeURIComponent(value)}`);
    if (!res.ok) { out.push(`${value}: the gateway keeps no journey (${res.status})`); continue; }
    const kinds = Object.entries((await res.json() as { written: Record<string, number> }).written).filter(([, n]) => n > 0);
    if (kinds.length) out.push(`${value}: ${kinds.map(([k, n]) => `${n} ${k}`).join(', ')}`);
  }
  return out;
}

/** One journey, as one line. */
async function walk(page: Page, j: Journey, tasks: GuideTask[]): Promise<boolean> {
  const task = tasks.find((t) => t.id === j.task)!;
  const w = new Walk(page, j.who === 'member' ? 'member' : 'superadmin');
  const head = () => `${j.task.padEnd(12)} ${j.who.padEnd(22)} ${(w.at ?? j.page).padEnd(30)}`;
  try {
    const found = await j.run(w);
    console.log(`ok   ${head()} ${task.task} ${found}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${head()} ${task.task} ${(e as Error).message}`);
    return false;
  }
}

if (import.meta.main) {
  let tasks: GuideTask[];
  try { tasks = readTasks(); } catch (e) { console.error(`journeys: cannot read ${TASKS_FILE}: ${(e as Error).message}`); process.exit(2); }
  const unknown = JOURNEYS.filter((j) => !tasks.some((t) => t.id === j.task));
  if (unknown.length) { console.error(`journeys: ${unknown.map((j) => j.task).join(', ')} name no task in ${TASKS_FILE}`); process.exit(2); }
  const chosen = JOURNEYS.filter((j) => !only || only.has(j.task));
  console.log(`journeys: ${chosen.length} of the guides' ${tasks.length} tasks, as journey sessions, against ${base}`);
  const already = await written().catch((e: Error) => [`the gateway could not be read: ${e.message}`]);
  if (already.length) {
    console.error(`journeys: the journey sessions cannot start clean here (${already.join('; ')}); start a fresh fake gateway`);
    process.exit(2);
  }
  // Imported here, so a test of the list above loads no browser and none of its process handlers.
  const { launch } = await import('./lib/chrome.ts');
  const page = await launch();
  let failed = 0;
  try { for (const j of chosen) if (!(await walk(page, j, tasks))) failed++; } finally { page.close(); }
  console.log(`\njourneys: ${chosen.length} tasks; ${failed} failed`);
  process.exit(failed || !chosen.length ? 1 : 0);
}
