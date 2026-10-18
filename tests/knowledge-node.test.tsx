import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Tooltip } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

/**
 * A lesson's citations as the knowledge node page and its context draw them (reconciliations 77 and 81, AC-1.7). A
 * shared lesson is published material and the initiatives behind it are their teams' own: the node answers the cited
 * initiatives of the team the reader acts for by name, and counts every other team's as `cited_elsewhere`. The page
 * links its own team's, says how many other teams' initiatives the lesson was learned in with no name and no link, and
 * marks the lesson "Shared" with nothing that says "read-only"; the assistant's context says the same.
 *
 * The lessons are the fake gateway's, read as Atlas reads them (`lesson` in scripts/fake-gateway/work-knowledge.ts).
 */
import type { KnowledgeBody } from '@/lib/api-shapes';
import { contextText } from '@/lib/shared-context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { INITIATIVES } from '../scripts/fake-gateway/work.ts';
import { SHARED_TEAM, SHELF, lesson } from '../scripts/fake-gateway/work-knowledge.ts';

const READER = 'atlas';
const SHARED = SHELF.filter((n) => n.team === SHARED_TEAM);
/** Every initiative of a team the reader does not act for: none of these may be named to them. */
const ELSEWHERE = INITIATIVES.filter((i) => i.team !== READER).map((i) => i.slug);
const AT = '2026-10-15T00:00:00Z';

function mount(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
async function draw(body: KnowledgeBody) {
  window.history.replaceState(null, '', `/knowledge/${body.team}/${body.path}`);
  await act(async () => { mount(<KnowledgeNodeView read={{ state: 'ok', data: body, at: AT }} team={body.team} rel={body.path} />); });
}
const contextOf = (body: KnowledgeBody) => contextText(knowledgeNodeContext(body, { updatedAt: AT, now: new Date(AT) }));
/** The fake's shared lessons as the reader is answered them, each citing initiatives of the reader's team and others'. */
const read = (i: number) => lesson(SHARED_TEAM, SHARED[i].path, READER)!;

describe('a shared lesson, as a reader of one team is answered it', () => {
  it('is the fixture this depends on: each shared lesson cites the reader\'s team and others\'', () => {
    for (const i of [0, 1]) {
      const body = read(i);
      expect(body.shelf).toBe('shared');
      expect(body.evidence_in?.length, body.path).toBeGreaterThan(0);
      expect(body.cited_elsewhere, body.path).toBeGreaterThan(0);
    }
  });

  it.each([0, 1])('links its own team\'s initiatives and counts the others with no name and no link (lesson %i)', async (i) => {
    const body = read(i);
    await draw(body);
    for (const e of body.evidence_in!) expect(screen.getByRole('link', { name: e.name })).toHaveAttribute('href', `/initiatives/${READER}/${e.name}`);
    const n = body.cited_elsewhere;
    expect(text()).toContain(`${n} ${n === 1 ? 'initiative of another team' : 'initiatives of other teams'}`);
    for (const slug of ELSEWHERE) expect(text(), slug).not.toContain(slug);
    const links = [...document.querySelectorAll('a[href^="/initiatives/"]')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(body.evidence_in!.map((e) => `/initiatives/${READER}/${e.name}`));
  });

  it('is marked Shared, and nothing says read-only', async () => {
    await draw(read(0));
    expect(screen.getAllByText('Shared').length).toBeGreaterThan(0);
    expect(text()).toContain('On the platform\'s shared shelf');
    expect(text()).not.toMatch(/read[- ]only/i);
  });

  it.each([0, 1])('gives the assistant the same: its own team\'s initiatives by address, the rest as a count (lesson %i)', (i) => {
    const body = read(i);
    const t = contextOf(body);
    for (const e of body.evidence_in!) expect(t).toContain(`${e.name} (/initiatives/${READER}/${e.name})`);
    const n = body.cited_elsewhere;
    expect(t).toContain(`${n} ${n === 1 ? 'initiative of another team' : 'initiatives of other teams'}`);
    for (const slug of ELSEWHERE) expect(t, slug).not.toContain(slug);
    expect(t).not.toMatch(/read[- ]only/i);
    expect(t).not.toContain('names no initiative');
  });
});

describe('a lesson learned only in other teams\' initiatives', () => {
  const body: KnowledgeBody = { ...read(0), evidence: null, evidence_in: null, cited_elsewhere: 2 };

  it('says how many, links none, and never that it names no initiative', async () => {
    await draw(body);
    expect(text()).toContain('2 initiatives of other teams');
    expect(document.querySelectorAll('a[href^="/initiatives/"]')).toHaveLength(0);
    const t = contextOf(body);
    expect(t).toContain('2 initiatives of other teams');
    expect(t).not.toContain('names no initiative');
  });

  it('says it names no initiative only when it cites none at all', () => {
    expect(contextOf({ ...body, cited_elsewhere: 0 })).toContain('The node names no initiative it was learned in.');
  });
});

describe('a lesson of the reader\'s own team', () => {
  it('links what it cites and counts nothing elsewhere', async () => {
    const own = SHELF.find((n) => n.team === READER && n.evidence?.length)!;
    const body = lesson(READER, own.path, READER)!;
    expect(body.cited_elsewhere).toBe(0);
    await draw(body);
    for (const e of body.evidence_in!) expect(screen.getByRole('link', { name: e.name })).toHaveAttribute('href', `/initiatives/${e.team}/${e.name}`);
    expect(text()).not.toMatch(/of (another team|other teams)/);
    expect(screen.queryAllByText('Shared')).toEqual([]);
    expect(contextOf(body)).not.toMatch(/of (another team|other teams)/);
  });
});
