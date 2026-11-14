# Card

A card is the one container for a group of related content: it sits one step above the canvas on `surface`, outlined by a hairline, and is the unit every row of a page is built from.

Status: beta

## Anatomy

1. **Container**: `surface`, 1px `line` border, `radius-lg` 16px, `shadow-card`.
2. **Top edge**: a 1px `highlight-top` line inset 12px from each side. Transparent on light, where the shadow lifts the card; a faint lit edge on dark, where shadows do not read.
3. **Header** (`CardHeader`, optional): title, an optional description under it, actions on the right.
4. **Body** (`CardBody`): the content; `flush` removes the padding for a list or table that runs edge to edge, and a `Table` as its first child is then clipped by the body with its header row's top border dropped — the card's edge is the table's edge, with no second line under it and no square corner over the card's rounded one. A second table in the same body keeps its top border.
5. **Footer** (`CardFooter`, optional): a quiet band with a hairline above: a link to the full view, a caption.

## Variants

| Variant | Use | Difference |
|---|---|---|
| Default | Any group of content | As above |
| Divided header | The body is a table or a list that runs edge to edge | A `line` hairline under the header; header bottom padding 14px |
| Interactive | The whole card is one link (a customer, a service) | Hover: border `line-strong`, `shadow-raise` |
| Wrapped header | A title that must be read whole: an objective, a record's name, the point of the card | `wrap`: the title wraps to as many lines as it needs, and carries no `title` attribute |

## Sizes

| Part | Spec |
|---|---|
| Padding | `card-pad` 24px (16px compact), on all sides of the body |
| Header | top `card-pad` minus 4px; title `t-card` 16px/600; description `t-caption` 12px `ink-3`, 4px under the title |
| Body | 12px under the header |
| Footer | 12px vertical, `card-pad` horizontal, `text-sm` 13px `ink-2` |
| Radius | `radius-lg` 16px; anything nested inside steps down to `radius-md` 10px |

A card never sets its own outer margin: the row's gap places it. Cards in one row are the same height (the grid stretches them); a card is its content's height otherwise.

## States

| State | Spec |
|---|---|
| Rest | as above |
| Title cut | a header without `wrap` keeps its title to one line and cuts it with an ellipsis where it has no room; a title that is plain text carries its whole text as the heading's `title` |
| Hover (interactive only) | border `line-strong`, shadow `shadow-raise`, over `dur-enter` |
| Focus (interactive only) | the 2px `accent` focus ring of the link that wraps the card |
| Loading | the same card holding Skeletons in the shape of its content |
| Empty | the card keeps its header; the body holds an Empty state |
| Error | the card keeps its header; the body holds a Banner (critical) with Retry |

## Behaviour

A card is not interactive unless it is one link; then the whole card is the target and nothing inside it is a second control. `interactive` only draws the hover: the caller wraps the card in its link (`<Link href="/customers/northwind" className="block rounded-lg"><Card interactive>…</Card></Link>`).

A header's title is one line unless the header takes `wrap`. Where a narrow column or the actions beside it leave it no room, it is cut with an ellipsis, and a title that is plain text carries its whole text as the heading's `title`, so a pointer reads it and the audit finds the cut held. A title built of elements gets no `title`: keep it short enough not to be cut, or pass `wrap`. Pass `wrap` whenever the title must be read whole, on a phone as much as at 1440px: a title the reader has to hover for is a label, not the point of the card.

## Surfaces

- **Console**: as specified.
- **Mobile**: same; rows stack, so cards run full width.
- **Embed**: the card takes the host's `--color-background-primary` and `--color-border-primary` through the bridge, so it sits in the host as one of its own; `radius-lg` follows `--border-radius-lg`.

## Agents

A card is the unit an agent is asked about: on the embed surface a card's header may carry an Ask action (AskAbout), which posts a question about exactly what the card shows.

## Accessibility

- A card with a title is a region of its page: the title is an `h2` (`t-card`) so headings outline the page.
- A cut title's whole text is its `title`, for a pointer. A screen reader reads the heading's own text, which is whole however it is drawn.
- Contrast (light, cobalt): title `ink` on `surface` 18.1:1; description `ink-3` on `surface` 5.3:1.
- The border and the highlight are decorative; the title and spacing carry the grouping.

## Content

- Title: a noun phrase, sentence case, no full stop: "Busiest endpoints", "Monthly quota".
- Description: what the numbers count or over what time: "Requests in the period", "p95, last 24 hours".

## Do and do not

- Do group by space first; reach for a card only for a real object with an edge.
- Do not nest a card inside a card; use a Divided header or a sunken well (`surface-sunk`) instead.
- Do not give a card a coloured background to make it stand out; use the one emphasis a row allows (a Metric tile's `emphasis`).

## Implementation

The look is one class, `.card`, in `src/styles/base.css` (border, `surface`, `radius-lg`, `shadow-card`, the lit top edge, and the clip a flush first child needs), so a card costs a short class in the HTML and the page payload instead of a dozen utilities. The Data table's own wrapper uses it too. A utility on the card still overrides it.

```tsx
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';

<Card>
  <CardHeader title="Busiest endpoints" description="Requests in the period" divided />
  <CardBody flush>{list}</CardBody>
  <CardFooter><Link href="/usage">All endpoints</Link></CardFooter>
</Card>
```

`Card`: `interactive` and div attributes. `CardHeader`: `title`, `description`, `actions`, `divided`, `wrap` (let the title wrap to as many lines as it needs, for a title that is the point of the card rather than a label in a list; without it a title that is plain text is also the heading's `title`). `CardBody`: `flush` (no padding, and a first-child `Table` is clipped with its top border dropped). `CardFooter`: div attributes.
