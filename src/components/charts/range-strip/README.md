# Range strip

A range strip draws each row's own range from one value to the other on one shared scale, against reference levels drawn across every row.

Status: draft

## Anatomy

1. **Row**: the label in a column on the left (`text-sm`, `ink-2`; the highlighted row `ink` at `weight-medium`), the plot on the right. The label column takes a third of the width and the plot two thirds, 16px apart.
2. **Strip**: a range's own segment from its `from` to its `to`, 8px tall, rounded, in `chart-neutral`; the one highlighted row's in `accent`. A row whose ends are equal draws a segment at least half a pixel wide, so a range of one value is still visible.
3. **Ends**: two 8px marks, one at each end of the strip, ringed in `line-strong`; the highlighted row's in `accent`. An end that is missing has no mark, so a range with one end reads as one.
4. **Figure**: both values as text at the right of the row, `text-2xs` (11px), tabular, `ink-2`: "180ms to 391ms". One end missing reads "up to 142ms" or "from 210ms", and a row with neither reads "no value".
5. **Reference**: one or two levels every row is read against, each a 1px line in `chart-axis` across the rows, its words under the plot. Named once below the chart as well, in `text-2xs` `ink-3`: "Ceiling at 350ms".
6. **Axis**: the scale's first and last level under the plot at `text-2xs` (11px) in `ink-3`. A held `domain` puts its own ends there.
7. **Widened**: when a value is past a held `domain`, one line above the rows at `text-2xs` in `ink-3`: "Scale widened from 0ms–1,500ms to 0ms–2,000ms".

## Variants

| Variant | Use |
|---|---|
| Plain | Each row a range, on the scale the values need |
| Held (`domain`) | Several strips compared row by row on one stated range |
| Referenced | One or two levels across every row: a ceiling, a median, a target |
| One highlighted | The card is about one row (the widest range, the one over the ceiling) |
| Linked | A row names a record that has a page: its label opens it |
| One end missing | A range whose low or high end was not measured; drawn open, never from zero |

## Sizes

Rows are 20px tall and 12px apart; the strip is 8px inside its row; the scale row is 16px, 8px under the last row. The chart takes its container's width, and each end of the plot keeps room for the figures that stand at the right of each row.

## States

| State | Spec |
|---|---|
| Arriving | Strips grow from their `from` end over `dur-grow`, 45ms apart in drawing order. |
| Hover | The row's neutral strip steps up to `chart-neutral-strong` over `dur-hover`. |
| Hover (a linked row's label) | The label takes `accent-ink` over `dur-hover`, and the strip steps up as on any row. |
| Focus (a linked row) | The label's link shows the 2px `accent` ring. |
| One end missing | No mark at the absent end, a figure that says which end is absent, and a segment from the plot's edge. |
| No value at all | The row reads "no value" and draws no strip. |
| Widened | The scale takes every value, and the line above the rows names the range it drew. |
| Empty | Render the card's Empty state. |

## Behaviour

Rows are not interactive by default. Give a row an `href` when it names a record that has a page, and its label becomes the link to it (`row-link`, with the `hit` target: 24px under a mouse, 44px under a finger). Give every row of a chart one or none.

Without `domain` the scale is the held levels around the lowest and highest value, references included. With `domain` it is the stated range while every value, every reference among them, is inside it; a value outside widens it to the levels that take them all, and the chart says so above the rows. A held scale never clips a strip.

`format` reads the figures, the reference labels, the scale and the widening line alike, so a duration reads as a duration everywhere.

## Surfaces

- **Console**: every row; the label column is a third of the width.
- **Mobile**: the same; long labels are cut sooner, and the figures stay at the right while the plot narrows around them.
- **Embed**: the same as mobile inline; the console's in fullscreen.

## Agents

A view that draws one shares the rows it draws through its own context; an agent reads the figures there, never from the drawing. A range is stated as its two ends and which, if either, is absent, so an agent never reads a missing end as zero.

## Accessibility

- A labelled `ul`, one list item per row, each row a group named by its label and both of its ends in words ("180ms to 391ms").
- The strip and its marks are `aria-hidden`: the words beside the row carry every value, and a missing end is said rather than drawn.
- The references' words stand under the plot and once more below the chart, so a level is never told by a line alone.
- The neutral strip is not held to 3:1, and does not reach it: `chart-neutral` on `surface` measures 1.50:1 dark and 1.39:1 light. That is the same choice the Column chart makes for its own columns, and the same thing carries it here — every value is written as text at the right of its row, so the strip is a reading aid and never the only place a value stands (WCAG 1.4.11).
- The accent strip and the ringed ends take the accent's own measurement, which `pnpm contrast` reports for every theme and accent. The words are `ink-2` and `ink-3`, which pass at `text-2xs`.

## Content

- A label is the record's own name, short enough to cut at the column: an endpoint's route, an account's name.
- The figure states both ends and the unit once: "180ms to 391ms", never two figures with no word between them.
- A reference's label is a short noun: "Ceiling", "Last hour", "Target". The words under the chart add its value.

## Do and do not

- Do use it for a range read against a level, row by row: a minimum and a median against a ceiling.
- Do not use it for two values compared as separate figures: that is a grouped Column chart.
- Do not draw a missing end as zero. A range with no low end starts at the plot's edge and says so in words.
- Do not hold a `domain` tighter than the values to make a range look wider: the scale widens and says so.
- Do not put more than one highlighted row; one row is what the card is about.

## Implementation

```tsx
import { RangeStrip } from '@/components/charts/range-strip';

<RangeStrip
  label="Lowest and median latency by endpoint"
  items={endpoints.map((e) => ({ key: e.route, label: e.route, from: e.lowest, to: e.median, href: `/services/${e.slug}` }))}
  format={(n) => formatDuration(n)}
  references={[{ value: 350, label: 'Ceiling' }]}
  domain={[0, 1_500]}
/>
```

Exports: `RangeStrip`, `RangeItem`.
