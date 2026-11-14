# Featured metric

The featured metric is a page's protagonist: the one number a dashboard leads with, at hero size, in the one card that carries the accent's light, with its chart inside it. Two measures of equal standing share the one card as its two halves.

Status: beta

## Anatomy

1. **Kicker**: `t-kicker` in `accent-ink`: the measure and the period ("Requests · last 30 days").
2. **Actions** (optional): Ask about, a menu or a small filter. Not a "Live" badge, nor any other badge: Freshness in the masthead already says how fresh the data is. They are the card's, drawn once at its head whatever the number of figures.
3. **Hero figure**: `t-hero` (52–80px, 600, −0.035em), its unit stepped down — and the cents of a money figure, the same rule the Metric tile's figure follows (`splitFigure` in `src/lib/format.ts`).
4. **Change pill** (when `delta` is given): a 28px glass pill holding the Delta and what the change is against, in the caller's words: "vs previous period" unless `compare` says otherwise ("vs the week before"). A `delta` of `null` draws the pill with a dash: there is nothing to compare with.
5. **Point pill**: while the Meridian reads a point, an inverse pill takes the change pill's place and names the point: the date, or what `pointLabel` makes of it ("Week of 14 Sept"). A figure with `points` and no `delta` keeps the pill's row empty at rest, so the pill arrives without moving anything.
6. **Caption** (optional): one sentence that makes the period's number concrete. It is about the period the kicker names, not about whichever point is being read.
7. **Finding** (optional): one quiet line under the change and the caption: a neutral 8px dot and one fact the figure does not say ("21 of the last 30 days were above the average day of the 30 before"). The dot is neutral because a finding here is a fact, not a warning.
8. **Chart**: a Trend chart at `fill` height, or a Column chart at `fill` height when the points are periods and not days. A Column chart is given an axis formatter (`axisFormat`, from `AXIS_FORMATTERS`), so its ticks read as a scale ("$75") while the figure above a column keeps its cents.
9. **Foot** (optional): a band inside the lit surface, under the chart and divided from it by a hairline, as a Card's footer is. It holds a few supporting figures, a label over each, and one link.

## Variants

| Variant | Prop | Use |
|---|---|---|
| One figure (default) | none | The number the page is about |
| Two figures | `peer` | Two measures of equal standing that are never added together. The card is still one lit surface: one edge, one glow, and a hairline between two halves. Each half has its own kicker, figure, change, caption, finding and chart; the actions and the foot are the card's |

### When two measures are peers

A page still has one featured card, and `node scripts/check.ts` fails a second. So when a page leads with two measures, decide which case it is:

- **They are peers**: neither is a part of the other, they are not added together, and the page is about both (what the agents produced this week and what a person decided; requests answered and what they cost). Pass the second as `peer`. One card, two halves, the first figure first.
- **One of them leads**: the other is context for it. The leading one is the featured figure and the other is a Metric tile beside it, or a supporting figure in the foot.

Never two featured cards side by side, and never more than two figures in one: a third measure of equal standing means the page has no protagonist, and it leads with a row of Metric tiles instead.

## Sizes

| Part | Spec |
|---|---|
| Card | `surface`, `radius-xl` 24px, a 1px `line` hairline, `card-pad` (20 to 28px) inside |
| Kicker | `t-kicker`: `text-xs` 12px, 500, as written, in `accent-ink` |
| Hero figure | `text-hero` (52 to 80px). In a half, `text-page` (36 to 56px) while the card is 42rem to under 64rem wide (588 to 895px), and `text-hero` from 64rem, so nine characters of number fit half a card as they fit a whole one |
| Pill | At least 28px tall, fully rounded, `text-xs` 12px, 12px of padding at each end. It grows a line rather than cutting its words |
| Caption | `text-sm` 13px in `ink-2`, 12px under the figure |
| Finding | `text-sm` 13px in `ink-2`, 8px under what is above it; the dot is 8px in `ink-3`, 8px before the text, on the first line's baseline |
| Chart | 16px under what is above it and 8px into the card's padding at each side; never under 220px tall |
| Foot | A 1px `line` hairline above; `card-pad` at the sides and 16px above and below. A label is `text-xs` 12px, 500, in `ink-2`; its figure is `text-md` 16px medium in `ink`, tabular; 32px between figures |
| Between two halves | A 1px `line` hairline, edge to edge of the card |

## Composition

A section on `surface` with `radius-xl` 24px and a `line` hairline, the `glow-feature` wash (an accent pool at the top right fading down), a lit edge (`edge-lit`: the hairline brightest at the top right, where the light comes from) and a faint `shadow-halo`. It is the one card on the page that carries the light; it never loops or pulses. It takes the wide cell of a `2/3` row; Metric tiles stack in the narrow cell. With two figures it takes a row of its own.

The section is a container, so its layout answers to its own width and never to the window's. It takes the width its cell gives it: give it a width (`w-full`) when it stands outside a `Row`, because a container does not size itself from what it holds.

With `peer`, the two halves sit in one grid:

- **From 42rem of the card's width** (the `@2xl` step: 588px, because one rem is the root's 14px) they are two columns with a vertical hairline between them, and they share one set of rows: kicker, figure, change, caption, finding, chart. So the two figures stand on one baseline and the two pills on another, whatever one half's kicker or caption runs to, and each chart fills what its half has left. Here the pill sits under its figure, not beside it, so one half's pill can never wrap while the other's does not.
- **Under 42rem** they are one column: the first figure, a horizontal hairline, the second. Each half is drawn as the one-figure card is, its pill beside its figure when there is room.

A container query and a subgrid decide this, not a measurement in script, so the server draws the layout the browser keeps and the page's largest element never moves after it arrives.

## Data

As Metric tile: `value`, `points`, `delta`, `intent`, `format`, and `compare` for the words after the change. The caption is computed from the same data ("The last 30 days averaged 99K a day. The busiest day was 1 Oct, with 128K."), never typed in, and so is the finding.

- `value` is `null` when the period has no number: nothing was recorded, or the read was unavailable. The figure's line then holds `missing`, the words the caller gives ("No words recorded", "Unavailable"; "Not recorded" by default), a size down and in `ink-2`, at the figure's own height, so a period with no number draws the same card as one with a number. Never pass `0` for a number nobody measured.
- `points` holds one value for each point of the page's Meridian, oldest first, `null` where that point has no number: a pointed point with none reads `missing`. They are days on a page of days and weeks on a page of weeks; the card does not care which.
- A figure reads the page's cursor only when its `points` has one value for each of the Meridian's dates, which is the rule a chart joins the Meridian by. With any other number of points, or with none, it keeps the period's value and its change while the rest of the page reads the pointed day.
- `pointLabel` names a pointed point from its date. Leave it out when a point is a day. Give it when a point is a week, a month or a release, so the pill says "Week of 14 Sept" and not a bare date.
- With `peer`, each half reads its own `points`, and `pointLabel` names the point for both.
- A figure is never cut. Past nine characters of number (`FIGURE_MAX`), `fitFigure` sets it at a glance with its unit kept: "9,876,543,210" reads "9.9B", "$1,234,567.89" reads "$1.2M". The exact amount is in the table behind the figure. The two Extreme states hold the largest figures the formatters print.

## States

| State | What changes |
|---|---|
| Rest | as above |
| Meridian reading | The figure reads the pointed point; the pill turns inverse and names it. The caption and the finding stay, unmoved: they are about the period the kicker names, so each must say so in its own words (see Content) |
| Points that are not the page's | The figure keeps the period and its change while the page reads a day |
| Nothing to compare (`delta` of `null`) | The pill holds a dash before the comparison's words |
| Points and no change | The pill's row is drawn at rest too, a line of its own under the figure holding the point pill's empty place, so pointing at the chart changes what the figure says and never where anything below it stands, however long the point's name |
| No number (`value` of `null`) | The figure's line holds `missing`, a size down, at the figure's height; a pointed point that is `null` reads the same way |
| Without a chart | Kicker, figure, pill, caption and finding only. A half with no chart is left without one |
| Without a foot, a finding or actions | Nothing is drawn in their place |
| Two figures, wide | Two halves side by side on shared rows, from 42rem of the card's width (588px) |
| Two figures, narrow | One column, a hairline between the halves |
| Loading | The card has none of its own: the page's loading state draws its shape, a Skeleton of the figure and the chart area (Home's `loading.tsx`) |

The card has no hover, pressed or focus state of its own: its chart, its actions and the foot's link bring theirs.

## Behaviour

- Pointing at the chart, or moving through it with the arrow keys, points the page's Meridian; the figure follows it and lets go when the chart does.
- Nothing in the card measures itself in script. The two layouts of the two-figure form are CSS, so there is no first frame in the other layout.

## Surfaces

- **Console**: the wide cell of the first row; with two figures, the whole first row.
- **Mobile**: full width; the chart keeps at least 220px. Two figures are one column, the first figure first, and the foot's link wraps under its figures.
- **Embed**: fullscreen views use it as on the console; an inline view leads with it too, its tiles under it, as Home's view draws it.

## Agents

The featured number is one of the facts an embed view shares with the model. A finding is computed by code from the page's data, and the page's context carries the same sentence, written once, so a person and an agent read one fact and not two versions of it. A page with two figures shares both in its context, each with its own unit and change, and never their sum.

## Accessibility

- The kicker names the number; the figure is text; the chart carries its own table for screen readers. The reading order is the visual order: kicker, actions, figure, change, caption, finding, chart, then the foot; with two figures, the whole of the first half and then the whole of the second.
- The finding's dot is decoration (`aria-hidden`); its text is the finding. The Delta says "up" or "down" to a screen reader, so the change never rests on colour or on an arrow.
- The foot's supporting figures are a description list (`dl`): each label is the `dt` of its figure, so a screen reader reads "Error rate, 0.90%".
- Contrast (dark, indigo, from `node scripts/contrast.ts --all`): the figure and the foot's figures, `ink` on `surface`, 16.89:1; the kicker, `accent-ink` on `surface`, 9.50:1; the caption, the finding and the foot's labels, `ink-2` on `surface`, 7.96:1, and 6.87:1 on an accent wash, which is why none of them is `ink-3`; the point pill, `ink-inverse` on `surface-inverse`, 16.31:1.

## Content

- One number a figure. The caption is a sentence a person would say out loud.
- The caption and the finding stay while a point is read, so each is true on its own, under any point's figure. Name the period or the day a sentence is about: "Last week averaged 103K a day", "The busiest day was 1 Oct, with 128K". Not "About 103K a day" alone under a figure by week: while another week is read it sits under that week's 644K and says something false of it.
- A finding is one fact, counted, with no praise in it: "The highest 30 days yet", "21 of the last 30 days were above the average day of the 30 before". Never "A great month". When its rule stops holding it leaves the card, with nothing weaker in its place.
- `compare` starts with "vs" and names the period before in plain words: "vs previous period", "vs the week before", "vs the same week last year".
- A foot's label is two or three words and its figure carries its unit. The foot has one link, and its text says where it goes: "All endpoints", "How revenue is counted".

## Do and do not

- Do use one per page, for the number the page is about, or the two numbers when they are peers.
- Do give both halves the same kind of chart over the same points, so the two read as one statement.
- Do not put two featured cards in a row, or a featured card on a list page; there the table is the protagonist.
- Do not add the two figures together, in the card or in its foot.
- Do not put a second link, a button or a paragraph in the foot; a control belongs in the actions and a sentence in the caption.

## Implementation

```tsx
import { FeaturedMetric } from '@/components/patterns/featured-metric';

<FeaturedMetric
  kicker="Requests · last 30 days"
  value={total}
  points={daily}
  format={formatCompact}
  delta={0.057}
  finding={{ text: '21 of the last 30 days were above the average day of the 30 before' }}
  foot={
    <>
      <dl>
        <div><dt>Error rate</dt><dd>0.90%</dd></div>
        <div><dt>Latency p95</dt><dd>294ms</dd></div>
      </dl>
      <Link href="/usage">All endpoints</Link>
    </>
  }
>
  <TrendChart height="fill" label="Requests per day" dates={dates} series={[{ key: 'r', label: 'Requests', values: daily, kind: 'area' }]} />
</FeaturedMetric>
```

Two figures, a week a point. `FeaturedFigure` is the type of one figure, and `peer` takes one whole, its chart as `children`:

```tsx
import { FeaturedMetric, type FeaturedFigure } from '@/components/patterns/featured-metric';

const decided: FeaturedFigure = {
  kicker: 'You decided · last week',
  value: 41,
  points: decidedByWeek,
  format: String,
  delta: -0.05,
  intent: 'neutral',
  compare: 'vs the week before',
  children: <ColumnChart height="fill" label="Decisions per week" dates={weeks} axisFormat={AXIS_FORMATTERS.count} columns={decidedColumns} />,
};

<Meridian dates={weeks}>
  <FeaturedMetric
    kicker="Agents produced · last week"
    value={1280}
    points={producedByWeek}
    format={formatCompact}
    delta={0.16}
    compare="vs the week before"
    pointLabel={(date) => `Week of ${formatDay(date)}`}
    peer={decided}
  >
    <ColumnChart height="fill" label="Work produced per week" dates={weeks} axisFormat={AXIS_FORMATTERS.count} columns={producedColumns} />
  </FeaturedMetric>
</Meridian>
```

The foot sets its own contents: a `dl` in it is drawn as the supporting figures, each `dt` a label over its `dd`, and what follows the list goes to the far end of the band. `FeaturedMetricProps` is exported for a product that wraps the card.
