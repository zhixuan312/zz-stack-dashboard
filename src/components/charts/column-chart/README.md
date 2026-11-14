# Column chart

A column chart compares counts side by side, one column per category or per period, with one column highlighted; given parts, each column is a whole split into them, or, grouped, two or three identities standing side by side.

Status: beta

## Anatomy

1. **Legend** (stacked, two or more parts drawn; grouped, always): above the plot, in stack order from the bottom, or grouped, in order from the left. A 10px square swatch (3px radius, as the Heatmap's) at the part's own strength, ringed by a 1px `ink-3` hairline, and the part's label in `ink-2` at `text-xs`.
2. **Gridlines and y labels**: three or four "nice" ticks from zero, or, for a signed series, from a step under its lowest value, `chart-grid` lines (the one at zero `chart-axis`), `text-2xs` `ink-3` labels in a gutter sized to the longest. Each label is the value its tick stands at, written by an axis formatter. Stacked, the axis is the total's.
3. **Columns**: equal width, 2px apart while the plot has room for it (see More columns than room), rounded 4px at the top, growing from the zero line; a fall (a value under zero) hangs from it, rounded 4px at the bottom and growing down. Plain, the population is `chart-neutral` and the highlighted column `accent`.
4. **Parts** (stacked): the first at the bottom, a 1px hairline of the card where two touch. Only the topmost part drawn is rounded. A part that is not zero is at least 3px tall; a part at zero is absent, with no line and no gap.
5. **Parts** (grouped): the column's parts side by side in its slot, the first on the left, 1px of the card between them, each in its categorical slot, rounded 4px at its free end. A part rises from the zero line or hangs from it; a part with no data keeps its slot with the dashed no-data hairline on the zero line.
6. **Value at rest**: the column's value, or its total, above it (under a fall) in `text-2xs` `ink-3`, while a column is at least 36px wide. Grouped, each part's value above its bar (under a fall), while the bar is at least 36px wide.
7. **Hatch** (an estimate): stripes of the surface's colour at 135° over the column's own fill, or over every part of it; once any column is an estimate, `Hatched: estimate` in `text-2xs` `ink-3` under the x labels.
8. **Dashed outline** (with a period still running): a 1px dashed `ink` line around the last column, open at the baseline, with 1px of the card between it and the fill, which is drawn at half strength. The outline has space of its own: it covers no part.
9. **No-data mark** (a period with no data): no column, and a dashed `line-strong` hairline across the slot, 2px above the baseline. Nothing stands up from the baseline, so the tallest mark on the chart is always a value; the slot keeps its place, and its value reads "No data" just above the hairline.
10. **Pointed column**: plain, it takes the accent and its value stands above it on `surface-inverse`. Stacked or grouped, it takes a 2px `ink` ring around its box and the readout.
11. **Readout** (stacked and grouped): a panel on `surface-raised` beside the pointed column: the period, every part from the top down with its value, then the total; grouped, every part from the left, and no total.
12. **X labels**: `text-2xs` `ink-3`. Dates show as many as fit without colliding, counted back from the last column, and are never cut. Categories each keep their label, cut with an ellipsis to their column, while a column is at least 36px wide (an unlabelled category cannot be told apart); narrower, they thin like dates. The pointed column's label always shows whole. A label is centred under its column, but the first starts no earlier than its column and the last ends no later than its own, so neither runs past the plot; the plain pointed value is placed the same way.
13. **Announcement**: a visually hidden line that reads the pointed column to screen readers.
14. **Screen-reader table**: every column's label and value; stacked, every part and the total; grouped, every part and no total.

## Variants

| Variant | Use |
|---|---|
| Categories | One column per category, sorted by value |
| Days | One column per day, or per week or month, given its `dates`; today or the period in question highlighted |
| On the Meridian | Given `dates`, one a column, the columns share the page's cursor: pointing at a column points every chart at that day, and the pointed day is highlighted |
| Stacked, one hue | `parts` with no tone: parts of one kind, such as requests by region or revenue by plan. Each column is a whole and the top of a column is its total |
| Stacked, outcomes | `parts` with a tone each: how something ended, such as passed, skipped and failed |
| Stacked, identities | `parts` with a categorical `color` each: teams, or several usual outcomes (accepted, delivered and abandoned) that one grey would make one. No tone beside them |
| Grouped | `grouped` with two or three `parts`, each an identity in a categorical slot: In and Out, this year and last. Nothing is summed and there is no Total |
| Estimates | `estimate` on a column whose figure is not yet measured, in every form: it is hatched and reads "estimate" |
| Running | The last column is a period still in progress, in every form |
| Rises and falls | A signed series in the plain form, such as a net change a day: values under zero are falls |

**The colour of a part.** Parts with no tone are one whole, so they share the accent, mixed into the surface: deepest at the bottom and paler with each part above, between the theme's `chart-stack-hi` and `chart-stack-lo` (dark 92% to 20%, light 78% to 36%). It is the mix a stacked Trend chart takes, from the same function, so the two read as one family. Once any part names a tone the parts are outcomes: the usual outcome is `neutral` and takes `chart-neutral-strong`, and one that needs somebody takes `warning` or `critical`. A part with no tone among parts that have one is neutral too, so the accent never stands beside a status colour, and the positive colour is never used for the usual case. When a part already is the neutral (`tone: 'neutral'`), a second usual part, Other among them, takes no tone and is drawn in the quieter `chart-neutral`, so the two usual parts are told apart and Other stays the quietest; like the paler parts of one hue, it is not held to 3:1, and the swatch's hairline, the legend and the table carry it. When the parts are identities (teams), or more than one outcome is usual, give each a categorical slot, `color` 1 to 6 in order, as a Trend series takes one: each draws in `series-<n>`, and a part with no slot (Other among them) is neutral. Keep status colours out of such a chart, as the accent is kept out of a toned one: coral (2) and saffron (5) read as a warning beside a real one. A chart with an outcome that needs somebody is a toned chart.

**Rises and falls.** A plain chart draws a signed series whole. When a value is under zero the scale goes down to a step under the lowest one, zero is one of its levels and is drawn as the axis (`chart-axis`), and the columns stand on it: a rise stands up from it and a fall hangs down from it, rounded at its lower end, its value at rest under it, its running outline open at the zero line. A fall is the same neutral as a rise, and the highlighted column the accent: which side of zero a column is on says the sign, and a second colour would say it twice. The plot keeps 28px under its lowest tick, as over its top one, for a fall's value. Format a change with its sign (`+12`, `−8`, with the true minus) so a figure read alone says which way it went. Stacked, the parts make up a whole, so a part under zero is no contribution and draws nothing; a signed series is plain. While no value is under zero, the scale is from zero as before.

**Grouped.** `grouped` stands a column's parts side by side, for two or three identities compared period by period: money in and money out, this year and last, two regions. They are identities, never the parts of a whole, so nothing is summed: the axis is every part's own value, from zero, or from a step under the lowest when a part is under zero (it hangs from the zero line, as a plain fall does), and no Total is drawn, read or tabled. Each part takes its categorical slot, `color` 1 to 6, the first part slot 1 and so on unless it names one, and a part past the sixth with no slot is neutral; a grouped part has no `tone`, which its type refuses, and the accent is never drawn: a highlighted or pointed group wears the 2px `ink` ring around its box. A part with no data (`null`) keeps its slot with the dashed no-data hairline on the zero line, so it never reads as a zero, and reads `noData` over it at rest while its bar is 36px wide or more, pointed at and in the table; a group whose every part is `null` draws the column's no-data mark. Running, the last group's bars are at half strength inside one dashed outline. For more than three identities, or a long run of periods, the form is a Trend chart with a line a series. The grouped form is a chunk of its own, loaded on demand: a route whose charts never pass `grouped` downloads none of it.

**Estimates.** `estimate: true` on a column says its figure is not yet measured: a day not yet reconciled, a forecast month. Its fill, or every part of it in a stacked or grouped column, is hatched (`data-estimate`, the base role in `src/styles/base.css`, which draws surface stripes over the mark's own background colour and keeps them under forced colours); a dense chart draws an estimated column as an element of its own so the hatch has a fill to stand on. Wherever the column is read it says so: ", estimate" in the announcement and its row of the table, " · estimate" in the readout. The chart writes `Hatched: estimate` once, under its labels, whenever any column is one, and nothing about estimates when none is. A period with no data is not an estimate: there is no figure to hatch.

**At most four parts.** Past four, nobody tells the steps of one hue apart. Given more, the fourth drawn is "Other": the sum of the fourth and every later part, in the columns, the legend, the readout and the table alike. Among outcomes it has no tone of its own and is neutral.

**The value at rest.** While `(plot width - 2 × (n - 1)) / n` is 36 or more for n columns, the plot width being the chart's width less the axis gutter, every column carries its value above it, or its total when stacked, as the chart formats it. Narrower, the figures would collide, so only the pointed column carries one. Pass a compact format: a figure wider than its column is cut with an ellipsis at rest, keeps the whole of itself in its column's title, and reads whole when the column is pointed at. A column that wide always has its whole gap, so the 2 in the rule is the gap as drawn.

**More columns than room.** A chart is never wider than its box, whatever it is given. The 2px between columns are kept while every column has a pixel of its own, which for n columns is a plot wider than `3n - 2` pixels. Under that the gap is 1px, and under `2n - 1` pixels there is none: the columns stand side by side and share the whole plot, each under a pixel once the plot is narrower than n pixels. The gap closes a whole pixel at a time, because a fraction of a pixel is drawn as a gap between some columns and none between others. Thirty days keep their 2px in a plot wider than 88px and ninety in one wider than 268px; a year of 360 needs 1,078px, and in a card half a desk wide has no gap at all. The rule is written in the rows' own style as an expression of their width, so it holds in the server's HTML, before the chart has measured itself, and the labels under the columns take the same gap and stay under them. Columns that narrow are a shape, and none of them is read on its own: for that many periods the form is a Trend chart.
 Past thirty columns a plain chart draws its bars as one path per fill inside an inline SVG, at the same slots, shares, 4px rounding and 2px floor: a chart of fifty columns committed about three hundred layout objects in the frame a period switch lands in, and this draws the same marks in a handful, with one overlay reading the column under the pointer. A stacked chart past thirty columns still draws a column of its own.

**No data.** A period with no data is not a period of zero: a week in which nothing was called has no failure rate, and drawn as zero it says the rate was perfect. Pass `null` for it, as a Trend chart's value is passed. The column keeps its slot, so the periods either side stay apart and the time axis is true, and draws only the no-data mark: no height, a dashed hairline on the baseline. Wherever its value would be read it reads `noData`, "No data" unless the product passes another word: at rest above it, pointed at, in the announcement and in the table. The scale is the periods that have data. Stacked, each part may be `null`: a column whose every part is `null` is a period with no data, drawn and read as one; a part that is `null` among parts that were read draws nothing, reads "No data" in the readout and the table, and adds nothing to the total, which is the total of the parts read. A running period with no data reads "No data so far" in every place its value is read.

**Periods take dates.** A chart whose columns are periods (days, weeks, months) passes `dates`, one ISO date a column, the period's first day. Its labels then thin as dates do and are never cut; passed as categories, "27 Sept" is cut to its column on a phone and reads "27 S…". Outside a Meridian the dates change nothing else.

**Running.** The last column is a period not over yet, such as today or the month so far. It is not a fact like the columns before it, so its fill is drawn at half strength, and a dashed outline, open at the baseline, stands around it. The fill alone would not do: a neutral column at half strength is nearly lost on the card (1.20:1 dark, 1.17:1 light, where a complete one is 1.50:1 and 1.39:1), so the outline, in `ink`, is what keeps the unfinished column a column, while its faded, hollowed body stays plainly weaker than a complete one. Wherever it is read it says "so far": the plain column's value when pointed at, the readout, the announcement and its row of the table. No other column does. A running period with no data reads "No data so far" (the product's `noData`, then "so far"); at rest, where its column is too narrow for those words, as on a phone, it reads "So far" above the dashed outline rather than a word cut short, and the rest say it whole.

## Sizes

| Height | Use |
|---|---|
| 200px (default) | A chart card: columns grow in 164px |
| 160 to 180px | A secondary chart: columns grow in 124 to 144px. Under 160px the 36px the box keeps for values and the zero label is a third of the chart, so a chart that short is better a Sparkline or a taller card |
| `fill` (at least 220px) | A card whose row is taller than the chart: the plot takes what the legend and the labels leave |

The height is the plot's box, and the box holds everything the plot draws. The scale stands inside it: 28px under the box's top, which is room over the top tick for a column's value, at rest (16px, 4px off the column) or pointed at (24px, 4px off), and 8px over its bottom, which is the half line the zero tick's label hangs under its gridline. So columns grow in the height less 36px, and nothing moves when the chart's width arrives. Under the box the labels take 24px, 8px off it, and above it a legend takes one line and 8px, more when it wraps. Columns share the width, less the gaps between them: 2px each, or the 1px or nothing that More columns than room leaves.

The readout is at least 144px wide and never wider than the chart, with `space-3` 12px side padding, on `shadow-overlay`.

## States

| State | Spec |
|---|---|
| Arriving | Columns grow from the baseline over `dur-grow`, 12ms apart; values at rest fade in over `dur-enter`. |
| Rest | Columns, and their values where a column is 36px or wider. No readout. |
| Hover | Plain, neutral columns step up to `chart-neutral-strong` over `dur-hover`. |
| Pointed | By the pointer or the keys. Plain: the column takes the accent, and its value stands above it in `ink-inverse` on `surface-inverse`. Stacked or grouped: the column takes a 2px `ink` ring over `dur-hover` and the readout shows; stacked, its total steps up to `ink`. |
| Highlighted | With no column pointed at, the highlighted column is the accent one (plain) or wears the ring (stacked and grouped). Its title adds `highlightLabel`, and the table's caption names it the way the mark draws it: `Accented: {highlightLabel}` plain, `Ringed: {highlightLabel}` stacked and grouped. |
| Focus | The plot wears a 2px `accent` outline, 4px off its box, on `radius-sm`. The ring encloses the plot's box and so all the plot draws: the gridlines, every tick's label whole, the columns, their values at rest and the pointed value. It stands 4px under the line of the zero tick's label and 2px over the line of the x labels, and encloses neither the legend nor the x labels. |
| Running | The last column's fill at half strength, inside a 1px dashed `ink` outline, open at the baseline, 1px off the fill; "so far" where it is read. Grouped, the group's bars at half strength inside one outline. |
| Estimate | The column's fill, or each of its parts, hatched; "estimate" where it is read, and `Hatched: estimate` under the labels. |
| More columns than room | The gap closes from 2px to 1px to none as the plot runs out of room for it, in the columns and in the labels under them alike, and the chart keeps its box. A running column narrower than the 4px its outline needs keeps the outline: it ends with the column and stands over the columns before it, never past the plot. |
| Zero | A column at zero draws nothing and reads zero; stacked, a column whose parts are all zero draws no part and reads a total of zero. Stacked, a part that is missing or below zero counts as zero. A plain column below zero is a fall (Rises and falls). |
| No data | A `null` period keeps its slot, draws no column but a dashed hairline on the baseline, and reads "No data" (or `noData`) at rest, pointed at, in the announcement and in the table. The scale leaves it out. Stacked, a column of `null` parts is the same; a `null` part among parts read draws nothing, reads "No data" and adds nothing to the total. Grouped, a `null` part keeps its slot with the hairline and reads "No data". Running, it reads "No data so far". |
| Highlighted key | A plain chart draws the accented column's key under the plot: a 10px accent swatch and `Accented: {highlightLabel}` in `text-xs` `ink-2`, indented to the plot's gutter. A stacked or grouped chart draws the ring instead (`Ringed: {highlightLabel}`), since its accent is spent on the parts. Nothing is drawn unless the chart is told both which column is the subject and why. |
| Held scale | With a `domain` and every value inside it, the levels end at both ends of the range and nothing else is drawn. With a value outside it, the levels widen to take it and `Scale widened from {min}–{max} to {low}–{top}` stands above the plot in `text-2xs` `ink-3`, and in the table's caption. |
| Empty | Render the card's Empty state. |

## Behaviour

- **Pointer**: entering or tapping a column points at it; leaving the chart lets go.
- **Keyboard**: the plot is one Tab stop, and its ring is the plot's own outline. Left and Right move the cursor a column, Home and End go to the first and the last. With no column pointed at, the cursor starts from the last column: a first Left lands on the last but one, a first Right on the last. Escape and blur let go.
- **One cursor**: the keys move the cursor the pointer moves. With `dates`, one a column, that cursor is the page's Meridian index, so every chart and tile on the page reads the same day.
- **Readout**: stacked and grouped, and only on the chart being pointed at: a chart that follows another chart's cursor on the page's Meridian rings the day and keeps its panel hidden, as the Trend chart does. It stands after a column in the first half of the plot and before one in the second, measures its own width and stays inside the chart; long labels wrap. Under 640px it pins to the plot's leading edge.
- **Width**: the chart reads its own width, and every rule about width follows it, not the window, except the readout's pin to the leading edge, which follows a window under 640px.

## Surfaces

- **Console**: 200px or `fill`. A week or a quarter of periods usually keeps its values at rest; thirty days in half a row does not.
- **Mobile**: date labels thin out as the width shrinks and category labels cut shorter; under 36px a column, values show on pointing. A long run of days closes its gaps on a narrow card first: ninety days are a pixel apart once the plot is under 268px wide. A tap points at a column; the readout pins to the leading edge.
- **Embed**: same as mobile inline; the console's in fullscreen.

## Agents

The view shares the highlighted column and the day pointed at through `useShareView`; an agent reads values from the table, never from the drawing. A period still running is marked in the table's row ("03 Oct, so far"), so an agent does not report a part-day as a fall. A period with no data reads "No data" in its row, never 0, so an agent does not report a gap as a perfect period. An estimated column is marked in its row ("14 Sept, estimate"), so an agent does not report a figure not yet measured as a fact.

## Accessibility

- A labelled `figure` whose `sr-only` table holds every value: a row a column, its label in the row's header cell. Stacked, the head is the period, each part drawn and "Total"; grouped, the period and each part, with no Total. The running column's header cell says "so far", and an estimated one's says "estimate".
- The plot is a `role="group"` named with the chart's label and how to use the keys: "Errors per day. Use the arrow keys to read one column." The column pointed at is read in an `aria-live="polite"` line: "Tue: 20", or "21 Sept: Large $40, Swift $0, Embed $20, Total $60", with ", so far" for the running column. A period with no data reads "21 Sept: No data". It is empty when no column is pointed at.
- Contrast on `surface`, dark then light, with the indigo accent (`node scripts/contrast.ts --all`): the accent column 3.71:1 and 5.71:1; `chart-neutral-strong` 3.96:1 and 3.52:1; `warning` 9.06:1 and 3.36:1; `critical` 5.90:1 and 4.58:1; the ring and the dashed outline, `ink`, 16.89:1 and 17.93:1; values at rest, labels and the swatch's hairline, `ink-3`, 6.39:1 and 5.13:1. The plain value, `ink-inverse` on `surface-inverse`: 16.31:1 and 17.00:1. The readout's text, `ink` on `surface-raised`: 15.45:1 and 18.54:1.
- The deepest part of a stack, the one it stands on, holds 3:1 on `surface`: 3.30:1 dark, 3.61:1 light with the indigo accent, and never under 3.23:1 (jade, dark) in any theme and accent. The paler parts are not held to 3:1, as the neutral columns are not: the hairline, the legend, the total at rest, the readout and the table carry what their colour alone does not (WCAG 1.4.11).
- A running column's fill is at half strength on purpose. Measured on `surface` with the repository's colour helpers, dark then light: a neutral column 1.50:1 and 1.39:1 complete, 1.20:1 and 1.17:1 at half strength; the accent column, with the indigo accent, 3.71:1 and 5.71:1 complete, 1.81:1 and 2.18:1 at half strength. No fill at half strength holds 3:1, so the column is not told by its fill: the dashed outline is `ink` (16.89:1 and 17.93:1) and stands on the card, with 1px of the card inside it, so it holds that contrast whatever it surrounds; and the words "so far" are in every place the column is read.
- A period with no data is never told by its hairline alone: the dashed hairline is not held to 3:1, and the words "No data" stand at rest, pointed at, in the announcement and in the table.
- An estimate is never the hatch alone: the key under the labels names it, and "estimate" stands in the readout, the announcement and the table.
- An outcome is never colour alone: the legend names each part in words, and the readout repeats the name beside each value.
- Neutral columns are the population and are not meant to be told apart by colour.

## Content

- Category labels are short (drop shared prefixes like `/v1/`); day labels are "27 Sept".
- The axis takes an axis formatter, `AXIS_FORMATTERS.count` or `AXIS_FORMATTERS.cost` from `@/lib/format`: one that is true at every tick ("1.5K", never "2K" for 1,500). A value formatter that rounds, such as `formatCompact`, is not one. With no `axisFormat` the axis reads as `format` does, which is right only while `format` is exact.
- A chart of counts passes `whole`: every level is a whole number, so a top of 1 is ticked 0 and 1, with no unlabelled level at 0.5 that no count stands at.
- `format` must tell neighbouring columns apart, because it writes the value above each: an exact count where the values are in the hundreds and low thousands ("902", "1,124", "1,016"), a compact one from the tens of thousands up ("62K", "108K"). Three columns of different heights that all read "1K" say the chart is wrong.
- Part labels are short nouns: "Enterprise", "us-east-1", "Failed". The fold is "Other".
- A running period is "so far", after its label: "03 Oct · so far" in the readout, "03 Oct, so far" in the table.
- A period with no data reads "No data". A product that says it another way ("Not observed", "No calls") passes `noData`; the word says there is no figure, never that the figure is zero.
- `label` says what is counted and per what: "Errors per day", "Revenue per month, by plan".

## Do and do not

- Do highlight at most one column.
- Do pass `axisFormat`, an axis formatter, whenever `format` rounds. Do not hand the axis a value formatter: `formatCompact` labels the tick at 1,500 "2K".
- Do choose a `format` under which two columns of plainly different heights never read the same.
- Do pass `dates` when the columns are periods. Do not pass periods as categories: their labels are cut mid-word on a phone.
- Do use parts when each period is a whole worth reading by its total. Parts at one moment are a Composition bar; parts over a long run of days, where the shape is the story, are a stacked Trend chart.
- Do use a Trend chart for a long run of days. A Column chart keeps its box with any number of columns, but once its gaps have closed nobody reads one column from the next.
- Do set a period still in progress as running. Do not leave a part-day drawn solid: it reads as a fall.
- Do pass `null` for a period with no data. Do not pass 0, which is drawn and read as a real zero, and do not leave the period out, which closes the gap and puts its neighbours side by side.
- Do hold a `domain` on charts compared side by side: three small multiples of the same measure share their levels and compare by height. Do not hold one tighter than the data to make a change look larger: the chart widens and says so.
- Do not colour columns by value; their height already shows it.
- Do not give a tone to parts of one kind, and do not put the accent beside a tone.
- Do not draw two usual outcomes in one neutral, or teams as shades of the accent: give each a `color` slot, in order. Do not put a `warning` or `critical` part beside categorical slots.
- Do not pass more than four outcomes: a fifth folds into a neutral Other, and a failure inside it is drawn as the usual case.
- Do group two or three identities that are compared, not summed. Do not group the parts of a whole: a stack shows its total, a group never does.
- Do mark a figure not yet measured as an estimate. Do not draw a forecast or an unreconciled day solid: it reads as a fact.

## Implementation

```tsx
import { ColumnChart } from '@/components/charts/column-chart';

import { AXIS_FORMATTERS, formatCompact, formatCost } from '@/lib/format';

<ColumnChart label="Errors per day" dates={dates} axisFormat={AXIS_FORMATTERS.count}
  columns={series.map((d) => ({ key: d.date, label: formatDate(d.date), value: d.errors }))} />

<ColumnChart label="Requests by endpoint" format={formatCompact} axisFormat={AXIS_FORMATTERS.count}
  columns={endpoints.map((e) => ({ key: e.route, label: e.route, value: e.requests }))} />

<ColumnChart label="Revenue per month, by plan" height="fill" running format={formatCost} axisFormat={AXIS_FORMATTERS.cost} dates={months.map((m) => m.month)}
  parts={[{ key: 'enterprise', label: 'Enterprise' }, { key: 'scale', label: 'Scale' }, { key: 'starter', label: 'Starter' }]}
  columns={months.map((m) => ({ key: m.month, label: m.label, values: [m.enterprise, m.scale, m.starter] }))} />

<ColumnChart label="Verification runs per day, by how they ended" dates={dates}
  parts={[{ key: 'passed', label: 'Passed', tone: 'neutral' }, { key: 'skipped', label: 'Skipped', tone: 'warning' }, { key: 'failed', label: 'Failed', tone: 'critical' }]}
  columns={days.map((d) => ({ key: d.date, label: formatDate(d.date), values: [d.passed, d.skipped, d.failed] }))} />

<ColumnChart label="Credits per day, bought and refunded" grouped dates={dates} format={formatCost} axisFormat={AXIS_FORMATTERS.cost}
  parts={[{ key: 'bought', label: 'Bought' }, { key: 'refunded', label: 'Refunded' }]}
  columns={days.map((d) => ({ key: d.date, label: formatDate(d.date), values: [d.bought, -d.refunded], estimate: !d.reconciled }))} />
```

```ts
export type Column = { key: string; label: string; value: number | null; estimate?: boolean };   // null: a period with no data
export type StackedColumn = { key: string; label: string; values: (number | null)[]; estimate?: boolean };
export type ColumnPart = { key: string; label: string; color?: number; tone?: 'neutral' | 'warning' | 'critical' };   // color: a categorical slot, 1 to 6
export type GroupedPart = { key: string; label: string; color?: number };   // an identity: a categorical slot, never a tone

export type ColumnChartProps = {
  highlight?: string;              // the key of the one column the card is about
  dates?: string[];                // one ISO date a column, for periods: labels thin as dates, and the chart joins the page's Meridian
  running?: boolean;               // the last column is a period still in progress
  format?: (n: number) => string;       // a column's value; it must tell neighbouring columns apart
  noData?: string;                 // how a period with no data reads: "No data" by default
  axisFormat?: (n: number) => string;   // a tick's label: an axis formatter, true at every tick
  height?: number | 'fill';        // 'fill': the card's height, never under 220px
  label: string;
  labelEvery?: number;             // label every nth column from the first: 6 puts hours at 00, 06, 12, 18
  className?: string;
} & ({ columns: Column[] } | { columns: StackedColumn[]; parts: ColumnPart[] } | { columns: StackedColumn[]; parts: GroupedPart[]; grouped: true });
```

With `parts`, a column's `values` holds one value a part, in the parts' order, the first at the bottom (grouped, the first on the left). On `fill` the chart's parent is a flex column, as a card's body is when its row is taller than the chart.

The colour of a part with no tone is `stackPart(place, parts)` from `@/components/charts/scale`, the one mix every one-hue stack takes: the accent into the surface, by the part's place from the bottom of the parts drawn.

The gap is each row's own `column-gap`, set in its style from the number of columns: a sum of steps, each from nothing to 1px as the row's width passes the next threshold.

Every column carries `data-column` with its key, `data-active` while it is pointed at, `data-running` when it is the running one and `data-no-data` when it has no data; its hairline carries `data-no-data-mark`. The plot carries `data-plot`, a tick's label `data-tick`, a value `data-value`, the legend `data-legend` and the readout `data-readout`. A part carries `data-part` with its key (`other` for the fold), and in a stack `data-tone` (`accent`, `series`, `neutral`, `warning` or `critical`) and, when it is the topmost drawn, `data-top`; a grouped part has no tone, since its colour is its slot, and one under zero carries `data-fall`. A grouped chart's figure carries `data-grouped`. An estimated column's fill, and every part of an estimated column, carries `data-estimate`, filled by a background colour (never the `background` shorthand, which would clear the hatch); the key under the labels carries `data-estimate-key`.

The grouped form is `GroupedColumns` in `./grouped`, which `ColumnChart` loads through `next/dynamic` only when it is passed `grouped`; what both forms use (the measures, the gap rule, the cursor, the axis, the labels and the swatch) is in `./shared`.

The Atlas uses `data-preview-index` to show a pointed column and its readout statically, as the Trend chart does, and draws the focused plot with a class that gives the plot its outline. Product charts use the pointer, the keys and the Meridian instead.
