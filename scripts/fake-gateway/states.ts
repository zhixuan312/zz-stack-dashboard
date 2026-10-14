/**
 * The fake gateway's other worlds: the same routes answered as a fresh deployment (`empty`) and as a busy one
 * (`extreme`). Each takes the normal answer and reshapes it, so a new route falls through unchanged rather than
 * breaking a mode nobody updated.
 */
import type {
  ActivityEvent, KnowledgeLogEntry, KnowledgeNode, Overview, Person, PlatformPersonRow, Runs, Skill, Team, WaitingGate,
} from '../../src/lib/api-shapes.ts';
import type { InitiativeList } from '../../src/lib/work-shapes.ts';

/** Nothing recorded yet: every list empty, every figure absent rather than zero where the API says so. */
export function empty(seg: string[], body: unknown): unknown {
  const [head, a, b] = seg;
  const list = (key: string) => ({ ...(body as object), [key]: [] });
  switch (head) {
    case 'overview': {
      const o = body as Overview;
      return {
        ...o,
        metrics: {
          progressing: { value: null, active: 0, scoreable: 0, stages: { noflow: 0, notstarted: 0, drafting: 0, agreed: 0, gated: 0, closed: 0 }, waiting: 0, waitingOldestDays: null, noDeltaBecause: o.metrics.progressing.noDeltaBecause },
          knowledge: { value: null, prev: null, fromWork: 0, imported: 0, searches: 0, importThresholdPerHour: o.metrics.knowledge.importThresholdPerHour },
          refusals: { value: null, prev: null, refused: 0, calls: 0, byDoor: [] },
          context: { value: null, prev: null, p90: null, runs: [], unmeasured: 0, capped: false, contextWindowKb: o.metrics.context.contextWindowKb },
        },
        counts: { teams: 0, activeTeams: 0, people: 1, superadmins: 1, documents: 0, initiatives: 0, events: 0, failures: 0, unattributedEvents: 0 },
        toolTrend: o.toolTrend.map((t) => ({ ...t, inside: 0, outside: 0, refused: 0 })),
        eventKinds: [],
        refusals: { total: 0, byTool: [], byMessage: [] },
      } satisfies Overview;
    }
    case 'teams': return a ? body : list('teams');
    // Two answers come off this route, as in `extreme` below: the list, and the bell's projection of what waits.
    case 'initiatives': return a && b ? body : 'waiting' in (body as object) ? list('waiting') : nothingListed(body as InitiativeList);
    case 'knowledge': return a === 'log' ? list('entries') : a ? body : list('nodes');
    case 'skills': return a ? { ...(body as object), surfaces: [], busiestTools: [] } : list('skills');
    case 'people': return list('people');
    case 'activity': return list('events');
    case 'runs': return { totals: { runs: 0, calls: 0, refusals: 0, mb: null } } satisfies Runs;
    case 'settings': return Array.isArray(body) ? (a === 'platform' ? (body as PlatformPersonRow[]).slice(0, 1) : []) : body;
    default: return body;
  }
}

/** The initiatives list of a team with no work: no row, every count zero, every week read and holding none. */
function nothingListed(l: InitiativeList): InitiativeList {
  const zero = { value: 0, why: null };
  return {
    ...l,
    tiles: { open: 0, waiting: 0, closed: { accepted: 0, delivered: 0, abandoned: 0 } },
    closures: l.closures.state === 'ok' ? { state: 'ok', data: l.closures.data.map((w) => ({ ...w, accepted: zero, delivered: zero, abandoned: zero })) } : l.closures,
    rows: [], total: 0,
    summary: l.summary.state === 'ok' ? { state: 'ok', data: {
      ...l.summary.data, total: 0, byFlow: [],
      byState: { open: 0, waiting: 0, quiet: 0, accepted: 0, delivered: 0, abandoned: 0 },
      touched: l.summary.data.touched.map((w) => ({ ...w, figure: zero, numerator: 0 })),
      previous: { ...l.summary.data.previous, total: 0 },
    } } : l.summary,
  };
}

const LONG = 'with-a-name-nobody-planned-for-because-it-came-from-a-ticket-title';
const big = (n: number) => n * 1_000 + (n % 7) * 137;

/**
 * `n` more rows, grown from the ones already there.
 *
 * Nothing to grow from means nothing invented. An empty answer is a real state — a team with no
 * work, a platform where nothing is waiting, a log with nothing recorded — and it is one the
 * console has to draw, so a mode named for the states a page must design for cannot overwrite it.
 *
 * It is also the only correct copy: `rows[i % 0]` is `undefined`, and spreading that leaves a row
 * carrying the overrides below and none of the fields they did not name. A team with no work came
 * back as 240 initiatives of `{ slug }` alone, and the console's initiative columns dereferenced
 * `stages` — so the page died in its error boundary on a shape no deployment sends.
 */
function grown<T>(rows: T[], n: number, more: (base: T, i: number) => T): T[] {
  if (!rows.length) return rows;
  return [...rows, ...Array.from({ length: n }, (_, i) => more(rows[i % rows.length], i))];
}

/**
 * A busy platform: six-figure counts, hundreds of rows, and names longer than any layout planned for.
 *
 * `own` is the one team a member is held to. However busy the platform, a member is still answered their own team,
 * so no row grown for them names another.
 */
export function extreme(seg: string[], body: unknown, own: string | null = null): unknown {
  const [head, a, b] = seg;
  switch (head) {
    case 'overview': {
      const o = body as Overview;
      return {
        ...o,
        toolTrend: o.toolTrend.map((t) => ({ ...t, inside: big(t.inside), outside: big(t.outside), refused: big(t.refused) })),
        eventKinds: [...o.eventKinds.map((k) => ({ ...k, n: big(k.n) })), ...Array.from({ length: 14 }, (_, i) => ({ kind: `custom.integration_event_with_a_long_name_${i + 1}`, n: 900 - i * 40 }))],
        counts: { ...o.counts, events: big(o.counts.events), failures: big(o.counts.failures), documents: 48_211, initiatives: 3_904, people: 1_250, teams: 214 },
        refusals: {
          total: big(o.refusals.total),
          byTool: o.refusals.byTool.map((r) => ({ ...r, n: big(r.n) })),
          byMessage: o.refusals.byMessage.map((r) => ({ ...r, n: big(r.n), message: `${r.message}. The argument was rejected before any write: the schema the client cached predates the release that renamed it, so every call from that client fails the same way until it reconnects.` })),
        },
      } satisfies Overview;
    }
    case 'teams': {
      if (a || own) return body;
      const t = (body as { teams: Team[] }).teams;
      return { teams: grown(t, 60, (base, i): Team => ({ ...base, slug: `team-${i + 1}-${LONG}`.slice(0, 63), name: `Regional delivery group ${i + 1}, ${LONG.replace(/-/g, ' ')}`, members: 300 + i, initiatives: 1_000 + i * 17, documents: 48_000 + i, sources: 120_000 + i, knowledge: 9_000 + i })) };
    }
    /* Two answers come off this route: the list, and the projection the alert bell asks for with
     * `?waiting=1`. Both are shaped here — a reader that recognises only one of them is a reader
     * that fails on the other, which is how this transform used to take the whole gateway down. */
    case 'initiatives': {
      if (a && b) return body;
      if (a === 'waiting' || 'waiting' in (body as object)) {
        const w = (body as { waiting: WaitingGate[] }).waiting ?? [];
        return { waiting: grown(w, 40, (base, i): WaitingGate => ({ ...base, id: `extreme/${i}`, gate: `approve spec ${LONG.replace(/-/g, ' ')}` })) };
      }
      // The list is paged on the server, so a busy team is a page of names longer than any layout planned for under
      // counts in the thousands, never more rows than the page asked for.
      const l = body as InitiativeList;
      const more = 3_904;
      return {
        ...l,
        tiles: { open: l.tiles.open + 812, waiting: l.tiles.waiting + 140, closed: { accepted: big(l.tiles.closed.accepted), delivered: big(l.tiles.closed.delivered), abandoned: big(l.tiles.closed.abandoned) } },
        rows: l.rows.map((r, i) => ({ ...r, slug: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}-${LONG}-${i}`, flow: r.flow && `${r.flow}-${LONG}` })),
        total: l.total ? l.total + more : 0,
        summary: l.summary.state === 'ok' && l.total ? { state: 'ok', data: { ...l.summary.data, total: l.summary.data.total + more } } : l.summary,
      } satisfies InitiativeList;
    }
    case 'knowledge': {
      if (a === 'log') {
        const entries = (body as { entries: KnowledgeLogEntry[] }).entries;
        return { entries: grown(entries, 300, (_, i): KnowledgeLogEntry => ({ ts: new Date(Date.now() - i * 3_600_000).toISOString(), actor: 'maximiliana.fitzgerald-oyelaran@example.com', team: own ?? 'atlas', kind: 'knowledge.add', node: String(1000 + i), recorded_title: `A lesson ${LONG.replace(/-/g, ' ')} number ${i}`, superseded_by: null, node_title: null, node_status: null })) };
      }
      if (a) return body;
      const n = (body as { nodes: KnowledgeNode[] }).nodes;
      return { nodes: grown(n, 300, (base, i): KnowledgeNode => ({ ...base, key: `extreme/${i}`, num: String(1000 + i).padStart(4, '0'), path: `nodes/${1000 + i}.md`, title: `When the gateway rejects an argument the client cached, reconnect before retrying, ${LONG.replace(/-/g, ' ')} (${i})`, tags: ['gateway', 'clients', 'schema-cache', 'reconnect', 'retries'] })) };
    }
    case 'skills': return a ? body : { skills: (body as { skills: Skill[] }).skills.map((s) => ({ ...s, runs: big(s.runs), calls: big(s.calls), refusals: big(s.refusals), durationTotal: s.durationTotal === null ? null : s.durationTotal * 900 })) };
    case 'people': {
      const p = (body as { people: Person[] }).people;
      return { people: grown(p, 180, (base, i): Person => ({ ...base, email: `person.${i}.${LONG}@example.com`, name: `Person ${i} ${LONG.replace(/-/g, ' ')}`, teams: own ? [`${own} (member)`] : Array.from({ length: 6 }, (_, j) => `team-${j + 1} (member)`), tokens: 40 + i })) };
    }
    case 'activity': return { ...(body as object), events: (body as { events: ActivityEvent[] }).events.map((e) => ({ ...e, subject: e.subject ? `${e.subject}_${LONG}` : e.subject })) };
    case 'runs': { const r = (body as Runs).totals; return { totals: { runs: big(r.runs), calls: big(r.calls), refusals: big(r.refusals), mb: r.mb === null ? null : r.mb * 1_000 } } satisfies Runs; }
    default: return body;
  }
}
