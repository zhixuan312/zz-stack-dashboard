# Spinner

A spinner says a discrete action is in progress: a ring in the current text colour that turns once every 0.8s.

Status: beta

## Anatomy

1. **Ring**: a circle with a `currentColor` border whose right quarter is transparent, at 80% opacity, turning with `.spin`.
2. **Name**: a visually hidden label ("Loading" by default) on the `role="status"` wrapper.

## Variants

One variant; it takes the colour of its context (`ink-2` in a caption, `accent-ink` beside an accent label, `on-accent` inside a primary Button).

`label={null}` makes it **decorative**: the ring is drawn and nothing is announced, for a spinner inside a control that already says it is busy — `Button`'s `busy` passes it, because `aria-busy` on the button is the announcement and a second one is noise.

## Sizes

The three steps are the icon scale's (14, 16 and 18px), so a spinner stands in for an icon at the same box and nothing moves.

| Size | Ring | Border | Use |
|---|---|---|---|
| sm | 14px | 1.5px | Inside a small control or a caption line |
| md (default) | 16px | 2px | Beside body text |
| lg | 18px | 2px | Centred in an empty panel that waits on one action |

## States

| State | Spec |
|---|---|
| Spinning | one turn per 0.8s, linear |
| Reduced motion | the ring holds still; the label beside it carries the meaning |

## Behaviour

- For an action that takes more than 300ms: a key rotating, an export preparing. A Button shows it through `busy`.
- Content that is loading gets a Skeleton instead. Never both in one place.

## Surfaces

Same on every surface.

## Agents

An agent's running tool call is shown by the host; inside a view, the action that the call drives shows a spinner on its own control.

## Accessibility

- `role="status"` with an accessible name; pass a specific one ("Rotating key").
- Decorative ring: no contrast requirement beyond its text label.

## Content

Pair it with a present-participle label: "Rotating key…", "Syncing".

## Do and do not

- Do keep the control's width steady while it spins.
- Do not spin for a page or a card that is loading; use Skeleton.

## Implementation

```tsx
import { Spinner } from '@/components/ui/spinner';

<span className="flex items-center gap-2 text-sm text-ink-2"><Spinner size="sm" label="Rotating key" />Rotating key…</span>
```

Props: `size` (`sm` | `md` | `lg`), `label`, `className`.
