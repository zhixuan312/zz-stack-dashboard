import { describe, expect, it } from 'vitest';
import { readableDocument } from '@/lib/document-markdown';

/**
 * What the reader's body is, after the store's markdown is prepared for it.
 *
 * Two things happen here and both were seen on a render. Acceptance criteria are stored one per line with no blank
 * line between them, which markdown joins into a wall of text, so a labelled item gets the blank line markdown needs.
 * And a document opens with `# <its own title>`, which the page's masthead is already showing at 55px — the reader saw
 * the same sentence twice, 200px apart, until this dropped it.
 */
describe('readableDocument', () => {
  it('separates a labelled item from the paragraph above it, and nothing else', () => {
    const body = 'A paragraph.\n**AC-1.1** `[me]` — booking is confirmed.\n**AC-1.2** `[me]` — a walk that is full.\n';
    expect(readableDocument(body)).toBe('A paragraph.\n\n**AC-1.1** `[me]` — booking is confirmed.\n\n**AC-1.2** `[me]` — a walk that is full.\n');
  });

  it('does not break a paragraph that is merely hard-wrapped', () => {
    // These documents wrap at about ninety characters, so a break at every newline would render every paragraph ragged.
    const body = 'One sentence that runs on\nand continues on the next line.\n';
    expect(readableDocument(body)).toBe(body);
  });

  it('drops the body\'s own title when the masthead is already showing it', () => {
    const body = '# Spec: relevance that explains itself\n\n## Context\n\nPeople search the archive.\n';
    expect(readableDocument(body, 'Spec: relevance that explains itself')).toBe('\n## Context\n\nPeople search the archive.\n');
    // The same sentence with different casing or spacing is still the same title.
    expect(readableDocument(body, ' spec: relevance THAT explains itself ')).not.toContain('# Spec:');
  });

  it('keeps a first heading that is a section, not the title', () => {
    const body = '# Context\n\nPeople search the archive.\n';
    expect(readableDocument(body, 'Spec: relevance that explains itself')).toBe(body);
  });

  it('keeps the title when the page has none to show', () => {
    const body = '# Spec: relevance that explains itself\n\nText.\n';
    expect(readableDocument(body)).toBe(body);
  });
});
