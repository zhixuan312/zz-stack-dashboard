import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
vi.mock('@/lib/live', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/live')>()), useLive: () => 'live' }));
const toasts = vi.hoisted(() => ({ said: [] as { tone?: string; title: string }[] }));
vi.mock('@/components/ui/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/toast')>()),
  toast: (t: { tone?: string; title: string }) => { toasts.said.push(t); },
}));

import { SurfaceOverride } from '@/components/base/surface';
import { StateBadge } from '@/console/initiative';
import { waitingGates } from '@/console/initiative-state';
import { AccessProvider } from '@/console/settings/access-read';
import { TokensPanel } from '@/console/settings/tokens-panel';
import type { KnowledgeBody, KnowledgeLog, KnowledgeLogEntry } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import type { Usage } from '@/lib/fleet-shapes';
import type { PeriodFigure } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { initiativeContext } from '@/views/initiative-context';
import { STATE_LABEL } from '@/views/initiatives-filter';
import { knowledgeLogContext } from '@/views/knowledge-log-context';
import { HomeView } from '@/views/pages/home';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { usageContext } from '@/views/platform-usage-context';
import { weekCount } from '@/views/teams-context';
import { pointsOf } from '@/views/week-change';
import { ME } from '../scripts/fake-gateway/people.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { initiativeDetail, rowsOf } from '../scripts/fake-gateway/work-initiatives.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { KNOWLEDGE_LOG, SHELF, knowledgeLog, lesson } from '../scripts/fake-gateway/work-knowledge.ts';

/**
 * Review round 2's console view findings (Task I-182): the knowledge log counted by the gateway's totals and named at
 * its ceiling (R2-C46, R2-C48), Share refused judged only on a week with enough calls (R2-C54), a token with no label
 * revoked in whole words (R2-C36), one neighbour read as one (R2-C49), a week before the team's record read as no data
 * (R2-C55), the read bound written once (R2-C44), and the Record line on Home a whole touch target (V-1).
 */
const ROOT = path.resolve(__dirname, '..');
const AT = '2026-10-19T12:00:00Z';

function mount(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SurfaceOverride surface={{ ask: () => {} }}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
async function draw(at: string, ui: ReactElement) {
  window.history.replaceState(null, '', at);
  await act(async () => { mount(ui); });
}
const text = () => document.body.textContent ?? '';
/** The tile a label heads. */
const tile = (label: string) => screen.getAllByText(label).map((n) => n.closest('.card') ?? n.parentElement!)[0] as HTMLElement;

beforeEach(() => { toasts.said = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('the knowledge log is counted by the gateway\'s totals, not by the rows it answered (R2-C46, R2-C48)', () => {
  /** A team past the ceiling: the latest 500 entries answered, 1,234 before the cutoff. */
  const entries: KnowledgeLogEntry[] = Array.from({ length: 500 }, (_, i) => ({
    ts: new Date(Date.parse(AT) - i * 3_600_000).toISOString(), actor: 'noah.okafor@example.com', team: 'atlas',
    kind: i % 10 ? 'knowledge.add' : 'knowledge.supersede', node: String(1000 + i), recorded_title: `Lesson ${i}`,
    superseded_by: null, node_title: `Lesson ${i}`, node_status: 'standing', path: `nodes/${1000 + i}-lesson-${i}.md`,
  }));
  const PAST: KnowledgeLog = { entries, totals: { entries: 1234, recorded: 1100, superseded: 134 }, ceiling: 500 };

  it('draws each tile from the totals and says the list holds the latest 500', async () => {
    await draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: PAST, at: AT }} />);
    expect(tile('Entries')).toHaveTextContent('1,234');
    expect(tile('Recorded')).toHaveTextContent('1,100');
    expect(tile('Superseded')).toHaveTextContent('134');
    expect(text()).toContain('the latest 500');
  });

  it('tells the assistant the totals and the ceiling, within its budget', () => {
    const said = contextText(knowledgeLogContext(PAST, { updatedAt: AT, now: AT }));
    expect(said).toContain('1,234');
    expect(said).toContain('1,100 nodes');
    expect(said).toContain('134 nodes');
    expect(said).toMatch(/latest 500/);
    expect(said.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('names no ceiling while every entry is listed', async () => {
    const all: KnowledgeLog = { entries: entries.slice(0, 40), totals: { entries: 40, recorded: 36, superseded: 4 }, ceiling: 500 };
    await draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: all, at: AT }} />);
    expect(text()).not.toContain('the latest 500');
    expect(contextText(knowledgeLogContext(all, { updatedAt: AT, now: AT }))).not.toMatch(/latest 500/);
  });

  it('is answered so by the fake: the latest 500 of the team\'s log, the totals over all of it', () => {
    const own = KNOWLEDGE_LOG.filter((e) => e.team === ME.activeTeam);
    const log = knowledgeLog(ME);
    expect(log.entries).toEqual(own.slice(0, 500));
    expect(log.totals).toEqual({ entries: own.length, recorded: own.filter((e) => e.kind === 'knowledge.add').length, superseded: own.filter((e) => e.kind === 'knowledge.supersede').length });
    expect(log.ceiling).toBe(500);
  });
});

describe('Share refused shows no change for a week under the 30-call sample (R2-C54)', () => {
  const base = usage(true);
  if (base.tiles.state !== 'ok') throw new Error('the fixture answers its tiles');
  const share = base.tiles.data.refusedShare;
  const few: Usage = {
    ...base,
    tiles: { state: 'ok', data: { ...base.tiles.data, refusedShare: { ...share, last: { ...share.last, figure: { value: 20, why: 'insufficient' } }, previous: { ...share.previous, figure: { value: 12.5, why: null } } } } },
  };

  it('has no points for the pair', () => {
    if (few.tiles.state !== 'ok') throw new Error('unreachable');
    expect(pointsOf(few.tiles.data.refusedShare)).toBeNull();
  });

  it('draws the tile with no change, and tells the assistant none', () => {
    render(<SurfaceOverride surface={{}}><Tooltip.Provider><PlatformUsageView read={{ state: 'ok', usage: few }} /></Tooltip.Provider></SurfaceOverride>);
    expect(tile('Share refused')).not.toHaveTextContent('pts');
    const fact = usageContext({ state: 'ok', usage: few }).facts.find((f) => f.label === 'Share refused');
    expect(fact?.change).not.toMatch(/^(up|down|unchanged)\b/);
  });
});

describe('a token with no label is revoked in whole words (R2-C36)', () => {
  it('toasts the same words the confirm asks in', async () => {
    const a = accessOf(ME)[1] as Access;
    const live = a.issued.find((t) => !t.revokedAt);
    if (!live) throw new Error('the fixture has a live token');
    const unlabelled = { ...live, label: '' };
    vi.stubGlobal('fetch', vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => ({ ok: true, status: 200, json: async () => (init?.method === 'DELETE' ? { ok: true, revoked: unlabelled.id } : {}) }) as unknown as Response));
    await draw('/access', <AccessProvider value={{ access: { ...a, issued: [unlabelled] } }}><TokensPanel /></AccessProvider>);
    const row = screen.getAllByRole('row').find((r) => within(r).queryByRole('button', { name: 'Revoke' }))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Revoke' }));
    expect(text()).toContain('Revoke this token?');
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Revoke' })); });
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'positive', title: 'Revoked this token' }));
  });
});

describe('one neighbour is one node (R2-C49)', () => {
  it('counts the shared-tag card in words', async () => {
    const node = lesson('atlas', SHELF.find((n) => n.team === 'atlas' && n.num === '0002')!.path, 'atlas') as KnowledgeBody;
    const neighbour = node.related[0] ?? SHELF.find((n) => n.team === 'atlas' && n.num !== '0002')!;
    const one = { ...node, related: [neighbour] };
    await draw(`/knowledge/atlas/${one.path}`, <KnowledgeNodeView read={{ state: 'ok', data: one, at: AT }} team="atlas" rel={one.path} />);
    expect(text()).toContain('1 node');
    expect(text()).not.toContain('1 nodes');
  });
});

describe('a week before a team\'s record reads as no data, not unavailable (R2-C55)', () => {
  const week = (figure: PeriodFigure['figure']): PeriodFigure => ({ window: { from: '2026-10-05', to: '2026-10-12', observedFrom: null, observedThrough: null, complete: true }, figure, numerator: null, denominator: null });

  it('says each kind of missing week in its own word', () => {
    expect(weekCount(week({ value: null, why: 'no_data' }))).toBe('No data');
    expect(weekCount(week({ value: null, why: 'unavailable' }))).toBe('Unavailable');
    expect(weekCount(week({ value: 1234, why: null }))).toBe('1,234');
  });
});

describe('the read bound is one constant (R2-C44)', () => {
  it('is defined once under src/ and app/', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const at = path.join(dir, e.name);
        if (e.isDirectory()) walk(at);
        else if (/\.tsx?$/.test(e.name)) {
          for (const m of fs.readFileSync(at, 'utf8').matchAll(/\b([A-Z_]*BOUND_MS)\s*=\s*[\d_]+\s*;/g)) found.push(`${path.relative(ROOT, at)} ${m[1]}`);
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    walk(path.join(ROOT, 'app'));
    expect(found).toEqual(['src/views/context.ts READ_BOUND_MS']);
  });
});

describe('the Record line on Home answers a finger whole (V-1)', () => {
  it('is a tagged target, so a phone presses it at 44px whatever it wraps to', async () => {
    await draw('/', <HomeView read={{ state: 'ok', home: homeOf('atlas', ME.email), team: 'atlas' }} />);
    expect(document.querySelector('[data-record-line]')).toHaveClass('hit');
  });
});

describe('the initiative list and the initiative page name one state in one set of words (R2-C63)', () => {
  const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
  const rows = rowsOf('atlas');

  it('is answered the same state on the page as on the list, for every initiative', () => {
    expect(new Set(rows.map((r) => r.state)).size).toBeGreaterThan(2);
    for (const r of rows) expect(initiativeDetail('atlas', r.slug)!.state).toBe(r.state);
  });

  it('draws the page badge and tells the assistant in the list\'s words', () => {
    for (const r of rows) {
      const d = initiativeDetail('atlas', r.slug)!;
      const { container, unmount } = render(<StateBadge state={d.state} waitingOn={waitingGates(d)} />);
      expect(container.textContent).toBe(STATE_LABEL[r.state]);
      unmount();
      expect(initiativeContext(d, arrival).facts.find((f) => f.label === 'State')!.value).toBe(STATE_LABEL[r.state]);
    }
  });
});
