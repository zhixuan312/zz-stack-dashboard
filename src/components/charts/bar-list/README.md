# Bar list

A bar list ranks a set of items by one measure, each with a bar under its label: "by endpoint", "by customer", "by region".

Status: beta

## Anatomy

1. **Row**: label on the left (`text-sm`, `ink-2`; the highlighted row `ink` at `weight-medium`), an optional meta line, the value on the right (`ink`, tabular, `weight-medium`).
2. **Track**: 6px tall, `fill-track`, `radius-full`.
3. **Bar**: the value against the scale's top (the largest row, `total`, `max` or the axis's last level), `chart-neutral`; the one highlighted row in `accent`, and its row's title adds `highlightLabel`, what makes it the one ("The busiest endpoint"), so the accent is never a colour left to guess.
4. **Others**: past `limit`, the remaining rows fold into "N others", the sum of those above zero, in `ink-3`; a single extra row shows as itself, since "1 others" would hide a name to save no space. It is never a link, whatever the rows it holds.
5. **Linked row**: a row with an `href` names a record that has a page, and its label is the one link to it, named by the label. The bar, the meta line and the figure stay text: they say what the label already opens, so they are never a second way there. At rest the row looks as an unlinked one does.
6. **Compare** (under `pair`): 2px under the value bar, the row's `compare` on the same scale, a 1px `chart-neutral-strong` outline with no fill; none for a missing compare. The figure reads `{value} · {compare}`, the compare in `ink-3`, `—` for one with no data.
7. **Legend** (under `pair`): above the rows, a filled and an outlined swatch named `pair.label` and `pair.compareLabel`, at `text-xs` in `ink-2`.
8. **Axis** (under `axis`): the levels at `text-2xs` in `ink-3` under the rows, and a 1px `chart-grid` gridline through every row at each. No two level words that show stand closer than 4px: from the top inward, a word that would touch the nearest one shown above it, or the first, is hidden (`invisible`, still in the row), and its gridline stays. The first level and the top always show.
9. **Estimate**: an estimated row's bar is hatched (`data-estimate`, the base hatch over its own fill), its title adds "estimate", and the list writes "Hatched: estimate" once. A folded row holding one is one; a compare outline never is.
10. **Lines under the list**, in this order, each at `text-2xs` in `ink-3`: the axis levels, the widening line ("Scale widened to 140 to show Gamma"), the estimate key.

## Variants

| Variant | Use |
|---|---|
| One highlighted | The card is about one row (the busiest endpoint, the customer in question) |
| All neutral | A ranking with no finding to point at |
| With meta | A short fact per row (a plan, an error rate), between label and value |
| Linked | Each row names a record that has a page (a customer): its label opens it |
| In the order given | `order="given"`: the order is the meaning (the hours of a day, the stages of a funnel) |
| Held scale | `max`: every bar against a stated top (a capacity, 100%), so cards of one measure compare row by row |
| With an axis | `axis`: a reader reads lengths against levels, not only against each other |
| Paired | `pair`: each row against its own earlier figure or target |
| With estimates | `estimate` on a row whose figure is projected or partial (the hour still running) |

## Sizes

Rows are 14px apart; label to bar 6px. The list takes its container's width.

## States

| State | Spec |
|---|---|
| Arriving | Bars grow from the left over `dur-grow`, 45ms apart in rank order. |
| Hover | The row's neutral bar steps up to `chart-neutral-strong` over `dur-hover`. |
| Hover (a linked row's label) | The label takes `accent-ink` over `dur-hover`, and the bar steps up as on any row. |
| Focus (a linked row) | The label's link shows the 2px `accent` ring. |
| Empty | Render the card's Empty state. |
| Below zero | A row below zero draws an empty bar (and an empty outline under `pair`), its figure the value it holds and its share of `total` `0.0%`: a Bar list measures from zero, and signed rows are Diverging bars. |

## Behaviour

Rows are not interactive by default. Give a row an `href` when it names a record that has a page, and its label becomes the link to it (`row-link`, with the `hit` target: 24px under a mouse, 44px under a finger). Give every row of a list one or none: a list where some names open and others do not reads as broken.

Rows are sorted by value, largest first. Pass `order="given"` when the order is the meaning (hours, weekdays, the stages of a funnel): the rows keep the order passed.

Bars are drawn against the largest row. Pass `total` when the rows are a share of a stated whole (the top 8 tools out of every call, or rows hidden by `limit`): each bar is then its value over `total`, and hovering a row shows its share ("12.4% of 3.1M").

Pass `max` instead when the scale is held: a capacity, a ceiling, 100%, or the same top across several cards so they compare row by row. Every bar is drawn against it and no share is printed; `max` and `total` are one or the other, in the type. A value (or a drawn compare) past `max` widens the scale to it, and the list writes "Scale widened to {top} to show {row}", naming the first row that stands at the top. A `max` not above zero draws against 1; a `max` under 1, a share held at 50% as 0.5, is held like any other.

Pass `axis` when a reader reads lengths against levels: under `max`, the held levels and the widened top; without it, the nice levels of the largest row, and the bars are drawn against the last of them. The levels row measures its width, at 7px a character, and hides a word that would touch one that shows (a widened 112% beside the held 100%), keeping its gridline; until it is measured every word shows.

Pass `pair` (`{ label, compareLabel }`) and a `compare` on each row to read each row against its own earlier figure or target. Both share one scale.

Mark a row `estimate` when its figure is projected or partial: its bar is hatched and the list writes the key.

Under `order="given"`, `max` or `pair` no row folds: each is read one by one, and a sum of the rest would hide that.

With none of these the root is the `ul`. Once the list draws a legend, levels, a widening line or a key, its root is a `div` taking `className` around the legend, the `ul` (which keeps `aria-label`) and the lines.

Every row is an `li` carrying `data-row` with its key (`__others` for the folded row); its bar carries `data-bar` (and `data-estimate` when estimated), its figure `data-figure`, its compare `data-compare`. The legend carries `data-legend`, a level `data-level`, a gridline `data-gridline`, the widening line `data-widened` and the key `data-estimate-key`.

## Surfaces

- **Console**: up to `limit` rows (default 6); every row under `order="given"`, `max` or `pair`, which fold none.
- **Mobile**: the meta line hides; everything else holds. A linked label answers a 44px target.
- **Embed**: the top five, then Expand.

## Agents

The ranking is shared as structured context by the view (`useShareView`), so an agent can name the top rows without reading bars.

## Accessibility

A labelled list (`aria-label`); each row's label and value are text, so the bar is reinforcement, never the only signal. A compare is text in the figure and the legend names both; an estimate is said in its row's title and the key, never by the hatch alone; a widened scale is said in a sentence. A linked row is one link a row, named by its label, so a keyboard has one Tab stop a row and a screen reader hears each name once. The accent bar holds 3.71:1 dark, 5.71:1 light on `surface`.

## Content

Labels are the items' own names (routes in mono); values use one formatter for the whole list.

## Do and do not

- Do rank the rows by value, the largest first; when the order is the meaning (hours, stages), pass `order="given"` and keep it.
- Do hold the scale with `max` when cards of one measure stand side by side; do not pass it and `total` together.
- Do pass `highlightLabel` beside the highlighted row's key: an accent with nothing to decode it with is not finished.
- Do not colour more than one row; do not colour rows by their value.

## Implementation

```tsx
import { BarList } from '@/components/charts/bar-list';

<BarList label="Requests by endpoint" items={items} highlight="/v1/messages" highlightLabel="The busiest endpoint" limit={5} format={formatCompact} />

// The hours of a day, in their order, against a held scale with its levels.
<BarList label="Requests by hour" order="given" max={5000} axis items={hours} format={formatCompact} />

// This week against last week.
<BarList label="Requests by region" pair={{ label: 'This week', compareLabel: 'Last week' }} items={regions.map((r) => ({ ...r, compare: r.lastWeek }))} />

// Rows that open a record: the label is the link.
<BarList label="Revenue by customer" items={customers.map((c) => ({ key: c.id, label: c.name, value: c.revenue, href: `/customers/${c.id}` }))} format={formatCost} />
```
