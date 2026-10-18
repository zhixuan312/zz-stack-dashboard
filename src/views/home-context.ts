/**
 * Home's shared context (decision 0011), and every word its cards are drawn with: the active team's last whole week, what
 * waits on it, and what is open, from the one `Home` the gateway answered. The page draws these words and the assistant
 * is told the same ones, as the page's shared context and through `view_home`, which reads the same response, so it
 * quotes the figures the screen shows.
 *
 * Nothing here works a figure out: the title, the findings, the estimate, the milestones and the counts are the
 * gateway's, and a figure the gateway could not read is said to be unavailable, never drawn as zero.
 */
import { formatPercent, plural } from '@/lib/format';
import { formatDateTime, formatDay, formatRelative } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Fact, Insight, SharedContext } from '@/lib/shared-context';
import type { Figure, PeriodFigure, ReadMeta, Window } from '@/lib/platform-shapes';
import type { Home, InitiativeRow, WritingCoverage } from '@/lib/work-shapes';
import { budgeted, clip, pendingContext } from './context';
import { nextOf } from './initiatives-context';

/** How long the page waits for Home's read before it says the read is unavailable: half a second under five, for a
 *  phone to draw what it says, the bound the browser's own reads keep (`src/lib/api.ts`). */
export const HOME_BOUND_MS = 4_500;

/** What the page's one read came back as: Home with the team it is for, a read that failed, or one slower than its bound. */
export type HomeRead =
  | { state: 'ok'; home: Home; team: string | null }
  | { state: 'failed' }
  | { state: 'slow' };

type Weeks = PeriodFigure[];

/** A week as a person reads it: `week of 5 Oct`. */
export const weekOf = (w: Window): string => `week of ${formatDay(w.from)}`;
/** The pill's words for a pointed column: `Week of 5 Oct`. */
export const pointLabel = (from: string): string => `Week of ${formatDay(from)}`;
/** The page's as-of line: the read's own cutoff, in the console's zone. */
export const asOfLine = (meta: ReadMeta): string => `As of ${formatDateTime(meta.asOf)}`;
/** A moment against the read's own cutoff, never the browser's clock: `3 h ago`. */
export const since = (at: string, meta: ReadMeta): string => formatRelative(at, new Date(meta.asOf));
/** Hours as the foot and the tiles say them: one decimal under ten, whole above. */
const formatHours = (h: number): string => `${h < 10 ? h.toFixed(1) : formatCount(Math.round(h))} h`;

/** The last whole week: the window every tile is for. */
export const lastWeekOf = (home: Home): Window => home.tiles.closed.window;

/** The two halves' weeks, oldest first, the running one last; null where the part could not be read. */
export function halvesOf(home: Home): { words: Weeks | null; approvals: Weeks | null; dates: string[] } {
  const words = home.words.state === 'ok' ? home.words.data.weeks : null;
  const approvals = home.approvals.state === 'ok' ? home.approvals.data.weeks : null;
  return { words, approvals, dates: (words ?? approvals ?? []).map((w) => w.window.from) };
}

/** The figure of the week that starts where `w` does, in `weeks`. */
export const weekIn = (weeks: Weeks | null, w: Window): PeriodFigure | undefined => weeks?.find((x) => x.window.from === w.from);

/** What a figure with no value is called, by why it has none. */
export function absent(why: Figure['why'], what: string): string {
  if (why === 'no_data') return `No ${what} recorded`;
  if (why === 'insufficient') return 'Too few to say';
  return 'Unavailable';
}

/** Each half: its kicker, the words a missing week reads as, and what its columns count. */
export const HALVES = {
  words: { kicker: 'Words added · last week', what: 'words', chart: 'Words added by week', none: 'No words recorded', unread: 'The words added could not be read.' },
  approvals: { kicker: 'Approvals in your name · last week', what: 'approvals', chart: 'Approvals in your name by week', none: 'No approvals recorded', unread: 'The approvals in your name could not be read.' },
} as const;

/** What the words are counted over, and what they leave out, in one line under the figure. */
export function coverageLine(c: WritingCoverage): string {
  const gaps = [
    c.importMade ? `${formatCount(c.importMade)} made by an import left out` : '',
    c.unrecorded ? `${formatCount(c.unrecorded)} with no recorded write` : '',
    c.missingLegacy ? `${formatCount(c.missingLegacy)} missing an earlier revision` : '',
  ].filter(Boolean);
  return `Net additions over ${formatCount(c.documents)} ${plural(c.documents, 'document')}, by week${gaps.length ? `; ${gaps.join(', ')}` : ''}.`;
}

export const APPROVALS_LINE = 'Revisions approved in your name, by week; a teammate\'s approvals are not counted.';

/** The foot's three figures, each as it reads, and the words beside the estimate. */
export function footOf(home: Home): { estimate: string; pace: string | null; coverage: string; peak: string } {
  const { estimate, coverageMs, peak } = home.foot;
  return {
    estimate: !estimate ? 'Unavailable' : estimate.hours === null ? 'No words recorded' : formatHours(estimate.hours),
    pace: estimate ? `estimated at ${formatCount(estimate.assumedWordsPerHour)} words an hour` : null,
    coverage: coverageMs.value === null ? absent(coverageMs.why, 'runs') : formatHours(coverageMs.value / 3_600_000),
    peak: peak.value === null ? absent(peak.why, 'runs') : `${formatCount(peak.value)} at once`,
  };
}

export const FOOT = {
  estimate: 'One person, writing this',
  coverage: 'Observed run coverage',
  peak: 'Peak concurrency',
  estimateHint: 'Last week\'s recorded net word additions at a stated pace: an estimate, not a measurement of anybody\'s time.',
} as const;

/** The four tiles: each one's label and what it counts, which the tile's info button and the assistant both read. */
export const TILES = {
  closed: { label: 'Work closed', hint: 'Initiatives closed in the week, whatever their outcome.' },
  medianHoursToClose: { label: 'Median hours to close', hint: 'The median time from opening to closing, over the week\'s closures.' },
  searchesWithResults: { label: 'Searches with results', hint: 'The share of the team\'s searches in the week that returned something: retrieval, not a proven answer.' },
  agentDays: { label: 'Days your agents ran', hint: 'The days of the week your agents made a real-work tool call; nothing about anybody\'s working hours.' },
} as const;
export type TileKey = keyof typeof TILES;

/** A tile as it reads: its figure (a number, or a word when there is none) and the one line under it. */
export function tileOf(key: TileKey, p: PeriodFigure): { value: number | string; note: string } {
  const week = weekOf(p.window);
  const { value, why } = p.figure;
  if (value === null) return { value: why === 'no_data' && key === 'medianHoursToClose' ? 'Nothing closed' : absent(why, key === 'searchesWithResults' ? 'searches' : 'work'), note: why === 'unavailable' ? `Not worked out for the ${week}` : `The ${week}` };
  if (key === 'medianHoursToClose') return { value, note: p.denominator !== null ? `Over ${formatCount(p.denominator)} ${plural(p.denominator, 'piece')} of work` : `The ${week}` };
  if (key === 'searchesWithResults') return { value: value / 100, note: p.numerator !== null && p.denominator !== null ? `${formatCount(p.numerator)} of ${formatCount(p.denominator)} searches` : `The ${week}` };
  if (key === 'agentDays') return { value, note: p.denominator !== null ? `Of ${formatCount(p.denominator)} days, the ${week}` : `The ${week}` };
  return { value, note: `The ${week}` };
}

/** How each tile's number reads. */
export const TILE_FORMAT: Record<TileKey, (n: number) => string> = {
  closed: formatCount,
  medianHoursToClose: formatHours,
  searchesWithResults: (n) => formatPercent(n, 0),
  agentDays: formatCount,
};

/** What waits: nothing, one revision with where it is, or how many and since when; or that it could not be read. */
type Waiting =
  | { kind: 'none' }
  | { kind: 'unavailable' }
  | { kind: 'one'; title: string; detail: string; href: string }
  | { kind: 'many'; title: string; detail: string; href: string };

export function waitingOf(home: Home, team: string | null): Waiting {
  if (home.waiting.state !== 'ok') return { kind: 'unavailable' };
  const { count, oldestSince, one } = home.waiting.data;
  if (!count) return { kind: 'none' };
  const sinceWhen = oldestSince ? `, the oldest since ${formatDay(oldestSince)}` : '';
  if (count === 1 && one) {
    return {
      kind: 'one',
      title: `${one.path}, version ${one.version}, waits for approval`,
      detail: `In ${one.initiative}${oldestSince ? `, since ${formatDay(oldestSince)}` : ''}.`,
      href: team ? `/initiatives/${team}/${one.initiative}/${one.path}` : '/approvals',
    };
  }
  return { kind: 'many', title: `${formatCount(count)} ${plural(count, 'revision waits', 'revisions wait')} for approval`, detail: `Presented and not yet approved${sinceWhen}.`, href: '/approvals' };
}

/** The milestones' names, as a person reads each count. */
export const MILESTONE = { closed: 'Pieces of work closed', documents: 'Documents created', lessons: 'Lessons adopted', words: 'Words added' } as const;

/** How far a milestone has come from the last round number passed to the next, as a fraction. */
export const covered = (m: { last: number; next: number; value: number }): number => (m.next > m.last ? Math.min(1, Math.max(0, (m.value - m.last) / (m.next - m.last))) : 0);

/** An open initiative as its row reads in words: its state, its gates and where it goes next. */
const openLine = (r: InitiativeRow): string =>
  `${clip(r.slug)} (${r.state}, ${r.gates.of ? `${r.gates.passed} of ${r.gates.of} gates` : 'no gates'}; next: ${nextOf(r)})`;

const VIEW = { view: 'home', title: 'Home', address: '/' } as const;

/** What a read that did not bring Home is called on the page, and the one sentence under it. */
export function troubleOf(state: Exclude<HomeRead['state'], 'ok'>): { title: string; detail: string } {
  if (state === 'slow') return { title: 'Home is unavailable', detail: `The platform did not answer within ${HOME_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: 'Home did not load', detail: 'The platform did not answer the read. Nothing on this page was read.' };
}

/** A half's figure for one week, as the context says it, with its noun: `15,400 words added`, `no approvals recorded`. */
function said(weeks: Weeks | null, w: Window, half: keyof typeof HALVES): string {
  const noun = half === 'words' ? 'words added' : 'approvals in your name';
  if (!weeks) return `${noun} unavailable`;
  const p = weekIn(weeks, w);
  if (!p) return `${noun} not in the record`;
  const n = p.figure.value;
  if (n === null) return absent(p.figure.why, HALVES[half].what).toLowerCase();
  const counted = half === 'words' ? `${formatCount(n)} ${plural(n, 'word')} added` : `${formatCount(n)} ${plural(n, 'approval')} in your name`;
  return `${counted}${p.window.complete ? '' : ' so far'}`;
}

/**
 * Home's context for `read`, with the person pointing at week `index` of the paired chart, or at none: the cursor is
 * part of what the page shows, so "why this week?" has a referent.
 */
export function homeContext(read: HomeRead, { index = null }: { index?: number | null } = {}): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = troubleOf(read.state);
    return pendingContext({ ...VIEW, scope: 'your team\'s last whole week' }, `${title}. ${detail}`);
  }
  const { home, team } = read;
  const last = lastWeekOf(home);
  const { words, approvals, dates } = halvesOf(home);
  const foot = footOf(home);

  const facts: Fact[] = [
    { label: 'Title', value: home.title.sentence },
    { label: 'Words added', value: said(words, last, 'words'), change: `the ${weekOf(last)}`, definition: 'Net words the documents and lessons gained, an import\'s left out' },
    { label: 'Approvals in your name', value: said(approvals, last, 'approvals'), definition: 'Never a teammate\'s' },
    { label: FOOT.estimate, value: foot.pace ? `${foot.estimate}, ${foot.pace}` : foot.estimate, definition: FOOT.estimateHint },
    { label: FOOT.coverage, value: foot.coverage, definition: 'Hours of the week with an observed run' },
    { label: FOOT.peak, value: foot.peak, definition: 'The most observed runs at one moment' },
    ...(Object.keys(TILES) as TileKey[]).map((k): Fact => {
      const t = tileOf(k, home.tiles[k]);
      return { label: TILES[k].label, value: typeof t.value === 'number' ? TILE_FORMAT[k](t.value) : t.value, change: t.note, definition: TILES[k].hint };
    }),
  ];

  const insights: Insight[] = [];
  const unknowns: string[] = [];
  const waiting = waitingOf(home, team);
  if (waiting.kind === 'one' || waiting.kind === 'many') insights.push({ text: `${waiting.title}. ${waiting.detail}`, evidence: waiting.href });
  else if (waiting.kind === 'none') insights.push({ text: 'Nothing waits for approval.' });
  else unknowns.push('What waits for approval could not be read, so nothing can be said about it; it is not an all-clear.');

  if (home.openWork.state === 'ok') {
    const { rows, quiet, total } = home.openWork.data;
    insights.push({
      text: total
        ? `${formatCount(total)} open ${plural(total, 'initiative')}, waiting first: ${rows.map(openLine).join('; ')}${quiet ? `; and ${formatCount(quiet)} quiet, untouched for 14 days or more` : ''}.`
        : 'No initiative is open.',
      evidence: '/initiatives',
    });
  } else unknowns.push('The open work could not be read.');

  const findings = [home.words.state === 'ok' ? home.words.data.finding : null, home.approvals.state === 'ok' ? home.approvals.data.finding : null].filter((f) => f !== null);
  for (const f of findings) insights.push({ text: `${f.text}.` });

  if (home.closedLastWeek.state === 'ok') {
    const closed = home.closedLastWeek.data;
    insights.push({ text: closed.length ? `Closed in the ${weekOf(last)}: ${closed.map((c) => `${clip(c.slug)} (${c.outcome})`).join('; ')}.` : `Nothing closed in the ${weekOf(last)}.` });
  } else unknowns.push('Last week\'s closures could not be read.');

  if (home.runs.state === 'ok') {
    const { active, more, lastRunAt } = home.runs.data;
    const n = active.reduce((a, g) => a + g.runs.length, 0) + more;
    insights.push({
      text: n
        ? `${formatCount(n)} ${plural(n, 'run')} active now: ${active.map((g) => `${g.initiative ? clip(g.initiative) : 'no initiative'} (${g.runs.map((r) => r.skill).join(', ')})`).join('; ')}${more ? `; and ${formatCount(more)} more` : ''}.`
        : lastRunAt ? `No run is active now; the last ended ${since(lastRunAt, home.meta)}.` : 'No run is active now, and none is recorded.',
      evidence: '/runs',
    });
  } else unknowns.push('The runs active now could not be read.');

  if (home.milestones.state === 'ok' && home.milestones.data.length) {
    insights.push({ text: `Next milestones: ${home.milestones.data.map((m) => `${MILESTONE[m.count].toLowerCase()} ${formatCount(m.value)} of ${formatCount(m.next)}`).join('; ')}.` });
  }

  if (home.words.state === 'ok') unknowns.push(`Words added: ${coverageLine(home.words.data.coverage)}`);
  else unknowns.push('The words added could not be read, so there is no estimate of what they would take to write.');
  if (home.approvals.state !== 'ok') unknowns.push('The approvals in your name could not be read.');

  // The week the cursor is on: both halves' figures, the running week said to be so far.
  const at = index !== null && dates[index] ? (words ?? approvals)![index].window : null;
  const focus = at ? `the ${weekOf(at)}: ${said(words, at, 'words')}, ${said(approvals, at, 'approvals')}` : undefined;

  return budgeted({
    ...VIEW,
    scope: `${home.meta.population}, the ${weekOf(last)}`,
    freshness: `${asOfLine(home.meta)}.`,
    focus,
    facts,
    insights,
    unknowns,
  });
}
