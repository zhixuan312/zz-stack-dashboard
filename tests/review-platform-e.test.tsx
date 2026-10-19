import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { formatDate, formatDay, formatShortDate } from '@/lib/format-date';
import type { Part } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import type { Audit } from '@/lib/fleet-shapes';
import { PlatformAuditView } from '@/views/pages/platform-audit';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { AUDIT_DEFAULTS, auditPath, reportTitles } from '@/views/platform-audit-context';
import { evaluationContext } from '@/views/platform-evaluation-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';

/**
 * The findings of "Phase 7, I-129 re-review: the Platform destinations after I-151 to I-157" on Evaluation, Usage and
 * Knowledge health (Task I-162), each held at its cause: a series cell whose population wrapped beside a lead column
 * with the slack (F-3); a waiting finding named by a placeholder in two templates, the superadmin's real words only on
 * the line under it (F-17); a phone card whose second fact wrapped to a line of its own behind the managed table's dot,
 * and a share with no result said "No data no result" (N-3); and a day in a table cell written as a sentence writes it
 * (N-4); and a deleted report named on Audit by its raw id (F-23). jsdom lays nothing out, so a line kept whole is the class that keeps it, and a phone card is the cells the
 * managed table marks for one: it draws its dot before every fact but the first, so a card of one fact has none.
 */
const ADMIN_EVAL = evaluation(true);
const MEMBER_EVAL = evaluation(false);
const ADMIN_KNOWLEDGE = knowledge(true, ME.activeTeam);
const MEMBER_KNOWLEDGE = knowledge(false, MEMBER.activeTeam);
const ADMIN_USAGE = usage(true);

function data<T>(p: Part<T> | null): T {
  if (!p || p.state !== 'ok') throw new Error('not answered');
  return p.data;
}
const mount = (ui: ReactElement) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>
  </QueryClientProvider>,
);
const table = (name: string) => screen.getByRole('table', { name });
const bodyRows = (t: HTMLElement) => within(t).getAllByRole('row').slice(1);

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('Evaluation\'s series cell keeps each line whole (F-3)', () => {
  it('holds the protocol and the population each on one line, so the column takes the width its longest needs', () => {
    for (const e of [ADMIN_EVAL, MEMBER_EVAL]) {
      mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: e }} />);
      const populations = [...table('Every score, by series').querySelectorAll('[data-population]')];
      expect(populations.length).toBeGreaterThan(0);
      for (const p of populations) expect(p.className, p.textContent!).toContain('whitespace-nowrap');
      document.body.innerHTML = '';
    }
  });
});

describe('a waiting finding is named by what it found, as far as its reader may read it (F-17)', () => {
  const MEMBER_ROWS = data(MEMBER_EVAL.waiting).rows;
  const ADMIN_ROWS = data(ADMIN_EVAL.waiting).rows as { pattern?: string; summary: string }[];

  it('names a member\'s finding in one template, by its kind, its plugin and its owner category', () => {
    expect(MEMBER_ROWS.length).toBeGreaterThan(1);
    expect(MEMBER_ROWS.some((r) => r.owner === 'unknown')).toBe(true);
    for (const r of MEMBER_ROWS) {
      expect(r.summary).toMatch(/^(A defect|An unknown) in \S+, (owned by (the plugin|a dependency|the platform|the environment|user input)|owner not known)$/);
      expect(r.summary).toContain(r.plugin);
    }
  });

  it('leads a member\'s row with that name, and no row is a placeholder', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: MEMBER_EVAL }} />);
    const t = table('Findings waiting for a decision, oldest first');
    for (const r of MEMBER_ROWS) expect(t.textContent).toContain(r.summary);
    expect(t.textContent).not.toMatch(/awaiting a decision/);
  });

  it('leads the superadmin\'s row with the words the evaluation recorded, and no fixed sentence', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: ADMIN_EVAL }} />);
    const rows = bodyRows(table('Findings waiting for a decision, oldest first'));
    expect(rows).toHaveLength(ADMIN_ROWS.length);
    rows.forEach((row, i) => {
      const lead = row.querySelector('[data-finding-name]');
      expect(lead?.textContent).toBe(ADMIN_ROWS[i].pattern);
      expect(row.textContent).not.toContain(ADMIN_ROWS[i].summary);
    });
    expect(contextText(evaluationContext({ state: 'ok', evaluation: ADMIN_EVAL }))).not.toMatch(/awaiting a decision/);
  });
});

describe('no phone card line starts with a dot, and a share with no result says so (N-3)', () => {
  it('gives each of Evaluation\'s latest scores one fact, a sentence that wraps as words', () => {
    for (const e of [ADMIN_EVAL, MEMBER_EVAL]) {
      mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: e }} />);
      const t = table('Each plugin\'s latest score');
      expect(t.querySelector('[data-sep]')).toBeNull();
      for (const row of bodyRows(t)) expect(row.querySelectorAll('td[data-mobile="fact"]')).toHaveLength(1);
      expect(t.textContent).toMatch(/No score, guardrails not established, scored \d{1,2} [A-Z][a-z]{2,3}/);
      document.body.innerHTML = '';
    }
  });

  it('gives each shelf one fact, and says a share with no result as a reader says it', () => {
    for (const h of [ADMIN_KNOWLEDGE, MEMBER_KNOWLEDGE]) {
      mount(<PlatformKnowledgeView read={{ state: 'ok', health: h }} />);
      const t = table('Each shelf\'s lessons and last week\'s searches');
      expect(t.querySelector('[data-sep]')).toBeNull();
      for (const row of bodyRows(t)) expect(row.querySelectorAll('td[data-mobile="fact"]')).toHaveLength(1);
      expect(t.textContent).not.toMatch(/No data no result|too few no result/);
      expect(t.textContent).toMatch(/\d+\.\d% with no result, too few to judge/);
      expect(t.textContent).toContain('no searches');
      // The fact sits in a numeric cell, which the managed table keeps on one line: its sentences must wrap.
      for (const c of t.querySelectorAll('[data-shelf-card]')) expect(c.className).toContain('whitespace-normal');
      document.body.innerHTML = '';
    }
  });

  it('gives each of Audit\'s events one fact, the day and the actor in one line', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    window.history.replaceState(null, '', '/platform/audit?filter=all');
    const all = audit(new URLSearchParams({ filter: 'all' }), { limit: 10, offset: 0 })![1] as Audit;
    const path = auditPath({ ...AUDIT_DEFAULTS, filter: 'all' });
    mount(<PlatformAuditView served={{ state: 'ok', path, data: all, reports: {} }} />);
    const t = table('Events, newest first');
    expect(t.querySelector('[data-sep]')).toBeNull();
    for (const row of bodyRows(t)) expect(row.querySelectorAll('td[data-mobile="fact"]')).toHaveLength(1);
    expect(t.textContent).toMatch(/\d{2} [A-Z][a-z]{2,3} \d{4}, actor not recorded/);
  });
});

describe('a deleted report is named by what the record kept of its filing (F-23)', () => {
  const admin = audit(new URLSearchParams(), { limit: 10, offset: 0 })![1] as Audit;
  const deleted = admin.rows.find((r) => r.kind === 'bug.delete')!;

  it('says the day it was filed, never its id or the title its deletion recorded', () => {
    expect(deleted.sentence).toMatch(/ deleted a report filed \d{2} [A-Z][a-z]{2,3} \d{4}$/);
    expect(deleted.sentence).not.toContain(deleted.subject!);
    expect(JSON.stringify(admin)).not.toContain('Beacon payroll export');
  });

  it('draws that sentence in the feed, and reads no report for it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    window.history.replaceState(null, '', '/platform/audit');
    mount(<PlatformAuditView served={{ state: 'ok', path: auditPath(AUDIT_DEFAULTS), data: admin, reports: {} }} />);
    const feed = document.querySelector('[data-protagonist="Administration"]')!;
    expect(feed.textContent).toContain(deleted.sentence!.slice(deleted.actor!.length + 1));
    expect(feed.textContent).not.toContain(deleted.subject!);
    const asked: string[] = [];
    await reportTitles(admin, async (path) => { asked.push(path); return { title: 'a title' }; });
    expect(asked.some((p) => p.includes(deleted.subject!))).toBe(false);
  });
});

describe('a day in a table cell is padded, and a day in a sentence is not (N-4)', () => {
  it('writes each tool\'s week as a table cell writes a day', () => {
    mount(<PlatformUsageView read={{ state: 'ok', usage: ADMIN_USAGE }} />);
    const t = table('Each tool\'s median call, first week against last');
    const rows = data(ADMIN_USAGE.tools).rows;
    expect(rows.some((r) => formatDay(r.first.window.from) !== formatShortDate(r.first.window.from))).toBe(true);
    for (const r of rows) {
      expect(t.textContent).toContain(`${formatShortDate(r.first.window.from)} · `);
      expect(t.textContent).toContain(`${formatShortDate(r.last.window.from)} · `);
    }
  });

  it('writes the day Evaluation\'s scoring began as a sentence writes it', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: ADMIN_EVAL }} />);
    const tiles = document.querySelector('[data-figures="read"]')!;
    expect(tiles.textContent).toContain(`Since ${formatDay(ADMIN_EVAL.meta.coverageFrom!)}`);
    expect(tiles.textContent).not.toContain(formatDate(ADMIN_EVAL.meta.coverageFrom!));
  });
});
