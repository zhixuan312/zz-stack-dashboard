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
export const TINTS = ['accent', 'sage', 'amber', 'rose', 'steel'] as const;
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
  sage: 'var(--sage)',
  steel: 'var(--steel)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
};

/**
 * The order categorical series take colours in, so the same category lands on
 * the same colour on every chart that does not name its tints explicitly.
 * Derived from `TINTS` rather than re-listed.
 */
const TINT_CYCLE: readonly Tint[] = TINTS;

/** The tint for slice `i` of an unnamed categorical series. */
export function cycleTint(i: number): Tint {
  return TINT_CYCLE[i % TINT_CYCLE.length]!;
}
