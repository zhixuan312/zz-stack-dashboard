# Progress

Progress shows how much of a known whole is done or used, as a bar that fills from the left with the figure beside it; Meter shows a level against thresholds in equal segments.

Status: beta

## Anatomy

Progress:
1. **Label row** (optional): what is measured on the left (`text-sm`, `ink-2`), the figure on the right (`weight-medium`, tabular).
2. **Track**: `fill-track`, `radius-full`.
3. **Fill**: the tone's fill colour, `radius-full`, its width the share.

Meter:
1. **Segments**: equal segments (10 by default) 2px apart, `radius-xs`-like 2px corners, 8px tall.
2. **Lit segments**: the share of segments rounded to the nearest, in the band's tone.

## Variants

| Variant | Use | Colour |
|---|---|---|
| Progress, accent (default) | A rollout, an import, a quota on track | `accent` |
| Progress, neutral | A share with no judgement inside a dense row | `ink-3` |
| Progress, warning or critical | A quota near or past its limit | `warning`, `critical` |
| Meter | Usage against a plan, a risk level | under `warnAt` (70%) `positive`, then `warning`, from `criticalAt` (90%) `critical` |

## Sizes

| Size | Track |
|---|---|
| md (default) | 6px |
| sm | 4px, for a table cell or a list row |

Label row 8px above the track.

## States

| State | Spec |
|---|---|
| Rest | as above |
| Changing | the fill grows from the left on arrival (`grow-x`, `dur-grow`, `ease-out`); later changes move its width over `dur-enter` |
| Unknown share | A missing or nonfinite value, or a nonpositive or nonfinite whole, reads "—" with no fill and no current value |
| Past its whole | the bar and its current value are held to the whole; the default figure says the share it is: 23 of 20 reads "115%" |
| Unknown total | not this card: use a Spinner or a Skeleton |
| Reduced motion | the final width at once |

## Behaviour

Not interactive.

## Surfaces

Same on every surface; on phones the label row truncates the label and keeps the figure whole.

## Agents

An agent reading usage gets the numbers from the view's shared context, not from the bar.

## Accessibility

- `role="progressbar"` (or `meter`) with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a name: a string `label` names the bar, a drawn one names it by reference, and a bar with no label row (`sm` in a table cell) takes `aria-label`, which the type requires when `label` is absent.
- The fill is reinforced by the figure; graphics contrast (light): `accent` 5.6:1 on `surface`.

## Content

The figure says the real quantity where it matters: "8.2M of 10M", "18 of 20". A bare percentage is the default.

## Do and do not

- Do say what the whole is.
- Do not use Progress for a time series or a comparison between items; use a Bar list.

## Implementation

```tsx
import { Meter, Progress } from '@/components/ui/progress';

<Progress label="Monthly quota" value={8.2} max={10} valueLabel="8.2M of 10M" />
<Progress value={42} size="sm" aria-label="Import" />
<Meter value={0.78} label="Plan usage" />
```

`Progress`: `value`, `max`, `label`, `valueLabel`, `tone`, `size`. `Meter`: `value` (0 to 1), `segments`, `warnAt`, `criticalAt`, `label`.
