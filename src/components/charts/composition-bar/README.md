# Composition bar

A composition bar splits one whole into its parts in a single bar, with a legend that carries the numbers.

Status: beta

## Anatomy

1. **Bar**: 10px tall, `radius-full` at its ends, a 2px gap between parts; every part at least 3px wide so a sliver stays visible.
2. **Legend**: two columns, four once the bar's own width reaches 36rem (a narrow card in a wide window keeps two): a swatch and the part's name in `ink-2`, then its share (`text-sm`, `weight-medium`) and its count (`ink-3`).

## Variants

| Variant | Colours |
|---|---|
| Status | Parts that carry a judgement take status colours (`warning`, `critical`); neutral classes take `neutral` and, beside it, `neutral-ink` (both at least 3:1 on the surface, unlike the `chart-neutral` track), never the accent; the legend names each in words |
| Categories | Parts with no judgement take slots 1, 2, 3 in order. The palette has six slots: past six parts, the first five keep theirs and the rest are drawn as one, "Other", their sum above zero, in `neutral` |
| Stacked | `stacked`: the parts are the ones a stacked Trend or Column chart on the same page draws, so a part with no colour takes `stackPart(place, parts)`, the one-hue stack by its place, and its swatch sits on an `ink-3` hairline as the stacked charts' do. Past four parts it folds as the stacked Column chart does: the first three and "Other", the rest's sum above zero, in the stack's colour for the fourth place. A part is one colour wherever the page draws it up to four parts; a stacked Trend chart draws every part, so a page that stacks more than four keeps the bar off them |

## Sizes

The bar takes its container's width; the legend wraps.

## States

| State | Spec |
|---|---|
| Arriving | The bar reveals left to right over `dur-grow`. |
| Hover | A part's native title gives its name and count. |
| Empty | A whole of zero renders the card's Empty state. |
| Below zero | A part below zero is no share of the whole: the whole is the sum of the parts above zero, and the part draws as a part of zero does, at the 3px sliver, its share `0%` and its count the value it holds; folded into Other, it adds nothing to Other. |

## Behaviour

Not interactive. `legend={false}` drops the key under the bar where the bar is a mark inside a tile: hovering a segment names it, and the key stays in the page for screen readers (`sr-only`).

## Surfaces

- **Console**: legend four across where the bar is 36rem wide or more, two in a narrow card.
- **Mobile** and **Embed** inline: legend two across.

## Agents

The parts and shares are shared as structured context by the view; the legend text carries them for any reader.

## Accessibility

A labelled `figure`; the legend is the accessible content. Shares under 10% carry one decimal so small parts are not rounded to zero; a part above none too small for that decimal reads `<0.1%`, and a part of none `0%`.

## Content

Part names are short: "2xx", "4xx", "us-east-1", "Enterprise".

## Do and do not

- Do use it for two to six parts of one whole.
- Do not use it to compare wholes; use a Column chart.

## Implementation

```tsx
import { CompositionBar } from '@/components/charts/composition-bar';

<CompositionBar label="Responses by status class" format={formatCompact}
  parts={[{ label: '2xx', value: 2_942_310, color: 'neutral' }, { label: '5xx', value: 13_350, color: 'critical' }]} />
```
