import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';
import { safeMarkdownUrl } from '@/lib/safe-markdown';

/** A link that leaves the product sends no referrer: the reader's address is not the author's business. */
const external = (href?: string) => Boolean(href && /^(https?:)?\/\//i.test(href));

/**
 * Markdown a person wrote (a document, a note, an agent's reply), set for reading on Meridian's roles: a 72-character
 * measure, quiet tables, code on the sunk surface. Each element is drawn here rather than by a typography plugin, so
 * every colour is a role and both themes read.
 *
 * Safe for content nobody vetted: raw HTML stays text (no raw-HTML plugin, which check.ts keeps out), and every URL
 * passes safeMarkdownUrl: a link only to http(s), mailto, tel or a path; an image only from this origin.
 *
 * Nothing scrolls the page sideways: words wrap between words, a fenced block wraps, and a long token (code, a link)
 * breaks anywhere, since only `anywhere` lowers the min-content width a table sizes its columns from. Plain words keep
 * `break-word`, so a narrow table never splits "Owner" into "Owne r"; a table with more columns than the card holds
 * scrolls inside its own frame. The writer's `#` is an h2, so the page keeps the only h1.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mt-10 mb-4 text-xl font-semibold tracking-[-0.02em] text-ink first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-10 mb-3 border-t border-line pt-6 text-lg font-semibold tracking-[-0.015em] text-ink first:mt-0 first:border-0 first:pt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-7 mb-2 text-md font-semibold text-ink">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-5 mb-2 text-base font-semibold text-ink">{children}</h5>,
  h5: ({ children }) => <h6 className="mt-5 mb-2 text-sm font-semibold text-ink">{children}</h6>,
  h6: ({ children }) => <h6 className="mt-5 mb-2 text-sm font-semibold text-ink-2">{children}</h6>,
  p: ({ children }) => <p className="my-3 max-w-[72ch]">{children}</p>,
  ul: ({ children, className }) => <ul className={cn('my-3 max-w-[72ch] space-y-1.5', className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc pl-5 marker:text-ink-3')}>{children}</ul>,
  ol: ({ children }) => <ol className="my-3 max-w-[72ch] list-decimal space-y-1.5 pl-5 marker:text-ink-3">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ href, children }) => (href ? <a href={href} rel={external(href) ? 'noreferrer' : undefined} className="link [overflow-wrap:anywhere]">{children}</a> : <span className="text-ink">{children}</span>),
  code: ({ children, className }) =>
    className ? <code className={className}>{children}</code> : <code className="rounded-xs border border-line bg-surface-sunk px-1 py-px font-mono text-[0.86em] text-ink [overflow-wrap:anywhere]">{children}</code>,
  pre: ({ children }) => <pre className="my-4 rounded-lg border border-line bg-surface-sunk p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink [overflow-wrap:anywhere] [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  table: ({ children }) => <div className="my-5 overflow-x-auto rounded-lg border border-line"><table className="w-full text-left text-sm leading-normal">{children}</table></div>,
  thead: ({ children }) => <thead className="border-b border-line bg-surface-sunk">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 text-xs font-medium whitespace-nowrap text-ink-3">{children}</th>,
  tr: ({ children }) => <tr className="border-b border-line last:border-0">{children}</tr>,
  td: ({ children }) => <td className="px-3 py-2.5 align-top text-ink-2">{children}</td>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-accent pl-4 text-ink">{children}</blockquote>,
  hr: () => <hr className="my-8 border-line" />,
  // An image the URL policy dropped reads as its alt text, never as a broken-image icon.
  img: ({ src, alt }) =>
    // eslint-disable-next-line @next/next/no-img-element -- same-origin only (safeMarkdownUrl), at whatever size the writer's file has; next/image needs both known ahead.
    src ? <img src={String(src)} alt={alt ?? ''} className="max-w-full rounded-md" /> : <em className="text-ink-2">{alt || 'Image not shown'}</em>,
  // A task box: remark-gfm draws a bare disabled checkbox with no name, and its state is all it says.
  // react-markdown's node is dropped, never spread onto the input.
  input: ({ node, ...rest }) => (void node,
    rest.type === 'checkbox' ? <input {...rest} aria-label={rest.checked ? 'Done' : 'Not done'} className="mr-2 size-3.5 align-[-2px] accent-(--accent)" /> : <input {...rest} />),
};

export function Prose({ children, size = 'base', className }: { children: string; /** `sm` for a side panel, a comment or a quoted body. */ size?: 'base' | 'sm'; className?: string }) {
  return (
    <div className={cn('min-w-0 text-ink-2 break-words', size === 'base' ? 'text-base leading-[1.7]' : 'text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeMarkdownUrl} components={COMPONENTS}>
        {children.replace(/\r\n/g, '\n').trim()}
      </ReactMarkdown>
    </div>
  );
}
