/**
 * The Work pages as the review suites draw them: the browser reads those pages make, answered from the fake gateway's
 * own functions, and the providers a view is mounted in.
 *
 * One module because the reads are the gateway's routes, not a suite's: when a route a Work page reads in the browser
 * changes its path, the stub changes once. A copy left behind answers nothing, and the read it should have answered
 * hangs until the case times out with no word of why.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { expect, vi } from 'vitest';
import { SurfaceOverride } from '@/components/base/surface';
import type { KnowledgeBody, KnowledgeLogEntry, Me } from '@/lib/api-shapes';
import type { KnowledgeSummary } from '@/lib/destination-shapes';
import type { Home, RecordRead } from '@/lib/work-shapes';
import { RECORD_DEFAULTS, recordPath } from '@/logic/record-context';
import { HomeView } from '@/views/pages/home';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { RecordView } from '@/views/pages/record';
import { answered } from '../scripts/fake-gateway/envelope.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { KNOWLEDGE_LOG, SHELF, knowledgeList, knowledgeSummary, lesson, logOf } from '../scripts/fake-gateway/work-knowledge.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

/** The fake's answer to a read the browser makes on a Work page, by its path past `/api/console`; null for none. */
function workRead(who: Me, url: URL): unknown {
  const p = url.pathname.replace('/api/console', '');
  return p === '/me' ? who
    : p === '/activity/summary' ? activitySummary(who)[1]
      : p === '/activity' ? activityLog(who, url.searchParams)[1]
        : p === '/settings/team/members' ? teamMembers(url.searchParams.get('team') ?? '')
          : p === '/access' ? access(who)[1]
            : p === '/knowledge' ? knowledgeList(who, url.searchParams)[1] : null;
}

/** The browser's reads on a Work page, answered as the fake answers `who`; a read it has no answer for never answers. */
export function stubWorkReads(who: Me = ME) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const body = workRead(who, new URL(String(input), 'http://console.test'));
    return body === null ? new Promise(() => {}) : Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
  }));
}

/** `ui` in the console's providers; with `ask`, an assistant listening, so every Ask is drawn. */
export function mount(ui: ReactElement, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const inner = <Tooltip.Provider>{ui}</Tooltip.Provider>;
  return render(<QueryClientProvider client={client}>{ask ? <SurfaceOverride surface={{ ask }}>{inner}</SurfaceOverride> : inner}</QueryClientProvider>);
}

/** The whole page's text. */
export const text = () => document.body.textContent ?? '';

// The review of Work's Home, Record and Knowledge (review-work-a and -d): the superadmin's team, the moment its reads
// are stamped with, and the fake's answers to each page, as `pnpm verify` and the review's screenshots read them.
export const TEAM = 'atlas';
export const AT = '2026-10-19T12:00:00Z';
/** A fake route's answer, held to have been a 200. */
export const answer = <T,>(a: [number, unknown]) => { expect(a[0]).toBe(200); return a[1] as T; };
/** Record over `period`, its first page. */
export const recordFor = (period: 'quarter' | 'year' | 'all') => answer<RecordRead>(record(ME, new URLSearchParams({ period, limit: '10', offset: '0' })));
export const ALL = recordFor('all');
export const HOME: Home = answered(homeOf(TEAM, ME.email));
export const SUMMARY = answer<KnowledgeSummary>(knowledgeSummary(ME));
export const LOG: KnowledgeLogEntry[] = KNOWLEDGE_LOG.filter((e) => e.team === TEAM);
/** A lesson on the team's shelf, by its number. */
export const node = (num: string) => SHELF.find((n) => n.team === TEAM && n.num === num)!;
export const LESSON = lesson(TEAM, node('0002').path, TEAM) as KnowledgeBody;

/** Each page drawn at its address, with an assistant listening when `ask` is given. */
export function drawing(ask?: (q: string) => void) {
  const draw = async (path: string, ui: ReactElement) => {
    window.history.replaceState(null, '', path);
    await act(async () => { mount(ui, ask); });
  };
  return {
    draw,
    drawRecord: () => draw('/record', <RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: ALL, team: TEAM }} />),
    drawHome: () => draw('/', <HomeView read={{ state: 'ok', home: HOME, team: TEAM }} />),
    drawKnowledge: () => draw('/knowledge', <KnowledgeView read={{ state: 'ok', data: SUMMARY, at: AT }} />),
    drawLog: () => draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: logOf(LOG), at: AT }} />),
    drawNode: () => draw(`/knowledge/${TEAM}/${LESSON.path}`, <KnowledgeNodeView read={{ state: 'ok', data: LESSON, at: AT }} team={TEAM} rel={LESSON.path} />),
  };
}

/** The row of cards the card a heading titles stands in, if it stands in one. */
export const rowOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[data-split]') as HTMLElement | null;
