# Agent mark

The agent mark is the sign of an AI assistant: anything an agent did, proposes or is doing carries it, so a reader can always tell a person's change from an agent's.

Status: beta

## Anatomy

1. **Tile**: a square with `radius-sm` corners on `accent-tint`, with a 1px `accent-line` ring.
2. **Glyph**: the sparkles icon in `accent-ink`.

## Variants

One variant. Square, never round: round discs are people (Avatar), so the shape tells an agent from a person before the words do.

## Sizes

| Size | Tile | Glyph | Use |
|---|---|---|---|
| sm | 20px | 12px | Inline in a sentence, a filter chip "Set by Claude" |
| md (default) | 24px | 14px | An activity line, beside an avatar's place |
| lg | 32px | 16px | The head of a Proposal |

## States

Not interactive.

## Behaviour

Decorative (`aria-hidden`); the agent's name always appears beside it in text.

## Surfaces

Same on every surface. On the embed the accent is the product's own, so the mark reads as this product's view of the agent's work, not the host's.

## Agents

This card is how agents are marked. Wherever an agent acted, the mark appears with the agent's name and the person it acted for: "Claude raised the rate limit for Parallax AI · for Jonas Weber". A change an agent wants to make appears as a Proposal, headed by the large mark.

## Accessibility

- The mark is hidden from assistive technology; the agent's name is read.
- Glyph contrast (light, cobalt): `accent-ink` on `accent-tint` 5.7:1.

## Content

Name the agent as the person knows it ("Claude"), and the person it acted for after a middle dot: "· for Jonas Weber".

## Do and do not

- Do mark every agent action, including ones the person approved.
- Do not use the mark for automation that is not an agent (a scheduled job, the product itself); those are system events.
- Do not make it round.

## Implementation

```tsx
import { AgentMark } from '@/components/ui/agent-mark';

<AgentMark size="md" />
```

Props: `size` (`sm` | `md` | `lg`), `className`.
