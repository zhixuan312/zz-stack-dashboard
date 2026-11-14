# Heatmap

A heatmap shows when load comes, as a grid of cells where a darker cell means more: a week of hours, or a year of days.

Status: beta

## Anatomy

1. **Column labels**: `text-2xs` `ink-3` above the grid. On a week of hours, the hour, every six hours. On a calendar, the short month ("Oct") above the column that holds its first day.
2. **Weekday names**: Monday first, `text-2xs` `ink-3`, in a 40px column, 8px from the cells.
3. **Cells**: one per hour or per date, 2px apart, filled with the step its value earns.
4. **Legend**: the figure's caption, right-aligned under the grid. The empty step and its name ("No requests"), then "Less", the five steps of the accent and "More".
5. **Weeks shown**: on a calendar that cannot show every week, "The latest 19 of 52 weeks", at the leading edge of the caption.
6. **Readout**: over the cell pointed at, on `surface-inverse`: the value, its unit and when; on a week of hours, when names the timezone ("Thu 14:00 UTC").
7. **Screen-reader table**: every value given, whatever is drawn.

## Variants

| Form | Prop | Draws |
|---|---|---|
| By hour | `values` | Weekday by hour: seven rows, 24 columns, when the figure is at least 560px wide |
| Grouped | `values` | Hours in threes, 8 columns, under 560px, so a cell stays large enough to point at |
| Calendar | `days` | A cell a date, a column a week of Monday to Sunday, a row a weekday. The first and the last column hold only the days given |
| Latest weeks | `days` | When not every week fits at 12px a cell, the latest that do, and the caption says how many of how many |

| Scale | A cell's step | Use |
|---|---|---|
| `max`, the default | Its share of the largest cell: `min(5, 1 + floor(value / largest × 4.999))` | Values of one order of magnitude, where the share is the story |
| `quantile` | Its rank among the cells above zero: of n of them, a cell with s smaller takes `ceil((s + 1) × 5 / n)`, and the cells that hold the largest value take 5 | Values with an outlier, which on `max` would leave every other cell at the lowest step |

The cells ranked are the ones the form draws from its data: on a grouped week of hours the three-hour blocks, and on a calendar every day given, shown or not, so a day keeps its step at any width. Equal values share one step, the one the lowest of them earns. On `quantile` the legend's upper end reads the value the top step starts at, "900 or more", in place of "More".

## Sizes

The grid takes its container's width. The colour ramp has six steps: an empty `fill-track` for zero and below, then the accent mixed into `surface` at 18, 34, 52, 74 and 100%.

| Part | By hour and grouped | Calendar |
|---|---|---|
| Cell | The column's width by 24px (28px from 640px), `radius-xs` | Square, sharing the width: never under 12px, and 28px tall at the most, wider than tall beyond that. 3px radius, as the legend's swatches |
| Column labels | One line, 8px above the cells | 16px tall, 8px above the cells. The first column shown is named too, for the month of its first day, unless the next name is fewer than three columns on. The last column's name ends with its column |
| Weekday names | All seven | All seven where a row is 16px or more; Monday, Wednesday and Friday where it is shorter |
| Legend | 12px swatches, 3px radius, 2px apart | The same |

A calendar shows `floor((width - 40 - 8 + 2) / 14)` of the latest weeks, the width being the figure's own: 52 weeks from 774px, 19 on a 320px figure. While every week fits, the cells share the width.

## States

| State | Spec |
|---|---|
| Rest | Cells and legend; no readout. |
| Pointed | By the pointer or the keys: the cell gains a 2px `ink` ring with a 1px `surface` offset, fading in over `dur-hover`; the readout shows, 6px above the cell's row. On either form it takes its place from the columns before its own and the columns after: centred at the middle of the grid, flush with the grid's edge at the first column and at the last, so it never leaves the grid. Too long for the grid, it breaks between its value and its date; on the hours form a date still too long for a line of its own (a long timezone at 320px) breaks between its words. |
| Focus | The grid wears a 2px `accent` outline, 4px off, on `radius-sm`. On both forms the outline encloses the cells and nothing else: the Tab stop is what the arrow keys move through, and the weekday names and the hour or month labels stand outside it. |
| In progress | Calendar with `running`: the last day wears a 1px dashed `ink` outline with its fill inset 2px inside it, and its readout and its row of the table say "so far". The outline is square and drawn an edge at a time on the pixel grid, 3px on and 2px off from each corner, clockwise, with antialiasing off, so its four edges weigh the same at 12px and at any larger cell. A CSS dashed border is not used: it is one antialiased stroke round the box, and its dashes land on fractions of a pixel. |
| Empty | All zeros: every cell is the empty track and the legend's upper end reads "More" on either scale; say so in the card. With no days the calendar draws no grid, and the card's Empty state is the caller's. |

## Behaviour

- **Pointer**: entering a cell points at it; leaving the figure lets go.
- **Keyboard**: either grid is one Tab stop. On a week of hours the arrow keys move a cell at a time, and Home and End go to the ends of the row. On a calendar the first key, an arrow, Home or End, only places the cursor, on the latest day. From there Up and Down move a day within the week, Left and Right a week, and Home and End go to the first and the last column shown that holds the cursor's weekday. A move with no day to land on leaves the cursor where it is. Escape and blur let go.
- **Meridian**: a calendar with `meridian` points the page's Meridian at the day read when the Meridian holds that date, and clears it when it does not; letting go clears it. Without `meridian`, or outside a Meridian, nothing outside the chart moves.
- **Width**: the form reads the figure's width. Before it is measured a calendar draws every week at 12px or more and clips the earliest, so the grid keeps its height when the width arrives.

## Surfaces

- **Console**: by hour; a calendar of 52 weeks shows every week from 774px.
- **Mobile**: grouped; a calendar shows the latest weeks that fit, 19 on a 320px figure.
- **Embed**: fullscreen only; inline views link to it with Expand.

## Agents

The view that draws it shares its busiest windows in its context (`useShareView`), for example "the busiest of the week Sunday 22:00 UTC, 43.9M requests" on Usage. An agent reads the same numbers a screen reader does, from the table; it never moves the cursor.

## Accessibility

- A labelled `figure` whose `sr-only` table holds every value: a week of hours as weekday by hour, its corner cell naming the timezone ("Day (UTC)"), a calendar as a row a date ("Thu 1 Oct 2026", then the value), for every date given.
- The grid is a `role="group"` named with the figure's label and how to use the keys. The cell pointed at is read in an `aria-live="polite"` line: "Thu 14:00 UTC: 3,912 requests" on a week of hours ("Thu 14:00 Asia/Singapore: …" given that `timezone`), "Thu 1 Oct 2026 · 1,318 requests" on a calendar.
- The ramp is one hue in monotone steps (sequential encoding), never a rainbow, and the legend explains direction in words and names the empty step. The steps are a magnitude, not a boundary: the exact value is in the readout and the table.
- Labels and legend, `ink-3` on `surface`: 6.39:1 dark, 5.13:1 light. The ring and the dashed outline, `ink` on `surface`: 16.89:1 dark, 17.93:1 light; the outline is drawn on the card, not on the fill, so it holds whatever the day's step. The readout, `ink-inverse` on `surface-inverse`: 16.31:1 dark, 17.00:1 light. The focus outline, `accent` on `surface`: 3.71:1 dark, 5.71:1 light.

## Content

- Hours are in the product's reporting zone, and the readout, the announcement and the table say which. That is UTC unless the product passes `timezone`, a label such as `Asia/Singapore` or `UTC+08:00`. A product that cuts its days at local midnight cuts its hours in the same zone and names it, so a local Monday morning stays in Monday's row; converting the hours to UTC to keep the label true moves them into another weekday's row. The zone is a label: the values are drawn as given.
- A calendar date is a day, not an instant: "2026-10-01" reads "Thu 1 Oct 2026" and sits in Thursday's row whatever the product's timezone.
- The legend names what a cell counts: `unit` is a plural noun, "requests", so the empty step reads "No requests".
- A day in progress says "so far"; a complete day says nothing.

## Do and do not

- Do use it for a recurring rhythm (weekday by hour) or for a long run of days where the eye should find the unusual ones.
- Do use `quantile` when one cell is many times the rest, and say in the card what the steps mean.
- Do not use a diverging or categorical palette here.
- Do not use a calendar for a trend: change over time is a Trend chart.

## Implementation

```tsx
import { Heatmap } from '@/components/charts/heatmap';

<Heatmap label="Requests by weekday and hour" values={demoHeatmap()} format={formatCompact} />
// The product cuts its hours in its own zone and names it.
<Heatmap label="Requests by weekday and hour" values={hours} timezone="Asia/Singapore" />
<Heatmap label="Requests a day" days={series.map((d) => ({ date: d.date, value: d.requests }))} running meridian scale="quantile" />
```

| Prop | Form | What it is |
|---|---|---|
| `values` | Hours | Seven rows, Monday first, of twenty-four hourly values, in the timezone named by `timezone` (UTC by default) |
| `timezone` | Hours | The zone the hours are cut in, as the readout, the announcement and the table name it: `UTC` by default |
| `days` | Calendar | `{ date, value }` a calendar date (`2026-10-01`), oldest first |
| `running` | Calendar | The last day is still in progress |
| `meridian` | Calendar | Point the page's Meridian at the day read |
| `scale` | Both | `max` (the default) or `quantile` |
| `format`, `unit` | Both | How a value reads and what it counts: "1,318" and "requests" by default |
| `label` | Both | What the figure shows, for screen readers |

Every cell carries `data-step`, 0 for the empty track and 1 to 5, as drawn; a calendar's cell also carries its date as `data-cell`, and `data-col` and `data-row`. Three props are for the Atlas only, where a state is drawn still: `data-preview-date` draws a day as pointed at, `data-preview-cell` an hour (its row and its hour, "3-23" for Thursday 23:00; where the hours group in threes it is the block that holds the hour, so the cell exists at every width), and `data-preview-state="focus"` the grid's focus outline.
