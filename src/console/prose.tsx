'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { safeMarkdownUrl, sanitizeUserVisibleMarkdown } from '@/lib/safe-markdown';

/**
 * A document or a skill, set for reading on Meridian's roles: a 72-character measure for running text, quiet tables,
 * code on the sunk surface. Markdown is drawn element by element rather than through a typography plugin, so every
 * colour is a role and both themes read.
 *
 * Nothing scrolls sideways. A fenced block wraps, and any long token (a URL, an inline code run, a path in a table
 * cell) breaks anywhere rather than pushing its paragraph or table past the card. `anywhere` and not `break-word`,
 * because only `anywhere` lowers the min-content width a table sizes its columns from.
 */
const COMPONENTS = {
  h1: ({ children }: ComponentProps<'h1'>) => <h2 className="mt-10 mb-4 text-xl font-semibold tracking-[-0.02em] text-ink first:mt-0">{children}</h2>,
  h2: ({ children }: ComponentProps<'h2'>) => <h3 className="mt-10 mb-3 border-t border-line pt-6 text-lg font-semibold tracking-[-0.015em] text-ink first:mt-0 first:border-0 first:pt-0">{children}</h3>,
  h3: ({ children }: ComponentProps<'h3'>) => <h4 className="mt-7 mb-2 text-md font-semibold text-ink">{children}</h4>,
  h4: ({ children }: ComponentProps<'h4'>) => <h5 className="mt-5 mb-2 text-base font-semibold text-ink">{children}</h5>,
  p: ({ children }: ComponentProps<'p'>) => <p className="my-3 max-w-[72ch]">{children}</p>,
  ul: ({ children, className }: ComponentProps<'ul'>) => <ul className={cn('my-3 max-w-[72ch] space-y-1.5 pl-5', className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc marker:text-ink-3')}>{children}</ul>,
  ol: ({ children }: ComponentProps<'ol'>) => <ol className="my-3 max-w-[72ch] list-decimal space-y-1.5 pl-5 marker:text-ink-3">{children}</ol>,
  strong: ({ children }: ComponentProps<'strong'>) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ href, children }: ComponentProps<'a'>) => <a href={href} className="link">{children}</a>,
  code: ({ children, className }: ComponentProps<'code'>) =>
    className ? <code className={className}>{children}</code> : <code className="rounded-xs border border-line bg-surface-sunk px-1 py-px font-mono text-[0.86em] text-ink">{children}</code>,
  pre: ({ children }: ComponentProps<'pre'>) => <pre className="my-4 rounded-lg border border-line bg-surface-sunk p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  table: ({ children }: ComponentProps<'table'>) => <div className="my-5 rounded-lg border border-line"><table className="w-full text-left text-sm leading-normal">{children}</table></div>,
  thead: ({ children }: ComponentProps<'thead'>) => <thead className="border-b border-line bg-surface-sunk">{children}</thead>,
  th: ({ children }: ComponentProps<'th'>) => <th className="px-3 py-2 text-xs font-medium text-ink-3">{children}</th>,
  tr: ({ children }: ComponentProps<'tr'>) => <tr className="border-b border-line last:border-0">{children}</tr>,
  td: ({ children }: ComponentProps<'td'>) => <td className="px-3 py-2.5 align-top text-ink-2">{children}</td>,
  blockquote: ({ children }: ComponentProps<'blockquote'>) => <blockquote className="my-4 border-l-2 border-accent pl-4 text-ink">{children}</blockquote>,
  hr: () => <hr className="my-8 border-line" />,
  // An image whose source the URL policy dropped reads as its alt text, not as a broken-image icon.
  img: ({ src, alt }: ComponentProps<'img'>) => (src ? <img src={String(src)} alt={alt ?? ''} className="max-w-full rounded-md" /> : <em className="text-ink-2">{alt || 'image not shown'}</em>),
  // A GFM task box: remark-gfm renders a bare disabled checkbox with no name; its state is the whole of what it says.
  input: (props: ComponentProps<'input'> & { node?: unknown }) => {
    const { node: _node, ...rest } = props;
    if (rest.type !== 'checkbox') return <input {...rest} />;
    return <input {...rest} aria-label={rest.checked ? 'done' : 'not done'} className="mr-2 size-3.5 align-[-2px] accent-(--accent)" />;
  },
};

export function Prose({ children, size = 'base', className }: { children: string; /** `sm` for a rail or a quoted body. */ size?: 'base' | 'sm'; className?: string }) {
  return (
    <div className={cn('min-w-0 text-ink-2 [overflow-wrap:anywhere]', size === 'base' ? 'text-base leading-[1.7]' : 'text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeMarkdownUrl} components={COMPONENTS as never}>
        {sanitizeUserVisibleMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
