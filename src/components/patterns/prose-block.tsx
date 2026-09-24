'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Children, Fragment, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { safeMarkdownUrl, sanitizeUserVisibleMarkdown } from '@/lib/safe-markdown';

/* Nothing in a document scrolls sideways. A fenced block wraps, and a table cell breaks a
   long token anywhere rather than pushing the table past its card. */
const FIT = 'prose-pre:whitespace-pre-wrap prose-pre:break-words prose-td:[overflow-wrap:anywhere] ';

/* Content fills its card.
 *
 * Tailwind Typography caps a prose block at 65ch, which is why every variant clears it with
 * `max-w-none`. Capping the text elements and leaving tables full width puts a 74ch paragraph
 * beside a full-width ledger in the same card; shrinking the page instead makes one page of
 * twenty half the width of the other nineteen under a full-width header band.
 *
 * A long measure is the smaller cost. If it needs solving, it is solved by the card's width,
 * in one place, for everything in it — not by singling out the paragraphs. */
const VARIANT_CLASSES = {
  document:
    FIT + 'prose prose-sm max-w-none text-ink',
  rail:
    FIT + 'prose prose-sm max-w-none text-ink min-w-0 ' +
    'prose-headings:mt-0 prose-headings:mb-2 prose-h3:text-sm prose-h3:font-semibold prose-h3:text-ink ' +
    'prose-p:my-1.5 prose-p:text-xs prose-p:leading-relaxed prose-p:text-ink-soft ' +
    'prose-strong:text-ink prose-strong:font-semibold ' +
    'prose-ul:my-1.5 prose-ul:pl-4 prose-ul:list-disc ' +
    'prose-li:my-0.5 prose-li:text-xs prose-li:text-ink-soft prose-li:marker:text-accent ' +
    'prose-hr:my-3 prose-hr:border-accent-tint ' +
    'prose-code:rounded prose-code:bg-accent-tint/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.7rem] ' +
    'prose-code:font-medium prose-code:text-accent-deep prose-code:before:content-none prose-code:after:content-none',
  compact:
    FIT + 'prose prose-sm max-w-none text-ink ' +
    'prose-headings:mt-0 prose-headings:mb-1 ' +
    'prose-p:my-0.5 prose-p:text-xs prose-p:text-ink-soft ' +
    'prose-ul:my-0.5 prose-ul:pl-3',
} as const;

type ProseVariant = keyof typeof VARIANT_CLASSES;

function CodeBlock(props: ComponentProps<'code'> & { node?: unknown }) {
  const { className, children, node: _node, ...rest } = props;
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

/** An image whose source the URL policy dropped. Rendered as its own alt text rather than as
 *  a broken-image icon: the reader should see what the author meant to show them, and a
 *  document that silently loses a figure is harder to explain than one that says so. */
function DroppedImage(props: ComponentProps<'img'> & { node?: unknown }) {
  const { src, alt, node: _node } = props;
  if (!src) return <em className="text-ink-soft">{alt || 'image not shown'}</em>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ''} />;
}

interface ProseBlockProps {
  children: string;
  variant?: ProseVariant;
  className?: string;
  /**
   * Decorate plain-text runs of the rendered markdown — e.g. highlighting @-mentions.
   *
   * Applied to string children only, so it never sees markup and cannot inject any: it
   * receives text react-markdown has already parsed out, and whatever it returns is React
   * nodes, not HTML.
   */
  highlight?: (text: string) => ReactNode;
}

/** Map a component's children, passing every string run through `highlight`. */
function decorate(children: ReactNode, highlight: (t: string) => ReactNode): ReactNode {
  return Children.map(children, (child, i) =>
    typeof child === 'string' ? <Fragment key={i}>{highlight(child)}</Fragment> : child,
  );
}

export function ProseBlock({ children, variant = 'document', className, highlight }: ProseBlockProps) {
  // Only the elements that carry prose. Headings and code are deliberately excluded: a
  // mention inside a fenced block is text the author typed as code, not a reference.
  const decorated = highlight
    ? {
        p: ({ children: c }: { children?: ReactNode }) => <p>{decorate(c, highlight)}</p>,
        li: ({ children: c }: { children?: ReactNode }) => <li>{decorate(c, highlight)}</li>,
        strong: ({ children: c }: { children?: ReactNode }) => <strong>{decorate(c, highlight)}</strong>,
        em: ({ children: c }: { children?: ReactNode }) => <em>{decorate(c, highlight)}</em>,
        td: ({ children: c }: { children?: ReactNode }) => <td>{decorate(c, highlight)}</td>,
      }
    : {};

  return (
    <div className={cn(VARIANT_CLASSES[variant], className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeMarkdownUrl}
        components={{ code: CodeBlock as never, img: DroppedImage as never, ...decorated }}
      >
        {sanitizeUserVisibleMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
