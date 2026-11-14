# Delta

A delta states a change against the previous period: the arrow carries the direction and the colour carries the judgement, which are not the same thing, because for latency or errors, down is good.

Status: beta

## Anatomy

1. **Arrow**: a 10px solid triangle, up or down; absent when the change is flat.
2. **Figure**: the size of the change, `text-xs` 12px, `weight-medium`, tabular figures.
3. **Spoken direction**: a visually hidden "up", "down" or "unchanged" before the figure.

## Variants

| Intent | Use | Rise | Fall |
|---|---|---|---|
| Up (default) | Requests, revenue, uptime | `positive-ink` | `critical-ink` |
| Down | Latency, error rate, cost per request | `critical-ink` | `positive-ink` |
| Neutral | Spend, volume where neither direction is good | `ink-2` | `ink-2` |

A change its format reads as no change is flat (under 0.05% for `percent` and `points`; a function format decides by its own reading): no arrow, `ink-2`, and the format reading no change ("0.0 pts" under `points`; "0%" with no format given). A missing comparison (`null`) is an em dash in `ink-3`: "we measured no change" and "there is nothing to compare with" are different facts.

## Sizes

One size, `text-xs`, so it sits on the caption line under a figure. The format defaults to `percent`, the change as a share of the earlier value with one decimal; `points` reads a change in a value that is itself a share in percentage points ("13.4 pts", where `percent` would print a share that went from 33.0% to 46.4% as up 40.6%); pass a function for absolute changes ("43ms"), which is handed the size of the change, never its sign.

## States

Not interactive.

## Behaviour

When the page's Meridian points at a day, a Metric tile replaces its delta with that day's date; the delta returns when the cursor leaves.

## Surfaces

Same on every surface.

## Agents

Not applicable.

## Accessibility

- Contrast (light): `positive-ink` 5.7:1, `critical-ink` 6.5:1 on `surface`.
- The direction is spoken ("up 5.7%"), so the arrow's shape and colour are never the only signal.

## Content

Follow it with what it is compared with, in `ink-3`: "vs previous period", "vs last week".

## Do and do not

- Do set `intent="down"` on every metric where less is better.
- Do not colour a delta for a measure that has no good direction; use `neutral`.
- Do not show a delta without saying what it is compared with.

## Implementation

```tsx
import { Delta } from '@/components/ui/delta';

<Delta value={-0.081} intent="down" />          // latency fell 8.1%: positive
<Delta value={23.73} format={(n) => `$${n}`} intent="neutral" />
```

Props: `value` (a fraction, or null), `format` (`percent` | `points` | a function), `intent` (`up` | `down` | `neutral`), `className`.
