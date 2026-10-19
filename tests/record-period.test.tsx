import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, Suspense, use, useEffect, useInsertionEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The work of one press of Record's period (Task I-148, AC-8.7). Measured on the phone (`scripts/vitals.ts`, Wave 5's
 * timed run #3676): the press drew the control at once, and the navigation's new tree committed in its transition, but
 * the page drew the new period only when the address readers were told the address had moved. That announcement is a
 * store's, so React renders what it changes synchronously, inside the task that flushes the navigation's effects: the
 * whole record, every chart of it, at once, in a long animation frame of 88 ms (script 54 ms by MessagePort.onmessage).
 * Here that task is marked: everything rendered between the announcement and the end of its task is the frame's work.
 */
const log = vi.hoisted(() => ({ entries: [] as string[] }));
vi.mock('@/lib/address', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/address')>();
  return {
    ...real,
    announceAddress: () => {
      log.entries.push('announced');
      real.announceAddress();
      // React renders a store's change before the task's microtasks run, so this lands after everything that render drew.
      queueMicrotask(() => log.entries.push('its task ended'));
    },
  };
});
/** Every chart the record draws, counted as it renders and drawn as the release draws it. */
function counted<M extends Record<string, unknown>>(real: M, name: keyof M & string): M {
  const Real = real[name] as (p: object) => React.ReactNode;
  return { ...real, [name]: (p: object) => { log.entries.push(name); return createElement(Real, p); } };
}
vi.mock('@/components/charts/trend-chart', async (importOriginal) => counted(await importOriginal<typeof import('@/components/charts/trend-chart')>(), 'TrendChart'));
vi.mock('@/components/charts/column-chart', async (importOriginal) => counted(await importOriginal<typeof import('@/components/charts/column-chart')>(), 'ColumnChart'));
vi.mock('@/components/charts/bar-list', async (importOriginal) => counted(await importOriginal<typeof import('@/components/charts/bar-list')>(), 'BarList'));
vi.mock('@/components/charts/heatmap', async (importOriginal) => counted(await importOriginal<typeof import('@/components/charts/heatmap')>(), 'Heatmap'));

/** The router: a replace is handed to the console below, which navigates as Next does. */
const router = vi.hoisted(() => ({ replace: (_url: string) => {}, push() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => router,
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));

import { recordText } from '@/console/record-text';
import type { RecordRead } from '@/lib/work-shapes';
import { RecordActions, RecordView } from '@/views/pages/record';
import { filtersOf, periodLine, recordPath, type RecordServed } from '@/views/record-context';
import { ME } from '../scripts/fake-gateway/people.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

const answer = (q: string) => record(ME, new URLSearchParams(q))[1] as RecordRead;
/** The console's server's read of a page address, as `readRecord` answers it. */
const serverRead = (url: string): Extract<RecordServed, { state: 'ok' }> => {
  const path = recordPath(filtersOf(Object.fromEntries(new URL(url, 'http://console.test').searchParams)));
  return { state: 'ok', path, data: answer(path.split('?')[1]), team: 'atlas' };
};
/** A read already answered, as React reads one it has seen settle. */
const answered = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: 'fulfilled', value });

/**
 * The page in the console as Next runs it: a replace is a navigation inside the press's transition, whose new tree
 * waits for the console's server's read of the new address, and the address moves when that tree commits (Next writes
 * the history in the commit), so the press's own transition stays pending until then.
 */
function Console({ start }: { start: string }) {
  const [at, setAt] = useState(() => ({ url: start, read: answered(serverRead(start)) as Promise<RecordServed> }));
  useEffect(() => {
    router.replace = (url) => setAt({ url, read: new Promise((r) => setTimeout(() => r(serverRead(url)), 20)) });
  }, []);
  useInsertionEffect(() => {
    if (`${window.location.pathname}${window.location.search}` !== at.url) window.history.replaceState(null, '', at.url);
  }, [at.url]);
  const served = use(at.read);
  return <><RecordActions served={served} /><RecordView served={served} /></>;
}

const actEnvironment = (on: boolean) => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = on; };
/** Lets the browser run its tasks until `done`, as a person waits: no act, so React schedules as it does in a page. */
async function until(done: () => boolean) {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(done()).toBe(true);
}
const chosen = () => document.querySelector('[role="radio"][aria-checked="true"]')?.textContent;
const firstSlice = () => document.querySelector('[data-slice]')?.textContent ?? '';
const QUARTER = serverRead('/record?period=quarter').data;

/** The page drawn at `start` from the console's server's read of it; from here on the test waits as a browser does. */
function mount(start: string) {
  window.history.replaceState(null, '', start);
  render(<QueryClientProvider client={new QueryClient()}><Tooltip.Provider><Suspense fallback={null}><Console start={start} /></Suspense></Tooltip.Provider></QueryClientProvider>);
  actEnvironment(false);
  log.entries = [];
}
afterEach(() => { actEnvironment(true); vi.unstubAllGlobals(); });

describe('a press of the period', () => {
  // From the record's second page too: the press takes the table back to its first, and that is not a reason to draw the charts again.
  it.each(['/record', '/record?page=2'])('draws the new period after the task the address is announced in, never inside it, from %s', async (start) => {
    mount(start);
    expect(chosen()).toBe('All');
    screen.getByRole('radio', { name: 'Quarter' }).click();
    // The control's own state, at once: React renders a press's update before the task's microtasks are done, so before
    // the frame, and the press draws it and nothing else.
    await Promise.resolve();
    expect(chosen()).toBe('Quarter');
    expect(log.entries).toEqual([]);
    await until(() => firstSlice().includes(periodLine(QUARTER)));
    const announced = log.entries.indexOf('announced');
    expect(announced).toBeGreaterThanOrEqual(0);
    const inside = log.entries.slice(announced + 1, log.entries.indexOf('its task ended', announced));
    expect(inside).toEqual([]);
    // The charts of the new period were drawn, in a render of their own after that task.
    expect(log.entries.slice(log.entries.indexOf('its task ended', announced)).filter((e) => e !== 'its task ended').length).toBeGreaterThan(0);
  });

  it('reads and draws the period it chose, at its address, and Copy as text copies that record', async () => {
    mount('/record');
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    screen.getByRole('radio', { name: 'Quarter' }).click();
    await until(() => firstSlice().includes(periodLine(QUARTER)) && !document.querySelector('[aria-busy="true"]'));
    expect(window.location.search).toBe('?period=quarter');
    expect(chosen()).toBe('Quarter');
    const copy = screen.getByRole('button', { name: 'Copy as text' });
    await until(() => !copy.hasAttribute('disabled'));
    copy.click();
    await until(() => writeText.mock.calls.length > 0);
    expect(writeText).toHaveBeenCalledWith(recordText(QUARTER));
  });
});
