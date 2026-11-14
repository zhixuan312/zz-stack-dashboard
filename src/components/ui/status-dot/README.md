# Status dot

A status dot shows a state at a glance as an 8px circle, always beside the word for that state; `live` adds a slow pulse for a state that is current and updating.

Status: beta

## Anatomy

1. **Dot**: an 8px circle (`radius-full`) in the tone's fill colour.
2. **Pulse** (live only): a ring of the same colour that grows to 6px and fades, every 2.4s.

## Variants

| Tone | Colour | Use |
|---|---|---|
| Neutral | `ink-3` | Paused, unknown, never run |
| Accent | `accent` | Syncing, in progress |
| Positive | `positive` | Operational, fresh |
| Warning | `warning` | Degraded, stale |
| Critical | `critical` | Outage, failing |

## Sizes

8px; it never scales with text. Gap to its word: `space-2` 8px (6px inside a Badge, which draws its own 6px dot).

## States

| State | Spec |
|---|---|
| Static | the dot |
| Live | the pulse loops (`m-pulse`, 2.4s, `ease-out`). One of the three loops the system allows. Under reduced motion the dot is still |

## Behaviour

Decorative (`aria-hidden`) beside its word: the word is the information. Where no word stands beside it (a list row, a finding), `label` makes it an image (`role="img"`) named by that word, with the same word as its title for the pointer.

`TONE_WORD` is the one map from a tone to that word — "For information", "In progress", "Went well", "Needs attention", "Failed" — so the same state reads the same wherever a dot stands alone. Metric tile findings, alert rows and the Activity feed's system lines all take their words from it. A control whose own `aria-label` replaces its contents, such as a finding that points at a day, has to carry the tone's word in that name too.

## Surfaces

Same on every surface. Status colours never bridge to the host.

## Agents

Not applicable.

## Accessibility

- Contrast (light) on `surface`: `positive` 3.4:1, `warning` 3.2:1, `critical` 4.3:1, all above the 3:1 graphics minimum in both themes.
- Never the only signal: the word carries the state.

## Content

The word beside it is one or two words: "Operational", "Updated 4 min ago", "Stale · 22 min ago".

## Do and do not

- Do use `live` only for something current: a feed that refreshes on its own (the freshness stamp, a live run), or a state that needs a look now (each service in a Status list that is not operational).
- Do not pulse a steady state: an operational service, a state that is past.
- Do not use a dot without a word, beside it or as its `label`.

## Implementation

```tsx
import { StatusDot } from '@/components/ui/status-dot';

<span className="flex items-center gap-2"><StatusDot tone="positive" live />Updated 4 min ago</span>
```

Props: `tone`, `live`, `label`, `className`.
