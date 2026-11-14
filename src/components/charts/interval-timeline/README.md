# Interval timeline

An interval timeline draws what ran and when, on one time axis: each row a series of runs from a start to an end.

Status: draft

## Anatomy

1. **Row**: the label in a column on the left (`text-sm`, `ink-2`), the plot on the right. The label takes a quarter of the width and the plot three quarters, 12px apart.
2. **Baseline**: one 1px line in `chart-grid` through every row at the middle of the plot, so a row with no runs reads as an empty stretch of time.
3. **Run**: a 8px bar from its `from` to its `to`, rounded, in the tone's fill: `chart-neutral-strong` for a completed run, `warning` for one that needs attention, `critical` for one that failed. A run still in progress reaches the now line and is drawn at 70% strength.
4. **Marker**: a run narrower than 3px at the drawn width is a 12px dot at its start rather than a widened bar, so lengths stay proportional.
5. **Now line**: a 1px `accent` line at the moment passed as `now`, through every row and the axis, with a key under the chart: "Now · 09:47".
6. **Axis**: the window's levels under the plot at `text-2xs` (11px) in `ink-3`, three of them under 640px and every level above. Its labels come from `tick` ("09:00"), a date by default.
7. **Readout**: on pointing at a run or stepping to it with the keys, a panel naming the row, the run and its tone, times and length.

## Variants

| Variant | Use |
|---|---|
| In progress (`now`) | A window that includes the present: the runs still open reach the now line |
| Closed (no `now`) | A window that is over; the axis names its own end |
| Toned runs | A failure or a run that needs a look, told apart by word as well as tone |
| Marker | A run too short to draw at the width, kept as a point |
| Empty row | A row with no runs in the window, drawn as the stretch of time it was |

## Sizes

Rows are 24px tall and 8px apart; the run is 8px inside its row and the marker 12px; the axis row is 16px under the last row. The chart takes its container's width.

## States

| State | Spec |
|---|---|
| Rest | Every run at its length, in its tone |
| Pointed | The pointer or the keys select a run; the readout names it and its row |
| Focus | The plot of a row is one Tab stop with the 2px `accent` ring |
| In progress | A run whose `to` is `null` reaches the now line at 70% strength |
| Failed or needs attention | The tone's fill, and the word on the run's own name and in the readout |
| Empty row | The baseline alone |
| Window that is not a range | Nothing is drawn: a `start` at or after `end` is not a window |
| Empty | Render the card's Empty state |

## Behaviour

The plot of each row is one Tab stop. Left and Right step through every run in the window, in the order they start, Home and End go to the first and the last, and Escape or blur lets go. The pointer selects the run under it and lets go on leaving.

A run whose `to` is `null` reaches the now line when there is one and, without one, is not drawn: a run open in a window that has closed has no end to draw.

## Surfaces

- **Console**: every row; the axis every level.
- **Mobile**: three ticks under 640px; the label column narrows and cuts a long label. A run's words are on pointing, as everywhere.
- **Embed**: the same as mobile inline; the console's in fullscreen.

## Agents

A view that draws one shares the runs it draws through its own context; an agent reads each run's start, end, tone and label there, never from the drawing. A run still open is stated as open, so an agent never reports it as finished.

## Accessibility

- A labelled `ul`, one item per row, each row's plot a `role="group"` named with the row and how to use the keys.
- Every run carries its words in an `sr-only` span inside it — "Integration 4822, Failed: 09:24–09:26, 2 min" — and the same words are the run's title.
- A tone is never colour alone: the words name it, and the readout repeats them.
- Contrast: the neutral run in `chart-neutral-strong` holds 3:1 on `surface`; `warning` and `critical` hold what `pnpm contrast` measures for every theme and accent, and the words beside them carry the state where a fill does not.

## Content

- A row's label is the kind of work: "Build", "Integration", "Canary". A run's label names that particular run: "Build 4821".
- Times read as the axis does, through `tick`: "09:24", or a date where the window is days.
- A length is in seconds under a minute, minutes under an hour, hours beyond: "2 s", "40 min", "1 h 5 min".

## Do and do not

- Do give a window that includes the present a `now`, so a run still under way reads as open.
- Do use a tone only for a run that needs somebody: a failed run, one that left its allowance.
- Do not give every step a tone: a completed run is neutral, and the axis already says when it ran.
- Do not widen a short run to make it visible; a marker keeps the length honest.

## Implementation

```tsx
import { IntervalTimeline } from '@/components/charts/interval-timeline';

<IntervalTimeline
  label="What ran, 09:00 to 10:00"
  start="2026-10-01T09:00:00Z"
  end="2026-10-01T10:00:00Z"
  now="2026-10-01T09:47:00Z"
  tick={(iso) => iso.slice(11, 16)}
  rows={jobs.map((j) => ({ key: j.id, label: j.kind, runs: j.runs.map((r) => ({ from: r.startedAt, to: r.finishedAt, tone: r.tone, label: r.name })) }))}
/>
```

Exports: `IntervalTimeline`, `TimelineRow`, `TimelineRun`.
