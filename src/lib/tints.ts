/**
 * The categorical palette, named by semantic token rather than by colour.
 *
 * One declaration serves both the person avatars and the chart series, because
 * it is genuinely one palette. Add a tint here and in `TINT_VAR` below, and
 * every chart and avatar picks it up.
 *
 * In the apps this template was extracted from, this list lived in the database
 * enum module because avatars persisted their tint. A template has no database,
 * so it lives here — move it back beside your enums if you start storing it.
 */
export const TINTS = ['accent', 'lavender', 'pink', 'blue', 'sage', 'amber', 'rose', 'steel'] as const;
export type Tint = (typeof TINTS)[number];
/**
 * Token → CSS variable, for the places that must hand a colour to an inline
 * `style` rather than a Tailwind class — SVG fills, bar widths, heat cells.
 *
 * Anywhere a class will do, use the class (`bg-accent`, `text-sage`). This map
 * exists for the cases where Tailwind cannot help, and it lives in one file so
 * a new tint is added once. `BarList` and `CompositionBar` each had their own
 * copy until the drift was caught.
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
 * The three kit pastels clear only ~1.8-2.4:1 against the cream ground — below even the
 * 3:1 non-text threshold — and that was accepted deliberately: a chart bar is a large
 * filled area, not text, and it separates by EDGE rather than by luminance. A series
 * rendered without this genuinely disappears, so it is required, not decorative.
 */
export const CHART_EDGE = 'inset 0 0 0 1px rgba(34, 27, 38, 0.13)';

/**
 * The order categorical series take colours in, so the same category lands on
 * the same colour on every chart that does not name its tints explicitly.
 *
 * STATUS HUES ARE NOT IN THIS CYCLE, and that is the point. It used to be the whole of
 * `TINTS`, which meant green, amber and red were handed out to whichever series happened
 * to be third, fourth and fifth — so a bar chart of event kinds was painted in the colours
 * that elsewhere mean good, warn and bad. Colour that means something everywhere else
 * cannot also be decoration here.
 *
 * A series may still NAME a status tint when it genuinely means one: the overview chart's
 * Refusals line asks for `rose` because refusals are bad.
 */
const TINT_CYCLE: readonly Tint[] = ['accent', 'lavender', 'pink', 'blue'];

/** The tint for slice `i` of an unnamed categorical series. */
export function cycleTint(i: number): Tint {
  return TINT_CYCLE[i % TINT_CYCLE.length]!;
}

/**
 * The tints that can carry a TILE'S IDENTITY — a soft ground with a glyph on it.
 *
 * NARROWER THAN `Tint` ON PURPOSE. A chart fill only has to be distinguishable; a chip has
 * something drawn on top of it, so it needs a measured pair and most kit hues have none.
 * The first version of this built the variables by hand — `var(--${tint}-tint)` — which
 * produced `--pink-tint`, a variable that does not exist, and the chip fell back to grey
 * with no error anywhere. A map that is missing a key is a type error; a template string
 * that is missing a variable is a silently grey chip.
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
