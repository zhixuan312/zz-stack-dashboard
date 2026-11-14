# Segmented control

A segmented control switches what a view shows between two to five short options in one track, with a lifted thumb that slides to the current one.

Status: beta

## Anatomy

1. **Track**: `surface-sunk` with an inset `line` hairline, `radius-md`, 2px padding; as wide as its options wherever it stands, a column that would stretch it included.
2. **Thumb**: a `surface` pill with `shadow-control` and a `line` ring, `radius-sm`, under the current option.
3. **Option**: `text-sm` (`text-xs` small), `weight-medium`, 10px side padding; an optional 14px icon before the label. On touch each option is at least 44px wide, so its own box is the target and nothing reaches past the track.

## Sizes

| Size | Height | Label |
|---|---|---|
| sm | `control-sm` 32px (28 compact) | `text-xs` 12px |
| md (default) | `control-md` 38px (32 compact) | `text-sm` 13px |

## States

| State | Visual |
|---|---|
| Rest | label `ink-2` |
| Hover | label `ink` |
| Current | label `ink`, on the thumb |
| Focus (keyboard) | 2px `accent` outline on the option |

The thumb slides and resizes over `dur-enter` with `ease-out`; labels change colour over `dur-hover`. Under reduced motion the thumb jumps.

The thumb is read only inside a `ResizeObserver` callback, which the browser runs after layout, never in the change's commit, an effect or a frame callback, so a tap forces no layout. A selection change or new options observes the options afresh, including a same-length reordering whose boxes do not resize, and that first observation carries the measurement. On first mount the thumb is not drawn until it, one frame later; after it the thumb slides as above.

## Behaviour

- The change is instant: the view updates and nothing asks for confirmation.
- Arrow keys move between options; Space or Enter chooses. One option is always chosen.
- A choice that changes the data (the period) is written to the URL.

## Surfaces

- **Console**: in the masthead (the period) or a card head (a view switch).
- **Mobile**: it never wraps. Only when the labels are wider than the room the track has does the track scroll sideways with the edge fade (`scroll-fade-x`), in a card head with counts in the labels ("All 37 · Idea 3 · Scored 25") as much as anywhere else; shorten labels ("30D") where you can, and prefer five options or fewer.
- **Embed**: the period control in the embed head, `sm`.

## Agents

An agent can open the view with an option already chosen (`?period=90d`). It does not change the option under a person who is looking.

## Accessibility

- Radix ToggleGroup (single): it renders a `radiogroup` named by `label`, one `radio` per option with `aria-checked`; arrow keys move between options, and Space or Enter chooses.
- Labels `ink-2` on `surface-sunk` 6.9:1; the current option `ink` on `surface` 18.1:1.
- An option with only an icon needs a `title` and an accessible name.

## Content

- One or two words, or a short code the domain already uses: "7D", "30D", "Trend", "Table".

## Do and do not

- Do use Segmented to switch a view; use Tabs to switch between sections of a page.
- Do not put more than five options in one track; use a Select.

## Implementation

```tsx
import { Segmented } from '@/components/ui/segmented';

<Segmented label="Reporting period" value={period} onChange={setPeriod} options={[{ value: '7d', label: '7D' }, { value: '30d', label: '30D' }]} />
```

Props: `label`, `value`, `onChange`, `options` (`value`, `label`, `title`), `size`.
