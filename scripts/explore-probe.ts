/**
 * explore-probe.ts — every view's tool and its page's prepared query, asked as one signed-in person through ZZ
 * Meridian's own runner over the console's prepared collections, on a real gateway: no answer holds a word of another
 * team's, and two answers agree with the pages beside them.
 *
 *   node scripts/explore-probe.ts < probe.json    # zz-stack's `npm run skeleton` runs it, on its own gateway
 *
 * It reads one JSON object on standard input, so the session secret is never on a command line:
 *
 *   gateway     the gateway's address, which the console's server reads as `ZZ_GATEWAY`
 *   cookie      the person's `zz_console` session secret; never printed
 *   sentinels   the words no answer to this person may hold: another team's slug, names and free text
 *   addresses   one console address of each detail page, `exists` false for one that names no record
 *   agree       the weekly figures two pages draw for a week, which the prepared queries are held to
 *   control     true for a reader who may read those words: then some answer must hold them, so that another reader
 *               finding none of them is about who asks, and no figure is held to a page
 *
 * The console's modules are loaded as its server runs them, by hooks registered here: `@/` and an import without its
 * extension resolved as TypeScript resolves them, each source compiled by the console's own TypeScript (JSX and every
 * construct Node's type stripping refuses included), `server-only` empty, and `next/headers` answering the session cookie
 * alone. Every read is the console's own gateway read made with that cookie (`src/data/gateway.ts`).
 *
 * What it establishes, for every view tool in `src/views/tools.ts`, read from that list so a view added later is asked
 * without editing this file:
 *
 *   - a view the person may use answers `view_<name>` (at its detail page's given address) with the context the tool
 *     returns, and a view they may not is refused with the one `AccessDenied` sentence, nothing read;
 *   - the prepared query of a page they may use, offered as the assistant's route offers it (the collections they may
 *     read, without the dimensions only a superadmin may name), is asked of every source it offers: its measures three
 *     at a time over every complete day kept with twenty rows drilled, then by each facet and each bucket. A drill of a
 *     measure the gateway lists no rows for is refused with the page's sentence, which is its answer;
 *   - no answer, refusal or drilled row holds any of the sentinels;
 *   - Status's malformed calls, their rate per 1,000 and the platform's calls in `agree.platform.week` are the figures
 *     its page draws, through `/platform/query`; Activity's refusals and calls in `agree.work.week` are the figures its
 *     page draws, through `/work/query`.
 *
 * DELIBERATE: the runner cuts its windows from the UTC date (zz-meridian#42), so between 00:00 and 08:00 of a Monday in
 * the reporting time zone the last whole week is not yet whole for it; run it again.
 *
 * Exit 0: every view held — one line per view, then the final line.
 * Exit 1: an answer held a sentinel, a read failed, or a figure disagreed — the view, the call and what was found.
 * Exit 2: no input, or the gateway could not be reached — the probe could not run, and that is not a pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { handedTo } from '../src/lib/assistant/scoped.ts';
import type { AccessDenied, can, collectionFor, may, resolveAccess } from '../src/data/access.ts';
import type { clock, collections } from '../src/data/collections.ts';
import type { FLEET } from '../src/data/features.ts';
import type { FLEET_FIELDS, PREPARED } from '../src/data/prepared.ts';
import type { aggregate, read } from '../src/data/read.ts';
import type { ExploreRights, exploreSchema, runExplore } from '../src/lib/explore.ts';
import type { dayOf } from '../src/lib/format-date.ts';
import type { ViewTool, contextText, viewAt } from '../src/lib/shared-context.ts';
import type { viewTools } from '../src/views/tools.ts';
import { consoleHooks } from './console-hooks.ts';

const NAME = 'explore-probe';
const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'src');
/** The most measures one call names, as the runner's schema allows. */
const PER_CALL = 3;
const ROWS = 20;
/** What a view whose input is more than its address is asked: Search, a word the person's own notes hold; Audit, every
 *  recorded event. */
const ASKED: Record<string, Record<string, string>> = { search: { q: 'notes' }, audit: { filter: 'all' } };
/** Where the hooks find the cookie: set once input is read, before any console module asks for it. */
const COOKIE = Symbol.for('zz-stack.explore-probe.cookie');

type Week = { week: string };
type Input = {
  gateway: string; cookie: string; sentinels: string[];
  addresses: { address: string; exists: boolean }[];
  agree?: { platform: Week & { malformed: number; calls: number; per1000: number }; work: Week & { refusals: number; calls: number } };
  control?: boolean;
};
type Call = Record<string, unknown>;

class CaseFailure extends Error {}
function fail(step: string, detail: string): never { throw new CaseFailure(`${NAME}: FAILED at "${step}": ${detail}`); }
const pass = (line: string): void => console.log(`  ok  ${line}`);

/** What the probe reads of the console's own modules, each by its name, so no other export of theirs counts as used. */
type Modules = {
  viewTools: typeof viewTools; exploreSchema: typeof exploreSchema; runExplore: typeof runExplore; contextText: typeof contextText;
  viewAt: typeof viewAt; resolveAccess: typeof resolveAccess; can: typeof can; collectionFor: typeof collectionFor; may: typeof may;
  AccessDenied: typeof AccessDenied; collections: typeof collections; clock: typeof clock; FLEET: typeof FLEET;
  FLEET_FIELDS: typeof FLEET_FIELDS; PREPARED: typeof PREPARED; aggregate: typeof aggregate; read: typeof read; dayOf: typeof dayOf;
  handedTo: typeof handedTo;
};

/** The console's own modules, loaded through the hooks. */
async function consoleModules(): Promise<Modules> {
  const files = ['views/tools.ts', 'lib/explore.ts', 'lib/shared-context.ts', 'data/access.ts', 'data/collections.ts', 'data/features.ts',
    'data/prepared.ts', 'data/read.ts', 'lib/format-date.ts', 'lib/assistant/scoped.ts'];
  const loaded = await Promise.all(files.map((f) => import(pathToFileURL(path.join(SOURCE, f)).href) as Promise<Record<string, unknown>>));
  return Object.assign({}, ...loaded) as Modules;
}

/** A view's input from an address it renders: `[name]` is one segment, `[...name]` the rest of them joined. */
function inputOf(page: string, address: string): Record<string, string> {
  const want = page.split('/'), got = address.split('/');
  return Object.fromEntries(want.flatMap((s, i) => {
    const rest = /^\[\.\.\.([^\]]+)\]$/.exec(s), one = /^\[([^\]]+)\]$/.exec(s);
    return rest ? [[rest[1], got.slice(i).join('/')]] : one ? [[one[1], got[i]]] : [];
  }));
}

/** Every call of a source a person is asked: its measures three at a time with rows, then by each facet and bucket. */
function callsOf(source: string, s: { date?: string; facets: string[]; buckets?: string[]; measures: Record<string, unknown> }): Call[] {
  const names = Object.keys(s.measures);
  const window = s.date === undefined ? {} : { period: 'all' };
  const chunks = Array.from({ length: Math.ceil(names.length / PER_CALL) }, (_, i) => names.slice(i * PER_CALL, (i + 1) * PER_CALL));
  return chunks.flatMap((measures) => [
    { source, measures, ...window, rows: ROWS },
    ...s.facets.map((by) => ({ source, measures, ...window, by })),
    ...(s.date === undefined ? [] : (s.buckets ?? []).map((bucket) => ({ source, measures, ...window, bucket }))),
  ]);
}

/** The figures of one bucket's group in an answer: `- 2026-10-05: 8 calls, 64 per 1,000 calls`, as numbers. */
function groupOf(answer: string, key: string): number[] | null {
  const line = answer.split('\n').find((l) => l.startsWith(`- ${key}: `));
  return line ? line.slice(key.length + 4).split(', ').map((v) => Number(v.split(' ')[0].replace(/,/g, ''))) : null;
}

async function main(): Promise<number> {
  const raw = fs.readFileSync(0, 'utf8');
  let input: Input;
  try { input = JSON.parse(raw) as Input; } catch { input = {} as Input; }
  if (!input.gateway || !input.cookie || !Array.isArray(input.sentinels) || !Array.isArray(input.addresses) || !(input.agree || input.control)) {
    console.error(`${NAME}: no input on standard input (gateway, cookie, sentinels, addresses, and agree or control) — the probe could not run, which is not a pass`);
    return 2;
  }
  try {
    await fetch(`${input.gateway.replace(/\/+$/, '')}/api/console/me`, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    console.error(`${NAME}: ${input.gateway} could not be reached (${(e as Error).message}) — the probe could not run, which is not a pass`);
    return 2;
  }
  // The console's server, as a deployment runs it: the gateway's address, production, and no development credential.
  Object.assign(process.env, { ZZ_GATEWAY: input.gateway, NODE_ENV: 'production', ZZ_DEV_PAT: '' });
  (globalThis as Record<symbol, unknown>)[COOKIE] = input.cookie;
  consoleHooks(ROOT, 'zz-stack.explore-probe.cookie');
  const m = await consoleModules();

  /** The sentinels a text holds. */
  const held = (text: string) => input.sentinels.filter((s) => s && text.includes(s));
  const found: string[] = [];
  const watch = (where: string, text: string) => { for (const s of held(text)) found.push(`${where} holds ${s} at ${text.indexOf(s)}`); };

  try {
    // COUPLED: app/api/assistant/route.ts, which hands the assistant these rights and reads; a route handler cannot be
    // imported, so they are worked out here the same way.
    const scope = await m.resolveAccess();
    const readable = (await Promise.all(m.collections.map(async (c) => ((await m.can(scope, c.name, 'read')) ? m.handedTo(scope, m.collectionFor(scope, c.name), c.name) : null))))
      .filter((c) => c !== null);
    const names = new Set(readable.map((c) => c.name));
    const wide = await m.may(m.FLEET);
    const rights: ExploreRights = {
      readable: names,
      hidden: (name) => [...((readable.find((c) => c.name === name)?.hidden ?? []) as string[]), ...(wide ? [] : m.FLEET_FIELDS[name] ?? [])],
    };
    const io = { aggregate: m.aggregate, read: m.read, today: m.dayOf(m.clock()) };
    /** The refusals a call the person's schema takes may still be answered: a drill of a measure the gateway lists no
     *  rows for, with the sentence naming the page that does, and a drill only a superadmin may read, with the one
     *  `AccessDenied` sentence. */
    const refusedWith = new Set([...m.PREPARED.flatMap((r) => ('none' in r.drill ? [r.drill.none] : [])), new m.AccessDenied().message]);
    pass(`${NAME}: signed in as ${scope.subjectId}, acting for ${scope.tenantId || 'no team'}, reading ${names.size} of the ${m.collections.length} prepared collections`);

    for (const v of m.viewTools as ViewTool[]) {
      const step = `view_${v.name}`;
      const given = await m.may(v.needs);
      const detail = v.page.includes('[');
      const at = detail ? input.addresses.find((a) => m.viewAt(m.viewTools, a.address.split('?')[0]) === v) : { address: v.page, exists: true };
      if (!at) fail(step, `no address of the form ${v.page} was given, so ${v.title} could not be read`);
      const address = at.address.split('?')[0];
      const own = detail ? inputOf(v.page, address) : {};
      const asking = { ...own, ...ASKED[v.name] };
      if (!given) {
        const refusal = await v.read(v.input.parse(asking)).then(() => null, (e: unknown) => e);
        if (!(refusal instanceof m.AccessDenied)) fail(step, `${v.title} needs ${String(v.needs)}, which ${scope.subjectId} does not hold, and answered ${refusal === null ? 'its context' : String(refusal)}`);
        watch(step, (refusal as Error).message);
        pass(`${step} at ${address} is refused with "${(refusal as Error).message}", and explore_${v.name} is not offered: the route offers a page's prepared query only to whom the page opens`);
        continue;
      }
      // The view tool's answer, as the assistant's tool returns it, and the data its page renders.
      const read = await v.read(v.input.parse(asking)).then(({ context, data }) => ({ answer: JSON.stringify({ address: context.address, context: m.contextText(context) }), data: JSON.stringify(data) }),
        (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
      if ('error' in read) {
        if (at.exists) fail(step, `${v.title} at ${address} answered ${read.error}`);
        watch(step, read.error);
      } else {
        if (!at.exists) fail(step, `${address} names no record, and ${v.title} answered a context for it`);
        watch(step, read.answer);
        watch(`${step}'s data`, read.data);
      }

      const sources = Object.values(v.explore.sources).map((s) => s.collection);
      if (!sources.some((c) => names.has(c))) {
        pass(`${step} answers${at.exists ? '' : ` "${(read as { error: string }).error}"`}; explore_${v.name} is not offered: ${scope.subjectId} reads none of ${sources.join(', ')}`);
        continue;
      }
      const ownSchema = detail ? v.input : undefined;
      const offered = m.exploreSchema(v.explore, rights, ownSchema);
      let calls = 0, refused = 0, unoffered = 0;
      for (const [source, s] of Object.entries(v.explore.sources)) {
        for (const call of callsOf(source, s)) {
          const full = { ...own, ...call };
          if (!offered.safeParse(full).success) { unoffered++; continue; }
          calls++;
          const answer = await m.runExplore(v.explore, full, rights, io, address, ownSchema).then((r) => r.answer, (e: unknown) => {
            const why = e instanceof Error ? e.message : String(e);
            if (!refusedWith.has(why) && at.exists) fail(`explore_${v.name}`, `${JSON.stringify(call)} was refused: ${why}`);
            refused++;
            return why;
          });
          watch(`explore_${v.name} ${JSON.stringify(call)}`, answer);
        }
      }
      if (!calls) fail(`explore_${v.name}`, `the person's schema took none of the calls asked of ${Object.keys(v.explore.sources).join(', ')}`);
      pass(`${step} answers${at.exists ? '' : ` "${(read as { error: string }).error}"`} at ${address}; explore_${v.name} answers ${calls} calls over ` +
        `${Object.keys(v.explore.sources).join(', ')}${refused ? `, ${refused} of them drills refused with the page's own sentence or the one refusal` : ''}` +
        `${unoffered ? `, and ${unoffered} more name what this person is not offered` : ''}`);
    }
    if (input.control) {
      if (!found.length) fail('the control', `no answer held any of the ${input.sentinels.length} sentinels, so a reader finding none of them proves nothing`);
      const where = [...new Set(found.map((f) => f.split(' ')[0].replace(/'s$/, '')))];
      console.log(`${NAME}: as ${scope.subjectId}, ${found.length} answers of ${where.join(', ')} hold the words looked for, so another reader finding none is about who asks: ok`);
      return 0;
    }
    if (found.length) fail('the second team\'s words', `\n    ${found.join('\n    ')}`);
    pass(`${NAME}: no view, prepared query, drilled row or refusal holds any of the ${input.sentinels.length} sentinels`);
    const agree = input.agree!;

    // Two answers held to the pages beside them: Platform's through /platform/query, Work's through /work/query.
    const figures = async (view: string, call: Call): Promise<string> => {
      const v = (m.viewTools as ViewTool[]).find((t) => t.name === view) ?? fail(`explore_${view}`, 'no such view tool');
      if (!(await m.may(v.needs))) fail(`explore_${view}`, `${scope.subjectId} may not open ${v.title}, so its prepared query is not offered`);
      return (await m.runExplore(v.explore, call, rights, io, v.page)).answer;
    };
    const p = agree.platform;
    const status = groupOf(await figures('platform_status', { source: 'malformed', measures: ['malformed', 'per1000'], bucket: 'week', period: 'all' }), p.week);
    const platform = groupOf(await figures('platform_status', { source: 'calls', measures: ['calls'], bucket: 'week', period: 'all' }), p.week);
    if (status?.[0] !== p.malformed || status[1] !== p.per1000 || platform?.[0] !== p.calls) {
      fail('explore_platform_status', `the week from ${p.week} reads ${JSON.stringify(status)} malformed and per 1,000 and ${JSON.stringify(platform)} calls, ` +
        `where Status draws ${p.malformed} of ${p.calls} and ${p.per1000}`);
    }
    pass(`explore_platform_status, through /platform/query, reads the week from ${p.week} as Status draws it: ${p.malformed} malformed calls in ${p.calls}, ${p.per1000} per 1,000`);
    const w = agree.work;
    const refusals = groupOf(await figures('activity', { source: 'refusals', measures: ['refusals'], bucket: 'week', period: 'all' }), w.week);
    const calls = groupOf(await figures('activity', { source: 'calls', measures: ['calls'], bucket: 'week', period: 'all' }), w.week);
    if (refusals?.[0] !== w.refusals || calls?.[0] !== w.calls) {
      fail('explore_activity', `the week from ${w.week} reads ${JSON.stringify(refusals)} refused and ${JSON.stringify(calls)} calls, where Activity draws ${w.refusals} of ${w.calls}`);
    }
    pass(`explore_activity, through /work/query, reads the week from ${w.week} as Activity draws it: ${w.refusals} refused in ${w.calls} calls`);
  } catch (err) {
    console.error(err instanceof CaseFailure ? err.message : `${NAME}: ${String((err as Error)?.stack ?? err)}`);
    return 1;
  }
  console.log(`${NAME}: every view tool and every prepared query offered was asked through ZZ Meridian's runner on the real ` +
    'gateway, none of their answers held another team\'s words, and Status\'s and Activity\'s agree with their pages: ok');
  return 0;
}

process.exit(await main());
