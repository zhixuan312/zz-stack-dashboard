import { describe, expect, it } from 'vitest';
import { collapse, type DiffLine } from '@/lib/diff';
import { formatKb, formatSeconds } from '@/lib/format-units';

describe('the console formatters choose the unit of the rounded figure', () => {
  it('formatSeconds never reads 60 of a unit', () => {
    expect(formatSeconds(0)).toBe('0 s');
    expect(formatSeconds(0.4)).toBe('< 1 s');
    expect(formatSeconds(42)).toBe('42 s');
    expect(formatSeconds(59.6)).toBe('1 min');
    expect(formatSeconds(3570)).toBe('1.0 h');
    expect(formatSeconds(3599)).toBe('1.0 h');
    expect(formatSeconds(420)).toBe('7 min');
    expect(formatSeconds(5040)).toBe('1.4 h');
    expect(formatSeconds(null)).toBe('—');
  });

  it('formatKb never reads 1024 KB', () => {
    expect(formatKb(840)).toBe('840 KB');
    expect(formatKb(1023.7)).toBe('1.0 MB');
    expect(formatKb(1638.4)).toBe('1.6 MB');
    expect(formatKb(null)).toBe('—');
  });
});

describe('the diff panel past its cap', () => {
  // 1,900 lines with a change every 12th: more than the panel draws.
  const lines: DiffLine[] = Array.from({ length: 1900 }, (_, i) =>
    (i % 12 === 0 ? { op: 'add', text: `new ${i}` } : { op: 'same', text: `line ${i}` }) as DiffLine);
  const changed = lines.filter((l) => l.op !== 'same').length;
  const { lines: shown, truncated } = collapse(lines);

  it('draws nothing past the cap, a skip marker included', () => {
    expect(shown.length).toBeLessThanOrEqual(1000);
    expect(shown.at(-1)?.op).not.toBe('skip');
  });

  it('counts only the changed lines it left out', () => {
    expect(truncated).toBe(changed - shown.filter((l) => l.op !== 'same' && l.op !== 'skip').length);
  });
});
