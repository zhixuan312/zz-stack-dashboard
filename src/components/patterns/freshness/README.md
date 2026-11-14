# Freshness

Freshness says when the data on a page last arrived ("Updated 4 min ago"), and says Stale when that is later than the data promised.

Status: beta

## Anatomy

1. **Dot**: an 8px Status dot, `positive` and breathing while fresh, `warning` and still when stale, `ink-3` when never updated.
2. **Stamp**: `text-xs`, "Updated 4 min ago", "Stale · 42 min ago" or "Never updated"; the exact time is in the title.

## Composition

Status dot and the relative-time formatter. It sits in a masthead's meta slot, beside the actions, or in an Embed frame's head.

## Data

- `updatedAt` is when the data arrived: the newest ingest time from the store. Never `now()`: a clock read at render time cannot expose a pipeline that stopped.
- `staleAfterMs` is the data's contract (15 minutes by default). A daily rollup passes a day.
- `now` is required: the data's clock, never the browser's, so the server and the browser print the same words.

## States

| State | Dot | Text |
|---|---|---|
| Fresh | `positive`, pulsing (2.4s loop) | `ink-3` |
| Stale | `warning`, still | `warning-ink`, "Stale · …" |
| Never | `ink-3` | `ink-3`, "Never updated" |
| Run (`run`) | `ink-3`, still | `ink-3`, "Run 12 Mar 2026": a batch result is dated, never stale on its own |

The pulse is one of the system's three loops; it stops under reduced motion.

## Surfaces

- **Console**: in the masthead, before the actions.
- **Mobile**: the masthead wraps; it leads the actions row.
- **Embed**: in the Embed frame's head; on a narrow host it shares a line with Expand and Open.

## Agents

An embed view includes the freshness in the context it shares with the model, so an answer about "today" says how fresh "today" is.

## Accessibility

- Contrast (dark): `ink-3` on the ground 6.9:1; `warning-ink` 12:1. The words, not the dot's colour, say stale.

## Content

- "Updated 4 min ago", "Updated 5 h ago", "Stale · 42 min ago". Never "Last sync" or "Refreshed".

## Do and do not

- Do show it on every page whose data has a cadence.
- Do not show it where the data is the person's own edits; there is nothing to go stale.

## Implementation

```tsx
import { Freshness } from '@/components/patterns/freshness';

<Freshness updatedAt={lastIngest} now={dataClock} staleAfterMs={15 * 60_000} />
```
