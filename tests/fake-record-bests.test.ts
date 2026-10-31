// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RecordRead } from '../src/lib/work-shapes.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { rowsOf } from '../scripts/fake-gateway/work-initiatives.ts';
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
