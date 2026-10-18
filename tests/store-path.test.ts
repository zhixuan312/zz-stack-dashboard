import { describe, expect, it } from 'vitest';
import { decodePath, encodePath } from '@/lib/store-path';

describe('a store path through an address', () => {
  it('encodes each segment and keeps the slashes as separators', () => {
    expect(encodePath('sources/2026-10-06-call notes.md')).toBe('sources/2026-10-06-call%20notes.md');
  });

  it('names the same path for a doubled or leading slash', () => {
    expect(encodePath('/sources//a.md')).toBe('sources/a.md');
  });

  it('decodes the route segments back into the path they were made from', () => {
    const path = 'sources/a b/c%d.md';
    expect(decodePath(encodePath(path).split('/'))).toBe(path);
  });
});
