import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prose } from '@/components/patterns/prose';
import { safeMarkdownUrl } from '@/lib/safe-markdown';

describe('safeMarkdownUrl', () => {
  it('lets a reader follow http(s), mailto, tel and paths', () => {
    for (const u of ['https://zz-meridian.example/docs', 'http://x.example', 'mailto:ops@zz-meridian.example', 'tel:+441234', '/requests', 'notes/today', '#why', '//cdn.example/x'])
      expect(safeMarkdownUrl(u, 'href')).toBe(u);
  });
  it('drops a link to any other scheme', () => {
    for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'vbscript:x', 'file:///etc/passwd']) expect(safeMarkdownUrl(u, 'href')).toBe('');
  });
  it('fetches an image only from this origin', () => {
    expect(safeMarkdownUrl('/images/chart.png', 'src')).toBe('/images/chart.png');
    for (const u of ['https://elsewhere.example/p.png', '//elsewhere.example/p.png', 'data:image/png;base64,AAAA']) expect(safeMarkdownUrl(u, 'src')).toBe('');
  });
  it('reads a colon after a slash as part of a path', () => {
    expect(safeMarkdownUrl('a/path:with-colon', 'href')).toBe('a/path:with-colon');
  });
  it('drops a scheme the URL parser would only see after it strips the whitespace', () => {
    // A URL parser removes tab, newline and carriage return from anywhere in a URL, and leading
    // C0 controls and spaces from its ends, BEFORE it reads the scheme. So `java\tscript:` is
    // `javascript:` to every browser — and a policy that reads the tab as an ordinary path
    // character hands the link straight through. Every entry here is a link a reader clicks.
    const smuggled = [
      'java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)',
      '\u0000javascript:alert(1)', '\u0001javascript:alert(1)', ' javascript:alert(1)',
      'da\tta:text/html,<script>alert(1)</script>', 'vb\tscript:x',
    ];
    for (const u of smuggled) expect(safeMarkdownUrl(u, 'href'), u).toBe('');
    // The image rule too: whatever it is, an image is fetched without the reader agreeing to it.
    for (const u of ['ja\tvascript:x', 'da\tta:image/png;base64,AAAA']) expect(safeMarkdownUrl(u, 'src'), u).toBe('');
  });
});

describe('Prose', () => {
  it('keeps raw HTML as text, and links and images within the policy', () => {
    const { container } = render(
      <Prose>{"<script>alert('x')</script>\n\n[run](javascript:alert(1)) and [docs](https://zz-meridian.example/docs)\n\n![pixel](https://elsewhere.example/p.png)\n\n- [x] shipped\n- [ ] next"}</Prose>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent("<script>alert('x')</script>");
    expect(screen.queryByRole('link', { name: 'run' })).toBeNull();
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute('rel', 'noreferrer');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('pixel')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Not done' })).not.toBeChecked();
  });
  it('starts the writer\'s headings at h2, under the page\'s own h1', () => {
    render(<Prose>{'# Review\n\n## Why'}</Prose>);
    expect(screen.getByRole('heading', { level: 2, name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Why' })).toBeInTheDocument();
  });
});
