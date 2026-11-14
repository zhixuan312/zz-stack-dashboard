# Banner

A banner is a message about the page or the card it sits in that stays until it is resolved or dismissed: an incident in progress, a key about to expire, a limit reached.

Status: beta

## Anatomy

1. **Container**: a tinted ground and a 1px border of the tone, `radius-lg` 16px, padding 14px 16px.
2. **Icon**: 16px, the tone's ink.
3. **Title**: `text-sm` medium, the tone's ink: what is happening.
4. **Body** (optional): `t-small`, `ink-2`: what it means and what to do.
5. **Action** (optional): one small button.
6. **Dismiss** (optional): a 24px ghost close.

## Variants

| Tone | Ground | Border | Icon and title | Use |
|---|---|---|---|---|
| Neutral | `surface-sunk` | `line` | `ink-3` / `ink` | A fact to know: reporting is in UTC |
| Accent | `accent-tint` | `accent-line` | `accent-ink` | Something new the product offers |
| Positive | `positive-tint` | `positive` at 25% | `positive-ink` | Resolved, restored |
| Warning | `warning-tint` | `warning` at 30% | `warning-ink` | Degraded, expiring, near a limit |
| Critical | `critical-tint` | `critical` at 25% | `critical-ink` | Failing, blocked, expired |

## Sizes

One size; it fills its container. The action sits to the right of the text once the banner is 32rem (448px) wide and under it below that, by the banner's own width (a container query), so a banner in the assistant's column or a half-width card wraps on a desk too.

## States

| State | Spec |
|---|---|
| Shown | Arrives with its page |
| Dismissed | Removed; the layout closes up. The page owns how long it stays dismissed: `onDismiss` is where it records that |

## Behaviour

- Dismiss is offered only for information the person can safely ignore; a critical banner that needs action has no dismiss until it is resolved.

## Surfaces

- **Console**: at the top of the page body or of a card.
- **Mobile**: the same; the banner is under 32rem, so the action sits under the text.
- **Embed**: at the top of the view when the data it shows is affected (an incident on the service it reports).

## Agents

An agent's suggestion is not a banner; it is a Proposal. The accent banner announces agent features, never an agent's action.

## Accessibility

- Critical is `role="alert"`; the others `role="status"`.
- The tone is said by the icon and the title, not the colour alone.
- Titles in each tone's ink hold 4.5:1 on its tint in both themes (`pnpm contrast`).

## Content

- The title is the fact: "Elevated latency in eu-west-1", not "Warning".
- The body says what to do or what is being done.

## Do and do not

- Do keep one banner per view; several at once read as noise.
- Do not use a banner to confirm an action the person just took; that is a Toast.

## Implementation

```tsx
import { Banner } from '@/components/ui/banner';

<Banner tone="warning" title="Elevated latency in eu-west-1" action={<Button size="sm">View incident</Button>}>
  Traffic is shifting to eu-central-1.
</Banner>
```
