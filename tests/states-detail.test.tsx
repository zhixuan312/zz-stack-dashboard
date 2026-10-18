import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  redirect: (to: string) => { throw new Error(`redirected to ${to}`); },
}));

/** The skill page's gate, let through, and its four reads, answered without a gateway: the page is what is under test. */
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), gate: async () => null }));
vi.mock('../app/(dash)/plugins/read-plugins', () => ({
  readSkill: async (plugin: string, skill: string) => ({
    catalog: { state: 'slow', path: '/plugins' },
    skills: { state: 'slow', path: `/plugins/${plugin}/skills` },
    detail: { state: 'slow', path: `/skills/${skill}` },
    text: { state: 'slow', path: `/plugins/${plugin}/skills/${skill}` },
  }),
}));

/**
 * The skill page's client module as the console's server sees it: every export is a client reference, which the server
 * may render as an element or hand to one as a prop, and never call. Calling one is what React's server refuses with
 * error #441, which drew the error page for every skill; vitest has no such boundary, so this module draws it.
 */
vi.mock('@/views/pages/skill', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(real).map((name) => {
    const reference = () => { throw new Error(`Attempted to call ${name}() from the server but ${name} is on the client.`); };
    Object.defineProperty(reference, 'name', { value: name });
    return [name, reference];
  }));
});

import type { DocumentDetail, KnowledgeBody } from '@/lib/api-shapes';
import type { DocumentRead } from '@/views/document-read';
import { INITIATIVES_BOUND_MS } from '@/views/initiatives-context';
import { HOME_BOUND_MS } from '@/views/home-context';
import { KNOWLEDGE_BOUND_MS, type ServerRead } from '@/views/knowledge-context';
import { STATUS_BOUND_MS } from '@/views/platform-status-context';
import { DocumentView } from '@/views/pages/document';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { SkillTabs, SkillView } from '@/views/pages/skill';
import PluginSkillPage from '../app/(dash)/plugins/[plugin]/[skill]/page';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * The detail pages Task I-126's states check found drawing something other than an explicit state (Task I-133, AC-2.9):
 * a skill page whose view the console's server chose by calling into a client module, a document drawing a skeleton
 * beside its error and its not-found state, and a lesson with no text drawing a blank panel. Each is drawn from the fake
 * gateway's own answer in that state, asked as `pnpm verify`'s sweep asks it (`zz_console=<person>+<state>`). And the
 * three server reads whose bound was the spec's five seconds itself, which leaves the page no time to draw what it says.
 */
let base = '';
let stop = () => {};
beforeAll(async () => {
  const gateway = await startFakeGateway();
  base = gateway.base;
  stop = () => gateway.proc.kill();
});
afterAll(() => stop());
afterEach(() => vi.unstubAllGlobals());

const realFetch = globalThis.fetch;
const AT = '2026-10-18T00:00:00Z';
const NODE = 'nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md';
const SLUG = '2026-09-28-search-relevance';

/** One read as the console's server makes it, for the member in `state`. */
async function served<T>(state: string, path: string): Promise<ServerRead<T>> {
  const res = await realFetch(`${base}/api/console${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: `zz_console=member+${state}` } });
  const body = await res.json() as T & { error?: string };
  return res.ok ? { state: 'ok', data: body, at: AT } : { state: 'failed', reason: body.error ?? `HTTP ${res.status}` };
}

/** The browser's reads, sent to the fake gateway for the member in `state`. */
function browser(state: string) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(`${base}${String(input)}`, { method: init?.method, body: init?.body, headers: { accept: 'application/json', cookie: `zz_console=member+${state}` } })));
}

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
/** Nothing on the page says it is still on its way: no busy region and no skeleton. */
const noPlaceholder = () => {
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  expect(document.querySelectorAll('.shimmer')).toHaveLength(0);
};

/** Every element in a server component's answer, props included, without rendering any of them. */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...Object.values(node.props).flatMap((v) => elements(v as ReactNode))];
}

describe('a skill page, on the console\'s server', () => {
  it.each([
    [undefined, 'cost'], ['read', 'read'], ['references', 'references'], ['anything else', 'cost'], [['read', 'cost'], 'read'],
  ])('?view=%s draws the %s view without calling a client module', async (asked, view) => {
    const page = await PluginSkillPage({
      params: Promise.resolve({ plugin: 'sdlc', skill: 'sdlc-plan' }),
      searchParams: Promise.resolve(asked === undefined ? {} : { view: asked }),
    });
    const drawn = elements(page);
    const viewEl = drawn.find((e) => e.type === SkillView);
    const tabs = drawn.find((e) => e.type === SkillTabs);
    expect(viewEl?.props.view).toBe(view);
    expect(tabs?.props.view).toBe(view);
    expect(drawn.some((e) => e.props.title === 'sdlc-plan')).toBe(true);
  });
});

describe('a document, read on the console\'s server', () => {
  const draw = async (path: string, read: DocumentRead) => {
    await act(async () => { mount(<DocumentView team="atlas" slug={SLUG} rel={path} served={read} teamPage={false} />); });
  };

  it('whose read failed draws the failure alone, with no skeleton beside it', async () => {
    browser('error');
    await draw('spec.md', await served<DocumentDetail>('error', `/document/atlas/${SLUG}/spec.md`));
    expect(await screen.findByText('This document did not load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    noPlaceholder();
  });

  it('that does not exist says so alone, with no skeleton beside it', async () => {
    browser('normal');
    const read = await served<DocumentDetail>('normal', `/document/atlas/${SLUG}/no-such-document.md`);
    expect(read.state).toBe('failed');
    await draw('no-such-document.md', { state: 'missing', reason: read.state === 'failed' ? read.reason : '' });
    expect(await screen.findByText('This document does not exist')).toBeInTheDocument();
    noPlaceholder();
  });
});

describe('a knowledge node', () => {
  it('with no text says it has none, and draws no placeholder for a body that is not coming', async () => {
    browser('empty');
    const read = await served<KnowledgeBody>('empty', `/knowledge/atlas/${NODE}`);
    expect(read.state === 'ok' && read.data.body).toBe('');
    await act(async () => { mount(<KnowledgeNodeView read={read} team="atlas" rel={NODE} />); });
    await waitFor(() => expect(text()).toMatch(/no text|nothing (is )?written|is empty/i));
    expect(document.querySelectorAll('.shimmer')).toHaveLength(0);
  });
});

describe('the server reads\' bounds', () => {
  it.each([['Status', STATUS_BOUND_MS], ['Home', HOME_BOUND_MS], ['Knowledge', KNOWLEDGE_BOUND_MS]])(
    '%s waits as long as every other page does, half a second under the spec\'s five', (_, bound) => {
      expect(INITIATIVES_BOUND_MS).toBe(4_500);
      expect(bound).toBe(INITIATIVES_BOUND_MS);
    },
  );
});
