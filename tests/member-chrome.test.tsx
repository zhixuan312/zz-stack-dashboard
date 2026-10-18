import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Suspense, cloneElement, createElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { z } from 'zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A member's chrome names no role and no one who can (reconciliation 77, AC-1.7 and AC-1.8). As the fake gateway's
 * member, who is their team's admin as every person the platform adds is, the shell and every destination and detail
 * page they may open are rendered against the fake's answers, and each is held to four things:
 * - no "superadmin", "read only" or "read-only" anywhere;
 * - no "admin" or "role" outside the two places they stay: Access's table of the teams the person belongs to, and the
 *   members panel a team admin is drawn on Access;
 * - no Resolve, Archive, Deactivate or Add person control;
 * - no sentence about what they cannot do, or about who else can.
 * The same holds with the member's `/me` and Access answer saying they are a member, not the admin, of their team,
 * mocked here over the fake's answers: no members panel is drawn at all. As the superadmin the same pages and the same
 * detector find the superadmin's own fields, so a clean member run is not a detector that finds nothing.
 *
 * Every string the assistant is handed for the member is held to the same words: each page's shared context, each view
 * tool's context read as the member, and the descriptions and input schemas of the tools the assistant route hands them
 * (`app/api/assistant/route.ts`: the view tools whose need they hold, and on each page its prepared query over the
 * collections they may read), with the prepared queries' own words, collected from the declarations, never a hand list.
 *
 * Each page is rendered as Next renders it: its own default export, its real gate, its async parts awaited (as
 * `tests/agent-side.test.ts` does), every server and browser read answered by the fake gateway `pnpm verify` serves,
 * spawned here, as the person the `zz_console` cookie names.
 */
const jar = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`redirect to ${to}`); },
}));

import { openCommand } from '@/components/patterns/command-palette';
import { SurfaceOverride, type Surface } from '@/components/base/surface';
import { PeriodProvider } from '@/console/period';
import { can, chromeAccess, may, resolveAccess } from '@/data/access';
import { clock, collections } from '@/data/collections';
import { FEATURES, FLEET, type FeatureId } from '@/data/features';
import { FLEET_FIELDS, PREPARED } from '@/data/prepared';
import { aggregate, read as readCollection } from '@/data/read';
import { whoCan } from '@/data/roles';
import type { Me, SearchAnswer, SearchHit } from '@/lib/api-shapes';
import { assistantTools, type HandedExplore } from '@/lib/assistant/tools';
import type { Access } from '@/lib/destination-shapes';
import { dayOf } from '@/lib/format-date';
import { contextText, type SharedContext, type ViewTool } from '@/lib/shared-context';
import { searchContext } from '@/views/search-context';
import { viewTools } from '@/views/tools';
import { WorkspacePalette, WorkspaceRail } from '@/views/workspace-chrome';
import config from '../scripts/verify.config.ts';
import { MEMBER } from '../scripts/fake-gateway/people.ts';
import { SHARED_TEAM, SHELF } from '../scripts/fake-gateway/work-knowledge.ts';
import { startFakeGateway } from './fake-gateway-start';

const ROOT = path.resolve(import.meta.dirname, '..');
const DASH = path.join(ROOT, 'app/(dash)');
const TEAM = MEMBER.activeTeam!;

// The words and controls a member's chrome never carries.
/** Anywhere on the page. */
const NEVER = /\bsuperadmins?\b|\bread[- ]only\b/gi;
/** Anywhere outside the two places they stay. */
const ROLE_WORDS = /\badmins?\b|\broles?\b/gi;
/** A sentence about what the reader cannot do, or about who else can. */
const CANNOT = /\b(?:you|they) (?:cannot|can't|can ?not|may not|are not (?:allowed|permitted)|do not have (?:access|permission))\b|\b(?:only|ask) (?:a|an|the|your) (?:superadmin|admin|team admin|owner)\b|\bnot (?:allowed|permitted)\b|\bno (?:access|permission)\b/gi;
const CONTROLS = /^(?:resolve|archive|deactivate|add person)\b/i;

/** Every match of `re` in `text`, each with a little of what surrounds it, so a failure says where. */
const hits = (re: RegExp, text: string): string[] => [...text.matchAll(re)].map((m) => text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' '));
/** What an assistant string carries of the words: none, for a member. */
const wordsIn = (text: string): string[] => [...hits(NEVER, text), ...hits(ROLE_WORDS, text)];
/**
 * A context's words, with Access's account of the person's own teams left out of the role words: it is the agent's
 * reading of Access's table of those teams (`src/views/access-context.ts`), the one place their own role stays.
 */
function contextWords(c: SharedContext): string[] {
  const text = contextText(c);
  const own = c.view === 'access' ? text.replace(/^- (?:Acting for|Their teams): .*$/gm, '') : text;
  return [...hits(NEVER, text), ...hits(ROLE_WORDS, own)];
}

/** An element's words as a reader meets them: its text, and the names and hints its attributes give. */
function wordsOf(root: Element): string {
  const named = [...root.querySelectorAll('[aria-label], [title], [placeholder], [alt]')]
    .flatMap((el) => ['aria-label', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? ''));
  return [root.textContent ?? '', ...named].join(' \n ');
}

/**
 * The two places a role word stays (reconciliation 77): Access's table of the teams the person belongs to, by its
 * caption, and the members panel a team admin is drawn, the FormSection whose title names the team's members.
 */
function keptPlaces(root: Element): Element[] {
  const teams = [...root.querySelectorAll('table')].filter((t) => t.querySelector('caption')?.textContent === 'Your teams, and the one this browser acts for');
  const members = [...root.querySelectorAll('section')].filter((s) => /'s members$/.test(s.querySelector('h2')?.textContent ?? ''));
  return [...teams, ...members];
}
const membersPanel = (root: Element = document.body) => keptPlaces(root).filter((el) => el.tagName === 'SECTION');

/** What a member's chrome must not carry, found on `root` as drawn. */
function findings(root: Element = document.body): string[] {
  const all = wordsOf(root);
  const outside = root.cloneNode(true) as Element;
  for (const kept of keptPlaces(outside)) kept.remove();
  const controls = [...root.querySelectorAll('button, a, [role="menuitem"], [role="option"]')]
    .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()).filter((name) => CONTROLS.test(name));
  return [
    ...hits(NEVER, all).map((h) => `word: ${h}`),
    ...hits(ROLE_WORDS, wordsOf(outside)).map((h) => `role word: ${h}`),
    ...hits(CANNOT, all).map((h) => `cannot: ${h}`),
    ...controls.map((c) => `control: ${c}`),
  ];
}

type Page = { file: string; feature: FeatureId; address: string; params: Record<string, string | string[]> };
/** The route a page file serves: route groups dropped, a segment `[x]` one name, `[...x]` the rest of the path. */
const routeOf = (file: string) => `/${path.dirname(file).split(path.sep).filter((s) => s !== '.' && !/^\(.*\)$/.test(s)).join('/')}`;
const segmentRe = (seg: string) => (seg.startsWith('[...') ? '(.+)' : seg.startsWith('[') ? '([^/]+)' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** A detail page's addresses: verify's own, without their queries, and a lesson on the shared shelf. */
const SHARED_LESSON = SHELF.find((n) => n.team === SHARED_TEAM)!;
const DETAILS = [...config.detailRoutes, `/knowledge/${SHARED_TEAM}/${SHARED_LESSON.path}`]
  .map((a) => a.split('?')[0]).filter((a, i, all) => all.indexOf(a) === i);
/** An address of a team the member does not act for, whose record the gateway answers nobody else. */
const ANOTHER_TEAM = /^\/(?:initiatives|knowledge)\/(?!atlas\/|zz-platform\/)/;

function pagesOf(file: string): Page[] {
  const route = routeOf(file);
  const feature = /\bgate\('([\w-]+)'\)/.exec(fs.readFileSync(path.join(DASH, file), 'utf8'))![1] as FeatureId;
  const segs = route.split('/').filter(Boolean);
  if (!segs.some((s) => s.startsWith('['))) return [{ file, feature, address: route, params: {} }];
  const re = new RegExp(`^/${segs.map(segmentRe).join('/')}$`);
  const names = segs.filter((s) => s.startsWith('['));
  return DETAILS.filter((a) => re.test(a)).map((address) => {
    const values = re.exec(address)!.slice(1);
    const params = Object.fromEntries(names.map((n, i) => (n.startsWith('[...') ? [n.slice(4, -1), values[i].split('/')] : [n.slice(1, -1), values[i]])));
    return { file, feature, address, params };
  });
}
const opens = (role: 'Member' | 'Superadmin', feature: FeatureId) => whoCan(FEATURES[feature].needs).includes(role);
/** Every page under `app/(dash)` but the address no page answers, at each of its addresses. */
const EVERY: Page[] = (fs.readdirSync(DASH, { recursive: true }) as string[])
  .filter((f) => path.basename(f) === 'page.tsx' && path.dirname(f) !== '[...missing]').sort().flatMap(pagesOf);
const MEMBER_PAGES = EVERY.filter((p) => opens('Member', p.feature) && !(Object.keys(p.params).length && ANOTHER_TEAM.test(p.address)));
const FLEET_PAGES = EVERY.filter((p) => !opens('Member', p.feature));

/** A server page's tree as Next hands it to the browser: every async component awaited where it stands. */
async function settled(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(settled));
  if (!isValidElement(node)) return node;
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (typeof type === 'function' && type.constructor.name === 'AsyncFunction') return settled(await (type as (p: unknown) => Promise<ReactNode>)(props));
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) next[k] = isValidElement(v) || Array.isArray(v) ? await settled(v as ReactNode) : v;
  return cloneElement(node, next);
}

/** The member as most are: a member, not the admin, of the one team they act for. */
const PLAIN: Me = { ...MEMBER, teams: MEMBER.teams.map((t) => ({ ...t, role: 'member' })) };
/** Whether the gateway's `/me` and Access answers are the plain member's, rewritten over the fake's. */
let plain = false;

let gateway: ChildProcess | null = null;
let base = '';
const saved = { fetch: globalThis.fetch, env: { ...process.env } };

/** The fake's answer, with the plain member's membership written over `/me` and Access when `plain` is on. */
async function answered(url: string, init: RequestInit | undefined, real: typeof fetch): Promise<Response> {
  const res = await real(url, init);
  const at = new URL(url).pathname.replace('/api/console', '');
  if (!plain || !res.ok || (at !== '/me' && at !== '/access')) return res;
  const body = at === '/me' ? PLAIN : ((a: Access): Access => ({ ...a, teams: { ...a.teams, teams: a.teams.teams.map((t) => ({ ...t, role: 'member' })) } }))(await res.json() as Access);
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeAll(async () => {
  const started = await startFakeGateway();
  gateway = started.proc;
  base = started.base;
  process.env.ZZ_GATEWAY = base;
  delete process.env.ZZ_DEV_PAT;
  const real = saved.fetch;
  // The server's reads carry the person's cookie themselves (`src/data/gateway.ts`); the browser's are relative, and
  // carry it here as the browser would. Anything else a page asks for (the live channel) is absent.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('/api/console')) {
      const headers = { ...(init?.headers as Record<string, string> | undefined), cookie: `zz_console=${jar.zz_console}` };
      return answered(`${base}${url}`, { method: init?.method, body: init?.body, headers, signal: init?.signal }, real);
    }
    if (url.startsWith(base)) return answered(url, init, real);
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}, 30_000);

afterAll(() => {
  gateway?.kill();
  globalThis.fetch = saved.fetch;
  process.env = saved.env;
});

beforeEach(() => {
  plain = false;
  jar.zz_console = 'member';
});

const onSurface = (surface: Partial<Surface>, child: ReactNode) =>
  createElement(SurfaceOverride, { surface } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, child));

/** Render `page` as Next does, with an assistant, once its reads have answered; the context it shared last, if any. */
async function open(page: Page): Promise<SharedContext | null> {
  window.history.replaceState(null, '', page.address);
  const shared: SharedContext[] = [];
  const mod = (await import(/* @vite-ignore */ path.join(DASH, page.file))) as { default: (props: object) => Promise<ReactNode> };
  const tree = await settled(await mod.default({ params: Promise.resolve(page.params), searchParams: Promise.resolve({}) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const frame = createElement(QueryClientProvider, { client }, createElement(PeriodProvider, null, createElement(Suspense, { fallback: null }, tree)));
  const share = (_text: string, context?: object) => { if (context) shared.push(context as SharedContext); };
  await act(async () => { render(onSurface({ ask: () => {}, share }, frame)); });
  // The browser's reads, answered by the fake process over HTTP.
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  return shared.at(-1) ?? null;
}

/** The rail and the palette, as the layout hands them `chromeAccess()`, at `where`; the palette left open. */
async function shell(where: string) {
  window.history.replaceState(null, '', where);
  const access = chromeAccess().catch(() => null);
  await act(async () => { render(<><WorkspaceRail access={access} /><WorkspacePalette access={access} /></>); });
  // The palette may still be open from an earlier render, which hides the rail from the accessibility tree.
  await screen.findByRole('navigation', { name: 'Main', hidden: true });
  if (!screen.queryByRole('dialog')) act(() => openCommand());
  await screen.findByRole('dialog');
}
/** The person card's two lines: the name, and the line under it. */
function card(name: string): [string, string] {
  const line = screen.getByText(name);
  return [line.textContent ?? '', line.nextElementSibling?.textContent ?? ''];
}

describe('the detector', () => {
  it('finds each thing a member\'s chrome must not carry, and leaves the two kept places alone', () => {
    const { container } = render(
      <div>
        <p>A superadmin issues a link. It is read-only here. Ask a team admin. You cannot change it. Your role is Member.</p>
        <button type="button">Resolve report</button>
        <table><caption>Your teams, and the one this browser acts for</caption><tbody><tr><th>Role</th><td>Admin</td></tr></tbody></table>
        <section><header><h2>atlas&apos;s members</h2></header><p>Who is on the team you act for, and their role.</p></section>
      </div>,
    );
    const found = findings(container);
    expect(found.filter((f) => f.startsWith('word:'))).toHaveLength(2);
    // "Ask a team admin" and "Your role", and nothing of the table or the members panel.
    expect(found.filter((f) => f.startsWith('role word:'))).toHaveLength(2);
    expect(found.filter((f) => f.startsWith('cannot:'))).toHaveLength(2);
    expect(found.filter((f) => f.startsWith('control:'))).toEqual(['control: Resolve report']);
  });

  it('finds every page a member may open, the shared lesson among them, and nothing a member is refused', () => {
    expect(MEMBER_PAGES.length).toBeGreaterThan(25);
    expect(MEMBER_PAGES.map((p) => p.address)).toContain(`/knowledge/${SHARED_TEAM}/${SHARED_LESSON.path}`);
    expect(MEMBER_PAGES.map((p) => p.address)).toContain('/access');
    expect(MEMBER_PAGES.map((p) => p.address)).toContain('/knowledge/log');
    for (const p of MEMBER_PAGES) expect(p.address, p.address).not.toMatch(/\/(?:beacon|cinder|dune)\b/);
    expect(MEMBER_PAGES.map((p) => p.address)).not.toContain('/platform/people');
  });
});

describe('as the fake gateway\'s member, their team\'s admin', () => {
  it('draws the person card\'s second line as the team they act for, and the shell carries none of it', async () => {
    for (const where of ['/', '/platform']) {
      await shell(where);
      expect(card(MEMBER.name), where).toEqual([MEMBER.name, TEAM]);
      expect(findings(), where).toEqual([]);
      cleanup();
    }
  });

  it.each(MEMBER_PAGES.map((p) => [p.address, p] as const))('%s names no role and no one who can, and its context the same', async (_address, page) => {
    const context = await open(page);
    expect(findings(), page.address).toEqual([]);
    expect(context, `${page.address} shared no context`).not.toBeNull();
    expect(contextWords(context!), `${page.address}'s context`).toEqual([]);
  });

  it('keeps their own role in Access\'s table of their teams, and draws them the members panel of the team they administer', async () => {
    await open(MEMBER_PAGES.find((p) => p.address === '/access')!);
    const [table] = keptPlaces(document.body);
    expect(within(table as HTMLElement).getByText('Admin')).toBeInTheDocument();
    expect(membersPanel().map((s) => s.querySelector('h2')?.textContent)).toEqual([`${TEAM}'s members`]);
  });
});

describe('as the same member with their membership answered as member', () => {
  it('draws no members panel on Access, and their own role in their table of teams', async () => {
    plain = true;
    await open(MEMBER_PAGES.find((p) => p.address === '/access')!);
    expect(membersPanel()).toEqual([]);
    expect(within(keptPlaces(document.body)[0] as HTMLElement).getByText('Member')).toBeInTheDocument();
  });

  it('draws the shell with the team they act for and none of it', async () => {
    plain = true;
    await shell('/');
    expect(card(MEMBER.name)).toEqual([MEMBER.name, TEAM]);
    expect(findings()).toEqual([]);
  });

  it.each(MEMBER_PAGES.map((p) => [p.address, p] as const))('%s still names no role and no one who can', async (_address, page) => {
    plain = true;
    const context = await open(page);
    expect(findings(), page.address).toEqual([]);
    expect(membersPanel(), page.address).toEqual([]);
    expect(contextWords(context!), `${page.address}'s context`).toEqual([]);
  });
});

describe('as the superadmin', () => {
  beforeEach(() => { jar.zz_console = 'superadmin'; });

  it('draws their own fields: the fleet\'s destinations, and the team they act for on the card', async () => {
    await shell('/platform');
    const rail = within(screen.getByRole('navigation', { name: 'Main', hidden: true })).getAllByRole('link', { hidden: true }).map((l) => l.textContent);
    for (const label of ['Teams', 'People', 'Audit']) expect(rail).toContain(label);
    expect(card('Ava Lindqvist')[1]).toBe('atlas');
  });

  it('opens the pages a member is refused, whose controls the detector finds', async () => {
    const found = new Set<string>();
    for (const page of FLEET_PAGES) {
      await open(page);
      for (const f of findings()) found.add(f.replace(/^control: (\w+).*$/, 'control: $1'));
      cleanup();
    }
    for (const c of ['Resolve', 'Archive', 'Deactivate']) expect([...found], c).toContain(`control: ${c}`);
  });

  it('is drawn the members panel of the team they administer', async () => {
    await open(EVERY.find((p) => p.address === '/access')!);
    expect(membersPanel().map((s) => s.querySelector('h2')?.textContent)).toEqual(['atlas\'s members']);
  });
});

/** The record each detail view tool opens, one of the member's own team or the shared shelf. */
const INPUTS: Record<string, Record<string, string>> = {
  initiative: { team: TEAM, slug: '2026-09-28-search-relevance' }, document: { team: TEAM, slug: '2026-09-28-search-relevance', path: 'spec.md' },
  knowledge_node: { team: SHARED_TEAM, path: SHARED_LESSON.path }, search: { q: 'shelf lesson' }, plugin: { plugin: 'sdlc' },
  skill: { plugin: 'sdlc', skill: 'sdlc-spec' }, release: { version: '0.97.0' },
};

/** The page's prepared query as the route hands it to the caller (`app/api/assistant/route.ts`), or none. */
async function handedExplore(v: ViewTool, readable: Set<string>): Promise<HandedExplore | undefined> {
  if (!Object.values(v.explore.sources).some((s) => readable.has(s.collection))) return undefined;
  const wide = await may(FLEET);
  return { view: v, rights: { readable, hidden: (name) => (wide ? [] : FLEET_FIELDS[name] ?? []) }, io: { aggregate, read: readCollection, today: dayOf(clock()) }, page: v.page };
}
const guard = { authorize: async () => false, invalidate: () => {} };
const writer = { write: () => {}, merge: () => {}, onError: undefined } as unknown as Parameters<typeof assistantTools>[1];
/** A tool's input schema as the model is offered it. */
const schemaOf = (s: unknown): unknown => (s instanceof z.ZodType ? z.toJSONSchema(s) : (s as { jsonSchema: unknown }).jsonSchema);

describe('every string the assistant is handed for the member', () => {
  it('holds none of the words, in each tool, prepared query and view context the route hands them', async () => {
    const scope = await resolveAccess();
    const readable = new Set((await Promise.all(collections.map(async (c) => ((await can(scope, c.name, 'read')) ? c.name : null)))).filter((n): n is string => n !== null));
    const views = (await Promise.all(viewTools.map(async (v) => ((await may(v.needs)) ? v : null)))).filter((v): v is ViewTool => v !== null);
    expect(views.length).toBeGreaterThan(15);
    expect(views.map((v) => v.name)).not.toContain('people');

    const strings: [where: string, text: string][] = [];
    const found: string[] = [];
    /** A tool as the model is offered it: its description and its input schema. */
    const offered = (tools: ReturnType<typeof assistantTools>['tools']) => {
      for (const [name, t] of Object.entries(tools)) strings.push([name, `${t.description ?? ''} ${JSON.stringify(schemaOf(t.inputSchema))}`]);
    };
    // Every view tool the route hands the member, which every page hands alike.
    offered(assistantTools([], writer, guard, views).tools);
    for (const v of views) {
      // The page's own prepared query, `explore_<view>`, where the route hands one.
      const explore = await handedExplore(v, readable);
      if (explore) offered(assistantTools([], writer, guard, [], explore).tools);
      // The prepared query's own words, which its answers carry: a source over a collection the member may not read is
      // never handed to them.
      for (const [name, s] of Object.entries(v.explore.sources).filter(([, s]) => readable.has(s.collection))) {
        strings.push([`explore_${v.name}.${name}`, [s.cannot, ...Object.values(s.measures).flatMap((m) => [m.label, m.definition]), JSON.stringify(s.labels ?? {}), JSON.stringify(s.none ?? {})].join(' ')]);
      }
      const { context } = await v.read(INPUTS[v.name] ?? {});
      found.push(...contextWords(context).map((h) => `view_${v.name}'s context: ${h}`));
    }
    for (const r of PREPARED.filter((r) => readable.has(r.name))) strings.push([`prepared ${r.name}`, `${r.label} ${r.description} ${'none' in r.drill ? r.drill.none : ''}`]);

    found.push(...strings.flatMap(([where, text]) => wordsIn(text).map((h) => `${where}: ${h}`)));
    expect(found).toEqual([]);
  });

  it('holds none of the words in a search that finds a document on the shared shelf', () => {
    const hit = (over: Partial<SearchHit>): SearchHit => ({
      kind: 'node', team: SHARED_TEAM, shelf: 'platform', initiative: null, path: SHARED_LESSON.path, title: SHARED_LESSON.title, type: 'process', status: 'adopted',
      superseded_by: null, tags: [], evidence: [], cited_elsewhere: 2, flow: null, outcome: null, approved_by: null, approved_at: null, updated: null,
      excerpt: 'Search the **shelf** first.', score: 0.02, via: ['lexical'], ...over,
    });
    const answer: SearchAnswer = {
      team: TEAM, query: 'shelf', ranked_total: 2, returned: 2, withheld: 0, superseded_in_results: 0, note: null, recall: null,
      results: [hit({}), hit({ kind: 'document', initiative: '2026-09-01-platform-notes', path: 'spec.md', title: 'Platform notes', status: 'approved' })],
    };
    const t = contextText(searchContext(answer, { updatedAt: '2026-10-15T00:00:00Z', now: new Date('2026-10-15T00:00:00Z') }));
    expect(t).toContain('has no page this console opens');
    expect(wordsIn(t)).toEqual([]);
  });
});
