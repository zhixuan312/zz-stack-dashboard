// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ cacheTag: () => {}, cacheLife: () => {}, updateTag: () => {}, revalidateTag: () => {}, revalidatePath: () => {}, refresh: () => {} }));

import { collections } from '@/data/collections';
import { exploreSchema, type PreparedQuery } from '@/lib/explore';
import { viewTools } from '@/views/tools';

/**
 * Every view tool has its prepared query (FR-38, FR-42, AC-14.1): a test fails a view tool without one. Each query names,
 * for each source, a collection the product declares, the filters, facets and buckets an agent may use, measures with a
 * label, a unit and a definition, a drill whose columns include the collection's key, and what its answers cannot say;
 * it reads at most five sources, and the whole of what it offers fits 6,000 characters of JSON Schema.
 */
describe('every view tool has its prepared query', () => {
  it('declares one on each view tool', () => {
    expect(viewTools.length).toBeGreaterThan(0);
    for (const v of viewTools) expect(v.explore, `view_${v.name}`).toBeTruthy();
  });

  for (const v of viewTools) {
    it(`view_${v.name}: its sources, each declared in full, within five and 6,000 characters`, () => {
      const q = v.explore as PreparedQuery;
      const sources = Object.entries(q.sources);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.length).toBeLessThanOrEqual(5);
      for (const [name, s] of sources) {
        const c = collections.find((x) => x.name === s.collection);
        expect(c, `${v.name}.${name} reads a declared collection`).toBeTruthy();
        expect(s.drill.columns, `${v.name}.${name}'s drill names the key`).toContain(c!.key);
        expect(Object.keys(s.measures).length, `${v.name}.${name} has a measure`).toBeGreaterThan(0);
        for (const [m, d] of Object.entries(s.measures)) for (const k of ['label', 'unit', 'definition'] as const) expect(d[k], `${v.name}.${name}.${m}.${k}`).toBeTruthy();
        expect(s.cannot.length, `${v.name}.${name} says what it cannot say`).toBeGreaterThan(0);
        for (const f of [...Object.keys(s.filters), ...s.facets]) expect((c!.hidden ?? []) as string[], `${v.name}.${name}.${f}`).not.toContain(f);
      }
      const own = v.page.includes('[') ? (v.input as z.ZodObject) : undefined;
      expect(JSON.stringify(z.toJSONSchema(exploreSchema(q, null, own))).length, `view_${v.name}`).toBeLessThanOrEqual(6000);
    });
  }
});
