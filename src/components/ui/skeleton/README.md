# Skeleton

A skeleton holds the place of content that is loading, in the shape of what is coming, so the page does not jump when the data lands.

Status: beta

## Anatomy

1. **Block**: a rounded shape (`radius-xs` 5px by default) painted with the shimmer: `fill-track` with a band of `fill-active` sweeping left every 1.6s.

## Variants

| Shape | Size | Use |
|---|---|---|
| Line | the text's line height (12px for 14px text), the width of a typical value | A title, a cell, a caption |
| Figure | 40px tall, `radius-sm` | A Metric tile's number |
| Disc | `radius-full` at the avatar's size | An avatar |
| Block | the chart's own height | A chart or a sparkline |

## Sizes

A skeleton takes the size of what it stands in for; it has no size of its own. Lines vary in width so a column does not read as a solid bar.

## States

| State | Spec |
|---|---|
| Loading | the shimmer loops (one of the three loops the system allows) |
| Reduced motion | still `fill-track`, no shimmer |

## Behaviour

- A page's loading state is built from the same Rows, Cards and spacing as the page, holding skeletons: nothing moves when the data arrives.
- One vocabulary per place: content that occupies layout shows a skeleton; a discrete action shows a Spinner. Never both in one place.

## Surfaces

Same on every surface. An embed that is waiting for its tool result shows the skeleton of its inline view, at its final height, so the host does not resize twice.

## Agents

While an agent's tool call is running, the view it will fill shows its skeleton; the host shows the call itself.

## Accessibility

- Skeletons are hidden (`aria-hidden`); the region that is loading carries `aria-busy="true"`.
- No text, so no contrast requirement; the shimmer is subtle enough not to flash (well under three flashes a second).

## Content

None.

## Do and do not

- Do mirror the real layout: the same number of tiles, the same header.
- Do not show a skeleton for less than 300ms of waiting; render nothing until then.
- Do not combine a skeleton and a spinner.

## Implementation

```tsx
import { Skeleton } from '@/components/ui/skeleton';

<Card className="p-(--card-pad)" aria-busy>
  <Skeleton className="w-24" />
  <Skeleton className="mt-4 h-10 w-32 rounded-sm" />
</Card>
```

Props: `className` (sets the size and shape).
