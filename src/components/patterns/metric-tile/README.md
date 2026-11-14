# Metric tile

A metric tile shows one number a page exists to show, with its change against the previous period and its shape over the period.

Status: beta

## Anatomy

1. **Head**: a 14px icon, the label (`text-sm` 500, `ink-2`) and an optional info button whose tooltip says what the number counts. A label the tile cuts keeps the whole of itself in its title, in both sizes.
2. **Figure**: `t-figure` (32–42px, 600, −0.03em); the unit and the cents step down to half size in `ink-3`.
3. **Change**: a Delta and "vs previous period" (on a tile too narrow for it the phrase wraps out of sight whole, rather than being cut to "vs previou…"; a screen reader still reads it), or the day the Meridian points at, followed by how it compares with what is usual ("2.7× usual", `ink-3`) when the tile has a `baseline`.
4. **Finding** (optional): one line under the change, `text-xs` `ink-2` beside a status dot: what the period's figures say that the number does not. The dot is the finding's tone: the neutral dot (`ink-3`) for a fact ("The busiest day was 1 Oct, with 128K"), the `warning` dot for one that needs a look ("2.7× usual on 21 and 22 Sept"). The dot names that tone in words (`TONE_WORD`: "For information", "Needs attention"), since it is the only mark carrying it. Computed by code, the same line both agents read. With a `day` it is a button (24px target, 44px on touch) that points the page's Meridian at that day; hover takes `ink` over `dur-hover`.
5. **Sparkline**: the period's shape, edge to edge at the foot, 40px tall.

The compact size has four parts of its own, listed under Sizes.

## Composition

Card, Delta, Status dot, Tooltip, Sparkline. Tiles sit in a `Row split="tiles"`, or stacked in the narrow cell of a `2/3` row beside a Featured metric. Compact tiles sit in a wall: a grid the page lays out, two across and four from 59rem of the wall's own width (826px), the first width at which each of four tiles has the 14rem its change needs beside its name, so eight are two rows on a desk and four on a phone. The wall stands in a card whose head says what the figure is, over which days and what the change is against.

## Data

- `value` is the period's figure; `points` one value a point of the same period, oldest first (days on a page of days), or `null` at a point nothing was measured for, which the Sparkline draws as a gap rather than a fall to zero; `delta` the change as a fraction (0.057 is +5.7%), or `null` when there is no earlier period; `deltaFormat="points"` reads it in percentage points for a figure that is itself a share (a share from 33.0% to 46.4% is `delta={0.134}`, "13.4 pts"). `compare` names what the change is measured against (default "vs previous period"; "vs the half hour before" when the window is not the period). `note` is a short line in that place when no comparison fits, such as who is past due, carrying `data-note`; in a narrow tile it takes a second line before it is cut ("296 active · 14 trials · 10 past due" in a third of a page with the assistant's panel open), and a note that is text keeps the whole of itself in its title when the tile cuts it. On a compact tile it stays on the tile's one line.
- `intent` says which way is good: `up` (requests), `down` (errors, latency), `neutral` (compute cost).
- `value` may be a word for a categorical state ("Likely new", "On track"); it is set at `text-2xl` instead of the figure size and wraps to a second line rather than losing its end ("03 Oct 2026" in a narrow tile), and `format` is not used.
- `format` turns the number into its text: a name (`count`, `compact`, `cost`, `cost-compact`, `duration`, `percent`), which a server page can pass, or a function from a client component; the default split recognises "$298.43" (any currency symbol from `app.currency`), "2.9M", "0.90%" and "294ms".
- `finding` is `{ text, day?, tone }`. The tone is `neutral` or `warning` and has no default: the code that counts a finding knows whether it is a fact or something to look at, and says so.
- A tile reads the page's cursor only when its `points` has one value for each of the Meridian's dates, which is the rule a chart joins the Meridian by. With any other number of points, or with none, it keeps the period's figure and its change while the rest of the page reads the pointed day: a customer's 14 days on a page of 30 are not the page's days, and the day at the same position would be the wrong one.
- A pointed day the tile has no number for (`null` at that point) reads as not measured — `—` and the day named with "No reading for this day" — never as the period's total, which is a different day's answer.
- Under two points there is no shape: the tile draws no Sparkline and is laid out as a tile given none.

- A figure is never cut. Past nine characters of number (`FIGURE_MAX`), `fitFigure` sets it at a glance with its unit kept: "9,876,543,210" reads "9.9B", "$1,234,567.89" reads "$1.2M". The exact amount is in the table behind the figure. The Extreme values specimen holds the largest figures the formatters print.

## Variants

| Variant | Use |
|---|---|
| Default | Every tile |
| Emphasis | The one tile that carries the finding when there is no Featured metric: its figure in `accent-ink`, its sparkline in `accent` |
| No sparkline | A count with no useful shape (active keys) |
| With a finding that is a fact | A figure whose period holds something counted worth one line: a record, a total, N of M. The neutral dot. The line wraps rather than losing its end |
| With a finding that needs a look | A figure whose period holds something unusual; at most one tile in a row, the one the finding is about. The `warning` dot |

## Sizes

| Size | Use |
|---|---|
| Default | A figure the page is about: up to four in a row |
| Compact (`size="compact"`) | A wall of many of the same figure, one a customer, a region or a model: eight where four default tiles would stand |

A compact tile is the same tile, set for a wall. It holds four parts and nothing else:

1. **Name**: the label, `text-sm` 500 in `ink`, on one line; a name the tile cuts keeps the whole of itself in its title.
2. **Change**: the Delta, and nothing after it. The words of `compare` are not drawn: down a wall they would stand once a tile, and on a narrow one they would fit beside one change and not beside the next. The card that holds the wall says what the change is against, once. A screen reader, which meets a tile on its own, hears the words after the change.
3. **Line**: one line of `text-xs`, carrying `data-line`: the figure as the tile formats it (`ink-2`, 500, tabular), then " · " and the `note` in `ink-3` when there is one: "$41.2K · Scale". The figure comes first, so what a narrow tile cuts is the end of the note, and the whole line is in its title.
4. **Sparkline**: edge to edge at the foot, 28px tall, when `points` holds two values or more.

It has no figure at the figure size, no hint, no icon and no finding, whatever it is passed, and it draws no words after its change: a wall says one thing about each of many, and a finding, a definition and what the change is against belong to the card that holds the wall.

| Part | Compact | Default |
|---|---|---|
| Padding | `space-4` 16px at the sides, `space-3` 12px above | `card-pad` (20 to 28px) at the sides and below, 2px less above; a Sparkline runs to the bottom edge |
| Radius, border, shadow | The Card's: `radius-lg`, `line`, `shadow-card` | The same |
| Rows | 2px apart; 8px above the Sparkline | 12px and 8px apart; 12px above the Sparkline |
| Height with a Sparkline | About 92px with the change beside the name, 114px in three rows | About 175px at 1440px |

The tile reads its own width, border to border, not the screen's:

| Its own width | Layout |
|---|---|
| From 14rem (196px) | The name and the change share the first row, the change at the right, so the changes of a wall stand in one column down its right edge. The line has the tile's whole width under them |
| Under 14rem | Three rows: the name with the tile's whole width, the change under it at the left edge, the line. Two to a row on a phone, every tile's change stands at the same place |

Neither layout keeps room for anything that is not drawn: the change takes the width of its figure.

The step is the tile's, not its content's. A container query measures a content box, so the tile is measured by an element with no padding straight inside the Card, and the query takes off the Card's 1px hairline on each side: a tile 196px wide from border to border is at the step, whatever its padding. A wall goes to four across from 59rem of its own width (826px) because four tiles of 14rem and three gaps of 12px are 820px.

## States

| State | What changes |
|---|---|
| Rest | as above |
| Meridian reading | The figure reads the pointed point; the change line names it ("22 Sept 2026"); a hairline marks it on the sparkline. Only when the tile's points are the page's |
| Meridian reading, no number | `—` and "No reading for this day" under the day it names, where a pointed point is `null` |
| Points that are not the page's | The figure and the change stay as at rest, and the Sparkline draws no cursor |
| No earlier period | "No earlier period to compare" in place of the change |
| Loading | The tile has none of its own: the page's loading state draws its shape with Page loading's `TilesSkeleton` (figure bar, two lines) |
| Compact, Meridian pointing | The line keeps the period's figure. The Sparkline follows its own rule and marks the day only when its points are the page's |
| Compact, no earlier period | A dash in place of the Delta; a screen reader hears "No earlier period to compare" after it |
| Compact, no `delta` | No change is drawn |
| Compact, no `points` | No Sparkline; the tile closes 12px under the line |

A tile has no hover, pressed or selected state of its own: only its info button and a finding with a day are controls. A compact tile has no control.

## Behaviour

- The info button shows what the number counts, on hover, on focus and on a press.
- A finding with a `day` points the page's Meridian at that day when pressed, and the person's next pointer takes over. A day the Meridian does not hold is still drawn, and pressing it points at nothing.
- Apart from a finding's day, a tile follows the Meridian and never sets it, and it follows only when its points are the page's.
- A compact tile is read, not pressed: nothing in it answers a pointer or a key.

## Surfaces

- **Console**: four across, or stacked three high beside a Featured metric. A wall of compact tiles is four across.
- **Mobile**: two across from 34rem of row width, one below; a row of three is one across until 48rem. Under 640px a tile with a sparkline sets it beside the figure; a tile without one becomes a single row, the label and its line on the left and the figure on the right at `text-xl`, so four stacked tiles take half a screen, not a whole one. Compact tiles stay two to a row on a phone, each in its three-row layout.
- **Embed**: one to three across in an inline view; the same tile. A wall of compact tiles is two across at 360px.

## Agents

A view's shared context carries each tile's value, its change with what it is measured against, and its `hint` as the figure's definition, so both agents read the words the info button shows (decision 0011). When the Meridian points at a day, the context says that day's figures. A finding's text is written once and is the same line in the context; its tone is how the page draws it and is not sent. A compact tile shows no hint, so the view that draws a wall puts each figure's definition in its context itself.

## Accessibility

- The label is the tile's heading (`h2`, one level under the page title). The figure is text; the sparkline is decorative, so the table behind the page's chart carries the series.
- A finding's dot is decorative and never the only sign: the words say what was found, and the dot's colour only sorts a fact from something to look at.
- A compact tile is heard in the order it is drawn: the name, the change, then the line. After the change a screen reader also hears what it is against (`compare`), in text that is visually hidden, because it may meet the tile without the card's head. Nothing in the tile is a Tab stop.
- Contrast (dark): label `ink-2` 8.0:1; figure `ink` 17:1; unit `ink-3` 6.4:1. Compact: name `ink` 17:1; the line's figure `ink-2` 8.0:1; its note `ink-3` 6.4:1. Dots against `surface`: neutral 6.4:1, warning 9.1:1.

## Content

- Labels name the measure in two words: "Error rate", "Latency p95". The hint says what it counts, in one sentence.
- A finding that is a fact states a count with its number and its date and no adjective: "The busiest day was 1 Oct, with 128K", never "A great month".
- On a compact tile the label is the name of the thing ("Northwind Labs") and the note is one or two words that sort it ("Scale"). The card that holds the wall says, once, what the figure is, over which days, and what the change is against: "What each paid in 30 days, and its plan. The change is its requests this week against last."

## Do and do not

- Do keep at most one emphasis tile per row, and none when the page has a Featured metric.
- Do put the emphasis on the figure the page is about — its finding where it has one, and otherwise the figure a person opens the page for. It is not the first tile on every page, and the accent says the same thing in either place.
- Do give every finding its tone. Do not make a fact a warning to draw the eye: the warning dot means somebody should look.
- Do use the compact size when the same figure is shown for many things. Do not mix compact and default tiles in one row.
- Do say what a wall's change is against in the head of the card that holds it, and still pass `compare` to each tile, for the screen reader.
- Do give `points` one value for each of the Meridian's dates when the tile should read the pointed day, and any other series when it should not.
- Do not colour a figure by a threshold; the delta carries direction, the figure stays ink.

## Implementation

```tsx
import { MetricTile } from '@/components/patterns/metric-tile';

<MetricTile label="Error rate" value={0.009} delta={0.13} intent="down" points={errors} format={(n) => formatPercent(n, 2)} finding={{ text: '2.7× usual on 21 and 22 Sept', day: '2026-09-22', tone: 'warning' }} />
<MetricTile size="compact" label="Northwind Labs" value={41_200} format="cost-compact" delta={0.12} compare="vs last week" note="Scale" points={last14Days} />
```

Props: `label`, `value`, `format`, `split`, `delta`, `deltaFormat`, `compare`, `intent`, `note`, `points`, `baseline`, `finding`, `hint`, `icon`, `emphasis`, `size`, `className`. A compact tile holds a container, so it takes its cell's width and never sizes itself from what it holds: give it a grid cell or a width.
