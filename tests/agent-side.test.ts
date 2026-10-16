import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import fs from 'node:fs';
import path from 'node:path';
import { Suspense, cloneElement, createElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SurfaceOverride, type Surface } from '@/components/base/surface';
import { AskAbout } from '@/components/patterns/ask-about';
import { Panel } from '@/console/panel';
import { PeriodProvider } from '@/console/period';
import { collections } from '@/data/collections';
import { FEATURES, type FeatureId } from '@/data/features';
import { ConsoleModeProvider } from '@/lib/api';
import type { SharedContext } from '@/lib/shared-context';
import { viewTools } from '@/views/tools';
import config from '../scripts/verify.config.ts';

/**
 * Every page of the console is designed for a person and for the agent working with them (the console's brief, "A person
 * and their agent, both first-class"). This holds every page under `app/(dash)` to that, with no list of exceptions: a
 * page found here is a page held to it, so a page that lands without its agent side fails the gate.
 *
 * For each page this asserts three things:
 * - it shares a context with data in it, once its reads have answered;
 * - that context's view has an assistant read: a `view_<name>` tool needing what the page's gate needs, or a
 *   `query_<name>` collection;
 * - it renders an Ask (ZZ Meridian's `AskAbout`) in the head of the card it sits on when the console offers an
 *   assistant, and none when it does not. Only the pages `MASTHEAD_UNTIL` names may carry it in the masthead instead,
 *   each until the reason it gives is gone.
 *
 * Each page is rendered as Next renders it: its own default export, with the gate let through (`tests/page-gate.test.ts`
 * holds the gate), its async parts awaited, and every read answered by the fake gateway `pnpm verify` serves, spawned
 * here as the superadmin, who may open every page. A dynamic page is opened at the first of verify's `detailRoutes`
 * its route matches, so a new detail page needs an address there before it can be held to this.
 */
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), gate: async () => null }));

const ROOT = path.resolve(import.meta.dirname, '..');
const DASH = path.join(ROOT, 'app/(dash)');

type Page = { file: string; route: string; feature: FeatureId; address: string; params: Record<string, string | string[]> };

/** The route a page file serves: route groups dropped, a segment `[x]` one name, `[...x]` the rest of the path. */
const routeOf = (file: string) => `/${path.dirname(file).split(path.sep).filter((s) => s !== '.' && !/^\(.*\)$/.test(s)).join('/')}`;
const segmentRe = (seg: string) => (seg.startsWith('[...') ? '(.+)' : seg.startsWith('[') ? '([^/]+)' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

function pageOf(file: string): Page {
  const route = routeOf(file);
  const src = fs.readFileSync(path.join(DASH, file), 'utf8');
  const feature = /\bgate\('([\w-]+)'\)/.exec(src)?.[1] as FeatureId | undefined;
  if (!feature) throw new Error(`${file} asks no gate, so no feature names its assistant read`);
  const segs = route.split('/').filter(Boolean);
  if (!segs.some((s) => s.startsWith('['))) return { file, route, feature, address: route, params: {} };
  const re = new RegExp(`^/${segs.map(segmentRe).join('/')}$`);
  const address = config.detailRoutes.find((r) => re.test(r));
  if (!address) throw new Error(`${file}: no address in scripts/verify.config.ts's detailRoutes matches ${route}`);
  const values = re.exec(address)!.slice(1);
  const names = segs.filter((s) => s.startsWith('['));
  const params = Object.fromEntries(names.map((n, i) => (n.startsWith('[...') ? [n.slice(4, -1), values[i].split('/')] : [n.slice(1, -1), values[i]])));
  return { file, route, feature, address, params };
}

const PAGES: Page[] = (fs.readdirSync(DASH, { recursive: true }) as string[]).filter((f) => path.basename(f) === 'page.tsx').sort().map(pageOf);

/**
 * A server page's tree, as Next would hand it to the browser: every async component it places is awaited where it
 * stands, through children and through any prop that holds an element (`PageFrame`'s `meta`).
 */
async function settled(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(settled));
  if (!isValidElement(node)) return node;
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (typeof type === 'function' && type.constructor.name === 'AsyncFunction') return settled(await (type as (p: unknown) => Promise<ReactNode>)(props));
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) next[k] = isValidElement(v) || Array.isArray(v) ? await settled(v as ReactNode) : v;
  return cloneElement(node, next);
}

let gateway: ChildProcess | null = null;
let base = '';
const saved = { fetch: globalThis.fetch, env: { ...process.env } };

beforeAll(async () => {
  const started = await startFakeGateway();
  gateway = started.proc;
  base = started.base;
  // The server's reads go to the gateway by its address and with no credential, which the fake answers as the superadmin.
  process.env.ZZ_GATEWAY = base;
  delete process.env.ZZ_DEV_PAT;
  // The browser's reads are relative (`/api/console/...`); anything else a page asks for (the live channel) is absent here.
  const real = saved.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('/api/console')) return real(`${base}${url}`, { headers: init?.headers, signal: init?.signal });
    if (url.startsWith(base)) return real(url, init);
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}, 30_000);

afterAll(() => {
  gateway?.kill();
  globalThis.fetch = saved.fetch;
  process.env = saved.env;
});

/** `child` on the console's surface as `surface` sets it, with the tooltips Ask is drawn in. */
const onSurface = (surface: Partial<Surface>, child: ReactNode) =>
  createElement(SurfaceOverride, { surface } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, child));

/** Render `page` on the console's surface, with an assistant when `ask` is given, and wait for its context to carry data. */
async function open(page: Page, ask?: (question: string) => void): Promise<SharedContext> {
  window.history.replaceState(null, '', page.address);
  const shared: SharedContext[] = [];
  const share = (_text: string, context?: object) => { if (context) shared.push(context as SharedContext); };
  const mod = (await import(/* @vite-ignore */ path.join(DASH, page.file))) as { default: (props: object) => Promise<ReactNode> };
  const tree = await settled(await mod.default({ params: Promise.resolve(page.params), searchParams: Promise.resolve({}) }));
  // The console's providers a page stands in, as `src/console/providers.tsx` and Meridian's `Providers` mount them.
  const frame = createElement(ConsoleModeProvider, null, createElement(PeriodProvider, null, createElement(Suspense, { fallback: null }, tree)));
  // Inside an awaited `act`: a detail page suspends on its params until they resolve.
  await act(async () => { render(onSurface(ask ? { ask, share } : { share }, frame)); });
  await waitFor(() => expect(shared.at(-1)?.facts.length ?? 0, `${page.route} shared no context with data`).toBeGreaterThan(0), { timeout: 10_000 });
  return shared.at(-1)!;
}

const ASK = /^Ask: /;

/**
 * The pages whose protagonist card has no head that can hold an action yet, each with what will give it one. Every other
 * page is held to the card's head; delete an entry the day its reason is gone.
 */
const MASTHEAD_UNTIL: Record<string, string> = {
  '/platform': 'Status is one ZZ Meridian MetricTile, which has no actions; Task I-28 rebuilds it on the Featured metric',
  '/settings': 'every section is a ZZ Meridian FormSection, which has no actions (zz-meridian issue #37)',
};

/**
 * Whether an Ask sits in the head of the card it is on (a Panel's or a table's head, a Featured metric's head row, a
 * list's filter bar), or, where `masthead` allows it, in the page's masthead: never inside a card's body, where it
 * would read as asking about one row.
 */
function inAHead(ask: HTMLElement, masthead = false): boolean {
  const frame = ask.closest('.card, section, header');
  if (!frame) return false;
  if (frame.tagName === 'HEADER') return masthead;
  return !!frame.firstElementChild?.contains(ask);
}

describe('every page of the console carries its agent side', () => {
  it('tells an Ask in a card\'s head from one in its body', () => {
    const ask = createElement(AskAbout, { question: 'What does this card show?' });
    const panel = (props: Omit<ComponentProps<typeof Panel>, 'children'>, body: ReactNode) => createElement(Panel, props as ComponentProps<typeof Panel>, body);
    const { unmount } = render(onSurface({ ask: () => {} }, panel({ title: 'Head', actions: ask }, 'body')));
    expect(inAHead(screen.getByRole('button', { name: ASK }))).toBe(true);
    unmount();
    render(onSurface({ ask: () => {} }, panel({ title: 'Body' }, ask)));
    expect(inAHead(screen.getByRole('button', { name: ASK }))).toBe(false);
  });

  it('finds every page, each gated on a feature the console has', () => {
    expect(PAGES.length).toBeGreaterThan(0);
    for (const p of PAGES) expect(FEATURES[p.feature], `${p.file} gates on ${p.feature}`).toBeDefined();
  });

  it.each(PAGES.map((p) => [p.route, p] as const))('%s shares a context its feature has an assistant read for, and asks about its protagonist card', async (_route, page) => {
    const ask = vi.fn();
    const context = await open(page, ask);
    const tool = viewTools.find((t) => t.name === context.view);
    const collection = collections.find((c) => c.name === context.view);
    expect(tool ?? collection, `no view_${context.view} tool and no query_${context.view} collection`).toBeTruthy();
    if (tool) expect(tool.needs, `view_${tool.name} needs what the page's gate needs`).toBe(FEATURES[page.feature].needs);

    const [first] = await screen.findAllByRole('button', { name: ASK }, { timeout: 10_000 });
    expect(inAHead(first, page.route in MASTHEAD_UNTIL), `${page.route}'s Ask is in no card's head`).toBe(true);
    const question = first.getAttribute('aria-label')!.replace(ASK, '');
    expect(question.length).toBeGreaterThan(10);
    fireEvent.click(first);
    expect(ask).toHaveBeenCalledWith(question);
  });

  it.each(PAGES.map((p) => [p.route, p] as const))('%s renders no Ask when the console offers no assistant', async (_route, page) => {
    await open(page);
    expect(screen.queryAllByRole('button', { name: ASK })).toEqual([]);
  });
});
