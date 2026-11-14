# Switch

A switch is a setting that takes effect the moment it is flipped; if the change waits for a Save button, it is a Checkbox instead.

Status: beta

## Anatomy

1. **Track**: a pill, 38 by 22px (32 by 18px small), `line-control` at 70% when off, `accent` when on.
2. **Thumb**: an 18px (14px) `on-accent` circle (white; near-black only on the graphite accent in dark, where the track is near-white) with `shadow-control` and a `line` ring.
3. **Label** (optional): `text-sm` `ink`, left; the switch sits at the right end of the row.
4. **Description** (optional): `text-xs` `ink-3` under the label. It describes the control (`aria-describedby`); the label alone names it.

## Sizes

| Size | Track | Thumb | Travel |
|---|---|---|---|
| sm | 32 × 18px | 14px | 14px |
| md (default) | 38 × 22px | 18px | 16px |

## States

| State | Visual |
|---|---|
| Off | track `line-control` at 70% |
| Off, hover | track `line-control` |
| On | track `accent`; hover `accent-hover` |
| Focus (keyboard) | 2px `accent` outline, 2px offset |
| Disabled | track `fill-track` with an `ink-disabled` thumb (on: an `ink-disabled` track, the thumb flat), the label `ink-disabled` as on a Checkbox, the description still `ink-3` so the reason reads; `not-allowed` cursor |

The thumb slides over `dur-enter` with `ease-spring`, the one place the switch feels physical; the track colour changes over `dur-hover`. Under reduced motion the thumb jumps.

## Behaviour

- Space or a click toggles, and the setting applies at once; show a toast when the effect is not visible on screen ("Incident emails on").
- If applying fails, the switch returns to its previous position and an error toast says why.

## Surfaces

- **Console**: rows in a settings card: label left, switch right.
- **Mobile**: the whole row is the target.
- **Embed**: not offered; settings change in the console.

## Agents

An agent never flips a switch. It proposes the setting; the person approves; the activity feed records the change "via" the agent.

## Accessibility

- Radix Switch: `role="switch"` with `aria-checked`; named by its label.
- The off track holds 3:1 against `surface` through `line-control`; the thumb position, not only colour, shows the state.

## Content

- The label names the thing that is on: "Incident emails", "Weekly usage digest". Never "Enable" or "Turn on".

## Do and do not

- Do group switches in a card with hairlines between rows.
- Do not use a switch inside a form that has a Save button.

## Implementation

```tsx
import { Switch } from '@/components/ui/switch';

<Switch label="Incident emails" description="When a service you own degrades." checked={on} onCheckedChange={setOn} />
```

Props: `label`, `description`, `size` (`sm` | `md`), `checked`, `onCheckedChange`, `disabled`, and the Radix Switch root props.
