import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import type { People, Usage } from '@/lib/fleet-shapes';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * Platform's pages in the states no other test drew (Task I-126, AC-2.9): People and Usage on a fresh deployment, each
 * drawn from the fake gateway's own answer in the `empty` state, asked as `pnpm verify`'s sweep asks it, with the
 * session value `superadmin+empty` (scripts/fake-gateway/states-partial.ts). Each says it is empty in words, draws no
 * figure where the answer holds none, and is not drawn as a failure.
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

/** One read as the console's server makes it, for the superadmin in `state`. */
async function served<T>(state: string, path: string): Promise<T> {
  const res = await realFetch(`${base}/api/console${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: `zz_console=superadmin+${state}` } });
  expect(res.status, path).toBe(200);
  return await res.json() as T;
}

/** The browser's reads, sent to the fake gateway for the superadmin in `state`. */
function browser(state: string) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(`${base}${String(input)}`, { method: init?.method, body: init?.body, headers: { accept: 'application/json', cookie: `zz_console=superadmin+${state}` } })));
}

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider><div data-scroll-region>{ui}</div></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 5_000 });
/** The figures the tiles draw, as their text. */
const figures = () => [...document.querySelectorAll('[data-value]')].map((el) => (el.textContent ?? '').trim());

describe('People on a fresh deployment', () => {
  it('says nobody has been added, and draws no sign-in figure for a week before the record began', async () => {
    browser('empty');
    const path = peoplePath(PEOPLE_DEFAULTS);
    const data = await served<People>('empty', path);
    expect(data).toMatchObject({ people: [], total: 0 });
    mount(<PlatformPeopleView served={{ state: 'ok', path, data }} />);
    await settled();
    expect(text()).toMatch(/No (one|person|people)|Nobody/);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelectorAll('section[aria-label="People"] tbody tr')).toHaveLength(0);
    // The week's sign-ins are unrecorded, not none: whatever stands in their tile, it is not a zero.
    expect(data.tiles.signInsLastWeek.figure.value).toBeNull();
    expect(figures().filter((f) => /^0(\.0+)?%?$/.test(f)).length).toBeLessThanOrEqual(3);
  });
});

describe('Usage on a fresh deployment', () => {
  it('says no call is recorded, and draws no figure for a week that holds none', async () => {
    browser('empty');
    const usage = await served<Usage>('empty', '/platform/usage');
    expect(usage.tiles.state === 'ok' && usage.tiles.data.calls.last.figure).toEqual({ value: null, why: 'no_data' });
    mount(<PlatformUsageView read={{ state: 'ok', usage }} />);
    await settled();
    expect(text()).toMatch(/No (call|data|tool|week|refusal)|Nothing|not recorded/i);
    expect(screen.queryByRole('alert')).toBeNull();
    // Every figure the answer holds is unrecorded, so no tile draws a zero for one.
    expect(figures().filter((f) => /^0(\.0+)?%?$/.test(f))).toEqual([]);
  });
});
