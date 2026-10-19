import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Record's running totals are counts, words added, closures and lessons made, so each axis is drawn in whole numbers:
 * a total whose top is 10 draws no level at 2.5 or 7.5 (Work M-19). ZZ Meridian's `TrendChart` takes `whole` for it
 * since 0.21.0 (#73), as `ColumnChart` does since 0.20.0. Read from the page's source: jsdom lays out no axis to read
 * a level from, and the rule is that every trend Record draws passes it.
 */
const source = fs.readFileSync(path.resolve(import.meta.dirname, '../src/views/pages/record.tsx'), 'utf8');
const trends = [...source.matchAll(/<TrendChart\b([^>]*?)\/?>/gs)].map((m) => m[1]);

describe('Record\'s running totals', () => {
  it('are three trend charts, one per running total', () => {
    expect(trends).toHaveLength(3);
  });

  it.each(trends.map((props, i) => [i, props]))('trend %i takes whole, its values being counts', (_i, props) => {
    expect(props).toMatch(/(^|\s)whole(\s|$)/);
  });
});
