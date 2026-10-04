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
