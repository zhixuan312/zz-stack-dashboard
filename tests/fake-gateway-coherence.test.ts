// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { KnowledgeBody, PluginEvalFound, PluginRow, Skill, SkillDetail } from '../src/lib/api-shapes.ts';
import type { KnowledgeList, KnowledgeSummary, Runs } from '../src/lib/destination-shapes.ts';
import type { Evaluation, PeriodFigure, PlatformStatus, Releases } from '../src/lib/platform-shapes.ts';
import type { Home, RecordRead } from '../src/lib/work-shapes.ts';
import config from '../scripts/verify.config.ts';
import { localDay } from '../scripts/fake-gateway/clock.ts';

/**
 * The fake gateway tells one story (Task I-151, AC-8.4): every figure a page draws agrees with the pages that draw the
 * same thing, as the gateway computes each from one record. A non-builder's review found Home, Record, Runs, Knowledge,
 * a skill, a plugin, Status and Releases each drawing a figure another page contradicted, and every one of those was
 * the fixture's own seeds; this reads the fixture's answers as each page reads them, over HTTP with each person's
 * session, and holds every pair to one measure.
 *
 * Where two pages measure different things, the pair is not held equal: Knowledge's standing lessons count imports and
 * leave the superseded out, while Home's and Record's lessons are those made outside an import, so this holds Home to
 * Record and Knowledge to what its own shelf says of the made ones.
 */
type Json = Record<string, any>;

const personas = config.personas!;
const BOTH = [['the superadmin', personas.superadmin.cookie.value], ['the member', personas.member.cookie.value]] as const;
/** The sentence every lesson's body carried before each lesson had its own. */
const GENERIC = 'The initiative found it the slow way';

let server: ChildProcess;
let base = '';

beforeAll(async () => {
  const gateway = await startFakeGateway();
  server = gateway.proc;
  base = gateway.base;
});
afterAll(() => { server?.kill(); });

const read = async <T = Json>(who: string, path: string): Promise<T> => {
  const res = await fetch(`${base}/api/console/${path}`, { headers: { cookie: `zz_console=${who}` } });
  expect(res.status, `${who} GET ${path}`).toBe(200);
  return res.json() as Promise<T>;
};
const ok = <T>(part: { state: string; data?: T }): T => { expect(part.state).toBe('ok'); return part.data as T; };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** The window of `series` that begins where `from` does. */
const at = (series: PeriodFigure[], from: string) => series.find((p) => p.window.from === from);
/** `a` newer than `b`, part by part, as a release's version reads. */
const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};
const record = (who: string, period: string) => read<RecordRead>(who, `record?period=${period}&limit=100`);

describe.each(BOTH)('the fixture read as %s', (_, who) => {
  it("draws each skill's door split and busiest tools as parts of its calls and refusals", async () => {
    const { skills } = await read<{ skills: Skill[] }>(who, 'skills');
    expect(skills.length).toBeGreaterThan(3);
    for (const s of skills) {
      const detail = await read<SkillDetail>(who, `skills/${s.name}`);
      const logged = s.logged!;
      expect(logged.calls, s.name).toBe(s.calls);
      expect(logged.failed, s.name).toBe(s.refusals);
      expect(sum(detail.surfaces.map((d) => d.calls)), s.name).toBe(logged.calls);
      expect(sum(detail.surfaces.map((d) => d.failed)), s.name).toBe(logged.failed);
      expect(sum(detail.surfaces.map((d) => d.tools)), s.name).toBe(logged.tools);
      expect(sum(detail.busiestTools.map((t) => t.calls)), s.name).toBe(logged.calls);
      expect(sum(detail.busiestTools.map((t) => t.failed)), s.name).toBe(logged.failed);
      expect(detail.busiestTools, s.name).toHaveLength(logged.tools);
      // Each door's tools are the busiest tools named on that door.
      for (const d of detail.surfaces) {
        const mine = detail.busiestTools.filter((t) => t.tool.startsWith(`${d.surface}:`));
        expect([mine.length, sum(mine.map((t) => t.calls)), sum(mine.map((t) => t.failed))], `${s.name} ${d.surface}`).toEqual([d.tools, d.calls, d.failed]);
      }
    }
  });

  it.each(['all', 'quarter', 'year'])("reads Record's firsts, bests and medians, on %s, from the series its charts draw", async (period) => {
    const r = await record(who, period);
    const work = ok(r.work), docs = ok(r.documents), knowledge = ok(r.knowledge), agents = ok(r.agents), firsts = ok(r.firsts);
    const table = ok(r.record);
    expect(table.rows).toHaveLength(table.total);
    const inPeriod = (t: string | null) => t !== null && t >= r.meta.period.from && t < r.meta.period.to;
    const closed = table.rows.filter((x) => inPeriod(x.closed));
    const abandoned = closed.filter((x) => x.outcome === 'abandoned');

    // The medians are the record table's own hours.
    expect(work.medianHoursToClose.figure.value).toBe(closed.length ? median(closed.map((x) => x.tookHours!)) : null);
    expect(work.medianHoursToAbandon.figure.value).toBe(abandoned.length ? median(abandoned.map((x) => x.tookHours!)) : null);
    expect(work.medianHoursToAbandon.denominator).toBe(abandoned.length);
    for (const w of work.medianHoursByWeek) {
      const here = closed.filter((x) => x.closed! >= w.window.from && x.closed! < w.window.to);
      expect(w.figure.value, w.window.from).toBe(here.length ? median(here.map((x) => x.tookHours!)) : null);
    }
    expect(work.closuresInAll.at(-1)!.figure.value).toBe(table.rows.filter((x) => x.closed !== null).length);

    // The words: the running total sums the bars, and the best week is the tallest whole one.
    expect(r.cumulative.at(-1)!.figure.value).toBe(sum(docs.wordsByWeek.map((w) => w.figure.value ?? 0)));
    const best = firsts.bests.find((b) => b.key === 'most_words_week');
    if (docs.wordsByWeek[0] && Date.parse(docs.wordsByWeek[0].window.to) - Date.parse(docs.wordsByWeek[0].window.from) <= 7 * 864e5) {
      const whole = docs.wordsByWeek.filter((w) => w.window.complete && w.figure.value !== null);
      const top = Math.max(0, ...whole.map((w) => w.figure.value!));
      if (top) expect([best?.value, best?.at]).toEqual([top, whole.find((w) => w.figure.value === top)!.window.from]);
      else expect(best).toBeUndefined();
    } else if (best) {
      // At month grain a week's words are part of one month's bar or two, so no bar's month holds less than the best
      // week drawn whole inside it, and the best is never more than the whole period's words.
      expect(best.value).toBeLessThanOrEqual(sum(docs.wordsByWeek.map((w) => w.figure.value ?? 0)));
    }
    const open = firsts.bests.find((b) => b.key === 'most_open');
    expect([open?.value, open?.at]).toEqual([work.mostOpenAtOnce.value.value, work.mostOpenAtOnce.at]);

    // The firsts are the whole record's: each falls where its running total first leaves zero.
    const first = (key: string) => firsts.firsts.find((f) => f.key === key)?.at;
    const closedFirst = table.rows.flatMap((x) => (x.closed ? [x.closed] : [])).sort()[0];
    expect(first('closed')).toBe(closedFirst);
    if (period === 'all') {
      const leaves = (series: PeriodFigure[]) => series.find((p) => (p.figure.value ?? 0) > 0)!.window;
      const lesson = leaves(knowledge.adoptedInAll), closes = leaves(work.closuresInAll);
      expect(first('lesson')! >= lesson.from && first('lesson')! < lesson.to).toBe(true);
      expect(first('closed')! >= closes.from && first('closed')! < closes.to).toBe(true);
      expect(localDay(Date.parse(first('run')!))).toBe(agents.days.find((d) => d.runs > 0)!.day);
      expect(first('words_week')).toBe(docs.wordsByWeek.find((w) => (w.figure.value ?? 0) > 0)!.window.from);
    }
  });

  it('holds every lesson Knowledge shows in the knowledge log', async () => {
    const list = await read<KnowledgeList>(who, 'knowledge?limit=100');
    const { entries } = await read<{ entries: Json[] }>(who, 'knowledge/log');
    expect(list.rows).toHaveLength(list.total);
    const logged = new Set(entries.filter((e) => e.kind === 'knowledge.add').map((e) => `${e.team}/${e.node}`));
    for (const n of list.rows) expect(logged.has(`${n.team}/${n.num}`), n.key).toBe(true);
  });

  it('gives each plugin one newest score, on the list, Evaluation and its own page alike', async () => {
    const [{ plugins }, evaluation] = await Promise.all([read<{ plugins: PluginRow[] }>(who, 'plugins'), read<Evaluation>(who, 'platform/evaluation')]);
    for (const h of ok(evaluation.history)) {
      const newest = h.series.flatMap((s) => s.runs).filter((x) => x.score !== null).sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))[0];
      const row = plugins.find((p) => p.plugin === h.plugin);
      if (row) expect([row.score?.value ?? null, row.score?.scoredAt ?? null], h.plugin).toEqual([newest?.score ?? null, newest?.scoredAt ?? null]);
      const res = await fetch(`${base}/api/console/plugins/${h.plugin}/eval`, { headers: { cookie: `zz_console=${who}` } });
      const own = res.status === 200 ? (await res.json()) as PluginEvalFound : null;
      // A plugin whose newest version has no scored run yet says so; one that has scores it as the newest.
      if (own?.found && own.run) expect([own.run.overallScore, own.run.scoredAt], h.plugin).toEqual([newest.score, newest.scoredAt]);
    }
  });

  it("puts Home's runs, words and lessons where Runs, Record and Knowledge put them", async () => {
    const [home, runs, all, summary] = await Promise.all([
      read<Home>(who, 'home'), read<Runs>(who, 'runs?limit=100'), record(who, 'all'), read<KnowledgeSummary>(who, 'knowledge/summary'),
    ]);
    const active = ok(home.runs);
    const running = ok(runs.recent).rows.filter((x) => x.state === 'active');
    expect(sum(active.active.map((g) => g.runs.length)) + active.more).toBe(running.length);
    for (const g of active.active) for (const x of g.runs) expect(running.some((y) => y.skill === x.skill && y.initiative === g.initiative && y.lastCallAt === x.lastAt)).toBe(true);
    expect(active.lastRunAt).toBe(ok(runs.recent).rows[0].lastCallAt);

    const week = home.tiles.closed.window.from;
    const words = ok(home.words).weeks;
    for (const w of words) expect(at(ok(all.documents).wordsByWeek, w.window.from)?.figure.value ?? null, w.window.from).toBe(w.figure.value);
    expect(home.foot.estimate!.words).toBe(at(words, week)!.figure.value);
    const milestone = (count: string) => ok(home.milestones).find((m) => m.count === count)!.value;
    expect(milestone('words')).toBe(all.cumulative.at(-1)!.figure.value);
    expect(milestone('lessons')).toBe(ok(all.knowledge).adopted.value);
    expect(milestone('closed')).toBe(ok(all.work).closuresInAll.at(-1)!.figure.value);

    // Knowledge counts what stands, imports in and the superseded out: made outside an import is the same lessons.
    expect(milestone('lessons')).toBe(summary.tiles.standing.value! - summary.tiles.standing.imported + summary.tiles.superseded.value!);
    expect(sum(ok(all.knowledge).byKind.map((k) => k.lessons))).toBe(summary.tiles.standing.value);
  });

  it("counts Knowledge's searches with results as Home and Record count them", async () => {
    const [home, summary, all] = await Promise.all([read<Home>(who, 'home'), read<KnowledgeSummary>(who, 'knowledge/summary'), record(who, 'all')]);
    const tile = home.tiles.searchesWithResults;
    const week = at(ok(summary.weeks), tile.window.from)!;
    expect([tile.numerator, tile.denominator, tile.figure.value]).toEqual([week.numerator, week.denominator, week.figure.value]);
    for (const w of ok(summary.weeks)) {
      const r = at(ok(all.knowledge).searchesWithResults, w.window.from);
      if (r) expect([r.numerator, r.denominator], w.window.from).toEqual([w.numerator, w.denominator]);
    }
  });

  it('shows on Runs, on "all", every run Record counts', async () => {
    const [runs, all] = await Promise.all([read<Runs>(who, 'runs?limit=100'), record(who, 'all')]);
    const agents = ok(all.agents);
    expect(ok(runs.recent).total).toBe(agents.runs.value);
    expect(sum(agents.bySkill.map((s) => s.runs))).toBe(agents.runs.value);
    for (const s of ok(runs.bySkill).rows) expect(agents.bySkill.find((x) => x.skill === s.skill)?.runs, s.skill).toBe(s.runs);
    expect(agents.skillsUsed.value).toBe(ok(runs.bySkill).rows.length);
    expect(sum(agents.days.map((d) => d.runs))).toBe(agents.runs.value);
    expect(agents.peak.value).toBe(runs.coverage.peak);
    expect(agents.coverageMs.value).toBe(runs.coverage.coverageMs);
  });

  it("says on Status what Releases says of the running release and the migrations", async () => {
    const [status, list] = await Promise.all([read<PlatformStatus>(who, 'platform/status'), read<Releases>(who, 'platform/releases?limit=100')]);
    const running = ok(status.running);
    expect(running.migrations).toBe(list.tiles.migrations.applied);
    const row = ok(list.rows).rows.find((x) => x.version === running.platform);
    expect(row?.releasedAt).toBe(running.releasedAt);
    expect(ok(list.rows).rows.some((x) => x.version === running.previous)).toBe(true);
  });

  it('lists releases whose versions read in order, newest first, each the one before the next', async () => {
    const list = await read<Releases>(who, 'platform/releases?limit=100');
    const rows = ok(list.rows).rows;
    for (let i = 1; i < rows.length; i++) {
      const [was, then] = [rows[i].version, rows[i - 1].version];
      expect(newer(then, was), `${then} before ${was}`).toBe(true);
      // One line of releases: no minor version skipped between two neighbours.
      expect(Number(then.split('.')[1]) - Number(was.split('.')[1]), `${then} after ${was}`).toBeLessThanOrEqual(1);
    }
  });

  it("gives each lesson a body of its own", async () => {
    const list = await read<KnowledgeList>(who, 'knowledge?limit=100');
    const bodies = await Promise.all(list.rows.map((n) => read<KnowledgeBody>(who, `knowledge/${n.team}/${n.path}`)));
    const after = (b: KnowledgeBody) => b.body.trim().split('\n').slice(1).join('\n').trim();
    for (const b of bodies) {
      expect(b.body, b.path).not.toContain(GENERIC);
      expect(after(b).length, b.path).toBeGreaterThan(40);
    }
    expect(new Set(bodies.map(after)).size).toBe(bodies.length);
  });
});
