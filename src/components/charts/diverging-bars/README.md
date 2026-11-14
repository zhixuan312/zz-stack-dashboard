# Diverging bars

Diverging bars set signed rows either side of one zero line on a scale symmetric about it: a net change by category, a customer ahead of or behind the company.

Status: beta

## Anatomy

1. **Row**: the label in a column on the left (`text-sm`, `ink-2`; the highlighted row `ink` at `weight-medium`), the plot on the right. The label column takes a third of the width and the plot two thirds, 16px apart.
2. **Zero line**: one 1px line through every row at the middle of the plot, in `chart-axis`.
3. **Bar**: a rise extends right of the zero line, a fall left, each its value's share of its half of the plot. 12px tall, its data end rounded 4px. The neutral population in `chart-neutral`; the one highlighted row in `accent`. A row with no data, or a value of zero, draws no bar.
4. **Figure**: the value at `text-2xs` (11px), tabular, `ink-2`, standing 4px beyond its bar's end, away from zero. No data reads `—` beside the zero line.
5. **Gutter**: each end of the plot keeps room for the widest figure, its characters times 6.5px plus 4px, so the longest bar's figure stands inside the chart.
6. **Axis**: the levels under the plot at `text-2xs` (11px) in `ink-3`, each in the chart's format, with a 1px gridline in `chart-grid` through the rows at each; zero's is the zero line. A level whose words would touch a neighbour's at the drawn width keeps its gridline and hides its words, the ends and zero last.
7. **Widened**: when a value is past a held `domain`, one line above the rows at `text-2xs` in `ink-3`: "Scale widened to +35 to show Delta".
8. **Estimate key**: when a row is an estimate, one line under the chart at `text-2xs` in `ink-3`: "Hatched: estimate".
9. **Linked row**: a row with an `href` names a record that has a page, and its label is the one link to it, named by the label. The bar and the figure stay text.

## Variants

| Variant | Use |
|---|---|
| Sorted (`order="value"`, the default) | The largest rise first and the largest fall last; equal values in the order given; no data after every value |
| In the order given (`order="given"`) | The order is the meaning: the plans of a ladder, the steps of a funnel |
| Held (`domain`) | Several charts compared row by row on one scale of ±`domain` |
| Without an axis (`axis={false}`) | A card that states the scale elsewhere; the zero line stays |
| One highlighted | The card is about one row (the largest fall, the customer in question) |
| Linked | Each row names a record that has a page (a customer): its label opens it |
| Estimated | A row whose figure is derived rather than measured is hatched |

## Sizes

Rows are 20px tall and 12px apart; the bar is 12px inside its row; the axis row is 16px, 8px under the last row. The chart takes its container's width.

## States

| State | Spec |
|---|---|
| Arriving | Bars grow from the zero line over `dur-grow`, 45ms apart in drawing order. |
| Hover | The row's neutral bar steps up to `chart-neutral-strong` over `dur-hover`. |
| Hover (a linked row's label) | The label takes `accent-ink` over `dur-hover`, and the bar steps up as on any row. |
| Focus (a linked row) | The label's link shows the 2px `accent` ring. |
| No data | The row reads `—`, draws no bar and, sorted, stands after every value. |
| All no data or zero | No bars, and the axis on the levels of ±1. |
| Estimate | The bar is hatched over its own fill, its row's title says `estimate`, and the key is written once. A row with no data or a zero has no figure to hatch, so it is not an estimate, whatever it is passed. |
| Widened | The scale reaches the largest magnitude, the levels add it at each end, and the line above the rows names its row. |
| Empty | Render the card's Empty state. |

## Behaviour

Rows are not interactive by default. Give a row an `href` when it names a record that has a page, and its label becomes the link to it (`row-link`, with the `hit` target: 24px under a mouse, 44px under a finger). Give every row of a chart one or none.

Without `domain` the scale reaches the last nice level over the largest magnitude, and the levels are the held levels of that range. With `domain` it is held at ±`domain`; a magnitude past it widens the half-width to that magnitude, adds it at each end of the levels, and the chart says so above the rows, naming the first row drawn of that magnitude. A held scale never clips a bar.

The default format signs every figure: a rise `+12`, a fall `−8` with the true minus, zero `0`. Pass `format` for a unit; it formats the figures, the levels and the widening line alike.

## Surfaces

- **Console**: every row; the label column is a third of the width.
- **Mobile**: the same; long labels are cut sooner, and a level that would touch its neighbour hides its words. A linked label answers a 44px target.
- **Embed**: same. No embed view draws it yet.

## Agents

The rows are shared as structured context by the view that draws the card (`useShareView`), so an agent names the largest rise and fall without reading bars. The card writes nothing.

## Accessibility

A labelled list (`aria-label`); each row's label and figure are text, so the bar and its side are reinforcement, never the only signal: the figure carries its sign. Each row's `title` names its label, its figure, `highlightLabel` on the highlighted row and `estimate` on an estimated one. The axis is hidden from a screen reader, which reads the figures; the widening line and the estimate key are text. A linked row is one link a row, named by its label. The accent bar holds 3.71:1 dark, 5.71:1 light on `surface`; the figures in `ink-2` hold 7.96:1 dark, 6.86:1 light, and the levels in `ink-3` 6.39:1 dark, 5.13:1 light.

## Content

Labels are the rows' own names. The chart's `label` names the measure and what it is against ("Change in requests against the company, by customer"), and the card around it names the period. One formatter for the whole chart.

## Do and do not

- Do keep the zero line meaningful: a change, a net flow, a difference from a reference.
- Do hold the scale (`domain`) when charts stand side by side to be compared.
- Do not colour rows by their sign, and do not colour more than one row.
- Do not use it for values that are all one sign: that is a Bar list.

## Implementation

```tsx
import { DivergingBars, type DivergingItem } from '@/components/charts/diverging-bars';

// items: { key, label: ReactNode, value: number | null, href?, estimate? }
// A label that is not text is named by its key in the widening line, and left out of the row's title.
<DivergingBars label="Net change by category" items={items} />

// Two charts held on one scale, the largest fall pointed at.
<DivergingBars label="Change against the company, Enterprise" items={enterprise} domain={10} highlight="lumen-studio" highlightLabel="The largest fall" format={points} />
```
