import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace: (to: string) => window.history.replaceState(null, '', to) }),
}));

import type { Me } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import { formatDate, formatDateTime } from '@/lib/format-date';
import type { Measure, PlatformStatus } from '@/lib/platform-shapes';
import { MissingPage } from '@/views/no-access';
import { AccessView } from '@/views/pages/access';
import { DocumentView } from '@/views/pages/document';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { PluginView } from '@/views/pages/plugin';
import { statusRead } from '@/views/platform-status-context';
import type { Catalog } from '@/views/plugins-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { pluginEval } from '../scripts/fake-gateway/platform.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';

/**
 * Phase 7, I-176: the third re-review's layout and copy findings (Work P-4 to P-7, Platform P-2 and P-3), each found
 * gone on the fake gateway's own answers. jsdom lays nothing out, so a layout finding is read off what decides it: the
 * labels a stacked cell carries, which card shares a row, where a line may break, the classes that size a card. The
 * screenshots of a scratch build show the rest.
 */
const AT = '2026-10-17T09:00:00Z';
const PEOPLE: [string, Me][] = [['the superadmin', ME], ['the member', MEMBER]];
const ok = <T,>(path: string, data: T) => ({ state: 'ok' as const, path, at: AT, data });
const mount = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);

const SPEC = ['atlas', '2026-09-28-search-relevance', 'spec.md'] as const;
let who: Me = ME;

beforeEach(() => {
  who = ME;
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const p = url.pathname.replace('/api/console', '');
    const body = p === '/me' ? who
      : p.startsWith('/document/') && !url.searchParams.has('revision') ? documentDetail(...SPEC)
        : p === '/access' ? accessOf(who)[1]
          : p === '/settings/team/members' ? teamMembers(url.searchParams.get('team') ?? '') : null;
    return body === null ? new Promise(() => {}) : Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Work P-4: a document\'s table labels each value it stacks at a phone\'s width', () => {
  /** The labels the page's own rules give, as `table/column -> words`, read back from their CSS strings. */
  const labelsOf = (container: HTMLElement) => {
    const css = [...container.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toMatch(/^@container \(width < 480px\)\{/);
    return Object.fromEntries([...css.matchAll(/:nth-child\((\d+) of :has\(>table\)\) td:nth-child\((\d+)\)::before\{content:"((?:[^"\\]|\\[0-9a-f]+ )*)"\}/g)]
      .map(([, t, c, words]) => [`${t}/${c}`, words.replace(/\\([0-9a-f]+) /g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))]));
  };
  /** Every table the reading body draws at its top level, by its headings, in the order the rules count them. */
  const drawn = (container: HTMLElement) => {
    const body = container.querySelector('[data-doc-text] > div')!;
    return [...body.children].filter((c) => c.querySelector(':scope > table')).map((c) => [...c.querySelectorAll('thead th')].map((th) => th.textContent));
  };
  const draw = async (body?: string) => {
    const doc = documentDetail(...SPEC)!;
    const { container } = mount(<DocumentView team={SPEC[0]} slug={SPEC[1]} rel={SPEC[2]} served={{ state: 'ok', data: body ? { ...doc, body } : doc, at: AT, revisions: {} } as never} teamPage />);
    await waitFor(() => expect(container.querySelector('[data-doc-text] table')).not.toBeNull());
    return container;
  };
  const expectLabelled = (container: HTMLElement) => {
    const labels = labelsOf(container);
    const tables = drawn(container);
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((headings, t) => {
      // The first cell is the card's title, and is what the row is about: it carries no label.
      expect(labels[`${t + 1}/1`]).toBeUndefined();
      headings.slice(1).forEach((h, c) => expect(labels[`${t + 1}/${c + 2}`]).toBe(h));
    });
    expect(Object.keys(labels)).toHaveLength(tables.reduce((n, h) => n + h.length - 1, 0));
  };

  it('gives every cell after a row\'s first its column\'s heading, written with the page, and hides the header row where the rows stack', async () => {
    const container = await draw();
    expect(drawn(container)[0]).toEqual(['Decision', 'Chosen', 'Rejected because']);
    expectLabelled(container);
    const text = container.querySelector('[data-doc-text]')!;
    expect(text.className).toContain('@max-[480px]:[&_thead]:hidden');
    expect(text.className).toContain('@max-[480px]:[&_td+td]:before:block');
  });

  it('counts the tables the body draws, past a table in a fence, one in a list, one with no outer pipes and marks in a heading', async () => {
    const container = await draw([
      '# T', '', 'Intro.', '', '```', '| not | a | table |', '|---|---|---|', '```', '',
      '- item', '', '  | in | a list |', '  |---|---|', '  | 1 | 2 |', '',
      'A | `code` heading | **bold** "quoted"', '--|:-:|--:', 'x | y | z', '',
      '| One | Two [link](https://example.com) | a \\| b |', '|---|---|---|', '| 1 | 2 | 3 |',
    ].join('\n'));
    expect(drawn(container)).toEqual([['A', 'code heading', 'bold "quoted"'], ['One', 'Two link', 'a | b']]);
    expectLabelled(container);
  });
});

describe('Work P-5: a plugin\'s Usage card is not stretched to a taller neighbour', () => {
  it.each(PEOPLE)('shares its row with the Overall fit card it qualifies, and with no card that carries a table, for %s', async (_, me) => {
    who = me;
    mount(<PluginView name="sdlc" served={{ catalog: ok('/plugins', plugins(me)[1] as Catalog), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) } as never} />);
    const usage = (await screen.findByRole('heading', { name: 'Usage' })).closest('[data-split]') as HTMLElement;
    expect(within(usage).getByRole('heading', { name: 'Overall fit for purpose' })).toBeInTheDocument();
    expect(within(usage).queryByRole('heading', { name: 'Health' })).toBeNull();
    expect(usage.querySelector('table')).toBeNull();
  });
});

describe('Work P-6: Access breaks an identifier only at its own separators', () => {
  it.each(PEOPLE)('keeps an address whole where it fits and breaks it only after its @, for %s', async (_, me) => {
    who = me;
    mount(<AccessView served={{ state: 'ok', access: accessOf(me)[1] as Access }} />);
    await screen.findByRole('heading', { name: 'Tokens' });
    const addresses = [...document.querySelectorAll('span')].filter((s) => s.querySelector(':scope > wbr') && /@/.test(s.textContent!));
    expect(addresses.length).toBeGreaterThan(0);
    for (const a of addresses) {
      // An inline block moves to the next line whole when it fits there, so a line never ends inside it.
      expect(a.className).toContain('inline-block');
      expect(a.className).not.toMatch(/break-all|overflow-wrap:anywhere/);
      const breaks = [...a.querySelectorAll('wbr')];
      expect(breaks).toHaveLength(1);
      expect(breaks[0].previousSibling?.textContent).toMatch(/@$/);
    }
  });

  it.each(PEOPLE)('sets each install line whole on its own line, scrolling in its block rather than breaking, for %s', async (_, me) => {
    who = me;
    mount(<AccessView served={{ state: 'ok', access: accessOf(me)[1] as Access }} />);
    const blocks = await waitFor(() => {
      const found = [...document.querySelectorAll('[data-setup] pre')];
      expect(found.length).toBeGreaterThan(0);
      return found as HTMLElement[];
    });
    expect(blocks.some((b) => /plugin install \S+@\S+ # required/.test(b.textContent!))).toBe(true);
    for (const b of blocks) {
      expect(b.className).toMatch(/(^|\s)whitespace-pre(\s|$)/);
      expect(b.className).toContain('overflow-x-auto');
      expect(b.className).not.toMatch(/overflow-wrap|break-all|whitespace-pre-wrap/);
      // A region that scrolls is reached by the keyboard, and named, as a group: a bare pre may not carry a name.
      expect(b.tabIndex).toBe(0);
      expect(b.getAttribute('role')).toBe('group');
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });
});

describe('Work P-7: the missing page\'s card fits its content', () => {
  it('sizes the card to the mascot and its button, at the title\'s left edge', () => {
    const { container } = render(<MissingPage />);
    const card = container.querySelector('[data-missing-page]')!;
    expect(card.className).toMatch(/(^|\s)w-fit(\s|$)/);
    expect(card.className).toMatch(/(^|\s)self-start(\s|$)/);
  });
});

describe('Platform P-2: Status\'s left featured half says its counts once', () => {
  const malformed = (s: PlatformStatus) => s.measures.find((m) => m.key === 'malformed_per_1000')!;
  const half = (s: PlatformStatus) => {
    const { container } = render(<Tooltip.Provider><PlatformStatusView read={statusRead(s)} /></Tooltip.Provider>);
    const h = container.querySelectorAll('[data-figures] [data-figure]')[0] as HTMLElement;
    const finding = h.querySelector('[data-finding]')?.textContent ?? '';
    const rest = (h.cloneNode(true) as HTMLElement);
    rest.querySelector('[data-finding]')?.remove();
    return { finding, rest: rest.textContent! };
  };

  it.each([['the superadmin', PLATFORM_STATUS], ['the member', MEMBER_STATUS]] as const)('where the gateway\'s finding is the week\'s counts, the caption says the change instead, for %s', (_, status) => {
    const m = malformed(status);
    expect(m.finding?.kind).toBe('count');
    const { finding, rest } = half(status);
    expect(finding).toBe(m.finding!.text);
    const counts = finding.match(/^[\d,]+ of [\d,]+/)![0];
    expect(rest).not.toContain(counts);
    expect(rest).toMatch(/Real-work calls, week of \d+ \w+, (up|down) [\d.]+ on the week before/);
  });

  it('where the finding is a record, the caption keeps the week\'s counts, said nowhere else', () => {
    const m = malformed(PLATFORM_STATUS);
    const record: Measure = { ...m, finding: { kind: 'best_week', text: 'Lowest observed malformed calls in a complete week, 12 Oct', dates: m.finding!.dates, tie: false } };
    const { rest } = half({ ...PLATFORM_STATUS, measures: PLATFORM_STATUS.measures.map((x) => (x.key === m.key ? record : x)) });
    expect(rest).toContain(`${m.last!.numerator} of ${m.last!.denominator} real-work calls`);
  });
});

describe('Platform P-3: Evaluation\'s last-scored tile is one line, and says its date once', () => {
  it.each([['the superadmin', true], ['the member', false]] as const)('reads how long ago, with the date and time once beneath, for %s', (_, admin) => {
    const e = evaluation(admin);
    render(<Tooltip.Provider><PlatformEvaluationView read={{ state: 'ok', evaluation: e }} /></Tooltip.Provider>);
    const tile = screen.getByRole('heading', { name: 'Last scored' }).closest('.card') as HTMLElement;
    const value = tile.querySelector('[data-value]')!.textContent!;
    expect(value).toMatch(/^\d+ (hours?|days?) ago$/);
    const said = tile.textContent!.split(formatDate(e.tiles.lastScored!)).length - 1;
    expect(said).toBe(1);
    expect(tile.textContent).toContain(formatDateTime(e.tiles.lastScored!));
  });

  it('says a scoring within the hour in words, never "0 hours ago"', () => {
    const e = evaluation(true);
    const asOf = new Date(Date.parse(e.tiles.lastScored!) + 20 * 60_000).toISOString();
    render(<Tooltip.Provider><PlatformEvaluationView read={{ state: 'ok', evaluation: { ...e, meta: { ...e.meta, asOf } } }} /></Tooltip.Provider>);
    const tile = screen.getByRole('heading', { name: 'Last scored' }).closest('.card') as HTMLElement;
    expect(tile.querySelector('[data-value]')!.textContent).toBe('Under an hour ago');
  });
});
