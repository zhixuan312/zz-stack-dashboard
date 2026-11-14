# Text roles

Text roles are the fourteen jobs a line of text can do, each one class, from the poster-sized display line to the tabular figure in a column.

Status: beta

## Anatomy

| Role | Class | Size | Weight · tracking · leading | Use |
|---|---|---|---|---|
| Display | `t-display` | `text-display` 52–104px | 600 · −0.035em · 0.96 | Sign-in, not found, the Atlas front door |
| Page | `t-page` | `text-page` 36–56px | 600 · −0.035em · 1.02 | The page title: one per screen |
| Hero | `t-hero` | `text-hero` 52–80px | 600 · −0.035em · 0.95 | The figure in a Featured metric |
| Section | `t-section` | `text-xl` 24–32px | 600 · −0.022em · 1.1 | A heading inside a page, a dialog title, and a page's title when it is a sentence (Shell, "The title") |
| Figure | `t-figure` | `text-2xl` 32–42px | 600 · −0.03em · 1 | A Metric tile's number |
| Card | `t-card` | `text-md` 16px | 600 · −0.012em · 1.3 | A card's title |
| Lead | `t-lead` | `text-md` 16px | 400 · `ink-2` · 1.6 | The sentence under a page title |
| Body | `t-body` | `text-base` 14px | 400 · 1.55 | Running text; the inherited size |
| Small | `t-small` | `text-sm` 13px | 400 · 1.5 | Secondary copy, table cells |
| Caption | `t-caption` | `text-xs` 12px | 400 · `ink-3` · 1.45 | Meta lines, notes under charts |
| Kicker | `t-kicker` | `text-xs` 12px | 500 · `ink-3`, as written, led by the slash | Where a title sits: "ZZ Meridian · Production" |
| Eyebrow | `t-eyebrow` | `text-xs` 12px | 500 · `ink-3`, as written | Group labels, a readout's date, axis names |
| Mono | `t-mono` | `text-xs` 12px Geist Mono | 0 | Identifiers, keys, routes, hashes |
| Number | `t-num` | inherited | tabular, lining | Any column of numbers |

The large sizes are fluid (`clamp()` on the viewport width), so a title keeps its proportion from a laptop to a wide display.

## Figures

Inside `t-figure` and `t-hero`, three spans step down to half size in `ink-3`, so the integer carries the reading: `.unit.pre` (a currency sign, raised), `.frac` (cents) and `.unit` (%, ms, K, M). "$298.43" steps the cents down; "2.9M", "0.90%" and "294ms" keep the number whole.

## Behaviour

- Headings balance their lines; paragraphs avoid a lone last word.
- Never shrink type to make it fit: cut words, or let a title wrap.

## Surfaces

- **Console**: as specified.
- **Mobile**: the fluid sizes reach their floor (page 36px, hero 52px, display 52px).
- **Embed**: the host's `--font-sans` replaces Geist when it sends one; sizes and roles hold.

## Agents

Not applicable.

## Accessibility

- Contrast (dark): `ink` 17:1 on surface, `ink-2` 8.0:1, `ink-3` 6.4:1; light `ink-3` at least 4.7:1. Every role clears 4.5:1 on every plane in both themes.
- Three weights only (400, 500, 600); never a weight below 400 on a dark ground.

## Content

- Kickers say where you are, never what to do. A page's title is a noun, or on a page that leads with figures a sentence that states them; a dialog's is a verb ("Rotate key").

## Do and do not

- Do use the role for the job, even when two roles share a size.
- Do not add a size or a weight; reach for the role that does the job.
- Do not set `ink-3` (a caption) on an accent wash (`accent-tint`): it falls under 4.5:1 in light. Use `ink-2`, or `accent-ink` for the accent's own words.

## Implementation

`src/styles/base.css`. Sizes are also Tailwind utilities (`text-page`, `text-hero`, `text-2xs` …) for the rare case a role class does not fit.

`keepHyphenated` (`@/components/base/text-roles`) holds a hyphenated identifier on one line wherever a sentence names a region, a key or a route, since a break after its hyphen reads as two words. The Banner, the Toast and the Incident card pass their text through it.

```tsx
import { keepHyphenated } from '@/components/base/text-roles';

<p>{keepHyphenated('Traffic is shifting to eu-central-1.')}</p>
```
