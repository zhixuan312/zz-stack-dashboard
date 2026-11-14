# Detail head

A record's masthead: the way back to its list, its name or ID with its state, the facts that identify it, and its actions. It fills a PageFrame's own masthead, so a detail page keeps the one condensing head every page has.

Status: beta

## Anatomy

1. **Kicker**: an arrow and the parent list ("← Requests"), a link, in the kicker style (`t-kicker`).
2. **Name**: the record's name at page-title size, or its ID in mono at 60% of it (`mono`).
3. **State**: a Badge with a dot beside the name ("503 Unavailable", "Active").
4. **Facts**: three to five identifying facts under the name, in the lead size, separated by dots: the endpoint, the latency, the customer, when. A wrapped line never starts or ends on a dot.
5. **Actions**: a secondary "More actions" icon button (a menu, destructive items last after a separator), then the page's main actions, the primary last.

## Variants

| Variant | Use |
|---|---|
| `detailHead()` into a PageFrame | Every console detail page |
| `DetailHead` block | An embed view or a sheet, where there is no PageFrame |
| `compact` block | Inside an inline embed: a section-sized title and small facts |

## Sizes

The name is `text-page` (clamp 36 to 56px); a mono ID is 60% of it. Facts are `text-md`. Actions are `control-md`. The compact block uses `text-xl` and `text-sm`.

## States

| State | What changes |
|---|---|
| Rest | As above |
| Scrolled | The PageFrame top bar shows the name small; the facts and actions scroll away with the masthead |
| A failing record | Its state Badge is `critical`, and Replay (or the fix) becomes the primary action |

## Behaviour

- The kicker returns to the list, with the list's address (filters, page) intact when the browser keeps it.
- Menu items run on select; a destructive one asks for confirmation on its own page or in a Dialog, never from the menu alone.

## Surfaces

- **Console**: as specified.
- **Mobile**: the name wraps; facts wrap; actions take their own row under the facts, and wrap onto another where three do not fit (320px).
- **Embed**: the `compact` block, without the menu; Open in the console replaces the actions.

## Agents

The facts are the record's identity in words, which is also what the view shares with the model (`useShareView`). An agent never acts from the head; a change it wants is a Proposal.

## Composition

Badge, Icon button, Menu and Buttons, laid into PageFrame's `kicker`, `title`, `description` and `actions`.

## Accessibility

- The name is the page's `h1`; the state Badge is inside it, so it is read with the name.
- The menu trigger is named "More actions".

## Content

- Name a record by what a person calls it; fall back to its ID only when it has no name.
- Facts are values, not labels: "2.1s", not "Latency: 2.1s".

## Do and do not

- Do keep one primary action, and only when the record needs one (Replay for a failed request).
- Do not repeat in the facts what the cards below already show in full.

## Implementation

```tsx
import { detailHead } from '@/components/patterns/detail-head';

<PageFrame
  {...detailHead({
    parent: { label: 'Requests', href: '/requests' },
    name: r.id,
    mono: true,
    status: { tone: 'critical', label: '503 Unavailable' },
    facts: ['POST /v1/messages', '2.1s', 'Parallax AI', '1 h ago'],
    primary: <Button variant="primary" icon={<RotateCw />}>Replay</Button>,
    more: [{ label: 'Copy request ID', onSelect: copy }, { label: 'Block this key', tone: 'critical', onSelect: block }],
  })}
>
```
