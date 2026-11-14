# Trend chart

A trend chart shows how one or more measures changed over time, on one shared axis, and joins the page's Meridian.

Status: beta

## Anatomy

1. **Plot**: horizontal gridlines in `chart-grid`, the baseline in `chart-axis`, 1px, crisp.
2. **Y axis**: 3 or 4 "nice" ticks from zero, or from a step under zero when a value falls under it, up to a step at or over the highest value (whole numbers only with `whole`, for a chart of counts or a stack of them, so a top of 10 draws no level at 2.5 or 7.5), labels `text-2xs` `ink-3`, tabular, right-aligned in a gutter sized to the longest label. Axis labels drop cents and exact digits (`$12`, `1.2M`), and money from $10,000 reads at a glance (`$25K`, `$5.0B`) so a large scale does not widen the gutter; the tooltip and table carry the exact amounts.
3. **X axis**: dates, `text-2xs` `ink-3`, one label per 92px, counted back from today so the last day is always labelled.
4. **Series**: monotone curves that never overshoot their data by default; straight segments with `curve="linear"`, for a few readings; a level held until the next reading with `curve="step"`. A stack's parts, their edges and its running stretch take the same curve.
5. **Band** (with `band`): the region from the floor up to the band's ceiling, in `fill-track`, under the gridlines, its top edge drawn as the axis is, and its label at an end of that edge — in `ink-2`, since it stands over the fill as often as over the card and `ink-3` on `fill-track` is 4.43:1 in light.
6. **Marks** (with `marks`): a dot on a named day's point and a stem from it to the axis, in the tone given.
7. **Points** (with `points`): a 3px dot on each measured value of every `line` and `area`, in the series' colour, ringed in `surface`.
8. **Widened line** (with a `domain` a value falls outside): `Scale widened from {min}–{max} to {low}–{top}`, `text-2xs` `ink-3`, on a line of its own above the legend and the plot; wrapped to two on a phone card, it pushes them down by its measured height.
9. **Running stretch** (with `running`): the last stretch of the same curve, into a point that is not over yet, 1.5px and dashed.
10. **Legend**: above the plot when there are two or more series: a 12px line swatch (dashed for `dashed`) and the label in `ink-2`.
11. **Cursor, dots and tooltip**: from the Meridian. The readout measures its own width and stays inside the chart; long labels wrap and values remain readable.
12. **Screen-reader table**: every day and series, formatted, each row headed by its date as the axis reads it (`tick` when given); the row of a running point says "so far", and the caption ends with the widened line when there is one.

## Variants

| Kind | Use | Mark |
|---|---|---|
| `area` | The series the chart is about. At most one per chart. | 2px line, an area fading from 30% (14% on light) to 0 of its colour, and a 5px glow at 24% (14% on light), blurred 4px (3px on light), 2px under the line |
| `line` | A peer series of equal standing | 2px line |
| `dashed` | A reference: the previous period, a target, a budget | 1.5px dashed line in `chart-neutral-strong` |
| `stacked` (chart prop) | The series are the parts of one whole, such as requests by region, or calls split into attributed, unattributed and refused: the top edge is the total. Parts of similar size; a part under a few percent is invisible as a band, so give it a chart or a tile of its own | Bands one on another, the first at the bottom, in one hue: the accent, deepest at the bottom and paler upward, between the theme's `chart-stack-hi` and `chart-stack-lo` (dark 92% to 20%, light 78% to 36%), a 1px `surface` hairline between them; on light the stack fades toward zero (`chart-stack-fade`); the total is the 2px accent line with its glow, as on an `area`. A series given its own `color` keeps it. The readout lists the bands top to bottom and the total; the y-axis is scaled to the total |

**Baseline** (`baseline: { value, label }`): what is usual, such as the period's median, drawn as a dashed hairline (`ink-3` at 60%, dash 3 4) under the data and named by a label (`text-2xs` `ink-3`) at an end of it. It fades in with the data and is named in the screen-reader table's caption ("Latency p95 per day. Median 296ms"). One per chart; the y-axis always reaches it.

**Where a reference line's label stands.** No series is drawn through the label, whatever the chart draws: one line, several, an area or a stack. Its first place is the right end of the line, its text 6px over it. When a series comes within 4px of the label's box there, the chart looks at both ends for the nearest clear place over the line, which is the label lifted clear of the highest point under it, and the nearest under the line, which is the label set clear of the lowest, its ink no nearer than 5px under the line. The place nearest the line wins; of two as near, the right end comes before the left, and over before under. The points under the label are those inside its width and one more on each side, since a curve never overshoots its data. An area, and every band of a stack, owns all that is under its line, so there the label stands over the line or at the other end. The label keeps to the plot, where it may use the 14px the chart keeps over its top gridline, and never stands under the axis. When no place is clear, or the label is wider than the plot, it is not drawn: the line stands alone and the table's caption still names it. The label's width is not known before it is drawn, so the chart takes 7px a character, which errs wide. Its 4px halo of `surface` is for a gridline that passes behind it, the one thing still drawn there.

**Band** (`band: { value, label }`): the level the page is judged against, such as the p95 a service level asks for. The region from the floor up to that value is filled with `fill-track` — the colour a track is drawn in, which is what a band is: what a figure is measured inside of — and its top edge is drawn as the axis is (`chart-axis`, 1px, crisp), because a wash's edge alone is not a line a reader can hold. It is drawn under the gridlines, so the grid stays a grid. The label stands beside the top edge by the same rule the baseline's does, and is named in the caption after the chart's own label ("Latency p95 per day. Band: p95 under 350 ms"). One per chart; the y-axis always reaches it.

**A band is a region; a baseline is a line.** They are not interchangeable and a chart may carry both: a median is one level, a band is everything under one. Where a chart has both, the band's label is placed first, so what the page is judged against is named before what is usual.

**Below zero.** A signed series, such as a net change or a net flow, is drawn whole: without a floor the axis holds zero and every value, so it goes down to a step under the lowest one, zero is one of its levels and is drawn as the axis (`chart-axis`), and an `area` is filled to the zero line from either side, never down to the lowest level. The top is the data's own: a ratio that peaks at 0.4% is drawn to a step over 0.4%, not along the floor of a scale to 100%.

**A format of its own** (`format` as a function, with `axisFormat`): the named formats are what a server component passes, since a function cannot cross into a client one. From a client component, `format` may be a function for a figure no name says exactly: a price to four decimals, a ratio to six, an amount in a currency other than the product's. It reads the readout and the table, and the axis too unless `axisFormat` says otherwise, which is right only while the format is exact: one that rounds prints a tick it does not stand at. A missing value reads `—` whichever format is given. The levels are told apart however fine they are: each is rounded to a digit under its step, so a ratio a millionth apart keeps one level per tick.

**Floor** (`floor`): the lowest level the axis shows, for a quantity that lives in a narrow band. Uptime, a success rate and a cache hit rate are 100% on almost every day and never near zero, so an axis from zero spends most of the plot on a range no day reaches and leaves the one thing the card is about as a shallow dent — Services' uptime line sat pinned to the 100% gridline with 82% of the panel empty and its dips 32px of 180. The floor is snapped *down* to a step, so the level the plot is drawn to is one the axis names, and it is held at or under the lowest value drawn: a hint, never a crop, so the scale widens to the data and never hides a day below its own axis. For `line` and `dashed` series only — an `area` and every stack are read by their height, which a floor changes the meaning of. A caption should name the rule ("on an axis that starts under its lowest day rather than at zero") and not the number, which the next bad day would make wrong.

**Steps** (`curve="step"`): each value is held level until the next reading, then the line moves straight up or down to it (step after). Right for a balance that changes at events — seats on a plan, a credit balance, a limit — where a slope between two days claims a change nobody made. Every path the chart draws steps: a line, an area, the running stretch, and each part of a stack, whose lower edge holds the same values over the same days as the top of the part under it, so the parts meet without a sliver. A quantity measured continuously, such as requests or latency, keeps the default smooth curve: a step there reads as a jump at midnight.

**Points** (`points`): a dot of 3px on each measured value of every `line` and `area`, in the series' colour and ringed in `surface`, so each reading is found rather than inferred from a bend. Right for a few readings — weekly figures, a handful of samples — and paired with `curve="linear"`. None is drawn on a `dashed` reference, which is read as a level, nor on a stack, whose parts are read by their bands. The dots are drawn only while neighbouring readings stand at least 6px apart; closer than that they merge into a thicker line, and none is drawn. A missing day has no dot, and nor has a running point: it is still in progress, and a solid dot would state it as a reading. Each reading stands at its index, not at its time, so readings taken at uneven dates are drawn evenly spaced: pass one value a period, `null` where none was taken, so a straight segment slopes over the span it covers.

**Spans.** `spans` shades a period a fact names — the minutes p95 stayed over its ceiling, an incident's run — as a full-height wash behind the series, from the first of its dates to the last. A period still open at an edge of the plot runs to that edge. It is not a second band: a band is a level, a span is a period.

**A visible key.** A `marks` set and a `running` point draw a dot on a stem and a dashed stretch, and each says what it means in the legend under the plot (the marks' `label`, "Today so far"), in `ink-3`: the caption says the same to a screen reader and the pointer finds a title, and neither is a key a reader can see. A chart with either draws the legend row even for one series, since the key stands in it.

**A held scale** (`domain: [min, max]`): the plot ends at a stated range, on levels that end exactly at both ends (`heldTicks`), so charts read side by side, one per service or per region, share their scale and compare by position. A chart of lines is held from `min`; an `area` and every stack are read by their height, so they are drawn from zero, or from `min` when it is under zero, and the widened line names the range they were drawn on (`from 0–80` for a domain of 20 to 80). While every value drawn, the baseline and the band included, is inside the range, the levels are the held ones; with `whole` only the whole levels are kept, both ends always. A value outside it is never cropped: the scale widens to the nice levels that take every value, and the chart says so in a line above the plot and at the end of its table's caption: `Scale widened from 90.0%–100.0% to 80.0%–100.0%`, each figure in the chart's own `format`. `domain` and `floor` are not passed together: a floor is a hint at the bottom of a scale that is the data's, a domain is the whole scale, and the type refuses both. A domain that is not a range (`max` at or under `min`) is drawn as no domain.

**Marks** (`marks: { dates, tone, label }`): the days the page names in its own words — the days a band left out, a change of state — marked so a reader finds them rather than hunting for one among 360 points. Each is a dot on the first series' own point, ringed in `surface` as the cursor's dots are, and a stem from the point down to the axis at 45% of the same tone. The stem is the load-bearing half: a day can leave a band on a measure the chart does not draw — its error rate, not its p95 — and then its point stands *inside* the band's region, where a 3px dot is lost in the line. A date the chart does not draw, and a day with no value, are skipped rather than marked at the wrong point. The tone is the caller's to say, as a finding's is: `warning` for a day worth a look, `neutral` for one that is only worth knowing. The caption names the count ("Marked: 3 days outside the band").

**Running** (`running`): the last point is a period still in progress, such as today or the month not over yet. It is not a fact like the points before it, so nothing solid reaches it. Every `area` and `line` is drawn as far as the last complete point, and the stretch from there into the running point is a stroke of its own on the same curve: the series' colour, 1.5px, dash 3 4, round caps. No area is filled under that stretch and no glow lies under it, so the lit part of the chart is the part that is settled. A `dashed` series is a reference, a whole period already, and is drawn as ever. Stacked, the bands end at the last complete point and the total's line alone carries the dashed stretch, in the accent; pointing at the running point shows one dot, the total's. The readout says "so far" beside the date and the table's last row says it too; no other point does. The axis is still scaled to every value, the running one included.

Colour: `accent` for the series the page is about; categorical slots 1 to 6 in order for peers; never a status colour unless the series means a status.

**A mark takes the strong quiet; a swatch needs a floor, not just a neighbour.** `chart-neutral` (#D5D7E0 in light) is a *fill* — a track, a band behind a mark — and `chart-neutral-strong` is what a *mark* takes when it is the quiet one, because a mark's job is to be seen against the ground: measured in light, the strong variant is 3.19:1 while the fill is under 3:1 on any light ground, which is how seven bars in a share column came to render blank. A stacked part is the accent faded toward `--surface`, and *that* is a rule about areas that touch each other, where each step only has to differ from its neighbour — a legend swatch has to differ from the ground behind it, and nothing in the ramp's parameters knows that. So every stacked swatch is drawn on a 6px `ink-3` hairline (measured 4.66:1 light, 6.86:1 dark), which keeps the ramp's ordering readable instead of flattening it.

## Sizes

| Height | Gridlines | Use |
|---|---|---|
| `fill` (at least 220px) | 4 | Inside the Featured metric and any card whose row is taller than the chart |
| 248px (default) | 4 | A chart card |
| 160 to 199px | 3 | A secondary chart; phones; an inline embed |

## States

| State | Spec |
|---|---|
| Arriving | The line draws left to right and the area reveals over `dur-grow` 820ms `ease-out`; the glow draws with its line, and the dashed lines fade in, the running stretch with them. |
| Rest, pointing, keyboard | See Meridian. The readout is bounded by the chart at every selected day, including the first and last. |
| Long text, extreme values | Labels wrap inside the readout. It is no wider than its chart, with `space-3` 12px side padding; the static specimen shows a long inference label and spend in billions. |
| Floor | The axis starts at the nearest step at or under `floor`, and under the lowest value drawn when a day falls further: the levels are recomputed, so a floored chart is a chart of its own range and never a cropped one. |
| Baseline | The label stands beside the dashed line where no series is drawn: the right end over the line first, then the nearest clear place at either end. With no clear place it is not drawn. |
| Band | The region under the ceiling, its edge and its label: drawn with the data, revealed left to right with the area's wipe. A chart whose data is far under its band still reaches the ceiling, so the region never collapses to nothing. |
| Held scale | With every value inside the `domain`, the plot ends at it and no words are drawn. With one outside, the levels widen to take it and the widened line stands above the plot. |
| Points | One dot on each measured value while readings are at least 6px apart; none at all once they are closer, never a thinned set. |
| Marks | One dot and one stem for each named day drawn. A day the chart does not draw, and a day with no value, are skipped: a chart never marks a point it does not have. |
| Gap | A `null` value breaks the line: each run of measured days is its own segment. A gap is never drawn as zero. Stacked, a day on which no part has a value breaks every band and the total, and its total reads `—`; a part missing on a day the others were measured stands on the parts below it. |
| Running | The last point is still in progress: a dashed stretch into it, nothing filled under it, "so far" in its readout and its row. With one point, with no value at the running point, or with a gap just before it, there is no stretch to dash and none is drawn; the row still says "so far". |
| Empty | No series: render the card's Empty state instead of an empty plot. |
| Loading | A Skeleton the chart's height. |

## Behaviour

Points are days by default: the axis reads "03 Oct" and the readout the full date. For points that are not days, pass `tick` (`(date) => string`), used by both: hours for a 24-hour period ("14:00"), weeks for a long one ("Week of 3 Mar").

The axis labels itself by counting back from the last date, as many as fit, so an hour of minutes reads 09:04 · 09:11 · 09:19 and a year of days can skip the first of a month. Pass `tickAt` (`(date, index) => boolean`) to name the dates that carry a label: quarter hours read 09:00 · 09:15 · 09:30 · 09:45 · 10:00, a year of days reads its month starts. The width rule still thins the named dates, counted back from the last, so they never collide, and the first named date and the last stay labelled, since they anchor the range. The readout and the table are unaffected: every date still reads.

Pointer, touch and keys as in Meridian. The chart redraws in real pixels when its container resizes, so strokes are never stretched.

## Surfaces

- **Console**: 248px or `fill`; date labels every 92px (six to eight across).
- **Mobile**: 160 to 200px; three or four date labels; the readout pins to the leading edge at the top of the plot, so it stays still while the finger moves between days.
- **Embed**: `fill` inside the Featured metric inline, as Home's view draws it; the console height in fullscreen.

## Agents

The view shares what the chart shows through `useShareView` (the period and the day pointed at). An agent reads exact values from the screen-reader table or the shared structured context, never from the drawing.

## Accessibility

- Focusable `role="img"` labelled with what it shows and how to read a day; the `sr-only` table holds every value. The day the keys or the pointer move to is announced through a polite live line ("01 Oct 2026: Requests 100, Errors 3"), since the readout is hidden from a screen reader. A running point is never told by its dashes alone: its row reads "2026-10-03, so far", and its readout and announcement say the same.
- Marks hold 3:1 on `surface`: slots 1 to 6 from 5.1:1 to 6.2:1 dark, 3.1:1 to 5.0:1 light (slot 5 is labelled everywhere because it falls under 3:1 on light). Axis labels `ink-3` 6.39:1 dark, 5.13:1 light.
- The deepest part of a stack, the one it stands on, holds 3:1 on `surface`: 3.30:1 dark, 3.61:1 light with the indigo accent, and never under 3.23:1 (jade, dark) in any theme and accent (`node scripts/contrast.ts --all`, "the deepest part of a stack"). The parts above it are told from their neighbours by the 1px `surface` hairline, and each is named in the legend and the readout.
- The categorical order passes colour-vision checks: worst adjacent CVD separation 8.7 dark, 10.2 light (`node scripts/contrast.ts`).
- Identity is never colour alone: a legend names every series and the tooltip repeats the label beside each value.

## Content

- `label` says what is measured and per what: "Requests per day", "Latency p95 per day".
- Series labels are short nouns: "This period", "Previous period", "p95".
- A running point is "so far", after the date: "03 Oct 2026 · so far".

## Do and do not

- Do show two measures of different size as two charts on one Meridian.
- Do use `floor` for a quantity that never approaches zero (uptime, a success rate), and say in the caption that the axis starts under the data. Do not floor a quantity whose zero is the meaning — revenue, requests, tokens — where the distance from zero is what the chart is for.
- Do not stack more than one area; use lines for peers.
- Do not put a number on every point.
- Do keep a baseline's label short ("Median 296ms"). A long one spans more of the plot, so more of the data stands under it and fewer places are clear.
- Do draw the band a card is named for. A chart headed "Days inside the band" that draws no band leaves a reader to infer the one thing the card is about from the axis.
- Do mark the days a finding names, and mark every one of them: a chart showing two days outside a band while the card says three is read as the card being wrong.
- Do hold a `domain` on charts compared side by side. Do not choose one tighter than the data to make a change look larger: the chart widens and says so.
- Do set `running` when the last point is a period not over yet. Do not leave a part-day drawn solid: it reads as a fall.

## Implementation

```tsx
import { TrendChart } from '@/components/charts/trend-chart';

<TrendChart
  label="Requests per day"
  dates={series.map((d) => d.date)}
  height="fill"
  series={[
    { key: 'now', label: 'This period', values: series.map((d) => d.requests), kind: 'area' },
    { key: 'prev', label: 'Previous period', values: previous.map((d) => d.requests), kind: 'dashed' },
  ]}
/>
```

Props: `dates`, `series` (`key`, `label`, `values`, `color`, `kind`), `format` (`count` | `compact` | `cost` | `cost-compact` | `duration` | `percent`, or a function from a client component), `axisFormat` (with a function `format`), `height` (number or `fill`), `label`, `legend` (defaults to two or more series), `tick`, `tickAt` (which dates carry an x-axis label), `stacked`, `whole` (the values are counts: whole levels only), `baseline`, `band`, `floor` or `domain` (a held scale, never both), `marks`, `spans` (`{ from, to, label }[]`, a period a fact names), `running` (the last point is still in progress), `curve` (`monotone`, `linear` or `step`), `points`.

The colour of a stacked part is `stackPart(place, parts)` from `@/components/charts/scale`, the one mix every one-hue stack takes: the accent into the surface, by the part's place from the bottom.

The Atlas uses `data-preview-index` to show a selected day's readout statically. Product charts use the Meridian's cursor instead.
