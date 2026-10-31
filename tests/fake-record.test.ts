// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RecordRead } from '../src/lib/work-shapes.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { rowsOf } from '../scripts/fake-gateway/work-initiatives.ts';
import { NO_TEAM } from '../scripts/fake-gateway/work-activity.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

type Bests = Extract<RecordRead['firsts'], { state: 'ok' }>['data']['bests'];

// A best names one of the acting team's documents, and says what that document's own page says.
describe("the fake's Record bests", () => {
  it.each(ME.teams.map((t) => t.slug))('for %s name only its own documents, as each document reads', (team) => {
    const [status, body] = record({ ...ME, activeTeam: team }, new URLSearchParams());
    expect(status).toBe(200);
    const read = body as RecordRead;
    const bests = (read.firsts.state === 'ok' ? read.firsts.data.bests : []) as Bests;
    const slugs = rowsOf(team).map((r) => r.slug);
    for (const b of bests.filter((x) => x.subject !== null)) {
      const [slug, ...rest] = b.subject!.split('/');
      expect(slugs, `${b.key} names ${b.subject}`).toContain(slug);
      const doc = documentDetail(team, slug, rest.join('/'))!;
      if (b.key === 'most_sources') expect(b.value).toBe(doc.sources.length);
      if (b.key === 'most_versions') expect([b.value, b.at]).toEqual([doc.current_revision, doc.updated_at]);
    }
  });
});

// The gateway's Record refuses in this order: a person in no team, a repeated period or page, the period, the page.
describe("the fake's Record refusals", () => {
  const ask = (query: string, activeTeam: string | null = 'atlas') => record({ ...ME, activeTeam }, new URLSearchParams(query));
  it('refuses a person in no team before reading anything', () => {
    expect(ask('period=month', null)).toEqual(NO_TEAM);
  });
  it('refuses a repeated period, limit or offset in the gateway\'s words', () => {
    for (const q of ['limit=10&limit=50', 'period=all&period=year', 'offset=0&offset=10']) {
      expect(ask(q), q).toEqual([400, { error: 'the period and the page are given at most once' }]);
    }
  });
  it('refuses an unknown period and a bad page', () => {
    expect(ask('period=month')[0]).toBe(400);
    expect(ask('limit=0')).toEqual([400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }]);
  });
});
