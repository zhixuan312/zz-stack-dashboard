import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/platform',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', () => ({ gatewayGet: gateway.get }));

import { nav, workspaces } from '@/app.config';
import { FEATURES } from '@/data/features';
import { MAIN_ROLES, effective, whoCan } from '@/data/roles';
import type { PeriodFigure } from '@/lib/platform-shapes';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { contextText } from '@/lib/shared-context';
import { PlatformStatusAsOf, PlatformStatusView } from '@/views/pages/platform-status';
import { STATUS_BOUND_MS, platformStatusContext, statusRead, type StatusRead } from '@/views/platform-status-context';
import { navOf, workspaceOf } from '@/views/workspaces';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { readStatus } from '../app/(dash)/platform/read-status';

/**
 * The Platform workspace's Status page as far as Phase 0 builds it: one tile, malformed calls per 1,000 real-work calls
 * in the last whole week, drawn from the read the page makes on the console's server. The figures come from the fake
 * gateway's own answer, the one `pnpm verify` serves the page, and the words are the contract's, written out here.
 */
const MEASURE = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!;
const LAST = MEASURE.last!;
const week = (state: 'standing' | 'insufficient' | 'no_data'): PeriodFigure =>
  MEASURE.weeks.find((w) => w.window.complete && (state === 'standing' ? w.figure.why === null : w.figure.why === state))!;
const ok = (last: PeriodFigure | null): StatusRead => ({ state: 'ok', meta: PLATFORM_STATUS.meta, last });
/** The view as the shell holds it: inside the tooltip provider the tile's info button needs. */
const draw = (read: StatusRead) => render(<Tooltip.Provider><PlatformStatusView read={read} /></Tooltip.Provider>);

beforeEach(() => router.refresh.mockReset());
afterEach(() => vi.useRealTimers());

describe('who opens Status', () => {
  it('needs platform:read, which both roles hold', () => {
    expect(FEATURES['platform-status']).toEqual({ title: 'Status', needs: 'platform:read' });
    expect(whoCan('platform:read')).toEqual(['Superadmin', 'Member']);
    for (const role of MAIN_ROLES) expect(effective(role).has('platform:read'), role).toBe(true);
  });

  it('is the Platform workspace, its one destination Status in Health', () => {
    expect(workspaces.platform).toEqual({ label: 'Platform', audience: 'The platform itself', homeHref: '/platform' });
    expect(navOf('platform').map((g) => ({ label: g.label, items: g.items.map((i) => [i.label, i.href]) }))).toEqual([{ label: 'Health', items: [['Status', '/platform']] }]);
    const status = nav.flatMap((g) => g.items).find((i) => i.href === '/platform')!;
    expect(status.needs).toBe(FEATURES['platform-status'].needs);
    expect(workspaceOf('/platform')).toBe('platform');
    expect(workspaceOf('/')).toBe('main');
  });
});

describe('the tile', () => {
  it('reads the last whole week: the rate to one decimal place, its counts in words and the week', () => {
    draw(statusRead(PLATFORM_STATUS));
    expect(screen.getByText('Malformed calls per 1,000')).toBeInTheDocument();
    const figure = (1000 * LAST.numerator! / LAST.denominator!).toFixed(1);
    expect(document.querySelector('.t-figure')?.textContent).toBe(figure);
    expect(screen.getByText(`${LAST.numerator} of ${LAST.denominator} real-work calls, week of ${formatDay(LAST.window.from)}`)).toBeInTheDocument();
    expect(screen.queryByText('Too few calls to compare')).toBeNull();
  });

  it('draws a week too small to judge with its value, its counts and that it is too few to compare', () => {
    const small = week('insufficient');
    draw(ok(small));
    expect(document.querySelector('.t-figure')?.textContent).toBe((1000 * small.numerator! / small.denominator!).toFixed(1));
    expect(screen.getByText(`${small.numerator} of ${small.denominator} real-work calls, week of ${formatDay(small.window.from)}`)).toBeInTheDocument();
    expect(screen.getByText('Too few calls to compare')).toBeInTheDocument();
  });

  it('says a week with no calls had none, with no number', () => {
    const none = week('no_data');
    const { container } = draw(ok(none));
    expect(screen.getByText('No calls that week')).toBeInTheDocument();
    expect(container.querySelector('.t-figure')).toBeNull();
    expect(container.textContent).not.toMatch(/real-work calls|\d+\.\d/);
    expect(screen.getByText(`Week of ${formatDay(none.window.from)}`)).toBeInTheDocument();
  });

  it('draws nothing of the read\'s other parts, and no verdict', () => {
    const { container } = draw(statusRead(PLATFORM_STATUS));
    expect(container.textContent).not.toMatch(/need|attention|door|running|better|worse|improved|worsened|operational|healthy/i);
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});

describe('a read that brought no figure', () => {
  const cases: [StatusRead, string][] = [
    [{ state: 'failed' }, "The platform's status did not load"],
    [statusRead({ ...PLATFORM_STATUS, measures: [] }), "The platform's status did not include this figure"],
    [{ state: 'slow' }, "The platform's status is unavailable"],
  ];
  for (const [read, title] of cases) {
    it(`is the error state for ${read.state}, naming the platform's status, with Retry`, () => {
      const { container } = draw(read);
      expect(screen.getByRole('alert')).toHaveTextContent(title);
      expect(container.textContent).not.toMatch(/Malformed calls per 1,000|\d+\.\d/);
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  }

  it('says the slow read was bounded, never an endless wait', () => {
    draw({ state: 'slow' });
    expect(screen.getByRole('alert')).toHaveTextContent(`It did not answer within ${STATUS_BOUND_MS / 1000} seconds`);
  });
});

describe('the as-of line', () => {
  it("is the read's own cutoff through the console's date formatter", () => {
    render(<PlatformStatusAsOf read={statusRead(PLATFORM_STATUS)} />);
    expect(screen.getByText(`As of ${formatDateTime(PLATFORM_STATUS.meta.asOf)}`)).toBeInTheDocument();
  });

  it('is not drawn when there is no read to date', () => {
    const { container } = render(<PlatformStatusAsOf read={{ state: 'failed' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('what the assistant is told', () => {
  it('is the same figure with the same words', () => {
    const text = contextText(platformStatusContext(statusRead(PLATFORM_STATUS)));
    const figure = (1000 * LAST.numerator! / LAST.denominator!).toFixed(1);
    expect(text).toContain(`- Malformed calls per 1,000: ${figure}, ${LAST.numerator} of ${LAST.denominator} real-work calls, week of ${formatDay(LAST.window.from)}.`);
    expect(text).toContain(`As of ${formatDateTime(PLATFORM_STATUS.meta.asOf)}`);
    expect(text).not.toMatch(/improved|worsened|better than|worse than/i);
  });

  it('says when a week is too small to compare, and when nothing was read', () => {
    expect(contextText(platformStatusContext(ok(week('insufficient'))))).toContain('Too few calls to compare');
    const failed = contextText(platformStatusContext({ state: 'slow' }));
    expect(failed).toContain("The platform's status is unavailable");
    expect(failed).not.toContain('Facts:');
  });
});

describe('the read on the server', () => {
  it('asks the gateway for the status and reduces it to the one measure', async () => {
    gateway.get.mockResolvedValueOnce(PLATFORM_STATUS);
    expect(await readStatus()).toEqual({ state: 'ok', meta: PLATFORM_STATUS.meta, last: LAST });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/status');
  });

  it('is failed when the gateway refuses, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new Error("could not read the platform's status"));
    expect(await readStatus()).toEqual({ state: 'failed' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const read = readStatus();
    await act(async () => { await vi.advanceTimersByTimeAsync(STATUS_BOUND_MS - 1); });
    let settled: StatusRead | null = null;
    void read.then((r) => { settled = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(settled).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(await read).toEqual({ state: 'slow' });
  });
});
