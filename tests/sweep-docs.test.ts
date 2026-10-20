import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Review round 2's console findings held at the layer each one lives in (Task I-183):
 *
 * - R2-C11, R2-C13, R2-C15: a plugin, a skill or a release nobody recorded is answered by the missing page, and its tab
 *   says what the missing page's does, "Not found", never the name the address typed, so it cannot be told apart from
 *   an address that names nothing. A recorded one keeps its own title.
 * - R2-C25: the fake gateway's `slow` state holds a read longer than every bound a read is given, on the console's
 *   server and in the browser, so the state draws each page's bounded-unavailable state and not its content late.
 * - R2-C26: Work's prepared query counts words, runs, lessons and searches from the rows the pages draw, so an agent's
 *   `explore_<view>` answers the figure the page it is asked on shows.
 */
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { KnowledgeSummary, Runs } from '@/lib/destination-shapes';
import type { Home, RecordRead } from '@/lib/work-shapes';
import { MISSING_METADATA } from '@/views/missing';
import { evalPath, SCORES_PATH } from '@/views/plugin-context';
import { releasePath } from '@/views/platform-releases-context';
import { skillDetailPath, skillsPath, skillTextPath } from '@/views/skill-context';
import { localDay } from '../scripts/fake-gateway/clock.ts';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { releaseDetail, RELEASES } from '../scripts/fake-gateway/platform-releases.ts';
import { SLOW_MS } from '../scripts/fake-gateway/states-partial.ts';
import { home } from '../scripts/fake-gateway/work-home.ts';
import { LAST_WEEK, WEEKS } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeSummary } from '../scripts/fake-gateway/work-knowledge.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';
import { workQuery } from '../scripts/fake-gateway/work-query.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';
import { generateMetadata as pluginMetadata } from '../app/(dash)/plugins/[plugin]/page';
import { generateMetadata as skillMetadata } from '../app/(dash)/plugins/[plugin]/[skill]/page';
import { generateMetadata as releaseMetadata } from '../app/(dash)/platform/releases/[version]/page';

type Json = Record<string, any>;
const ROOT = path.resolve(import.meta.dirname, '..');

/** The fake gateway's answer to one console read, as `who`; a 404 or a 403 as the gateway's error. */
function answerOf(who: Me, p: string): unknown {
  const [route, query] = p.split('?');
  const q = new URLSearchParams(query ?? '');
  const body = ([status, b]: [number, unknown]) => {
    if (status !== 200) throw new GatewayError(status, (b as { error: string }).error);
    return b;
  };
  if (route === '/me') return who;
  if (route === '/plugins') return body(plugins(who) as [number, unknown]);
  if (route === SCORES_PATH) return evaluation(who.superadmin);
  if (route === '/skills') return body(skills(who, q) as [number, unknown]);
  const skill = /^\/skills\/([^/]+)$/.exec(route);
  if (skill) return body(skillDetail(who, decodeURIComponent(skill[1])) as [number, unknown]);
  const evaluated = /^\/plugins\/([^/]+)\/eval$/.exec(route);
  if (evaluated) return pluginEval(decodeURIComponent(evaluated[1]));
  const text = /^\/plugins\/([^/]+)\/skills\/([^/]+)$/.exec(route);
  if (text) {
    const t = skillText(decodeURIComponent(text[1]), decodeURIComponent(text[2]));
    if (!t) throw new GatewayError(404, 'No such skill.');
    return t;
  }
  const release = /^\/platform\/releases\/([^/]+)$/.exec(route);
  if (release) {
    const r = releaseDetail(decodeURIComponent(release[1]));
    if (!r) throw new GatewayError(404, 'No release of this version is recorded.');
    return r;
  }
  throw new Error(`no fake answer for ${p}`);
}

describe('a plugin, a skill or a release nobody recorded is titled as the missing page (R2-C11, R2-C13, R2-C15)', () => {
  const as = (who: Me) => gateway.get.mockImplementation(async (p: string) => answerOf(who, p));
  const params = <T>(p: T) => ({ params: Promise.resolve(p) });

  it('says "Not found" in the tab, and never the name typed', async () => {
    for (const who of [ME, MEMBER]) {
      as(who);
      expect(await pluginMetadata(params({ plugin: 'no-such-plugin' })), who.role).toEqual(MISSING_METADATA);
      expect(await skillMetadata({ ...params({ plugin: 'sdlc', skill: 'no-such-skill' }), searchParams: Promise.resolve({}) }), who.role).toEqual(MISSING_METADATA);
      expect(await releaseMetadata(params({ version: '9.9.9' })), who.role).toEqual(MISSING_METADATA);
    }
    // The reads the tab was decided by are the page's own: nothing else is asked.
    const asked = gateway.get.mock.calls.map(([p]) => p as string);
    expect(asked).toContain(evalPath('no-such-plugin'));
    expect(asked).toContain(skillTextPath('sdlc', 'no-such-skill'));
    expect(asked).toContain(releasePath('9.9.9'));
    expect(asked).toContain(skillsPath('sdlc'));
    expect(asked).toContain(skillDetailPath('no-such-skill'));
  });

  it('keeps a recorded one\'s own title', async () => {
    as(ME);
    expect(await pluginMetadata(params({ plugin: 'sdlc' }))).toEqual({ title: 'sdlc' });
    expect(await skillMetadata({ ...params({ plugin: 'sdlc', skill: 'sdlc-spec' }), searchParams: Promise.resolve({}) })).toEqual({ title: 'sdlc-spec' });
    expect(await releaseMetadata(params({ version: RELEASES[0].version }))).toEqual({ title: `Release ${RELEASES[0].version}` });
  });

  it('says what it would on a failed read: a read that failed is not a name nobody recorded', async () => {
    gateway.get.mockImplementation(async (p: string) => {
      if (p === '/me') return ME;
      throw new GatewayError(500, 'the gateway could not reach its database');
    });
    expect(await pluginMetadata(params({ plugin: 'sdlc' }))).toEqual({ title: 'sdlc' });
    expect(await releaseMetadata(params({ version: RELEASES[0].version }))).toEqual({ title: `Release ${RELEASES[0].version}` });
  });
});

describe('the fake\'s slow state is slower than every read bound (R2-C25)', () => {
  /** Every `<NAME>_BOUND_MS = <ms>` a read of the console's is given, on its server or in the browser. */
  function bounds(): [string, number][] {
    const found: [string, number][] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const at = path.join(dir, e.name);
        if (e.isDirectory()) walk(at);
        else if (/\.tsx?$/.test(e.name)) {
          for (const m of fs.readFileSync(at, 'utf8').matchAll(/\b([A-Z_]+_BOUND_MS)\s*=\s*([\d_]+)\s*;/g)) {
            found.push([`${path.relative(ROOT, at)} ${m[1]}`, Number(m[2].replaceAll('_', ''))]);
          }
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    walk(path.join(ROOT, 'app'));
    return found;
  }

  it('holds a page read and the status read past each of them', () => {
    const all = bounds();
    // One bound for every read: each page's, the identity read's and the browser's (R2-C44).
    expect(all.map(([name]) => name)).toEqual(['src/views/context.ts READ_BOUND_MS']);
    for (const [name, ms] of all) {
      expect(SLOW_MS, name).toBeGreaterThan(ms);
    }
  });
});

describe('Work\'s prepared query answers the figures its pages draw (R2-C26)', () => {
  const TODAY = localDay(Date.now());
  /** The total is the same whatever it is grouped by; each measure is grouped by period, its first that is no bucket. */
  const ask = (who: Me, args: Record<string, string>): Json => {
    const [status, body] = workQuery(who, new URLSearchParams({ by: 'period', ...args }));
    expect(status, JSON.stringify([args, body])).toBe(200);
    return body as Json;
  };
  const total = (who: Me, args: Record<string, string>) => ask(who, args).total.value;
  const read = <T>([status, body]: [number, unknown]): T => { expect(status).toBe(200); return body as T; };
  const PEOPLE = [['the superadmin', ME], ['the member', MEMBER]] as const;
  const ALL = { from: '0001-01-01', to: TODAY };

  it.each(PEOPLE)('words: each week Home and Record draw, as %s', (_, who) => {
    const weeks = (home(who) as Home).words;
    expect(weeks.state).toBe('ok');
    if (weeks.state !== 'ok') return;
    expect(total(who, { measure: 'words' })).toBe(weeks.data.weeks[LAST_WEEK].figure.value ?? 0);
    WEEKS.forEach((w, i) => expect(total(who, { measure: 'words', from: w.from, to: w.to }), w.from).toBe(weeks.data.weeks[i].figure.value ?? 0));
  });

  it.each(PEOPLE)('runs: every run Runs and Record count, as %s', (_, who) => {
    const page = read<Runs>(runs(who, new URLSearchParams()) as [number, unknown]);
    expect(total(who, { measure: 'runs', ...ALL })).toBe(page.tiles.runs.value);
    const rec = read<RecordRead>(record(who, new URLSearchParams({ period: 'all' })) as [number, unknown]);
    expect(rec.agents.state).toBe('ok');
    if (rec.agents.state === 'ok') expect(total(who, { measure: 'runs', ...ALL })).toBe(rec.agents.data.runs.value);
  });

  it.each(PEOPLE)('lessons: every lesson Home and Record count as made, as %s', (_, who) => {
    const made = (home(who) as Home).milestones;
    expect(made.state).toBe('ok');
    if (made.state === 'ok') expect(total(who, { measure: 'lessons', ...ALL })).toBe(made.data.find((m) => m.count === 'lessons')!.value);
    const rec = read<RecordRead>(record(who, new URLSearchParams({ period: 'all' })) as [number, unknown]);
    expect(rec.knowledge.state).toBe('ok');
    if (rec.knowledge.state === 'ok') expect(total(who, { measure: 'lessons', ...ALL })).toBe(rec.knowledge.data.adopted.value);
  });

  it.each(PEOPLE)('searches: last week\'s, and those that found nothing, as Knowledge draws them, as %s', (_, who) => {
    const k = read<KnowledgeSummary>(knowledgeSummary(who) as [number, unknown]);
    expect(total(who, { measure: 'searches' })).toBe(k.tiles.searches.figure.value);
    const found = Object.fromEntries(ask(who, { measure: 'searches', by: 'found' }).groups.map((g: Json) => [g.key, g.value.value]));
    expect(found.none ?? 0).toBe(k.tiles.noResult.numerator);
  });
});
