# XY line chart

An XY line chart reads a measure against a number with a unit: the share of requests served within each latency, a quantity available within a distance from a reference price.

Status: draft

## Anatomy

1. **Plot**: one y-scale for every series, and an x-axis of the values themselves, never indices. A step line holds each value to the next point and rises at it; a linear line joins the readings straight.
2. **Y axis**: a gridline and a label at every level, in `chart-grid` and `ink-3` at `text-2xs`; the level at zero is `chart-axis`. A stated `domain` puts its own ends there.
3. **X axis**: the first value, the middle and the last, at `text-2xs` `ink-3`, each in `xFormat`.
4. **Series**: a 2px line, the first in `accent` and each later in its categorical slot. A point with no `y` breaks the line there; the line never dips to zero for it.
5. **Reference**: an optional vertical dashed level at an x, named above the plot ("Budget"), for a threshold a series is read against.
6. **Cursor**: pointing at the plot, or stepping with the arrow keys, marks the nearest point of every series with a hollow ring and a hairline at its x.
7. **Readout**: the x in words and every series' value there; a series with no point at that x says "No value" rather than interpolating one.
8. **Axis names**: what x and y are, under the plot, at `text-2xs` `ink-3`: "Latency, ms" and "Share of requests".
9. **Legend**: from two series, each with its line's swatch.
10. **Widened**: when a value is past a stated `domain`, one line above the plot naming the range drawn.

## Variants

| Variant | Use |
|---|---|
| Step (`curve="step"`) | A distribution: the share at or under each threshold, held level between them |
| Linear (`curve="linear"`, the default) | A measurement read against a number, joined straight |
| Referenced | A threshold the series is read against, at its own x |
| Held (`domain`) | Several charts read side by side on one y-range |
| Several series | Peer measures over the same x, each in its categorical slot |
| With gaps | A threshold or a bucket nobody measured: the line breaks, the table says so |

## Sizes

240px by default; the plot takes its container's width. The left gutter is the widest level's words, so a level never runs off the card; the axis names take a line under the plot.

## States

| State | Spec |
|---|---|
| Rest | The lines and their levels, no cursor |
| Pointed | The pointer selects the nearest x; every series' point there is ringed, and the readout names them |
| Focus (keyboard) | The plot is one Tab stop with the 2px `accent` ring; Left and Right step through the x values, Home and End to the ends, Escape lets go |
| A point with no value | The line breaks there, the readout says "No value", the table's cell says it too |
| Widened | The scale takes every value and the line above the plot names the range drawn |
| No points | Render the card's Empty state |

## Behaviour

There is no Meridian join: x is not time, so pointing at a day on the page does not move this chart's cursor and this chart does not move the page's.

`xFormat` reads the axis and the readout's x; `format` reads every y — the levels, the readout and the table — so a share reads as a share in all four places.

The cursor's x is the nearest x any series measured, not an interpolated position: a reading is always a value somebody took.

## Surfaces

- **Console**: 240px or the height given; every x tick.
- **Mobile**: the same; the three x ticks stay labelled at every width.
- **Embed**: the same as mobile inline; the console's in fullscreen.

## Agents

A view that draws one shares its points and its axis names through its own context; an agent reads the values there, never from the drawing. A point with no value is stated as absent, so an agent never reports a gap as zero.

## Accessibility

- A labelled `figure` whose `sr-only` table holds every x and every series' value there, one row per x, its x in the row's header cell.
- The plot is `role="group"`, named with the chart's label and how to use the keys; the reading is announced in an `aria-live="polite"` line ("Latency, ms 250: Answered within 94.1%").
- A point with no value is said in words in the readout and in the table, never left as a gap on its own.
- Contrast: the accent line holds what `pnpm contrast` measures for every theme and accent; the later series take the categorical slots, whose contrast the chart palette holds; the words are `ink-2` and `ink-3` at `text-2xs`.

## Content

- `xLabel` and `yLabel` are short nouns with their unit: "Latency, ms", "Share of requests", "Basis points from reference".
- `xFormat` and `format` are exact at every value they print: an axis that rounds prints a level it does not stand at.
- A reference's label is a short noun: "Budget", "Reference price".

## Do and do not

- Do use a step line for a distribution and a linear line for measurements joined.
- Do not use this chart for a series over time: that is a Trend chart, whose x-axis is dates and whose readout follows the page's day.
- Do not pad the x-range: an axis of values says where the values are, and a padded one invents support nobody measured.
- Do not interpolate a value at an x nobody measured; state the absence.
- Do not hold a `domain` tighter than the values to make a change look larger: the chart widens and says so.

## Implementation

```tsx
import { XYLineChart } from '@/components/charts/xy-line-chart';

<XYLineChart
  label="Share of requests answered within each latency"
  series={[{ key: 'served', label: 'Answered within', points: buckets.map((b) => ({ x: b.ms, y: b.share })) }]}
  xLabel="Latency, ms"
  yLabel="Share of requests"
  xFormat={(n) => `${n} ms`}
  format={(n) => formatPercent(n, 1)}
  curve="step"
  references={[{ x: 250, label: 'Budget' }]}
/>
```

Exports: `XYLineChart`, `XYSeries`, `XYPoint`.
