# Meridian

The Meridian is one time cursor shared by every chart and tile on a page: point at a day in any time chart and every chart draws the same line, and every figure reads that day.

Status: beta

## Anatomy

1. **Provider**: `<Meridian dates>` around a page's rows. It holds one list of dates and one index (the day pointed at, or none).
2. **Cursor line**: a 1px vertical hairline in `ink-3` at 55%, from the top of the plot to its baseline, in every time chart on the page.
3. **Marks**: a 4px dot on each series at that day, filled with the series colour, ringed 2px in `surface`.
4. **Tooltip**: only on the chart under the pointer: the date as a mono eyebrow, then one row per series (swatch, label, value). Other charts show the line and the dots, never a second tooltip.
5. **Readouts**: Metric tiles and the Featured metric swap their figure for that day's value and their delta for the date; a Sparkline marks the day with a hairline and a dot. Each does so only when it has one value for each of the Meridian's dates.

## Variants

| Variant | Use |
|---|---|
| Shared | Charts inside one `<Meridian>` whose `dates` have the same length follow one cursor. The default for a dashboard page. |
| Alone | A chart outside a provider (or with a different number of dates) keeps a private cursor; nothing else moves. |
| Not the page's points | A Metric tile, a Featured metric or a Sparkline inside the provider with any other number of values than the Meridian has dates does not read the cursor: it keeps its period's figure and draws no mark. |

## Sizes

The Meridian has no size of its own. The line is 1px; the dots 8px across (4px radius) with a 2px ring; the tooltip is at least 144px wide, padded 12 by 8px, `radius-md`, `surface-raised` with `shadow-overlay`.

## States

| State | What shows |
|---|---|
| Rest | No line. Tiles show the period's figure and delta. |
| Pointing | The line and dots on every chart; the tooltip on the chart under the pointer; tiles whose points are the page's show the day. The tooltip fades in over `dur-hover`. |
| Keyboard | A focused chart draws a 2px `accent` ring around its plot while it has focus; the line moves with the keys. |
| Left | Leaving the chart (pointer out, Escape, blur) clears the index everywhere. |

## Behaviour

- **Pointer**: the nearest day to the pointer's x. **Touch**: press and drag along the chart; vertical drags still scroll the page (`touch-action: pan-y`).
- **Keyboard** on a focused chart: Left and Right move one day, Home and End jump to the first and last, Escape clears.
- **From an address or a finding**: `Meridian day="2026-09-22"` opens the page pointed at a day (`?day=`), and `usePointMeridian()` points it from outside a chart, as a tile's finding does. A new address day takes over on client navigation; the person's next pointer takes over from there. Rerendering with the same address day does not reset that local cursor.
- **When the dates change**: the selected date keeps its cursor at its new position. If the frame no longer holds that date, the cursor clears rather than reading another day or an index outside the frame.
- **From a chart of other dates**: a Heatmap of a year of days does not share the page's list of dates. With `meridian` it points the Meridian at the day read through `usePointMeridian()` when the Meridian holds that date, and lets go of it through `useClearMeridian()` when it does not, and when the person lets go.
- One index per page: the latest pointer wins. A chart, a column chart with `dates`, a tile and a sparkline all read it through `useMeridian` or `useMeridianIndex`.
- One rule for who reads it: one value for each of the Meridian's dates. A chart joins by it (`useMeridian` compares the lengths), and a Metric tile, a Featured metric and a Sparkline read `useMeridianIndex()` and compare their own number of values with `dates.length` before they read the index. The index is a position in the page's list of dates, so a series of another length would read a different day: a tile of a customer's 14 days on a page of 30 keeps its period's figure. A compact Metric tile never reads the cursor in its line.

## Surfaces

- **Console**: pointer and keyboard as above.
- **Mobile**: the finger drags the cursor; a Trend chart's readout stays at the leading edge above the plot, bounded by its width. On wider charts the readout follows the cursor and measures its own width to stay inside the plot.
- **Embed**: the same. The view shares the day the person is looking at with the model (below), so "why did it dip here?" has a referent.

## Agents

- An embed view calls `useShareView` with its shared context, whose `focus` sentence names the day pointed at, whenever the index changes, so the model knows which day is pointed at.
- An agent never moves the cursor. It reads the same numbers from the shared context and from every chart's screen-reader table.

## Accessibility

- Each chart's plot is focusable, a `role="img"` (Trend chart) or a `role="group"` of its marks (Column chart, Heatmap), with a label that says how to use the keys, and carries an `sr-only` table of every day and series: the tooltip is visual only, the table is the accessible source of the numbers.
- The cursor line is decorative; the marks hold 3:1 (`accent` on `surface` 3.71:1 dark, 5.71:1 light).
- Reduced motion: nothing animates; the line jumps with the pointer instead of gliding.

## Content

- The tooltip's date is the long form ("22 Sept 2026"); values use the chart's formatter, never raw numbers.

## Do and do not

- Do wrap a whole page body in one Meridian when its charts share a period.
- Do not put charts of different periods in one Meridian: give each its own, or none. A tile or a Sparkline of another period may stand inside it: it does not read the cursor.
- Do not add a second cursor behaviour (a crosshair, a vertical band); the Meridian is the only one.

## Implementation

```tsx
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';

<Meridian dates={series.map((d) => d.date)}>
  <TrendChart label="Requests per day" dates={dates} series={[...]} />
  <MetricTile label="Error rate" points={series.map((d) => d.errors / d.requests)} ... />
</Meridian>
```

`useMeridian(dates)` returns `{ index, setIndex, dates, shared }` for a chart; `useMeridianIndex()` returns `{ index, dates }` for a readout that never sets it. From outside a chart, `usePointMeridian()` returns a function that points the page's Meridian at a date it holds, and `useClearMeridian()` one that lets go of it; both do nothing without a Meridian.
