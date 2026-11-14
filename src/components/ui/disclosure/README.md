# Disclosure

A disclosure is a section a reader opens in place: a summary row with a chevron, and the content under it, shown when it is opened.

Status: beta

## Anatomy

1. **Details**: the native `<details>`, which holds the open state. It takes `className` for its spacing and any rule above it.
2. **Summary**: its first child, a `<summary>` row: `text-sm` 13px at a 20px line in `ink`, the browser's marker hidden, 2px padding above and below, so the row is 24px tall.
3. **Chevron**: a 14px `ChevronRight` in `ink-3`, 6px before the summary text, on its first line. It points right while closed and down while open.
4. **Content**: whatever the disclosure holds, 8px under the summary.

## Variants

One. A disclosure inside a card sits on the card's padding like any other line; a rule above it is the caller's `className` (`border-t border-line pt-3`).

## Sizes

| Part | Size |
|---|---|
| Summary row | 24px tall for a line; a long summary wraps and grows |
| Chevron | 14px, `stroke-width` 2 |
| Gap, chevron to text | 6px |
| Content offset | 8px under the summary |
| Hit area | at least 24px, 44px on a coarse pointer (`.hit`) |

## States

| State | What changes |
|---|---|
| Closed (rest) | The chevron points right; the content is not drawn |
| Open | The chevron turns 90° (`rotate`, `dur-hover` 160ms, `ease-out`); the content is drawn at once |
| Hover | The pointer becomes a hand; nothing else moves |
| Focus | The 2px `accent` ring, 2px off the row, `radius-xs` 5px |

There is no disabled, loading, empty or error state: a disclosure that has nothing to hold is not drawn.

## Behaviour

- Pressing the summary, or Enter or Space while it has focus, opens and closes it. The browser handles all three: the component ships no client code.
- `defaultOpen` supplies the initial open attribute; keep it unchanged while the disclosure is mounted. The browser owns the reader's toggles, which ordinary rerenders with the same prop preserve. Changing the prop changes that attribute; this is not a controlled disclosure API.
- It opens at once. Nothing animates the height, which reduced motion would ask to drop anyway; under reduced motion the chevron turns at once too.
- Find in page opens a closed disclosure that holds the match, where the browser supports it.

## Surfaces

- **Console**: same.
- **Mobile**: same; the hit area grows to 44px on a touch screen.
- **Embed**: same. It needs no script, so it works before the view has hydrated.

## Agents

Not applicable. An agent reads the content whether the disclosure is open or not.

## Accessibility

- The native `<details>` and `<summary>`: a screen reader announces the summary as a button with its expanded state, and the keyboard is the browser's own.
- The chevron is `aria-hidden`; the summary text is the name.
- Contrast (dark, indigo): summary `ink` on `surface` 16.89:1, on `ground` 18.13:1; chevron `ink-3` on `surface` 6.39:1; focus ring `accent` on `surface` 3.71:1, on `ground` 3.98:1.
- Under forced colours the ring is the system's own `Highlight` outline and the chevron takes the text colour.

## Content

- The summary names what opens, as a noun: "Evidence", "How the cost per million tokens is computed". Not "Show more" or "Details".
- Keep it to one line where you can; it wraps when it must and is never cut.

## Do and do not

- Do use it for supporting material a reader opens on purpose: the readings behind a figure, how it is computed.
- Do not hide the figure itself, an error or an action the page needs in one.
- Do not nest one disclosure in another.

## Implementation

```tsx
import { Disclosure } from '@/components/ui/disclosure';

<Disclosure summary="Evidence" className="mt-4 border-t border-line pt-3">
  <p className="text-sm text-ink-2">Six readings between 09:00 and 09:30, each above the 800 ms p95 target.</p>
</Disclosure>
```

| Prop | Type | Default | |
|---|---|---|---|
| `summary` | `ReactNode` | | The summary row's text |
| `defaultOpen` | `boolean` | `false` | Starts it open |
| `children` | `ReactNode` | | The content |
| `className` | `string` | | On the `<details>` |
