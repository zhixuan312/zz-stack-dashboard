import { cn } from '@/lib/cn';

const SIZE = { sm: 'size-6 text-2xs', md: 'size-8 text-xs', lg: 'size-10 text-sm' } as const;
/* Each disc tucks under the next by a sliver (2, 4, 6px), so the next one's surface ring draws the seam without
   covering a letter; any deeper and it cuts the second initial ("AO" reads "AC"). */
const OVERLAP = { sm: '-ml-0.5', md: '-ml-1', lg: '-ml-1.5' } as const;

/**
 * A person or an organisation: their picture, or their initials on a soft tint of one chart hue derived from the
 * name, so the same person always gets the same colour. Soft ground, strong glyph: the initials are the hue mixed
 * toward ink, so they hold contrast in both themes.
 */
export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string; size?: keyof typeof SIZE; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const slot = ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 6) + 1;
  return (
    <span
      aria-hidden
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold ring-2 ring-surface', SIZE[size], className)}
      style={{ background: `color-mix(in oklab, var(--series-${slot}) 22%, var(--surface))`, color: `color-mix(in oklab, var(--series-${slot}) 52%, var(--ink))` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a decorative 20-40px picture from any origin the product's users have; next/image would need every origin listed in next.config. */}
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

/**
 * Who is involved, at a glance: up to `max` avatars tucked under each other by a sliver, then a "+N" chip. The full list is in
 * the accessible name (and a tooltip where the group is interactive).
 */
export function AvatarGroup({ names, max = 4, size = 'sm', className }: { names: string[]; max?: number; size?: keyof typeof SIZE; className?: string }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span role="img" aria-label={names.join(', ')} className={cn('inline-flex items-center', className)}>
      {shown.map((n, i) => (
        <Avatar key={n + i} name={n} size={size} className={i > 0 ? OVERLAP[size] : undefined} />
      ))}
      {rest > 0 ? (
        <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full bg-fill-active font-medium text-ink-2 ring-2 ring-surface', OVERLAP[size], SIZE[size])}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
