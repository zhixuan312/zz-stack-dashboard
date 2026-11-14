# Badge

A badge is a short label for a state or a category, set on a soft tint of its tone; a status badge always says its state in words, and the colour only repeats it.

Status: beta

## Anatomy

1. **Container**: a pill (`radius-full`), 22px tall, 8px horizontal padding.
2. **Dot** (optional): a 6px circle in the tone's fill colour, 6px before the word.
3. **Label**: one or two words, `text-xs` 12px, `weight-medium` 500.

## Variants

| Tone | Means | Ground | Label | Dot |
|---|---|---|---|---|
| Neutral (default) | A category without judgement: a plan, a draft | `fill-track` | `ink-2` | `ink-3` |
| Accent | New, selected or live in the product's own sense | `accent-tint` | `accent-ink` | `accent` |
| Positive | Good: operational, healthy, paid | `positive-tint` | `positive-ink` | `positive` |
| Warning | Needs attention: degraded, near a limit | `warning-tint` | `warning-ink` | `warning` |
| Critical | Bad: failing, outage, past due | `critical-tint` | `critical-ink` | `critical` |

## Sizes

One size: 22px tall, `text-xs`, gap 6px. In a dense table it sits on the row's centre line.

## States

A badge is not interactive: it has no hover, focus or pressed state. When a badge must open something (a filter), use a Button or a Segmented option instead.

## Behaviour

Static. A badge whose state is live (updating) takes a dot; the pulse belongs to Status dot's `live`, not to the badge.

## Surfaces

Same on every surface: a badge is sized in text, and its colours carry meaning, so they never bridge to the host's colours on the embed.

## Agents

Not applicable.

## Accessibility

- Contrast (light, cobalt): `positive-ink` on `positive-tint` 5.2:1, `warning-ink` on `warning-tint` 5.6:1, `critical-ink` on `critical-tint` 5.8:1, `accent-ink` on `accent-tint` 5.7:1. Every tone holds 4.5:1 in both themes.
- Colour is never the only signal: the word states the state.

## Content

- One or two words, sentence case: "Operational", "Rate limited", "Past due". Not "OK" or "Error!".
- A status code goes beside the badge, not inside it, so the column aligns: `503` then "Server error".

## Do and do not

- Do use status tones only for status; a plan or a region is neutral.
- Do not put more than two badges on one row of a table.
- Do not use a badge as a button.

## Implementation

```tsx
import { Badge } from '@/components/ui/badge';

<Badge tone="warning" dot>Degraded</Badge>
```

Props: `tone` (`neutral` | `accent` | `positive` | `warning` | `critical`), `dot`, span attributes. The `Tone` type is shared by Status dot and Progress.
