import { render } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
/** Every Featured metric Home draws, with the props it was handed, drawn as the release draws it. */
const card = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('@/components/patterns/featured-metric', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/patterns/featured-metric')>();
  return { ...real, FeaturedMetric: (p: Parameters<typeof real.FeaturedMetric>[0]) => { card.props.push(p); return createElement(real.FeaturedMetric, p); } };
});

import type { FeaturedFigure } from '@/components/patterns/featured-metric';
import type { Home } from '@/lib/work-shapes';
import { HALVES, lastWeekOf } from '@/views/home-context';
import { HomeView } from '@/views/pages/home';
import { ME } from '../scripts/fake-gateway/people.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';

/**
 * Home's paired figure hands the card no number where a half has none (Task I-130, AC-2.8): a half the gateway could not
 * read, and a last week the answer sent no figure for, each say in the figure's place why there is none, in the half's own
 * words, never `NaN` and never a 0. The answer is the fake gateway's own, the one `pnpm verify` serves, with one part changed as the gateway
 * could answer it.
 */
const ATLAS = homeOf('atlas', ME.email);
const LAST = lastWeekOf(ATLAS).from;
const gone = { state: 'unavailable', reason: 'query_failed' } as const;
const UNREAD: Home = { ...ATLAS, words: gone, approvals: gone };
/** The last week's figure taken out of a half's weeks, as the gateway answers a week it has no number for. */
const noLast = <W extends { window: { from: string }; figure: { value: number | null; why: unknown } }>(weeks: W[], why: 'no_data' | 'unavailable'): W[] =>
  weeks.map((w) => (w.window.from === LAST ? { ...w, figure: { value: null, why } } : w));
const lastWithout = (why: 'no_data' | 'unavailable'): Home => ({
  ...ATLAS,
  words: ATLAS.words.state === 'ok' ? { state: 'ok', data: { ...ATLAS.words.data, weeks: noLast(ATLAS.words.data.weeks, why), finding: null } } : ATLAS.words,
  approvals: ATLAS.approvals.state === 'ok' ? { state: 'ok', data: { ...ATLAS.approvals.data, weeks: noLast(ATLAS.approvals.data.weeks, why), finding: null } } : ATLAS.approvals,
});
const NO_LAST = lastWithout('no_data');

const draw = (home: Home) => render(<Tooltip.Provider><HomeView read={{ state: 'ok', home, team: 'atlas' }} /></Tooltip.Provider>);
const halves = () => [...document.querySelectorAll('[data-figures] [data-figure]')] as HTMLElement[];
/** The two figures the card was handed last: the words half, then the approvals half. */
const handed = (): FeaturedFigure[] => {
  const p = card.props.at(-1) as FeaturedFigure & { peer: FeaturedFigure };
  return [p, p.peer];
};

beforeEach(() => { card.props = []; });

describe('Home\'s paired figure with no number', () => {
  it('the fixture is the case: last week has a figure in both halves before it is changed', () => {
    for (const part of [ATLAS.words, ATLAS.approvals]) {
      expect(part.state).toBe('ok');
      if (part.state === 'ok') expect(part.data.weeks.find((w) => w.window.from === LAST)?.figure.value).toEqual(expect.any(Number));
    }
  });

  it('a half that could not be read hands the card no number and says it is unavailable in the figure\'s place', () => {
    draw(UNREAD);
    for (const f of handed()) {
      expect(f.value).toBeNull();
      expect(f.missing).toBe('Unavailable');
    }
    const [words, approvals] = halves();
    for (const [half, key] of [[words, 'words'], [approvals, 'approvals']] as const) {
      const figure = half.querySelector('[data-value]')!;
      expect(figure.querySelector('[data-missing]')?.textContent).toBe('Unavailable');
      expect(figure.textContent).not.toMatch(/NaN|\d/);
      expect(half.textContent).toContain(HALVES[key].unread);
    }
  });

  it('a last week the answer sent no figure for hands the card no number and says the half\'s own words for none', () => {
    draw(NO_LAST);
    const [wordsFigure, approvalsFigure] = handed();
    expect(wordsFigure.value).toBeNull();
    expect(wordsFigure.missing).toBe(HALVES.words.none);
    expect(approvalsFigure.value).toBeNull();
    expect(approvalsFigure.missing).toBe(HALVES.approvals.none);
    const [words, approvals] = halves();
    for (const [half, key] of [[words, 'words'], [approvals, 'approvals']] as const) {
      const figure = half.querySelector('[data-value]')!;
      expect(figure.querySelector('[data-missing]')?.textContent).toBe(HALVES[key].none);
      expect(figure.textContent).not.toMatch(/NaN|\d/);
    }
  });

  it('a last week the gateway could not count says it is unavailable, never that nothing was recorded', () => {
    draw(lastWithout('unavailable'));
    for (const f of handed()) {
      expect(f.value).toBeNull();
      expect(f.missing).toBe('Unavailable');
    }
    for (const half of halves()) {
      const figure = half.querySelector('[data-value]')!;
      expect(figure.querySelector('[data-missing]')?.textContent).toBe('Unavailable');
      expect(figure.textContent).not.toMatch(/recorded|NaN|\d/);
    }
  });

  it('a last week with a figure still hands the card that number, formatted as a count', () => {
    draw(ATLAS);
    const [wordsFigure] = handed();
    const last = ATLAS.words.state === 'ok' ? ATLAS.words.data.weeks.find((w) => w.window.from === LAST)!.figure.value : null;
    expect(wordsFigure.value).toBe(last);
    expect(halves()[0].querySelector('[data-value] [data-missing]')).toBeNull();
  });
});
