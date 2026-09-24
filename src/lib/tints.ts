/**
 * The categorical palette, named by semantic token rather than by colour. One declaration
 * serves both the person avatars and the chart series.
 *
 * COUPLED: add a tint here and in `TINT_VAR` below, and every chart and avatar picks it up.
 */
export const TINTS = ['accent', 'lavender', 'pink', 'blue', 'sage', 'amber', 'rose', 'steel'] as const;
export type Tint = (typeof TINTS)[number];
/**
 * Token → CSS variable, for the places that must hand a colour to an inline `style` rather
 * than a Tailwind class — SVG fills, bar widths, heat cells.
 *
 * Anywhere a class will do, use the class (`bg-accent`, `text-sage`). One file, so a new tint
 * is added once.
 */
export const TINT_VAR: Record<Tint, string> = {
  accent: 'var(--accent)',
  lavender: 'var(--zz-lavender)',
  pink: 'var(--zz-pink)',
  blue: 'var(--zz-blue)',
  sage: 'var(--sage)',
  steel: 'var(--steel)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
};

/**
 * The hairline every chart mark carries.
 *
 * DELIBERATE: the three kit pastels clear only ~1.8-2.4:1 against the cream ground, below the
 * 3:1 non-text threshold. A chart bar is a large filled area and separates by edge rather than
 * luminance, so a series rendered without this disappears. Required, not decorative.
 */
export const CHART_EDGE = 'inset 0 0 0 1px rgba(34, 27, 38, 0.13)';

/**
 * The order categorical series take colours in, so the same category lands on the same colour
 * on every chart that does not name its tints explicitly.
 *
 * DELIBERATE: status hues are not in this cycle. Green, amber and red mean good, warn and bad
 * everywhere else, so they cannot also be decoration here. A series may still name a status
 * tint when it means one — the overview chart's Refusals line asks for `rose`.
 */
const TINT_CYCLE: readonly Tint[] = ['accent', 'lavender', 'pink', 'blue'];

/** The tint for slice `i` of an unnamed categorical series. */
export function cycleTint(i: number): Tint {
  return TINT_CYCLE[i % TINT_CYCLE.length]!;
}

/**
 * The tints that can carry a tile's identity — a soft ground with a glyph on it.
 *
 * DELIBERATE: narrower than `Tint`. A chart fill only has to be distinguishable; a chip has
 * something drawn on top of it, so it needs a measured pair and most kit hues have none. A map
 * missing a key is a type error; a template string like `var(--${tint}-tint)` missing a
 * variable is a silently grey chip.
 */
export const CHIP: Record<'accent' | 'sage' | 'amber' | 'rose' | 'blue', { bg: string; fg: string }> = {
  accent: { bg: 'var(--accent-tint)', fg: 'var(--accent-deep)' },
  sage: { bg: 'var(--sage-tint)', fg: 'var(--sage-deep)' },
  amber: { bg: 'var(--amber-tint)', fg: 'var(--amber-deep)' },
  rose: { bg: 'var(--rose-tint)', fg: 'var(--rose-deep)' },
  blue: { bg: 'var(--zz-blue-tint)', fg: 'var(--zz-blue-deep)' },
};

/** A tile's identity colour. */
export type ChipTint = keyof typeof CHIP;
