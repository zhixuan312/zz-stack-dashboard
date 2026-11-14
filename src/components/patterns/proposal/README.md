# Proposal

A proposal is a change an agent wants to make, waiting for a person: what changes (before and after), why, and what else it touches, with Approve and Dismiss. A removal is proposed with the critical tone.

Status: beta

## Anatomy

1. **Edge**: while a neutral proposal is pending or applying, the 1px `edge-lit` hairline, the accent at the top fading out down the sides, over the card's `line` border, with a faint `shadow-halo`. An open critical proposal or any failed proposal uses a plain `critical` border at 45% instead.
2. **Head**: the Agent mark at 32px, "<agent> proposes" (`t-caption`) and the title (`t-card`), what will happen as a sentence; the state tag on the right.
3. **Reason** (optional): one or two sentences with the evidence the agent used (`t-small`, `ink-2`).
4. **Changes**: a bordered list of rows: the setting (`ink-3`), the old value struck through, an arrow, the new value (500).
5. **Impact**: who or what else it touches (`t-caption`).
6. **Note**: why a closed proposal closed, such as its expiry reason (`t-small`, `ink-2`).
7. **Footer**: Dismiss (ghost) and Approve (primary; danger and "Approve and remove" in the critical tone), on `surface-sunk`.

## Composition

Agent mark, Button, on a card (`radius-lg`); while a neutral proposal waits for a person it carries the lit edge (`edge-lit`) and a faint `shadow-halo`, the system's one sign of "this needs you" besides the tag. An open critical proposal uses its critical border instead. The changes list is a Key value pattern drawn as before → after.

## Data

`title`, `tone` (`neutral` or `critical`), `reason` (optional), `changes: { label, from, to }[]`, `impact`, `note`, `onApprove` (may return a promise) and `onDismiss`. Without `state`, `onApprove` is required and the card keeps its own state; a synchronous callback is supported too. With an explicit controlled `state`, the handler is optional: the caller owns the result and may render a settled proposal without an action.

## States

| State | Tag | Border | Footer |
|---|---|---|---|
| Pending | "Needs you", `accent-ink` | the lit edge for neutral; plain `critical` at 45% in the critical tone | Dismiss, Approve |
| Applying | "Applying…" | the lit edge for neutral; plain `critical` at 45% in the critical tone | uncontrolled: both disabled, Approve busy; controlled: none |
| Applied | ✓ "Applied", `positive-ink` | `line`; title `ink-2` | none |
| Dismissed | ✕ "Dismissed", `ink-3` | `line` | none |
| Expired | ✕ "Expired", `ink-3` | `line` | none; the note says why |
| Failed | ✕ "Not applied", `critical-ink` | `critical` at 45% | uncontrolled: the error on its own line, then Dismiss and Try again; controlled: the same when the caller passes `onApprove` to run it again, none otherwise |

## Behaviour

- Approve runs the change once; while it runs, nothing can be pressed again.
- A failure changes nothing and says so; Try again runs it again.
- Applied follows a successful handler return, never the absence of a handler. An untyped uncontrolled consumer that omits `onApprove` follows the existing failure state instead of claiming a change was made.
- A removal is proposed with the critical tone: the button is danger and reads "Approve and remove".
- Controlled, a pending proposal shows buttons, and a failed one does when the caller can run it again; the caller answers the rest.

## Surfaces

- **Console** and **Mobile**: in the assistant panel, under the turn that proposed it; on phones the change rows put the label above the values.
- **Embed**: the card a tool returns when an agent wants to write.

## Agents

This is the consent rule made visible: an agent may read anything, and changes nothing without a person. Applied proposals become Activity lines with the agent and the person named.

## Accessibility

- An `article` named "Proposal from <agent>: …"; the failure message is `role="alert"`.
- The struck-through old value is also read as text; the arrow is decorative.
- Contrast (dark): reason `ink-2` 8.0:1, old value `ink-3` 6.4:1.

## Content

- The title is the change, in the imperative: "Raise the rate limit for Parallax AI".
- The reason gives the evidence with numbers, not a feeling: "hit its limit 1,284 times in the last hour".

## Do and do not

- Do show every value that changes, before and after.
- Do not auto-approve, and do not hide Dismiss.

## Implementation

```tsx
import { Proposal } from '@/components/patterns/proposal';

<Proposal
  title="Raise the rate limit for Parallax AI"
  reason="Parallax AI hit its limit 1,284 times in the last hour…"
  changes={[{ label: 'Rate limit', from: '1,200 rpm', to: '2,000 rpm' }]}
  impact="Applies to all 14 API keys of Parallax AI."
  onApprove={() => callTool('set_rate_limit', { customer: 'parallax', rpm: 2000 })}
/>
```
