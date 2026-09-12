import { describe, it, expect } from 'vitest';
import { safeMarkdownUrl } from '@/lib/safe-markdown';

describe('safeMarkdownUrl', () => {
  it('drops a remote image, which is the beacon', () => {
    expect(safeMarkdownUrl('https://someone-else/p.png', 'src')).toBe('');
    expect(safeMarkdownUrl('//someone-else/p.png', 'src')).toBe('');
    expect(safeMarkdownUrl('data:image/png;base64,AAAA', 'src')).toBe('');
  });
  it('keeps a same-origin image', () => {
    expect(safeMarkdownUrl('/media/a.png', 'src')).toBe('/media/a.png');
    expect(safeMarkdownUrl('a/b.png', 'src')).toBe('a/b.png');
  });
  it('keeps a link a person can choose to follow', () => {
    expect(safeMarkdownUrl('https://example.com/x', 'href')).toBe('https://example.com/x');
    expect(safeMarkdownUrl('mailto:a@example.com', 'href')).toBe('mailto:a@example.com');
    expect(safeMarkdownUrl('/docs/x', 'href')).toBe('/docs/x');
  });
  it('drops a link that is not navigation', () => {
    expect(safeMarkdownUrl('javascript:alert(1)', 'href')).toBe('');
    expect(safeMarkdownUrl('JavaScript:alert(1)', 'href')).toBe('');
    expect(safeMarkdownUrl('vbscript:x', 'href')).toBe('');
  });
  it('does not mistake a colon in a path for a scheme', () => {
    expect(safeMarkdownUrl('some/path:with-colon', 'href')).toBe('some/path:with-colon');
  });
});
