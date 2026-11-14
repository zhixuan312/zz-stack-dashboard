# Sparkline

A sparkline shows the shape of a trend beside the figure it qualifies, with no axes and no values of its own.

Status: beta

## Anatomy

1. **Line**: 1.5px, round joins, drawn in real pixels across the container's full width. A day with no value breaks it.
2. **Area**: the line's colour fading from 21% (10% on light) to 0, under each run of the line.
3. **Day mark** (on a Meridian, when the values are the page's): a 1px `ink-3` hairline at 45% and a 3px dot ringed in `surface`.

## Variants

| Colour | Use |
|---|---|
| `accent` | The tile that carries the finding (an `emphasis` Metric tile) |
| `neutral` | Every other tile and every table cell (`chart-neutral-strong`) |
| Slot 1 to 6 | When the sparkline stands for a categorical series shown elsewhere in that colour |

| `curve` | Use |
|---|---|
| `monotone` (default) | A smooth line that never overshoots its data |
| `linear` | Straight segments between days |
| `step` | Each value held level to the next day, then a straight rise or fall: a quantity that changes in steps (seats, a plan, a limit). The area takes the same path. |

## Sizes

Height 24px in a table cell, 28px in a compact Metric tile, 32 to 44px in a tile; the width is the container's. The scale fits the data's own range (minimum to maximum of the numbers, a day with no value left out), because a sparkline shows shape, not magnitude.

`domain={[min, max]}` holds the scale instead, so sparklines side by side are drawn against one range and their heights compare. The range drawn is the domain itself: a sparkline has no axis to round to a step. The title names the range drawn: while every value is inside the domain, the domain itself, so values from 42 to 66 on `domain={[0, 100]}` read `0 to 100`. A value outside it widens the range to the nice levels that take it, and the title names the range drawn and says so: values from 42 to 128 on `domain={[0, 100]}` read `0 to 150, scale widened from 0–100`. A `domain` whose second number is not above its first is drawn as no domain.

## States

| State | Spec |
|---|---|
| Arriving | Draws and reveals over `dur-grow` with `ease-out`. |
| Day pointed at | The hairline and dot at that day, when the line has one value for each of the Meridian's dates. On a day with no value, the hairline alone: there is no point for the dot to stand on. |
| Gap | A `null` is a day with no value: it keeps its place on the x axis and the line and its area break there, as the Trend chart's line does. Each run of days with a value is its own stretch; a day with a value between two gaps has no neighbour to join and draws no line. A gap is never drawn as zero. |
| Values that are not the page's | With any other number of values, no hairline and no dot: the line alone, whatever the page points at. |
| Scale widened | A value outside the `domain`: the range widens to nice levels around the domain and the data, and the title reads the range drawn, the first and last of those levels, then `, scale widened from {min}–{max}`. |
| Too few points | Under two numbers, render nothing and let the figure stand alone. A `null` is not a number. |

## Behaviour

None by default: a sparkline is not interactive. It follows the page's Meridian but never sets it.

With `readout` it is one Tab stop: the pointer picks a point, the arrow keys step through them from the last, Home and End go to the first and the last, and Escape or blur lets go. A readout panel names the day (when its values are the page's dates) and the value, "01 Oct" over "Requests 6K", and an `aria-live` line says the same words. A point with no value reads "No data", never zero. Without the prop every one of those states stays exactly as it was.

It follows only when its values are the page's: one for each of the Meridian's dates, which is the rule a chart joins the Meridian by. The cursor is a position in the page's list of dates, so on a line of any other length it would mark a different day: a customer's 14 days on a page of 30 draw no cursor. Outside a Meridian there is no cursor to draw.

## Surfaces

Same on every surface: it scales with its container.

## Agents

Not applicable: it repeats a series the view already shares.

## Accessibility

Without `readout`, decorative (`aria-hidden`): the figure beside it and the page's charts carry the numbers, and the title names the range for the pointer. With `readout`, an image named by that range and how to use it ("4K to 10K. Use the arrow keys to read a point."), one Tab stop, and each point announced. The neutral line holds 3.96:1 dark and 3.52:1 light on `surface`.

## Content

None. A sparkline never carries a label, a value or an axis.

## Do and do not

- Do place it beside or under its figure, never instead of it.
- Do not compare two sparklines' heights unless they hold one `domain`: otherwise each has its own scale.
- Do not pad or cut a series to the page's length to make the mark appear: a line that marks a day must hold that day at that position.
- Do pass `null` for a day with no value. Do not pass 0, which draws a dip to the floor that never happened, and do not leave the day out, which joins the days either side as if they were neighbours.

## Implementation

```tsx
import { Sparkline } from '@/components/charts/sparkline';

<Sparkline values={series.map((d) => d.p95)} color="neutral" height={40} />

// A day with no calls has no failure rate: null breaks the line there.
<Sparkline values={series.map((d) => (d.calls ? d.failed / d.calls : null))} color="neutral" />

// Seats change in steps, and every customer's row is drawn against one range.
<Sparkline values={c.seats} curve="step" domain={[0, 50]} color="neutral" height={24} />
```

`values` is `(number | null)[]`; `curve` is `'monotone' | 'linear' | 'step'`; `domain` is `[number, number]`; `format` is `(n: number) => string`, how the title reads the range, a count unless given (a Metric tile passes its own, so a margin reads `62.0% to 71.0%`, not `0.62 to 0.71`).
